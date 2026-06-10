import { app } from 'electron';

export const rendererDebuggerConfig = () => {
  require('electron-debug').default();
  let port = '9223';
  if (process.env.MAIN_ARGS) {
    port = (
      [...process.env.MAIN_ARGS.matchAll(/"[^"]+"|[^\s"]+/g)]
        .flat()
        .filter((str) => str.includes('debugging-port'))[0] || '=9223'
    ).split('=')[1];
  }
  app.commandLine.appendSwitch('remote-debugging-port', port);
};
