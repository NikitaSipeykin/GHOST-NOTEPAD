const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// ── Notes file path (в папке приложения) ─────────────────────────────────────
const NOTES_PATH = path.join(app.getPath('userData'), 'ghostpad-notes.json');

function loadNotes() {
  try {
    if (fs.existsSync(NOTES_PATH)) {
      return JSON.parse(fs.readFileSync(NOTES_PATH, 'utf-8'));
    }
  } catch (e) {}
  return null;
}

function saveNotes(notes) {
  try {
    fs.writeFileSync(NOTES_PATH, JSON.stringify(notes, null, 2), 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

ipcMain.handle('notes:load', () => loadNotes());
ipcMain.handle('notes:save', (_, notes) => saveNotes(notes));

let win;
let isClickThrough = false;

function createWindow() {
  win = new BrowserWindow({
    width: 520,
    height: 640,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    hasShadow: false,
    skipTaskbar: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
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
}

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
