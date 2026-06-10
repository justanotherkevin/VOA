import { vi } from 'vitest';

// Minimal MediaRecorder mock used by Recording.tsx
export default class MockMediaRecorder {
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  mimeType: string | undefined;
  stream: MediaStream;
  private dataHandlers: ((ev: any) => void)[] = [];
  private stopHandlers: ((ev: any) => void)[] = [];

  static isTypeSupported = vi.fn(() => true);

  constructor(stream: MediaStream, options?: { mimeType?: string }) {
    this.stream = stream;
    this.mimeType = options?.mimeType;
  }

  start() {
    this.state = 'recording';
    // no-op: tests simulate stopping later
  }

  stop() {
    // Mark inactive first so listeners that check recorder.state see 'inactive'
    this.state = 'inactive';

    // emulate finalizing: create a blob and fire dataavailable events
    const blob = new Blob(['fake-audio'], {
      type: this.mimeType || 'audio/webm',
    });

    // dataavailable events include the mimeType for callers that inspect it
    this.dataHandlers.forEach((h) => h({ data: blob, type: this.mimeType }));

    // fire stop handlers (if any)
    this.stopHandlers.forEach((h) => h({}));
  }

  addEventListener(ev: string, cb: (e: any) => void) {
    if (ev === 'dataavailable') this.dataHandlers.push(cb);
    if (ev === 'stop') this.stopHandlers.push(cb);
  }

  removeEventListener(ev: string, cb: (e: any) => void) {
    if (ev === 'dataavailable')
      this.dataHandlers = this.dataHandlers.filter((h) => h !== cb);
    if (ev === 'stop')
      this.stopHandlers = this.stopHandlers.filter((h) => h !== cb);
  }
}
