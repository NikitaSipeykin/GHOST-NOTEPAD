function applyTheme(theme, persist = true) {
  GP.settings.theme = { ...GP.DEFAULT_THEME, ...theme };
  const t = GP.settings.theme;
  const r = document.documentElement.style;
  r.setProperty('--bg-color', t.bg);
  r.setProperty('--glass',        rgbaFromHex(t.bg,      GP.settings.opacity / 100));
  r.setProperty('--accent',       rgbaFromHex(t.accent,  0.9));
  r.setProperty('--accent-dim',   rgbaFromHex(t.accent,  0.18));
  r.setProperty('--glass-active', rgbaFromHex(t.accent,  0.12));
  r.setProperty('--tint', t.tint && t.tint.toLowerCase() !== '#000000' ? t.tint : 'transparent');
  r.setProperty('--tint-strength', t.tintStrength != null ? t.tintStrength : 0.18);

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('bgColorInput', t.bg);
  set('accentColorInput', t.accent);
  set('tintColorInput', t.tint || '#000000');

  if (persist) scheduleSettingsSave();
}

function applyPreset(key) {
  const p = GP.PRESETS[key];
  if (!p) return;
  applyTheme(p.theme);
  applyTransparency(p.opacity);
}
