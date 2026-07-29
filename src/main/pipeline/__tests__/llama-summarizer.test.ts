import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';

// Fake utilityProcess.fork() target: an EventEmitter standing in for the
// real UtilityProcess, so tests never actually spawn a child process.
class FakeChild extends EventEmitter {
  postMessage = vi.fn();
  kill = vi.fn(() => {
    // Real utilityProcess emits 'exit' with code 0 on a deliberate kill.
    this.emit('exit', 0);
  });
}

async function importFreshSummarizer(): Promise<any> {
  vi.resetModules();
  const mod = await import('../llama-summarizer');
  return mod.default;
}

describe('LlamaSummarizer (utilityProcess proxy + queue)', () => {
  let summarizer: any;
  let children: FakeChild[];

  beforeEach(async () => {
    children = [];
    summarizer = await importFreshSummarizer();
    summarizer._processFactory = vi.fn(() => {
      const child = new FakeChild();
      children.push(child);
      return child as any;
    });
  });

  it('initializes by posting an initialize message and resolving on "initialized"', async () => {
    const initPromise = summarizer.initialize('/models/qwen.gguf');

    expect(children).toHaveLength(1);
    const [child] = children;
    expect(child.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'initialize',
        modelPath: '/models/qwen.gguf',
      }),
    );

    const sentMessage = child.postMessage.mock.calls[0][0];
    child.emit('message', { id: sentMessage.id, type: 'initialized' });

    await expect(initPromise).resolves.toBeUndefined();
    expect(summarizer.getModelInfo()).toEqual({
      modelPath: '/models/qwen.gguf',
      isInitialized: true,
    });
  });

  it('skips reloading the model when initialize() is called again with the same modelPath', async () => {
    const preloadInit = summarizer.initialize('/models/qwen.gguf');
    const [child] = children;
    const preloadMsg = child.postMessage.mock.calls[0][0];
    child.emit('message', { id: preloadMsg.id, type: 'initialized' });
    await preloadInit;

    expect(child.postMessage).toHaveBeenCalledTimes(1);

    const secondInit = summarizer.initialize('/models/qwen.gguf');
    await secondInit;

    expect(child.postMessage).toHaveBeenCalledTimes(1);
    expect(children).toHaveLength(1);
  });

  it('kills and respawns the child when the model path changes', async () => {
    const firstInit = summarizer.initialize('/models/qwen.gguf');
    const [firstChild] = children;
    const firstMsg = firstChild.postMessage.mock.calls[0][0];
    firstChild.emit('message', { id: firstMsg.id, type: 'initialized' });
    await firstInit;

    const secondInit = summarizer.initialize('/models/other.gguf');
    expect(firstChild.kill).toHaveBeenCalled();
    expect(children).toHaveLength(2);

    const secondChild = children[1];
    const secondMsg = secondChild.postMessage.mock.calls[0][0];
    secondChild.emit('message', { id: secondMsg.id, type: 'initialized' });
    await secondInit;

    expect(summarizer.getModelInfo().modelPath).toBe('/models/other.gguf');
  });

  it('serializes generate() calls — never posts a second job before the first resolves', async () => {
    const initPromise = summarizer.initialize('/models/qwen.gguf');
    const [child] = children;
    const initMsg = child.postMessage.mock.calls[0][0];
    child.emit('message', { id: initMsg.id, type: 'initialized' });
    await initPromise;

    const first = summarizer.generate('prompt one');
    const second = summarizer.generate('prompt two');

    expect(child.postMessage).toHaveBeenCalledTimes(2); // 1 init + 1 summarize
    const firstMsg = child.postMessage.mock.calls[1][0];
    expect(firstMsg.type).toBe('summarize');

    child.emit('message', {
      id: firstMsg.id,
      type: 'result',
      text: 'result one',
    });
    await expect(first).resolves.toBe('result one');

    expect(child.postMessage).toHaveBeenCalledTimes(3);
    const secondMsg = child.postMessage.mock.calls[2][0];
    expect(secondMsg.id).not.toBe(firstMsg.id);

    child.emit('message', {
      id: secondMsg.id,
      type: 'result',
      text: 'result two',
    });
    await expect(second).resolves.toBe('result two');
  });

  it('exposes queue depth while jobs are pending', async () => {
    const initPromise = summarizer.initialize('/models/qwen.gguf');
    const [child] = children;
    const initMsg = child.postMessage.mock.calls[0][0];
    child.emit('message', { id: initMsg.id, type: 'initialized' });
    await initPromise;

    expect(summarizer.getQueueDepth()).toBe(0);

    const first = summarizer.generate('a');
    summarizer.generate('b');

    expect(summarizer.getQueueDepth()).toBe(2); // 1 in flight + 1 queued

    const firstMsg = child.postMessage.mock.calls[1][0];
    child.emit('message', {
      id: firstMsg.id,
      type: 'result',
      text: 'a-result',
    });
    await first;

    expect(summarizer.getQueueDepth()).toBe(1); // second now in flight
  });

  it('rejects queued and in-flight jobs when the child crashes', async () => {
    const initPromise = summarizer.initialize('/models/qwen.gguf');
    const [child] = children;
    const initMsg = child.postMessage.mock.calls[0][0];
    child.emit('message', { id: initMsg.id, type: 'initialized' });
    await initPromise;

    const first = summarizer.generate('a');
    const second = summarizer.generate('b');

    // Simulate a native crash — child exits with a non-zero code, not via
    // our own kill() (which always exits 0).
    child.emit('exit', 1);

    await expect(first).rejects.toThrow(/exited unexpectedly/);
    await expect(second).rejects.toThrow(/exited unexpectedly/);
    expect(summarizer.getModelInfo().isInitialized).toBe(false);
  });

  it('rejects generate() calls made before initialize()', async () => {
    await expect(summarizer.generate('a')).rejects.toThrow(/not initialized/);
  });
});
