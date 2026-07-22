/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 */

import path from 'path';
import { app, BrowserWindow, shell, systemPreferences } from 'electron';
import MenuBuilder from '@/main/menu';

if (process.platform === 'darwin') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { initMain } = require('electron-audio-loopback');
    initMain(app);
  } catch {
    // electron-audio-loopback unavailable in this environment
  }
}
import {
  getAssetPath,
  isDebug,
  preloadPath,
  resolveHtmlPath,
} from '@/main/util';
import createTray from '@/main/models/tray';
import { rendererDebuggerConfig } from '@/main/models/debugger';
import {
  createNotificationWindow,
  closeNotificationWindow,
} from '@/main/notification-window';
import { initializeStore } from '@/main/store';
import { registerIpcHandlers } from '@/main/ipc';
import { meetingDetector } from '@/main/services/meeting-detector';
import transcriberService from '@/main/services/transcriber';
import { CHANNELS } from '@/lib/ipc-channels';
import { log } from 'electron-log';
import {
  PermissionsService,
  OsPermissionProbe,
} from '@/main/services/permissions';
import {
  setMainWindow,
  getMainWindow,
  initializeShortcutManager,
  getShortcutManager,
} from '@/main/state/volatile';
import { initCommands } from '@/main/commands/registry';

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

if (isDebug && process.env.E2E_TEST !== 'true') {
  rendererDebuggerConfig();
}

// Prevent WebRTC from switching macOS to communication audio mode
app.commandLine.appendSwitch('disable-features', 'MediaSessionService');

const createWindow = async () => {
  const isPackaged = app.isPackaged || process.env.E2E_TEST === 'true';

  const window = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: preloadPath,
      sandbox: isPackaged,
      webSecurity: isPackaged,
      devTools: true,
    },
  });

  setMainWindow(window);
  const mainWindow = window;

  const indexHtmlPath = resolveHtmlPath('index.html');
  mainWindow.loadURL(indexHtmlPath);

  mainWindow.on('ready-to-show', () => {
    const mw = getMainWindow();
    if (!mw) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mw.minimize();
    } else {
      mw.show();
    }

    if (
      (isPackaged || process.env.DEBUG_PROD === 'true') &&
      process.env.E2E_TEST !== 'true'
    ) {
      mw.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.on('closed', () => {
    setMainWindow(null);
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });
};

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
/*
  First call — await createWindow() on line 116: Launches the app window when Electron is ready. Runs exactly once at startup.

  Second call — inside app.on('activate', ...) on line 124-128: This only fires on macOS, when the user clicks the app's Dock icon while no windows are open (e.g. after closing
   the main window). The if (mainWindow === null) guard ensures it only creates a new window if one doesn't exist. This is standard Electron macOS behavior — on macOS apps
  typically don't quit when you close the last window.
*/
app
  .whenReady()
  .then(async () => {
    await initializeStore();
    // On macOS, the icon property in BrowserWindow is ignored for the dock — it only affects Windows (taskbar) and Linux. The dock icon on macOS must be set explicitly via app.dock.setIcon().
    if (process.platform === 'darwin') {
      app.dock.setIcon(getAssetPath('icons/64x64.png'));
    }

    const electronProbe: OsPermissionProbe = {
      getMicrophoneStatus: () =>
        systemPreferences.getMediaAccessStatus('microphone'),
      getScreenRecordingStatus: () =>
        systemPreferences.getMediaAccessStatus('screen'),
      isAccessibilityGranted: () =>
        systemPreferences.isTrustedAccessibilityClient(false),
    };

    const permissionsService = new PermissionsService(electronProbe);
    permissionsService.refresh();
    initializeShortcutManager();
    await createWindow();
    createNotificationWindow();
    initCommands();

    // Fire-and-forget: warm the currently-selected model so it's already
    // loaded by the time the first recording starts, instead of loading
    // lazily on the first transcribe() call. Must not be awaited here —
    // window creation, tray, shortcuts, and IPC registration below must
    // proceed immediately regardless of how long the model takes to load.
    transcriberService
      .preloadCurrentModel((data) => {
        getMainWindow()?.webContents.send(CHANNELS.TRANSCRIBER.PROGRESS, data);
      })
      .then((result) => {
        if (!result.success) {
          log('[main] Eager model preload failed:', result.message);
          getMainWindow()?.webContents.send(
            CHANNELS.TRANSCRIBER.ERROR,
            result.message,
          );
        }
      })
      .catch((err) => log('[main] Eager model preload threw:', err));

    const mainWindow = getMainWindow();
    if (mainWindow) {
      createTray(mainWindow);
    }
    getShortcutManager().setupDefaultShortcuts();
    meetingDetector.start();

    registerIpcHandlers({ permissionsService });

    app.on('activate', () => {
      if (getMainWindow() === null) {
        createWindow();
      }
    });
  })
  .catch(console.log);

app.on('will-quit', () => {
  getShortcutManager().unregisterAll();
  closeNotificationWindow();
  meetingDetector.stop();
});
