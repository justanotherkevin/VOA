/* eslint import/prefer-default-export: off */
import { URL } from 'url';
import path from 'path';
import { app, clipboard } from 'electron';
import { exec } from 'child_process';

const RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '../../assets');

export function resolveHtmlPath(htmlFileName: string) {
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.VITE_DEV_SERVER_PORT || 5173;
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  }

  return `file://${path.resolve(__dirname, '../renderer/', htmlFileName)}`;
}

export const getAssetPath = (...paths: string[]): string => {
  return path.join(RESOURCES_PATH, ...paths);
};

export const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

export function shouldPasteText(): boolean {
  // Skip pasting in test environments
  console.log('check shouldPasteText');
  if (process.env.NODE_ENV === 'test') return false;
  if (process.env.PLAYWRIGHT_TEST === 'true') return false;
  if (process.env.CI === 'true') return false;
  return true;
}

// copy and paste text
export function pasteTextToActiveWindow(text: string) {
  try {
    clipboard.writeText(text);

    if (process.platform === 'darwin') {
      exec(
        'osascript -e \'tell application "System Events" to keystroke "v" using command down\'',
        (error) => {
          if (error) {
            console.error('Failed to paste text via AppleScript:', error);
          }
        },
      );
    }
  } catch (pasteError) {
    console.error('Failed to auto-paste text:', pasteError);
  }
}

export const preloadPath = path.join(__dirname, '../preload/preload.js');
