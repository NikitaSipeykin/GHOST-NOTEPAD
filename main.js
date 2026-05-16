const { app, globalShortcut } = require('electron');
const storage      = require('./src/main/storage');
const mainWindow   = require('./src/main/main-window');
const sliderWindow = require('./src/main/slider-window');

let isClickThrough = false;

storage.registerIpc();
mainWindow.registerIpc();
sliderWindow.registerIpc();

app.whenReady().then(() => {
  mainWindow.create();

  const mod = process.platform === 'darwin' ? 'Command' : 'Control';

  // Click-through toggle
  globalShortcut.register(`${mod}+Shift+T`, () => {
    isClickThrough = !isClickThrough;
    mainWindow.setIgnoreMouseEvents(isClickThrough, { forward: true });
    mainWindow.sendToRenderer('click-through-changed', isClickThrough);
    if (isClickThrough) sliderWindow.hide();
  });

  // Hide / show the main window (slider follows)
  globalShortcut.register(`${mod}+Shift+H`, () => mainWindow.toggleVisibility());
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
