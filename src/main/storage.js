const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const notesPath    = () => path.join(app.getPath('userData'), 'ghostpad-notes.json');
const settingsPath = () => path.join(app.getPath('userData'), 'ghostpad-settings.json');

// Backward compatible: legacy notes file was a plain array; new format is { notes, folders }.
function loadNotes() {
  try {
    if (fs.existsSync(notesPath())) {
      const data = JSON.parse(fs.readFileSync(notesPath(), 'utf-8'));
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
    fs.writeFileSync(notesPath(), JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

function loadSettingsFile() {
  try {
    if (fs.existsSync(settingsPath())) {
      return JSON.parse(fs.readFileSync(settingsPath(), 'utf-8'));
    }
  } catch (e) {}
  return null;
}

function writeSettingsFile(settings) {
  try {
    fs.writeFileSync(settingsPath(), JSON.stringify(settings || {}, null, 2), 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

let cache = null;
function getSettings() {
  if (cache === null) cache = loadSettingsFile() || {};
  return cache;
}

// Merge so independent writers (renderer-side settings vs main-side window state)
// never clobber each other's keys.
function mergeSettings(partial) {
  cache = { ...getSettings(), ...(partial || {}) };
  writeSettingsFile(cache);
  return cache;
}

function registerIpc() {
  ipcMain.handle('notes:load',    () => loadNotes());
  ipcMain.handle('notes:save',    (_, payload) => saveNotes(payload));
  ipcMain.handle('settings:load', () => getSettings());
  ipcMain.handle('settings:save', (_, s) => mergeSettings(s));
}

module.exports = { registerIpc, getSettings, mergeSettings, loadNotes, saveNotes };
