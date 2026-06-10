import { getMainWindow } from '@/main/state/volatile';
import { CHANNELS } from '@/lib/ipc-channels';

type CommandId = 'recording.toggle' | 'window.show' | 'window.hide';

type CommandFn = () => void;

const registry = new Map<CommandId, CommandFn>();

function register(id: CommandId, fn: CommandFn): void {
  registry.set(id, fn);
}

export function executeCommand(id: CommandId): void {
  const fn = registry.get(id);
  if (!fn) throw new Error(`Unknown command: ${id}`);
  fn();
}

export function initCommands(): void {
  register('recording.toggle', () => {
    getMainWindow()?.webContents.send(CHANNELS.RECORDING.TOGGLE);
  });

  register('window.show', () => {
    getMainWindow()?.show();
  });

  register('window.hide', () => {
    getMainWindow()?.hide();
  });
}
