import type { PermissionsService } from '@/main/services/permissions';
import { registerTranscriberHandlers } from './transcriber';
import { registerTranscriberE2eHandlers } from './transcriber.e2e';
import { registerSettingsHandlers } from './settings';
import { registerNotificationHandlers } from './notifications';
import { registerMeetingsHandlers } from './meetings';
import { registerShortcutHandlers } from './shortcuts';
import { registerPermissionsHandlers } from './permissions';
import { registerMeetingDetectorHandlers } from './meeting-detector';

export function registerIpcHandlers(deps: {
  permissionsService: PermissionsService;
}): void {
  registerTranscriberHandlers();
  if (process.env.E2E_TEST === 'true') {
    registerTranscriberE2eHandlers();
  }
  registerSettingsHandlers();
  registerNotificationHandlers();
  registerMeetingsHandlers();
  registerShortcutHandlers();
  registerPermissionsHandlers(deps.permissionsService);
  registerMeetingDetectorHandlers();
}
