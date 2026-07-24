import { vi } from 'vitest';
import transcriberService from '../../services/transcriber';
import type { TranscriberCallbacks } from '../../services/transcriber';

// Shared across transcriber-integration.test.ts and transcriberService.test.ts,
// both of which drive the same TranscriberService singleton and previously
// duplicated this object verbatim.
export function createTranscriberCallbacks(): TranscriberCallbacks {
  return {
    onUpdate: vi.fn(),
    onProgress: vi.fn(),
    onComplete: vi.fn(),
    onError: vi.fn(),
    onMeetingSaved: vi.fn(),
  };
}

// Resets TranscriberService's private session state directly, bypassing the
// side effects beginSession()/endSession() would normally trigger (meeting
// detection, tray animation, persistence) — needed between tests since the
// service is a singleton shared across the whole file.
export function resetTranscriberSessionState(): void {
  const svc = transcriberService as any;
  svc.sessionActive = false;
  svc.sessionIsMeeting = false;
  svc.lastSavedMeetingId = null;
  svc.lastSessionMeta = null;
  svc.sessionSegments = [];
  svc.sessionChunks = [];
  svc.sessionSources = new Set();
  svc.sessionStartedAt = null;
  svc.pasteOnComplete = false;
}

// Silent audio buffer in the plain-array format TranscribeArgs accepts,
// sized to match the app's 16kHz sample rate.
export function createSilentAudio(samples = 16000): number[] {
  return Array.from(new Float32Array(samples));
}
