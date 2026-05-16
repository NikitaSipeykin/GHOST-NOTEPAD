// Renderer-side settings persistence. Window bounds are owned by the main
// process; we only send keys we own, and main merges them in.

function scheduleSettingsSave() {
  clearTimeout(GP.settingsSaveTimer);
  GP.settingsSaveTimer = setTimeout(() => {
    GP.ipc.invoke('settings:save', {
      opacity: GP.settings.opacity,
      theme:   GP.settings.theme,
      expandedFolders:  [...GP.expandedFolders],
      selectedFolderId: GP.selectedFolderId,
    });
  }, 400);
}

// hex → rgba helpers reused by theme + transparency modules
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  return m ? { r: parseInt(m[1],16), g: parseInt(m[2],16), b: parseInt(m[3],16) } : { r:12, g:12, b:18 };
}
function rgbaFromHex(hex, a) { const c = hexToRgb(hex); return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`; }
