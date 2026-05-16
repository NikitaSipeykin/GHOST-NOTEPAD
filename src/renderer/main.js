// Renderer entry point — wires modules together and runs init() once
// state.js / settings.js / theme.js / transparency.js / window-controls.js /
// panels.js / editor.js / tree.js have all been loaded.

GP.editor = document.getElementById('editor');

// Hint text
const mod = navigator.platform.includes('Mac') ? '⌘' : 'Ctrl';
const hint = document.getElementById('hintText');
if (hint) hint.textContent = `${mod}+Shift+T — сквозной  ·  ${mod}+Shift+H — скрыть  ·  F11 — полный экран`;

// Theme inputs wiring (defined here so theme.js stays a pure module)
['bgColorInput','accentColorInput','tintColorInput'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', e => {
    const k = id === 'bgColorInput' ? 'bg' : id === 'accentColorInput' ? 'accent' : 'tint';
    applyTheme({ ...GP.settings.theme, [k]: e.target.value });
  });
});

async function init() {
  const sv = await GP.ipc.invoke('settings:load') || {};
  applyTheme(sv.theme || GP.DEFAULT_THEME, false);
  applyTransparency(typeof sv.opacity === 'number' ? sv.opacity : 52, false);
  if (Array.isArray(sv.expandedFolders)) GP.expandedFolders = new Set(sv.expandedFolders);
  if (sv.selectedFolderId) GP.selectedFolderId = sv.selectedFolderId;

  setupRootDrop(document.getElementById('tree'));

  const saved = await GP.ipc.invoke('notes:load');
  GP.notes   = (saved && Array.isArray(saved.notes)   && saved.notes.length)   ? saved.notes   : [];
  GP.folders = (saved && Array.isArray(saved.folders))                          ? saved.folders : [];
  if (!GP.notes.length) GP.notes = [makeNote('Первая заметка')];

  // Sanitise refs (folders that no longer exist, etc.)
  GP.notes.forEach(n => { if (n.folderId   !== null && !folderExists(n.folderId)) n.folderId   = null; });
  GP.folders.forEach(f => { if (f.parentId !== null && !folderExists(f.parentId)) f.parentId = null; });
  if (!folderExists(GP.selectedFolderId)) GP.selectedFolderId = null;
  GP.expandedFolders = new Set([...GP.expandedFolders].filter(folderExists));

  GP.currentId = GP.notes[0].id;
  GP.editor.innerHTML = GP.notes[0].content || '';
  renderTree();
  updateWordCount();
  bindEditorEvents();
  GP.editor.focus();
}

init();
