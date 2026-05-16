// Shared mutable state lives on `window.GP` so every renderer module can read
// from / write to a single namespace without re-declaring `let` globals.
window.GP = window.GP || {};
GP.ipc = require('electron').ipcRenderer;

// Editor DOM ref is filled in renderer/main.js once DOM is ready
GP.editor = null;

// Notes / folders state
GP.notes = [];
GP.folders = [];
GP.expandedFolders = new Set();
GP.currentId = null;
GP.selectedFolderId = null;

// Persistence timers
GP.saveTimer = null;
GP.settingsSaveTimer = null;

// Settings (kept in sync with disk via src/main/storage.js)
GP.DEFAULT_THEME = { bg: '#0c0c12', accent: '#78c8ff', tint: '#000000', tintStrength: 0.18 };
GP.PRESETS = {
  ghost:     { theme:{ bg:'#0c0c12', accent:'#78c8ff', tint:'#000000', tintStrength:0.18 }, opacity:52 },
  cyberpunk: { theme:{ bg:'#14071e', accent:'#ff4fd8', tint:'#00e5ff', tintStrength:0.12 }, opacity:60 },
  matrix:    { theme:{ bg:'#02100a', accent:'#39ff7a', tint:'#0aff5e', tintStrength:0.10 }, opacity:55 },
  frost:     { theme:{ bg:'#1a2230', accent:'#a8c8ff', tint:'#ffffff', tintStrength:0.10 }, opacity:38 },
};
GP.settings = { opacity: 52, theme: { ...GP.DEFAULT_THEME } };

// Window state mirror
GP.isFullScreen = false;

// Font / heading definitions exposed for the editor module
GP.FONT_FAMILIES = {
  mono:  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  sans:  "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
};
