const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

// ── Persistence paths (в папке приложения) ───────────────────────────────────
const NOTES_PATH    = path.join(app.getPath('userData'), 'ghostpad-notes.json');
const SETTINGS_PATH = path.join(app.getPath('userData'), 'ghostpad-settings.json');

// ── Notes ────────────────────────────────────────────────────────────────────
// Backward compatible: old format was a plain array of notes. New format is
// { notes: [...], folders: [...] }. Reading still accepts the legacy array.
function loadNotes() {
  try {
    if (fs.existsSync(NOTES_PATH)) {
      const data = JSON.parse(fs.readFileSync(NOTES_PATH, 'utf-8'));
      if (Array.isArray(data)) return { notes: data, folders: [] };
      return { notes: data.notes || [], folders: data.folders || [] };
    }
  } catch (e) {}
  return null;
}

function saveNotes(payload) {
  try {
    const data = Array.isArray(payload)
      ? { notes: payload, folders: [] }
      : { notes: payload.notes || [], folders: payload.folders || [] };
    fs.writeFileSync(NOTES_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

ipcMain.handle('notes:load', () => loadNotes());
ipcMain.handle('notes:save', (_, payload) => saveNotes(payload));

// ── Settings (transparency / theme / window state / folder tree state) ───────
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
    }
  } catch (e) {}
  return null;
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings || {}, null, 2), 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

let settingsCache = loadSettings() || {};

ipcMain.handle('settings:load', () => settingsCache);
ipcMain.handle('settings:save', (_, settings) => {
  // Merge so the renderer's saves never clobber window state owned by main.
  settingsCache = { ...settingsCache, ...(settings || {}) };
  return saveSettings(settingsCache);
});

let win;
let isClickThrough = false;
let saveBoundsTimer = null;

// Re-assert the overlay invariants — kept in one place so any window state
// change (maximize / fullscreen / restore) can safely call it.
function reassertOverlay() {
  if (!win || win.isDestroyed()) return;
  win.setContentProtection(true);                                  // screenshot invisibility
  win.setAlwaysOnTop(true, 'screen-saver');                        // stay above everything
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
}

function persistWindowState() {
  if (!win || win.isDestroyed()) return;
  const state = settingsCache.window || {};
  state.isMaximized  = win.isMaximized();
  state.isFullScreen = win.isFullScreen();
  if (!state.isMaximized && !state.isFullScreen) {
    const b = win.getBounds();
    state.x = b.x; state.y = b.y; state.width = b.width; state.height = b.height;
  }
  settingsCache.window = state;
  saveSettings(settingsCache);
}

function scheduleWindowStateSave() {
  clearTimeout(saveBoundsTimer);
  saveBoundsTimer = setTimeout(persistWindowState, 500);
}

function sendWindowState() {
  if (!win || win.isDestroyed()) return;
  win.webContents.send('window-state-changed', {
    isMaximized: win.isMaximized(),
    isFullScreen: win.isFullScreen(),
  });
}

function pickInitialBounds() {
  const def = { width: 520, height: 640 };
  const saved = settingsCache.window;
  if (!saved || typeof saved.width !== 'number' || typeof saved.height !== 'number') return def;
  const out = { width: saved.width, height: saved.height };
  if (typeof saved.x === 'number' && typeof saved.y === 'number') {
    // Keep the window on a currently-connected display.
    const visible = screen.getAllDisplays().some(d => {
      const w = d.workArea;
      return saved.x < w.x + w.width && saved.x + 100 > w.x &&
             saved.y < w.y + w.height && saved.y + 40 > w.y;
    });
    if (visible) { out.x = saved.x; out.y = saved.y; }
  }
  return out;
}

function createWindow() {
  const bounds = pickInitialBounds();

  win = new BrowserWindow({
    ...bounds,
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

  // ── Prevent screen capture (macOS & Windows) ──────────────────────────────
  win.setContentProtection(true);

  // ── Start as draggable / interactive ─────────────────────────────────────
  win.setIgnoreMouseEvents(false);

  // Показывать на всех рабочих столах / Space'ах macOS
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Самый высокий уровень поверх всех окон (включая системные)
  win.setAlwaysOnTop(true, 'screen-saver');

  // Restore maximized / fullscreen state once content is ready.
  win.webContents.once('did-finish-load', () => {
    const s = settingsCache.window;
    if (s && s.isFullScreen) win.setFullScreen(true);
    else if (s && s.isMaximized) win.maximize();
    reassertOverlay();
    sendWindowState();
  });

  win.on('resize', scheduleWindowStateSave);
  win.on('move', scheduleWindowStateSave);
  win.on('maximize',   () => { sendWindowState(); scheduleWindowStateSave(); });
  win.on('unmaximize', () => { sendWindowState(); scheduleWindowStateSave(); });
  win.on('enter-full-screen', () => { reassertOverlay(); sendWindowState(); scheduleWindowStateSave(); });
  win.on('leave-full-screen', () => { reassertOverlay(); sendWindowState(); scheduleWindowStateSave(); });
  win.on('close', persistWindowState);
}

// ── Window control IPC (replaces the old @electron/remote calls) ─────────────
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
ipcMain.handle('win:get-state', () => ({
  isMaximized: win ? win.isMaximized() : false,
  isFullScreen: win ? win.isFullScreen() : false,
}));

app.whenReady().then(() => {
  createWindow();

  // ── Toggle click-through with Ctrl+Shift+T (Cmd+Shift+T on Mac) ──────────
  const mod = process.platform === 'darwin' ? 'Command' : 'Control';
  globalShortcut.register(`${mod}+Shift+T`, () => {
    isClickThrough = !isClickThrough;
    if (isClickThrough) {
      win.setIgnoreMouseEvents(true, { forward: true });
    } else {
      win.setIgnoreMouseEvents(false);
    }
    win.webContents.send('click-through-changed', isClickThrough);
  });

  // ── Toggle visibility with Ctrl+Shift+H ──────────────────────────────────
  globalShortcut.register(`${mod}+Shift+H`, () => {
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
      win.focus();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Dragging support via IPC
ipcMain.on('start-drag', () => {
  // handled by CSS -webkit-app-region: drag
});
