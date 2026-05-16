// Only the theme panel lives in-window now — the transparency slider has its
// own external BrowserWindow (see src/main/slider-window.js).
const PANELS = { theme: 'themePanel' };

function closeAllPanels() {
  Object.values(PANELS).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  });
}

function togglePanel(name) {
  const el = document.getElementById(PANELS[name]);
  if (!el) return;
  const wasOpen = el.classList.contains('open');
  closeAllPanels();
  if (!wasOpen) {
    el.classList.add('open');
    const f = el.querySelector('input,button');
    if (f) f.focus({ preventScroll: true });
  }
}

document.addEventListener('mousedown', e => {
  if (e.target.closest('.panel') || e.target.closest('#btnTheme')) return;
  closeAllPanels();
});

document.addEventListener('keydown', e => {
  if (e.key === 'F11') { e.preventDefault(); winToggleFullscreen(); return; }
  if (e.key === 'Escape') {
    const anyOpen = Object.values(PANELS).some(id => document.getElementById(id) && document.getElementById(id).classList.contains('open'));
    if (anyOpen)      { closeAllPanels(); return; }
    if (GP.isFullScreen) winToggleFullscreen();
  }
});

window.addEventListener('blur', () => {
  const a = document.activeElement;
  if (a && a.closest && a.closest('.panel')) return;
  closeAllPanels();
});
