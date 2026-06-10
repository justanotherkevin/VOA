import type { PermissionsService } from '@/main/services/permissions';
import { registerTranscriberHandlers } from './transcriber';
import { registerSettingsHandlers } from './settings';
import { registerNotificationHandlers } from './notifications';
import { registerMeetingsHandlers } from './meetings';
import { registerShortcutHandlers } from './shortcuts';
import { registerPermissionsHandlers } from './permissions';
import { registerMeetingDetectorHandlers } from './meeting-detector';

export function registerIpcHandlers(deps: { permissionsService: PermissionsService }): void {
  registerTranscriberHandlers();
  registerSettingsHandlers();
  registerNotificationHandlers();
  registerMeetingsHandlers();
  registerShortcutHandlers();
  registerPermissionsHandlers(deps.permissionsService);
  registerMeetingDetectorHandlers();
}
