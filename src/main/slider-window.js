// Separate floating window that hosts the vertical transparency slider.
// Lives to the right of the main window, follows it around, and proxies
// opacity changes between the user and the main renderer.

const { BrowserWindow, ipcMain } = require('electron');
const mainWindow = require('./main-window');

const W = 44;     // slider window width
const H = 230;    // slider window height
const GAP = 8;    // gap to main window's right edge

let slider = null;
let pendingOpacity = null;   // last value the main renderer pushed before slider was created

function position() {
  if (!slider || slider.isDestroyed()) return;
  const m = mainWindow.get();
  if (!m || m.isDestroyed()) return;
  const b = m.getBounds();
  slider.setBounds({
    x: b.x + b.width + GAP,
    y: b.y + Math.max(0, Math.floor((b.height - H) / 2)),
    width: W,
    height: H,
  });
}

function ensure() {
  if (slider && !slider.isDestroyed()) return slider;
  slider = new BrowserWindow({
    width: W,
    height: H,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    focusable: true,
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  slider.loadFile('slider.html');
  slider.setContentProtection(true);
  slider.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  slider.setAlwaysOnTop(true, 'screen-saver');
  // Closing the slider window simply hides the UI affordance — don't quit the app.
  slider.on('closed', () => { slider = null; });
  // Hide when focus leaves it (mirrors the old in-window panel behaviour).
  slider.on('blur', () => {
    if (slider && !slider.isDestroyed() && slider.isVisible()) slider.hide();
  });
  slider.webContents.once('did-finish-load', () => {
    if (pendingOpacity != null) slider.webContents.send('slider:set', pendingOpacity);
  });
  position();
  return slider;
}

function show(opacity) {
  ensure();
  if (typeof opacity === 'number') {
    pendingOpacity = opacity;
    if (slider.webContents.isLoading()) {
      // value will be flushed in did-finish-load
    } else {
      slider.webContents.send('slider:set', opacity);
    }
  }
  position();
  slider.show();
  slider.focus();
}

function hide() {
  if (slider && !slider.isDestroyed() && slider.isVisible()) slider.hide();
}

function toggle(opacity) {
  if (slider && !slider.isDestroyed() && slider.isVisible()) hide();
  else show(opacity);
}

function destroy() {
  if (slider && !slider.isDestroyed()) slider.destroy();
  slider = null;
}

// React to main window lifecycle
mainWindow.on((event) => {
  if (event === 'move-resize') position();
  else if (event === 'hide')   hide();
  else if (event === 'close')  destroy();
});

function registerIpc() {
  ipcMain.on('slider:toggle', (_, opacity) => toggle(opacity));
  ipcMain.on('slider:show',   (_, opacity) => show(opacity));
  ipcMain.on('slider:hide',   () => hide());

  // Slider window pushes opacity to the main renderer.
  ipcMain.on('slider:opacity-changed', (_, pct) => {
    pendingOpacity = pct;
    mainWindow.sendToRenderer('slider:opacity', pct);
  });

  // Main renderer can push the canonical value (e.g. preset applied) to the slider.
  ipcMain.on('slider:sync', (_, pct) => {
    pendingOpacity = pct;
    if (slider && !slider.isDestroyed()) slider.webContents.send('slider:set', pct);
  });
}

module.exports = { registerIpc, show, hide, toggle, destroy };
