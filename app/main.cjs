// Casca Electron: sobe o servidor local e mostra a interface numa janela.
const { app, BrowserWindow, shell } = require('electron');

let win = null, server = null;
async function createWindow() {
  server ??= await import('./server.mjs');
  const port = await server.start(0);
  win = new BrowserWindow({ width: 1320, height: 860, minWidth: 720, minHeight: 520, backgroundColor: '#14161a', title: 'HD500 Editor', icon: require('path').join(__dirname, '..', 'build', 'icon.png'), autoHideMenuBar: true });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  await win.loadURL(`http://127.0.0.1:${port}/`);
}
const lock = app.requestSingleInstanceLock(); // dois editores disputariam o mesmo USB
if (!lock) app.quit();
else {
  app.on('second-instance', () => win && (win.isMinimized() && win.restore(), win.focus()));
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => app.quit());
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => app.quit());
  let closing = false;
  app.on('before-quit', async e => { // devolve o pedal ao driver antes de sair
    if (closing || !server) return;
    e.preventDefault(); closing = true;
    await server.stop();
    // o libusb nativo derruba o Electron (SIGTRAP) na finalização normal; com o pedal já devolvido ao driver, encerra direto
    process.kill(process.pid, 'SIGKILL');
  });
}
