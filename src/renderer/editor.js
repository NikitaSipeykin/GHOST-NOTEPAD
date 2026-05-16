// Text formatting toolbar. Apple-Notes-inspired set: fonts, headings, B/I/U/S,
// alignment, lists, checklists, color, highlight.

let savedRange = null;

function _editor() { return GP.editor; }

function _focusEditor() { _editor().focus({ preventScroll: true }); }

function _restoreSelection() {
  if (savedRange) {
    _focusEditor();
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(savedRange);
    savedRange = null;
  } else {
    _focusEditor();
  }
}

// --- B / I / U / S ----------------------------------------------------------
function fmt(cmd) {
  _restoreSelection();
  document.execCommand(cmd, false, null);
  _focusEditor();
  updateBtnStates();
}

// --- Font size --------------------------------------------------------------
function changeFontSize(size) {
  _restoreSelection();
  document.execCommand('fontSize', false, '7');
  document.querySelectorAll('font[size="7"]').forEach(el => {
    el.removeAttribute('size');
    el.style.fontSize = size + 'px';
  });
  _focusEditor();
}

// --- Font family ------------------------------------------------------------
function setFontFamily(key) {
  const stack = GP.FONT_FAMILIES[key] || GP.FONT_FAMILIES.mono;
  _restoreSelection();
  document.execCommand('fontName', false, stack);
  _focusEditor();
  updateBtnStates();
}

// --- Heading / paragraph block ---------------------------------------------
function setHeading(tag) {
  // Empty selection ⇒ formatBlock acts on the current line
  _restoreSelection();
  document.execCommand('formatBlock', false, '<' + tag + '>');
  _focusEditor();
  updateBtnStates();
}

// --- Alignment --------------------------------------------------------------
function setAlign(dir) {
  _restoreSelection();
  const map = { left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight' };
  document.execCommand(map[dir] || 'justifyLeft', false, null);
  _focusEditor();
  updateBtnStates();
}

// --- Bulleted / numbered lists ---------------------------------------------
function insertList(kind) {
  _restoreSelection();
  document.execCommand(kind === 'ordered' ? 'insertOrderedList' : 'insertUnorderedList', false, null);
  _focusEditor();
  updateBtnStates();
}

// --- Checklist --------------------------------------------------------------
// Inserts an interactive checkbox line at the caret. Subsequent Enters from
// inside a checklist line produce another checklist line (handled in keydown).
function insertChecklist() {
  _restoreSelection();
  const html = '<div class="gp-check"><input type="checkbox" contenteditable="false"><span class="gp-check-text">&#8203;</span></div>';
  document.execCommand('insertHTML', false, html);
  // place caret inside the new span
  const last = _editor().querySelector('.gp-check:last-of-type .gp-check-text');
  if (last) {
    const r = document.createRange();
    r.selectNodeContents(last); r.collapse(false);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  _focusEditor();
}

// --- Foreground (text) color ----------------------------------------------
function setColor(color, swatchEl) {
  _restoreSelection();
  document.execCommand('foreColor', false, color);
  document.querySelectorAll('.swatch[data-hex]').forEach(s => s.classList.remove('active'));
  if (swatchEl) swatchEl.classList.add('active');
  showColorHint();
}

// --- Background / highlight color -----------------------------------------
function setHighlight(color, swatchEl) {
  _restoreSelection();
  if (!color || color === 'transparent') {
    // Chromium's clear approach: re-apply with transparent then strip if needed
    document.execCommand('hiliteColor', false, 'transparent');
  } else {
    document.execCommand('hiliteColor', false, color);
  }
  document.querySelectorAll('.hl-swatch').forEach(s => s.classList.remove('active'));
  if (swatchEl) swatchEl.classList.add('active');
}

function showColorHint() {
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed) return;
  const hint = document.getElementById('colorHint');
  if (!hint) return;
  hint.style.opacity = '1';
  clearTimeout(hint._t);
  hint._t = setTimeout(() => hint.style.opacity = '0', 1500);
}

// --- Button state mirror ---------------------------------------------------
function normColor(c) {
  if (!c) return '';
  const d = document.createElement('div');
  d.style.color = c;
  document.body.appendChild(d);
  const computed = getComputedStyle(d).color;
  document.body.removeChild(d);
  return computed;
}

function updateBtnStates() {
  const set = (id, on) => { const el = document.getElementById(id); if (el) el.classList.toggle('active', on); };
  set('btnB', document.queryCommandState('bold'));
  set('btnI', document.queryCommandState('italic'));
  set('btnU', document.queryCommandState('underline'));
  set('btnS', document.queryCommandState('strikeThrough'));

  // alignment
  ['left','center','right'].forEach(d => {
    const on = document.queryCommandState({left:'justifyLeft',center:'justifyCenter',right:'justifyRight'}[d]);
    set('btnAlign' + d[0].toUpperCase() + d.slice(1), on);
  });

  // foreground color swatches
  const color = document.queryCommandValue('foreColor');
  if (color) {
    const normalized = normColor(color);
    let matched = false;
    document.querySelectorAll('.swatch[data-hex]').forEach(s => {
      const match = normColor(s.dataset.hex) === normalized;
      s.classList.toggle('active', match);
      if (match) matched = true;
    });
    if (!matched) document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
  }
}

// --- Selection tracking so toolbar clicks don't lose the editor selection --
function bindEditorEvents() {
  const editor = _editor();
  editor.addEventListener('mousedown', () => { savedRange = null; });
  document.addEventListener('mousedown', e => {
    if (!editor.contains(e.target)) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
        savedRange = sel.getRangeAt(0).cloneRange();
      }
    }
  });

  // input → save current note, refresh sidebar
  editor.addEventListener('input', () => {
    flushCurrent();
    updateWordCount();
    refreshNoteRow();
    scheduleSave();
  });
  editor.addEventListener('keyup',   updateBtnStates);
  editor.addEventListener('mouseup', updateBtnStates);

  // Paste: keep formatting, strip colors
  editor.addEventListener('paste', e => {
    e.preventDefault();
    const html  = e.clipboardData.getData('text/html');
    const plain = e.clipboardData.getData('text/plain');
    let content;
    if (html) {
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      tmp.querySelectorAll('*').forEach(el => {
        el.style.color = ''; el.style.backgroundColor = ''; el.style.background = '';
        if (el.tagName === 'FONT') el.removeAttribute('color');
        if (el.getAttribute('style') === '') el.removeAttribute('style');
      });
      const body = tmp.querySelector('body');
      content = (body || tmp).innerHTML
        .replace(/color\s*:\s*[^;}"']+;?/gi, '')
        .replace(/background(-color)?\s*:\s*[^;}"']+;?/gi, '');
    } else {
      content = plain.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
    }
    document.execCommand('insertHTML', false, content);
  });

  // Checklist: toggle on click, continue list on Enter
  editor.addEventListener('click', e => {
    if (e.target instanceof HTMLInputElement && e.target.type === 'checkbox' &&
        e.target.closest('.gp-check')) {
      e.target.checked = !e.target.checked;
      e.target.closest('.gp-check').classList.toggle('done', e.target.checked);
      flushCurrent(); scheduleSave();
    }
  });
  editor.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const node = sel.getRangeAt(0).startContainer;
    const item = (node.nodeType === 1 ? node : node.parentElement).closest('.gp-check');
    if (!item) return;
    const textSpan = item.querySelector('.gp-check-text');
    const isEmpty = !textSpan || !textSpan.textContent.replace(/​/g,'').trim();
    e.preventDefault();
    if (isEmpty) {
      // exit checklist on empty Enter
      const p = document.createElement('div'); p.innerHTML = '<br>';
      item.replaceWith(p);
      const r = document.createRange(); r.selectNodeContents(p); r.collapse(false);
      sel.removeAllRanges(); sel.addRange(r);
    } else {
      const nxt = document.createElement('div');
      nxt.className = 'gp-check';
      nxt.innerHTML = '<input type="checkbox" contenteditable="false"><span class="gp-check-text">​</span>';
      item.after(nxt);
      const span = nxt.querySelector('.gp-check-text');
      const r = document.createRange(); r.selectNodeContents(span); r.collapse(false);
      sel.removeAllRanges(); sel.addRange(r);
    }
    flushCurrent(); scheduleSave();
  });
}

function updateWordCount() {
  const t = _editor().innerText.trim();
  const el = document.getElementById('wordCount');
  if (el) el.textContent = (t ? t.split(/\s+/).length : 0) + ' сл.';
}
