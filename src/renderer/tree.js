// Sidebar tree (folders + notes), drag-and-drop, persistence.
// The header "+" buttons always create at root; per-folder "+" buttons
// inside a folder row create inside that folder. `selectedFolderId` is
// now purely a visual cue and never affects where new items go.

function makeNote(title = 'Новая заметка', folderId = null) {
  return { id: Date.now() + '_' + Math.random().toString(36).slice(2), title, content: '', updatedAt: Date.now(), folderId };
}
function makeFolder(name = 'Новая папка', parentId = null) {
  return { id: 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2), name, parentId };
}
function folderExists(id) { return id != null && GP.folders.some(f => f.id === id); }
function noteById(id)   { return GP.notes.find(n => n.id === id); }
function folderById(id) { return GP.folders.find(f => f.id === id); }
function childFolders(parentId) {
  return GP.folders.filter(f => (f.parentId ?? null) === parentId).sort((a,b) => a.name.localeCompare(b.name, 'ru'));
}
function childNotes(folderId) {
  return GP.notes.filter(n => (n.folderId ?? null) === folderId).sort((a,b) => b.updatedAt - a.updatedAt);
}
function isExpanded(id) { return GP.expandedFolders.has(id); }

// ── Persistence (notes) ────────────────────────────────────────────────────
async function persist() {
  await GP.ipc.invoke('notes:save', { notes: GP.notes, folders: GP.folders });
  const el = document.getElementById('saveFlash');
  if (el) { el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 1200); }
}
function scheduleSave() {
  clearTimeout(GP.saveTimer);
  GP.saveTimer = setTimeout(persist, 800);
}
function flushCurrent() {
  if (!GP.currentId) return;
  const n = noteById(GP.currentId);
  if (!n) return;
  n.content = GP.editor.innerHTML;
  n.updatedAt = Date.now();
  const plain = GP.editor.innerText.trim();
  const first = plain.split('\n')[0].slice(0, 32).trim();
  if (first && (n.title === 'Новая заметка' || n.title === 'Первая заметка')) n.title = first;
}

// ── Render ─────────────────────────────────────────────────────────────────
function renderTree() {
  const tree = document.getElementById('tree');
  tree.innerHTML = '';
  buildLevel(null, tree);
  if (!tree.children.length) {
    const empty = document.createElement('div');
    empty.className = 'tree-empty';
    empty.textContent = '— пусто —';
    tree.appendChild(empty);
  }
}

function buildLevel(parentId, container) {
  childFolders(parentId).forEach(f => {
    container.appendChild(buildFolderRow(f));
    const kids = document.createElement('div');
    kids.className = 'tree-children' + (isExpanded(f.id) ? '' : ' collapsed');
    kids.dataset.folderId = f.id;
    buildLevel(f.id, kids);
    container.appendChild(kids);
  });
  childNotes(parentId).forEach(n => container.appendChild(buildNoteRow(n)));
}

function buildFolderRow(f) {
  const row = document.createElement('div');
  row.className = 'tree-row folder-row' + (f.id === GP.selectedFolderId ? ' active' : '');
  row.dataset.folderId = f.id;

  const caret = document.createElement('span');
  caret.className = 'row-caret' + (isExpanded(f.id) ? '' : ' collapsed');
  caret.textContent = '▾';
  caret.title = isExpanded(f.id) ? 'Свернуть' : 'Развернуть';
  caret.addEventListener('click', e => { e.stopPropagation(); toggleFolder(f.id); });

  const icon = document.createElement('span');
  icon.className = 'row-icon';
  icon.textContent = isExpanded(f.id) ? '▽' : '▷';
  icon.style.fontSize = '10px';

  const name = document.createElement('div');
  name.className = 'row-name';
  name.contentEditable = 'true';
  name.spellcheck = false;
  name.textContent = f.name;
  name.title = f.name;
  name.addEventListener('mousedown', () => selectFolder(f.id));
  name.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); name.blur(); } });
  name.addEventListener('blur', () => {
    const v = name.innerText.trim().slice(0, 40) || 'Без названия';
    f.name = v; name.textContent = v; name.title = v; scheduleSave();
  });

  const actions = document.createElement('div');
  actions.className = 'row-actions';
  const addNoteBtn   = document.createElement('button');
  addNoteBtn.className = 'row-act';   addNoteBtn.textContent = '+';   addNoteBtn.title = 'Новая заметка в этой папке';
  addNoteBtn.addEventListener('click', e => { e.stopPropagation(); newNote(f.id); });
  const addFolderBtn = document.createElement('button');
  addFolderBtn.className = 'row-act'; addFolderBtn.textContent = '▤'; addFolderBtn.title = 'Новая вложенная папка'; addFolderBtn.style.fontSize = '8px';
  addFolderBtn.addEventListener('click', e => { e.stopPropagation(); newFolder(f.id); });
  const delBtn = document.createElement('button');
  delBtn.className = 'row-act del';   delBtn.textContent = '✕';       delBtn.title = 'Удалить папку (содержимое поднимется уровнем выше)';
  delBtn.addEventListener('click', e => { e.stopPropagation(); deleteFolder(f.id); });
  actions.append(addNoteBtn, addFolderBtn, delBtn);

  row.append(caret, icon, name, actions);
  row.addEventListener('click', e => {
    if (e.target === name || actions.contains(e.target) || e.target === caret) return;
    selectFolder(f.id);
    if (!isExpanded(f.id)) toggleFolder(f.id);
  });

  makeDropTarget(row, f.id);
  return row;
}

function buildNoteRow(n) {
  const plain = (n.content || '').replace(/<[^>]*>/g,'').trim();
  const row = document.createElement('div');
  row.className = 'tree-row note-row' + (n.id === GP.currentId ? ' active' : '');
  row.dataset.noteId = n.id;
  row.draggable = true;

  const caret = document.createElement('span'); caret.className = 'row-caret leaf'; caret.textContent = '·';
  const icon  = document.createElement('span'); icon.className  = 'row-icon';        icon.textContent  = '◦';

  const meta = document.createElement('div');
  meta.className = 'note-meta';
  const name = document.createElement('div');
  name.className = 'row-name';
  name.contentEditable = 'true';
  name.spellcheck = false;
  name.textContent = n.title;
  name.title = n.title;
  name.addEventListener('mousedown', e => { if (n.id !== GP.currentId) { e.preventDefault(); switchNote(n.id); } });
  name.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); name.blur(); GP.editor.focus(); } });
  name.addEventListener('blur', () => {
    const v = name.innerText.trim().slice(0, 40) || 'Без названия';
    n.title = v; name.textContent = v; name.title = v; scheduleSave();
  });
  const preview = document.createElement('div'); preview.className = 'note-preview'; preview.textContent = plain.slice(0, 42) || '—';
  const date    = document.createElement('div'); date.className    = 'note-date';    date.textContent    = formatDate(n.updatedAt);
  meta.append(name, preview, date);

  const actions = document.createElement('div');
  actions.className = 'row-actions';
  const delBtn = document.createElement('button');
  delBtn.className = 'row-act del'; delBtn.textContent = '✕'; delBtn.title = 'Удалить заметку';
  delBtn.addEventListener('click', e => { e.stopPropagation(); deleteNote(n.id); });
  actions.append(delBtn);

  row.append(caret, icon, meta, actions);
  row.addEventListener('click', e => {
    if (e.target === name || actions.contains(e.target)) return;
    switchNote(n.id);
  });

  row.addEventListener('dragstart', e => {
    if (e.target.closest('.row-name')) { e.preventDefault(); return; }
    e.dataTransfer.setData('text/ghostpad-note', n.id);
    e.dataTransfer.effectAllowed = 'move';
    row.classList.add('dragging');
  });
  row.addEventListener('dragend', () => row.classList.remove('dragging'));
  return row;
}

function refreshNoteRow() {
  const n = noteById(GP.currentId);
  if (!n) return;
  const row = document.querySelector(`.note-row[data-note-id="${CSS.escape(n.id)}"]`);
  if (!row) { renderTree(); return; }
  const plain = (n.content || '').replace(/<[^>]*>/g,'').trim();
  const prev = row.querySelector('.note-preview');
  const name = row.querySelector('.row-name');
  if (prev) prev.textContent = plain.slice(0, 42) || '—';
  if (name && document.activeElement !== name) { name.textContent = n.title; name.title = n.title; }
}

// ── Drag & drop ────────────────────────────────────────────────────────────
function makeDropTarget(el, folderId) {
  el.addEventListener('dragover', e => {
    if (![...e.dataTransfer.types].includes('text/ghostpad-note')) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    el.classList.add('drop-target');
  });
  el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
  el.addEventListener('drop', e => {
    el.classList.remove('drop-target');
    const noteId = e.dataTransfer.getData('text/ghostpad-note');
    if (!noteId) return;
    e.preventDefault(); e.stopPropagation();
    moveNoteToFolder(noteId, folderId);
  });
}

let rootDropBound = false;
function setupRootDrop(tree) {
  if (rootDropBound) return;
  rootDropBound = true;
  tree.addEventListener('dragover', e => {
    if (![...e.dataTransfer.types].includes('text/ghostpad-note')) return;
    if (e.target.closest('.folder-row') || e.target.closest('.note-row')) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; tree.classList.add('drop-root');
  });
  tree.addEventListener('dragleave', e => { if (e.target === tree) tree.classList.remove('drop-root'); });
  tree.addEventListener('drop', e => {
    tree.classList.remove('drop-root');
    if (e.target.closest('.folder-row')) return;
    const noteId = e.dataTransfer.getData('text/ghostpad-note');
    if (!noteId) return;
    e.preventDefault();
    moveNoteToFolder(noteId, null);
  });
  // Clicking the empty tree area deselects the visual folder highlight
  tree.addEventListener('click', e => {
    if (e.target === tree || e.target.classList.contains('tree-empty')) {
      GP.selectedFolderId = null;
      document.querySelectorAll('.folder-row.active').forEach(r => r.classList.remove('active'));
      scheduleSettingsSave();
    }
  });
}

function moveNoteToFolder(noteId, folderId) {
  const n = noteById(noteId);
  if (!n) return;
  if ((n.folderId ?? null) === (folderId ?? null)) return;
  n.folderId = folderId ?? null;
  n.updatedAt = Date.now();
  if (folderId && !isExpanded(folderId)) GP.expandedFolders.add(folderId);
  renderTree();
  persist();
  scheduleSettingsSave();
}

// ── Folder operations ──────────────────────────────────────────────────────
function toggleFolder(id) {
  if (GP.expandedFolders.has(id)) GP.expandedFolders.delete(id); else GP.expandedFolders.add(id);
  renderTree();
  scheduleSettingsSave();
}
function selectFolder(id) {
  GP.selectedFolderId = id;
  document.querySelectorAll('.folder-row').forEach(r => r.classList.toggle('active', r.dataset.folderId === String(id)));
  scheduleSettingsSave();
}
function newFolder(parentId = null) {
  // explicit arg only — no fallback to selectedFolderId (prevents the
  // "I can't make a root folder" surprise).
  const f = makeFolder('Новая папка', parentId);
  GP.folders.push(f);
  if (parentId) GP.expandedFolders.add(parentId);
  GP.selectedFolderId = f.id;
  renderTree();
  persist();
  scheduleSettingsSave();
  const row = document.querySelector(`.folder-row[data-folder-id="${CSS.escape(f.id)}"] .row-name`);
  if (row) { row.focus(); document.execCommand('selectAll', false, null); }
}
function deleteFolder(id) {
  const f = folderById(id);
  if (!f) return;
  const parent = f.parentId ?? null;
  GP.notes.forEach(n => { if ((n.folderId ?? null) === id) n.folderId = parent; });
  GP.folders.forEach(c => { if ((c.parentId ?? null) === id) c.parentId = parent; });
  GP.folders = GP.folders.filter(c => c.id !== id);
  GP.expandedFolders.delete(id);
  if (GP.selectedFolderId === id) GP.selectedFolderId = parent;
  renderTree();
  persist();
  scheduleSettingsSave();
}

// ── Note operations ────────────────────────────────────────────────────────
function switchNote(id) {
  if (id === GP.currentId) return;
  flushCurrent();
  GP.currentId = id;
  const n = noteById(id);
  GP.editor.innerHTML = n ? (n.content || '') : '';
  updateWordCount();
  document.querySelectorAll('.note-row').forEach(r => r.classList.toggle('active', r.dataset.noteId === String(id)));
  GP.editor.focus();
  scheduleSave();
}
function newNote(folderId = null) {
  // explicit arg only — no fallback to selectedFolderId
  flushCurrent();
  const n = makeNote('Новая заметка', folderId);
  GP.notes.unshift(n);
  if (folderId) GP.expandedFolders.add(folderId);
  GP.currentId = n.id;
  GP.editor.innerHTML = '';
  updateWordCount();
  renderTree();
  GP.editor.focus();
  persist();
}
function deleteNote(id) {
  if (GP.notes.length === 1) {
    GP.notes[0].content = ''; GP.notes[0].title = 'Новая заметка'; GP.notes[0].updatedAt = Date.now(); GP.notes[0].folderId = null;
    GP.editor.innerHTML = ''; updateWordCount(); renderTree(); persist(); return;
  }
  const wasCurrent = GP.currentId === id;
  GP.notes = GP.notes.filter(n => n.id !== id);
  if (wasCurrent) { GP.currentId = GP.notes[0].id; GP.editor.innerHTML = GP.notes[0].content || ''; updateWordCount(); }
  renderTree();
  persist();
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts), now = new Date();
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'})
    : d.toLocaleDateString('ru-RU', {day:'numeric',month:'short'});
}
