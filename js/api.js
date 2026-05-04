(function () {
  const C = window.INVENTORY_CONFIG || {};
  const SESSION_KEY = 'bhh_inv_session_v2';
  const VERSION_KEY = 'bhh_inv_versions_v2';

  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') || {}; }
    catch { return {}; }
  }
  function saveSession(session) { localStorage.setItem(SESSION_KEY, JSON.stringify(session || {})); }
  function clearSession() { localStorage.removeItem(SESSION_KEY); localStorage.removeItem(VERSION_KEY); }
  function getVersions() {
    try { return JSON.parse(localStorage.getItem(VERSION_KEY) || '{}') || {}; }
    catch { return {}; }
  }
  function saveVersions(v) { localStorage.setItem(VERSION_KEY, JSON.stringify(v || {})); }

  async function request(action, params = {}, options = {}) {
    const mode = C.MODE || 'gas';
    const session = getSession();
    const token = options.token || session.token || '';
    if (!C.API_URL || C.API_URL.includes('PASTE_') || C.API_URL.includes('YOUR_PROJECT_REF')) {
      throw new Error('กรุณาตั้งค่า API_URL ใน js/config.js ก่อนใช้งาน');
    }

    if (mode === 'edge') {
      const res = await fetch(C.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify({ action, ...params, token })
      });
      let json;
      try { json = await res.json(); } catch { throw new Error('Invalid JSON response'); }
      if (!res.ok || !json.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`);
      return json.data;
    }

    const isPost = options.method === 'POST' || ['additem','updateitemdb','deleteitemdb','upsertuser','addtx','addtxbatch','rebuildinventory','runminstock'].includes(action);
    if (isPost) {
      const res = await fetch(C.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, token, ...params })
      });
      let json;
      try { json = await res.json(); } catch { throw new Error('Invalid JSON response'); }
      if (!json.ok) throw new Error(json.message || json.error || 'API error');
      return json.data;
    }

    const url = new URL(C.API_URL);
    url.searchParams.set('action', action);
    if (token) url.searchParams.set('token', token);
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
    const res = await fetch(url.toString());
    let json;
    try { json = await res.json(); } catch { throw new Error('Invalid JSON response'); }
    if (!json.ok) throw new Error(json.message || json.error || 'API error');
    return json.data;
  }

  window.InventoryAPI = { request, getSession, saveSession, clearSession, getVersions, saveVersions };
})();
