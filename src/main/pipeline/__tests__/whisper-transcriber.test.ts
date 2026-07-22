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

async function importFreshTranscriber(): Promise<any> {
  vi.resetModules();
  const mod = await import('../whisper-transcriber');
  return mod.default;
}

describe('WhisperTranscriber (utilityProcess proxy + queue)', () => {
  let transcriber: any;
  let children: FakeChild[];

  beforeEach(async () => {
    children = [];
    transcriber = await importFreshTranscriber();
    transcriber._processFactory = vi.fn(() => {
      const child = new FakeChild();
      children.push(child);
      return child as any;
    });
  });

  it('initializes by posting an initialize message and resolving on "initialized"', async () => {
    const initPromise = transcriber.initialize('Xenova/whisper-tiny', true);

    expect(children).toHaveLength(1);
    const [child] = children;
    expect(child.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'initialize',
        model: 'Xenova/whisper-tiny',
        quantized: true,
      }),
    );

    const sentMessage = child.postMessage.mock.calls[0][0];
    child.emit('message', { id: sentMessage.id, type: 'initialized' });

    await expect(initPromise).resolves.toBeUndefined();
    expect(transcriber.getModelInfo()).toEqual({
      model: 'Xenova/whisper-tiny',
      quantized: true,
      isInitialized: true,
    });
  });

  it('serializes transcribe() calls — never posts a second job before the first resolves', async () => {
    const initPromise = transcriber.initialize('Xenova/whisper-tiny', true);
    const [child] = children;
    const initMsg = child.postMessage.mock.calls[0][0];
    child.emit('message', { id: initMsg.id, type: 'initialized' });
    await initPromise;

    const audio = new Float32Array([0.1, 0.2]);
    const first = transcriber.transcribe(audio, 'transcribe');
    const second = transcriber.transcribe(audio, 'transcribe');

    // Only the first job should have been posted so far.
    expect(child.postMessage).toHaveBeenCalledTimes(2); // 1 init + 1 transcribe
    const firstTranscribeMsg = child.postMessage.mock.calls[1][0];
    expect(firstTranscribeMsg.type).toBe('transcribe');

    // Resolve the first job — only now should the second be dispatched.
    child.emit('message', {
      id: firstTranscribeMsg.id,
      type: 'result',
      chunks: [],
      duration_in_seconds: 1,
    });
    await first;

    expect(child.postMessage).toHaveBeenCalledTimes(3); // + second transcribe
    const secondTranscribeMsg = child.postMessage.mock.calls[2][0];
    expect(secondTranscribeMsg.id).not.toBe(firstTranscribeMsg.id);

    child.emit('message', {
      id: secondTranscribeMsg.id,
      type: 'result',
      chunks: [],
      duration_in_seconds: 1,
    });
    await second;
  });

  it('exposes queue depth while jobs are pending', async () => {
    const initPromise = transcriber.initialize('Xenova/whisper-tiny', true);
    const [child] = children;
    const initMsg = child.postMessage.mock.calls[0][0];
    child.emit('message', { id: initMsg.id, type: 'initialized' });
    await initPromise;

    expect(transcriber.getQueueDepth()).toBe(0);

    const audio = new Float32Array([0.1]);
    const first = transcriber.transcribe(audio, 'transcribe');
    transcriber.transcribe(audio, 'transcribe');

    expect(transcriber.getQueueDepth()).toBe(2); // 1 in flight + 1 queued

    const firstMsg = child.postMessage.mock.calls[1][0];
    child.emit('message', {
      id: firstMsg.id,
      type: 'result',
      chunks: [],
      duration_in_seconds: 1,
    });
    await first;

    expect(transcriber.getQueueDepth()).toBe(1); // second now in flight
  });

  it('kills and respawns the child when the model identity changes', async () => {
    const firstInit = transcriber.initialize('Xenova/whisper-tiny', true);
    const [firstChild] = children;
    const firstMsg = firstChild.postMessage.mock.calls[0][0];
    firstChild.emit('message', { id: firstMsg.id, type: 'initialized' });
    await firstInit;

    const secondInit = transcriber.initialize('Xenova/whisper-base', true);
    expect(firstChild.kill).toHaveBeenCalled();
    expect(children).toHaveLength(2);

    const secondChild = children[1];
    const secondMsg = secondChild.postMessage.mock.calls[0][0];
    secondChild.emit('message', { id: secondMsg.id, type: 'initialized' });
    await secondInit;

    expect(transcriber.getModelInfo().model).toBe('Xenova/whisper-base');
  });

  it('skips reloading the model when initialize() is called again with the same model/quantized — proving eager preload avoids redundant work', async () => {
    // Simulates the app-startup eager preload: the first initialize() call
    // actually loads the model.
    const preloadInit = transcriber.initialize('Xenova/whisper-tiny', true);
    const [child] = children;
    const preloadMsg = child.postMessage.mock.calls[0][0];
    child.emit('message', { id: preloadMsg.id, type: 'initialized' });
    await preloadInit;

    expect(child.postMessage).toHaveBeenCalledTimes(1);

    // Simulates what happens inside TranscriberService.transcribe() when a
    // real recording segment comes in later in the same session — it always
    // calls initialize() defensively with the current preferences' model.
    const recordingInit = transcriber.initialize('Xenova/whisper-tiny', true);
    await recordingInit;

    // No second 'initialize' message posted to the child, and no second
    // child spawned — the preload's work wasn't redone.
    expect(child.postMessage).toHaveBeenCalledTimes(1);
    expect(children).toHaveLength(1);
  });

  it('rejects queued and in-flight jobs when the child crashes', async () => {
    const initPromise = transcriber.initialize('Xenova/whisper-tiny', true);
    const [child] = children;
    const initMsg = child.postMessage.mock.calls[0][0];
    child.emit('message', { id: initMsg.id, type: 'initialized' });
    await initPromise;

    const audio = new Float32Array([0.1]);
    const first = transcriber.transcribe(audio, 'transcribe');
    const second = transcriber.transcribe(audio, 'transcribe');

    // Simulate a native crash — child exits with a non-zero code, not via
    // our own kill() (which always exits 0).
    child.emit('exit', 1);

    await expect(first).rejects.toThrow(/exited unexpectedly/);
    await expect(second).rejects.toThrow(/exited unexpectedly/);
    expect(transcriber.getModelInfo().isInitialized).toBe(false);
  });

  it('rejects transcribe() calls made before initialize()', async () => {
    await expect(
      transcriber.transcribe(new Float32Array([0.1]), 'transcribe'),
    ).rejects.toThrow(/not initialized/);
  });
});
