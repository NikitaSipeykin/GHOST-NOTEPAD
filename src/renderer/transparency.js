// Applies the glass-background alpha. The slider UI lives in a separate
// BrowserWindow (slider.html); we exchange values via the main process.

let _suppressSliderSync = false;

function applyTransparency(pct, persist = true, fromSlider = false) {
  pct = Math.max(12, Math.min(98, Math.round(pct)));
  GP.settings.opacity = pct;
  const a = pct / 100;
  const root = document.documentElement.style;
  root.setProperty('--shell-alpha', a);
  root.setProperty('--glass', rgbaFromHex(GP.settings.theme.bg, a));
  // If the change originated in the slider window, don't echo it back.
  if (!fromSlider && !_suppressSliderSync) GP.ipc.send('slider:sync', pct);
  if (persist) scheduleSettingsSave();
}

function toggleTransparencySlider() {
  GP.ipc.send('slider:toggle', GP.settings.opacity);
}

// Opacity changes pushed FROM the slider window land here.
GP.ipc.on('slider:opacity', (_, pct) => {
  _suppressSliderSync = true;
  applyTransparency(pct, true, true);
  _suppressSliderSync = false;
});
