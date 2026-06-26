'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vesselBridge', {
  notify(title, body, icon) {
    ipcRenderer.send('show-notification', { title, body, icon });
  },
  setBadge(count) {
    ipcRenderer.send('set-badge', count);
  },
});

window.addEventListener('DOMContentLoaded', () => {
  const script = document.createElement('script');
  script.textContent = `(function () {
  'use strict';

  if (window.__vesselNotificationPatched) return;
  window.__vesselNotificationPatched = true;

  const bridge = window.vesselBridge;
  if (!bridge) return; 

  class VesselNotification extends EventTarget {
    constructor(title, options = {}) {
      super();
      bridge.notify(
        String(title ?? ''),
        String(options.body ?? ''),
        typeof options.icon === 'string' ? options.icon : undefined
      );
    }

    static get permission() { return 'granted'; }
    static requestPermission() { return Promise.resolve('granted'); }
  }

  Object.defineProperty(window, 'Notification', {
    value: VesselNotification,
    writable: false,
    configurable: false,
  });

  const titleObserver = new MutationObserver(() => {
    const match = document.title.match(/^\\((\\d+)\\)/);
    const count = match ? parseInt(match[1], 10) : 0;
    bridge.setBadge(count);
  });

  titleObserver.observe(document.querySelector('title') || document.head, {
    childList: true,
    subtree: true,
    characterData: true,
  });
})();`;

  const target = document.head || document.documentElement;
  target.insertBefore(script, target.firstChild);
  script.remove(); 
});
