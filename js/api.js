(function () {
  const C = window.INVENTORY_CONFIG || {};
  const SESSION_KEY = C.SESSION_KEY || 'bhh_rx_inventory_session_v3';
  const VERSION_KEY = SESSION_KEY + '_versions';

  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') || {}; }
    catch { return {}; }
  }

  function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session || {}));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(VERSION_KEY);
  }

  function getVersions() {
    try { return JSON.parse(localStorage.getItem(VERSION_KEY) || '{}') || {}; }
    catch { return {}; }
  }

  function saveVersions(v) {
    localStorage.setItem(VERSION_KEY, JSON.stringify(v || {}));
  }

  function assertConfigured() {
    if (!C.API_URL || C.API_URL.includes('PASTE_')) {
      throw new Error('กรุณาตั้งค่า API_URL ใน js/config.js ก่อนใช้งาน');
    }
  }

  function jsonp(action, params = {}) {
    assertConfigured();
    return new Promise((resolve, reject) => {
      const cb = '__bhhInvCb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const script = document.createElement('script');
      const cleanup = () => {
        delete window[cb];
        script.remove();
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('API timeout'));
      }, 30000);

      window[cb] = (json) => {
        clearTimeout(timer);
        cleanup();
        if (!json || json.ok === false) reject(new Error((json && (json.message || json.error)) || 'API error'));
        else resolve(json.data);
      };

      const url = new URL(C.API_URL);
      url.searchParams.set('action', action);
      url.searchParams.set('callback', cb);
      url.searchParams.set('ua', navigator.userAgent.slice(0, 120));
      Object.entries(params || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
      });
      script.onerror = () => {
        clearTimeout(timer);
        cleanup();
        reject(new Error('Cannot load API script'));
      };
      script.src = url.toString();
      document.head.appendChild(script);
    });
  }

  async function postJson(action, params = {}) {
    assertConfigured();
    const session = getSession();
    const token = params.token || session.token || '';
    const res = await fetch(C.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token, ...params })
    });
    let json;
    try { json = await res.json(); }
    catch { throw new Error('Invalid JSON response'); }
    if (!json.ok) throw new Error(json.message || json.error || 'API error');
    return json.data;
  }

  async function request(action, params = {}, options = {}) {
    const session = getSession();
    const token = options.token || params.token || session.token || '';
    const isWrite = options.method === 'POST' || [
      'addtx', 'addtxbatch', 'additem', 'updateitemdb', 'deleteitemdb', 'upsertuser', 'rebuildinventory', 'setconfig', 'runminstock'
    ].includes(action);

    if (!isWrite) {
      const merged = { ...params, token };
      if (C.JSONP_READS !== false) return jsonp(action, merged);
      assertConfigured();
      const url = new URL(C.API_URL);
      url.searchParams.set('action', action);
      if (token) url.searchParams.set('token', token);
      Object.entries(params || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
      });
      const res = await fetch(url.toString());
      const json = await res.json();
      if (!json.ok) throw new Error(json.message || json.error || 'API error');
      return json.data;
    }

    try {
      return await postJson(action, params);
    } catch (err) {
      if (!C.JSONP_WRITE_FALLBACK) throw err;
      const payload = JSON.stringify({ ...params, token });
      return jsonp(action, { token, payload });
    }
  }

  window.InventoryAPI = {
    request,
    getSession,
    saveSession,
    clearSession,
    getVersions,
    saveVersions
  };
})();
