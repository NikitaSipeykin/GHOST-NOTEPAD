const { BrowserWindow, ipcMain, screen } = require('electron');
const { getSettings, mergeSettings } = require('./storage');

let win;
let boundsSaveTimer = null;
const listeners = [];   // notified on lifecycle events ('ready' | 'move-resize' | 'show' | 'hide' | 'close' | 'focus')

function on(fn) { listeners.push(fn); }
function emit(event, ...args) { for (const fn of listeners) try { fn(event, ...args); } catch (e) {} }

// Re-assert the overlay invariants — anything that resets them
// (fullscreen, maximize on some platforms) calls this to restore.
function reassertOverlay() {
  if (!win || win.isDestroyed()) return;
  win.setContentProtection(true);                                    // screenshot invisibility
  win.setAlwaysOnTop(true, 'screen-saver');                          // top of everything
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
}

function persistWindowState() {
  if (!win || win.isDestroyed()) return;
  const state = { ...(getSettings().window || {}) };
  state.isMaximized  = win.isMaximized();
  state.isFullScreen = win.isFullScreen();
  if (!state.isMaximized && !state.isFullScreen) {
    const b = win.getBounds();
    state.x = b.x; state.y = b.y; state.width = b.width; state.height = b.height;
  }
  mergeSettings({ window: state });
}

function scheduleWindowStateSave() {
  clearTimeout(boundsSaveTimer);
  boundsSaveTimer = setTimeout(persistWindowState, 500);
}

function sendWindowState() {
  if (!win || win.isDestroyed()) return;
  win.webContents.send('window-state-changed', {
    isMaximized:  win.isMaximized(),
    isFullScreen: win.isFullScreen(),
  });
}

function pickInitialBounds() {
  const def = { width: 520, height: 640 };
  const saved = getSettings().window;
  if (!saved || typeof saved.width !== 'number' || typeof saved.height !== 'number') return def;
  const out = { width: saved.width, height: saved.height };
  if (typeof saved.x === 'number' && typeof saved.y === 'number') {
    const visible = screen.getAllDisplays().some(d => {
      const w = d.workArea;
      return saved.x < w.x + w.width && saved.x + 100 > w.x &&
             saved.y < w.y + w.height && saved.y + 40 > w.y;
    });
    if (visible) { out.x = saved.x; out.y = saved.y; }
  }
  return out;
}

function create() {
  win = new BrowserWindow({
    ...pickInitialBounds(),
    minWidth: 320,
    minHeight: 240,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    hasShadow: false,
    skipTaskbar: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile('index.html');
  win.setContentProtection(true);
  win.setIgnoreMouseEvents(false);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, 'screen-saver');

  win.webContents.once('did-finish-load', () => {
    const s = getSettings().window;
    if (s && s.isFullScreen)    win.setFullScreen(true);
    else if (s && s.isMaximized) win.maximize();
    reassertOverlay();
    sendWindowState();
    emit('ready');
  });

  const onMove = () => { scheduleWindowStateSave(); emit('move-resize'); };
  win.on('resize', onMove);
  win.on('move',   onMove);
  win.on('maximize',          () => { sendWindowState(); scheduleWindowStateSave(); emit('move-resize'); });
  win.on('unmaximize',        () => { sendWindowState(); scheduleWindowStateSave(); emit('move-resize'); });
  win.on('enter-full-screen', () => { reassertOverlay(); sendWindowState(); scheduleWindowStateSave(); emit('move-resize'); });
  win.on('leave-full-screen', () => { reassertOverlay(); sendWindowState(); scheduleWindowStateSave(); emit('move-resize'); });
  win.on('show',     () => emit('show'));
  win.on('hide',     () => emit('hide'));
  win.on('minimize', () => emit('hide'));
  win.on('restore',  () => emit('show'));
  win.on('focus',    () => emit('focus'));
  win.on('close',    () => { persistWindowState(); emit('close'); });
  return win;
}

function get() { return win; }
function sendToRenderer(channel, ...args) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, ...args);
}
function setIgnoreMouseEvents(ignore, opts) {
  if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(ignore, opts);
}
function toggleVisibility() {
  if (!win || win.isDestroyed()) return;
  if (win.isVisible()) win.hide();
  else { win.show(); win.focus(); }
}

function registerIpc() {
  ipcMain.on('win:minimize', () => { if (win && !win.isDestroyed()) win.minimize(); });
  ipcMain.on('win:toggle-maximize', () => {
    if (!win || win.isDestroyed()) return;
    if (win.isFullScreen()) { win.setFullScreen(false); return; }
    win.isMaximized() ? win.unmaximize() : win.maximize();
  });
  ipcMain.on('win:toggle-fullscreen', () => {
    if (!win || win.isDestroyed()) return;
    win.setFullScreen(!win.isFullScreen());
  });
  ipcMain.on('win:close', () => { if (win && !win.isDestroyed()) win.close(); });
}

module.exports = {
  create, get, on, registerIpc,
  sendToRenderer, setIgnoreMouseEvents, toggleVisibility,
};
