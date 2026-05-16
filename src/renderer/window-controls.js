function winClose()           { GP.ipc.send('win:close'); }
function winMinimize()        { GP.ipc.send('win:minimize'); }
function winToggleMaximize()  { GP.ipc.send('win:toggle-maximize'); }
function winToggleFullscreen(){ GP.ipc.send('win:toggle-fullscreen'); }

GP.ipc.on('window-state-changed', (_, st) => {
  GP.isFullScreen = !!st.isFullScreen;
  document.body.classList.toggle('flush', !!(st.isMaximized || st.isFullScreen));
  const full = document.querySelector('.dot.full');
  if (full) {
    full.title = st.isFullScreen ? 'Выйти из полноэкранного режима'
               : st.isMaximized  ? 'Восстановить размер · F11 — полноэкранный'
               :                   'Развернуть · F11 — полноэкранный';
  }
});

GP.ipc.on('click-through-changed', (_, v) => {
  const p = document.getElementById('statusPill');
  if (!p) return;
  p.textContent = v ? '○ Сквозной' : '● Активен';
  p.className = 'status-pill ' + (v ? 'passthrough' : 'interactive');
  if (v) closeAllPanels();
});
