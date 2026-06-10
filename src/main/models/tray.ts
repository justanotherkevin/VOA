import { app, BrowserWindow, Tray, nativeImage, NativeImage, Menu } from 'electron';
import { getAssetPath } from '../util';

const FRAME_COUNT = 7;
const ANIMATION_INTERVAL_MS = 150;

let tray: Tray | null = null;
let animationInterval: NodeJS.Timeout | null = null;
let frameImages: NativeImage[] = [];
let staticIcon: NativeImage | null = null;

export default function createTray(mainWindow: BrowserWindow) {
  staticIcon = nativeImage.createFromPath(getAssetPath('icons', 'icon.png')).resize({ width: 16, height: 16 });
  for (let i = 1; i <= FRAME_COUNT; i++) {
    frameImages.push(nativeImage.createFromPath(getAssetPath('icons', `tray-frame-${i}.png`)));
  }

  tray = new Tray(staticIcon);
  tray.setToolTip('Audio Transformer');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => mainWindow?.show() },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setContextMenu(contextMenu);
}

export function startTrayAnimation() {
  if (!tray || animationInterval || !frameImages.length) return;
  let frame = 0;
  animationInterval = setInterval(() => {
    tray!.setImage(frameImages[frame % frameImages.length]);
    frame++;
  }, ANIMATION_INTERVAL_MS);
}

export function stopTrayAnimation() {
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = null;
  }
  if (tray && staticIcon) {
    tray.setImage(staticIcon);
  }
}
