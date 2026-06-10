import { EventEmitter } from 'events';

export interface PermissionsState {
  microphone: string;
  accessibility: boolean;
  screenRecording: string;
  keyboardShortcut: boolean;
}

export interface PermissionsServiceEvents {
  change: (current: PermissionsState, previous: PermissionsState) => void;
}

export interface OsPermissionProbe {
  getMicrophoneStatus(): string;
  getScreenRecordingStatus(): string;
  isAccessibilityGranted(): boolean;
}

class PermissionsService extends EventEmitter {
  private _state: PermissionsState = {
    microphone: 'not-determined',
    accessibility: false,
    screenRecording: 'not-determined',
    keyboardShortcut: true,
  };

  constructor(private probe: OsPermissionProbe) {
    super();
  }

  get state(): Readonly<PermissionsState> {
    return this._state;
  }

  refresh(): PermissionsState {
    const previous = this._state;
    const next: PermissionsState = {
      microphone: this.probe.getMicrophoneStatus(),
      accessibility: this.probe.isAccessibilityGranted(),
      screenRecording: this.probe.getScreenRecordingStatus(),
      keyboardShortcut: true,
    };

    const changed =
      previous.microphone !== next.microphone ||
      previous.accessibility !== next.accessibility ||
      previous.screenRecording !== next.screenRecording;

    this._state = next;

    if (changed) {
      this.emit('change', next, previous);
    }

    return this._state;
  }

  on(event: 'change', listener: PermissionsServiceEvents['change']): this;
  on(event: string, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener);
  }

  isScreenRecordingGranted(): boolean {
    return this._state.screenRecording === 'granted';
  }

  isMicrophoneGranted(): boolean {
    return this._state.microphone === 'granted';
  }

  isAccessibilityGranted(): boolean {
    return this._state.accessibility;
  }
}

export { PermissionsService };
