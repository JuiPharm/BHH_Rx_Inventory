(function () {
  const C = window.INVENTORY_CONFIG || {};
  const API = window.InventoryAPI;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const PERM_LABELS = [
    ['canIssue', 'เบิก OUT'],
    ['canReceive', 'รับเข้า IN'],
    ['canAdjust', 'ปรับยอด ADJ'],
    ['canManageItems', 'จัดการ Items'],
    ['canManageUsers', 'จัดการ Users'],
    ['canViewReports', 'ดู Reports ทั้งหมด'],
    ['canRebuild', 'Rebuild']
  ];

  const state = {
    user: null,
    token: '',
    config: { departments: ['OPD Pharmacy', 'IPD Pharmacy', 'IV Chemo'] },
    items: [],
    transactions: [],
    transactionsLoaded: false,
    txStale: false,
    itemsDb: [],
    users: [],
    issueList: [],
    selected: { out: null, in: null, adj: null },
    tab: 'stock',
    versions: {},
    syncTimer: null,
    busy: false,
    filters: { stockQ: '', stockStatus: 'all', txType: '', txDept: '', txFrom: '', txTo: '', txQ: '', itemsDbQ: '' }
  };

  function esc(s) { return String(s ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
  function num(v) { const n = Number(String(v ?? 0).replace(/,/g, '')); return Number.isFinite(n) ? n : 0; }
  function fmt(v) { return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(num(v)); }
  function nowId() { return 'req-' + Date.now() + '-' + Math.random().toString(36).slice(2); }
  function itemKey(it) { return [it.itemCode || '', it.itemName || '', it.unit || ''].join('|'); }
  function splitKey(key) { const [itemCode, itemName, unit] = String(key || '').split('|'); return { itemCode, itemName, unit }; }
  function imagePlaceholder() {
    return 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23eef7fb%22/%3E%3Cpath d=%22M20 40h24M24 24h16M24 32h16%22 stroke=%22%230b3558%22 stroke-width=%224%22 stroke-linecap=%22round%22/%3E%3C/svg%3E';
  }
  function imgSrc(url) { return String(url || '').trim() || imagePlaceholder(); }
  function itemCacheKey() { return (C.SESSION_KEY || 'bhh_rx_inventory_session_v3') + '_items_fastux_v3'; }
  function saveLocalItems() { try { localStorage.setItem(itemCacheKey(), JSON.stringify({ at: Date.now(), items: state.items || [] })); } catch {} }
  function loadLocalItems() {
    try {
      const cached = JSON.parse(localStorage.getItem(itemCacheKey()) || 'null');
      if (cached && Array.isArray(cached.items) && cached.items.length) {
        state.items = cached.items;
        renderItemPickers();
        renderStock();
        setSyncText('Loaded cached stock • syncing...', 'loading');
        return true;
      }
    } catch {}
    return false;
  }
  function normalizeText(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function itemSearchHay(it) { return normalizeText([it.itemCode, it.itemName, it.unit].join(' ')); }
  function hasPerm(perm) { return !!(state.user && (state.user.role === 'Admin' || perm === 'any' || (state.user.permissions && state.user.permissions[perm]))); }

  function toast(title, detail, type = '') {
    const area = $('#toastArea');
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = `<strong>${esc(title)}</strong>${detail ? `<span>${esc(detail)}</span>` : ''}`;
    area.appendChild(el);
    setTimeout(() => el.remove(), 5200);
  }

  function setBusy(flag, title = 'กำลังทำงาน...', detail = 'กรุณารอสักครู่') {
    state.busy = flag;
    document.body.classList.toggle('busy', flag);
    const loader = $('#globalLoader');
    if (loader) loader.classList.toggle('hidden', !flag);
    const titleEl = $('#loaderTitle');
    const detailEl = $('#loaderDetail');
    if (titleEl) titleEl.textContent = title;
    if (detailEl) detailEl.textContent = detail;
  }

  function setSyncText(text, status = '') {
    const el = $('#syncText');
    el.textContent = text;
    el.className = 'sync-pill ' + status;
  }

  function setTab(tab) {
    const button = $(`.tab[data-tab="${tab}"]`);
    if (!button || button.classList.contains('hidden')) {
      tab = 'stock';
    }
    state.tab = tab;
    $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    $$('.page').forEach(p => p.classList.add('hidden'));
    $(`#page-${tab}`)?.classList.remove('hidden');
  }

  function renderPermissionCheckboxes(container, permissions = {}, disabledAdmin = false, prefix = 'perm') {
    const html = PERM_LABELS.map(([key, label]) => `
      <label class="perm-check ${disabledAdmin ? 'disabled' : ''}">
        <input type="checkbox" data-perm-key="${key}" data-perm-prefix="${prefix}" ${permissions[key] ? 'checked' : ''} ${disabledAdmin ? 'disabled' : ''}>
        <span>${esc(label)}</span>
      </label>
    `).join('');
    container.innerHTML = html;
  }

  function collectPermissions(root, prefix) {
    const out = {};
    $$(`input[data-perm-prefix="${prefix}"]`, root).forEach(cb => { out[cb.dataset.permKey] = cb.checked; });
    return out;
  }

  function updateRoleUI() {
    const user = state.user || {};
    const p = user.permissions || {};
    $('#loginCard').classList.add('hidden');
    $('#appMain').classList.remove('hidden');
    $('#logoutBtn').classList.remove('hidden');
    $('#userText').classList.remove('hidden');
    $('#userText').textContent = `${user.fullName || user.staffId} • ${user.role}${user.department ? ' • ' + user.department : ''}`;
    $('#welcomeTitle').textContent = `สวัสดี ${user.fullName || user.staffId}`;

    const enabled = PERM_LABELS.filter(([key]) => user.role === 'Admin' || p[key]).map(([, label]) => label);
    $('#permissionText').textContent = user.role === 'Admin'
      ? 'Admin: เห็นทุกเมนูและจัดการระบบได้ทั้งหมด'
      : `สิทธิ์ของคุณ: ${enabled.length ? enabled.join(', ') : 'ดู Stock และ Transaction ที่เกี่ยวข้องเท่านั้น'}`;

    $$('.tab').forEach(tab => {
      const perm = tab.dataset.perm || 'any';
      tab.classList.toggle('hidden', !hasPerm(perm));
    });
    setTab(state.tab);
  }

  function renderDepartments() {
    const depts = state.config.departments || ['OPD Pharmacy', 'IPD Pharmacy', 'IV Chemo'];
    ['#outDept', '#txDept', '#newDepartment'].forEach(sel => {
      const el = $(sel);
      if (!el) return;
      const allowAll = sel === '#txDept';
      el.innerHTML = (allowAll ? '<option value="">All departments</option>' : '') + depts.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
    });
    if (state.user && state.user.department) {
      $('#outDept').value = state.user.department;
      $('#newDepartment').value = state.user.department;
    }
  }

  function renderStats() {
    const items = state.items || [];
    const txs = state.transactionsLoaded ? (state.transactions || []) : [];
    const today = new Date().toISOString().slice(0, 10);
    $('#statItems').textContent = fmt(items.length);
    $('#statLow').textContent = fmt(items.filter(x => x.belowMin).length);
    $('#statZero').textContent = fmt(items.filter(x => x.zeroStock).length);
    $('#statTxToday').textContent = state.transactionsLoaded
      ? fmt(txs.filter(t => String(t.TimestampText || '').startsWith(today)).length)
      : '—';
  }

  function renderItemPickers() {
    ['out', 'in', 'adj'].forEach(kind => {
      renderSelectedItem(kind);
      hideSuggestions(kind);
    });
    renderOutRemain();
  }

  function selectedBoxId(kind) { return '#' + kind + 'Selected'; }
  function inputId(kind) { return '#' + kind + 'Search'; }
  function suggestionsId(kind) { return '#' + kind + 'Suggestions'; }

  function renderSelectedItem(kind) {
    const el = $(selectedBoxId(kind));
    if (!el) return;
    const it = state.selected[kind];
    if (!it) {
      el.className = 'selected-item muted';
      el.textContent = 'ยังไม่ได้เลือกรายการ';
      return;
    }
    el.className = 'selected-item ok';
    el.innerHTML = `<div class="sel-head"><img class="item-thumb tiny" loading="lazy" src="${esc(imgSrc(it.imageUrl))}" onerror="this.src='${imagePlaceholder()}'"><div><strong>${esc(it.itemName)}</strong><small>${esc(it.itemCode || '-')} • คงเหลือ ${fmt(it.qtyRemain)} ${esc(it.unit)} • Min ${fmt(it.minimum)}</small></div></div>`;
  }

  function hideSuggestions(kind) {
    const el = $(suggestionsId(kind));
    if (el) el.classList.add('hidden');
  }

  function filterPickerItems(kind, q) {
    const text = normalizeText(q);
    let rows = state.items || [];
    if (kind === 'out') rows = rows.filter(it => num(it.qtyRemain) > 0);
    if (text) rows = rows.filter(it => itemSearchHay(it).includes(text));
    return rows.slice(0, 30);
  }

  function renderSuggestions(kind) {
    const input = $(inputId(kind));
    const box = $(suggestionsId(kind));
    if (!input || !box) return;
    const q = input.value.trim();
    const rows = filterPickerItems(kind, q);
    if (!q && !rows.length) { hideSuggestions(kind); return; }
    box.innerHTML = rows.length ? rows.map(it => `
      <button type="button" class="suggestion" data-pick-kind="${kind}" data-pick-key="${esc(itemKey(it))}">
        <img class="item-thumb small" loading="lazy" src="${esc(imgSrc(it.imageUrl))}" onerror="this.src='${imagePlaceholder()}'">
        <span><strong>${esc(it.itemName)}</strong><small>${esc(it.itemCode || '-')} • ${esc(it.unit)} • Min ${fmt(it.minimum)}</small></span>
        <span class="remain">${fmt(it.qtyRemain)} ${esc(it.unit)}</span>
      </button>`).join('') : '<div class="empty-cell">ไม่พบรายการที่ค้นหา</div>';
    box.classList.remove('hidden');
  }

  function selectItem(kind, it) {
    if (!it) return;
    state.selected[kind] = it;
    const input = $(inputId(kind));
    if (input) input.value = `${it.itemName} ${it.itemCode ? '(' + it.itemCode + ')' : ''}`;
    renderSelectedItem(kind);
    hideSuggestions(kind);
    if (kind === 'out') renderOutRemain();
  }

  function getSelectedItem(kind) {
    const it = state.selected[kind];
    if (it) return it;
    const input = $(inputId(kind));
    const q = input ? input.value.trim() : '';
    const matches = filterPickerItems(kind, q);
    if (matches.length === 1) {
      selectItem(kind, matches[0]);
      return matches[0];
    }
    throw new Error('กรุณาค้นหาและเลือกรายการจากผลลัพธ์ก่อน');
  }

  function renderOutRemain() {
    const it = state.selected.out;
    $('#outRemainText').textContent = it ? `คงเหลือ ${fmt(it.qtyRemain)} ${it.unit} • Minimum ${fmt(it.minimum)}` : '';
  }

  function stockStatus(it) {
    if (it.zeroStock) return ['Zero/Negative', 'danger'];
    if (it.belowMin) return ['Below Min', 'warning'];
    if (it.nearMin) return ['Near Min', 'soft'];
    return ['OK', 'ok'];
  }

  function filteredStock() {
    const q = state.filters.stockQ.toLowerCase().trim();
    const status = state.filters.stockStatus;
    return state.items.filter(it => {
      if (q) {
        const hay = [it.itemCode, it.itemName, it.unit].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (status === 'low' && !it.belowMin) return false;
      if (status === 'zero' && !it.zeroStock) return false;
      if (status === 'near' && !it.nearMin) return false;
      if (status === 'ok' && (it.belowMin || it.zeroStock || it.nearMin)) return false;
      return true;
    });
  }

  function renderStock() {
    const rows = filteredStock();
    $('#stockBody').innerHTML = rows.length ? rows.map(it => {
      const [label, cls] = stockStatus(it);
      const canIssue = hasPerm('canIssue') && !it.zeroStock;
      return `<tr>
        <td><div class="stock-item"><img class="item-thumb" loading="lazy" src="${esc(imgSrc(it.imageUrl))}" onerror="this.src='${imagePlaceholder()}'"><div class="item-title"><span class="code">${esc(it.itemCode || '-')}</span><strong>${esc(it.itemName)}</strong><small class="muted">${esc(it.unit)}</small></div></div></td>
        <td class="num ${it.zeroStock ? 'neg' : ''}">${fmt(it.qtyRemain)}</td>
        <td>${esc(it.unit)}</td>
        <td>${fmt(it.minimum)}</td>
        <td><span class="status ${cls}">${label}</span></td>
        <td>${canIssue ? `<button class="btn small" data-quick-out="${esc(itemKey(it))}">Issue</button>` : '<span class="muted">-</span>'}</td>
      </tr>`;
    }).join('') : `<tr><td colspan="6" class="empty-cell">ไม่พบรายการ</td></tr>`;
    renderStats();
  }

  function renderTransactions() {
    $('#txBody').innerHTML = state.transactions.length ? state.transactions.map(t => {
      const type = String(t['Type(IN/OUT/ADJ)'] || '').toUpperCase();
      return `<tr>
        <td>${esc(t.TimestampText || '')}</td>
        <td><span class="tx-type ${type.toLowerCase()}">${esc(type)}</span></td>
        <td>${esc(t.ItemName || '')}</td>
        <td class="num">${fmt(t.Qty)}</td>
        <td>${esc(t.Unit || '')}</td>
        <td>${esc(t.Department || '')}</td>
        <td>${esc(t.StaffName || t.StaffID || '')}</td>
        <td>${esc(t.Note || '')}</td>
        <td><span class="code">${esc(t.RefNo || '')}</span></td>
      </tr>`;
    }).join('') : `<tr><td colspan="9" class="empty-cell">ไม่พบ transaction</td></tr>`;
    renderStats();
  }

  function renderIssueList() {
    const root = $('#issueList');
    if (!state.issueList.length) {
      root.className = 'issue-list empty';
      root.textContent = 'ยังไม่มีรายการ';
      return;
    }
    root.className = 'issue-list';
    root.innerHTML = state.issueList.map((it, i) => `
      <div class="issue-row">
        <div><strong>${esc(it.itemName)}</strong><small>${esc(it.unit)} • code ${esc(it.itemCode || '-')}</small></div>
        <input class="input" type="number" min="1" value="${esc(it.qty)}" data-issue-qty="${i}">
        <input class="input" value="${esc(it.note || '')}" placeholder="note" data-issue-note="${i}">
        <button class="btn small danger" data-remove-issue="${i}">Remove</button>
      </div>`).join('');
  }

  function renderItemsDb() {
    const q = state.filters.itemsDbQ.toLowerCase().trim();
    const rows = state.itemsDb.filter(it => !q || [it.itemCode, it.itemName, it.unit].join(' ').toLowerCase().includes(q));
    $('#itemsDbBody').innerHTML = rows.length ? rows.map((it) => {
      const i = state.itemsDb.indexOf(it);
      return `<tr>
        <td><span class="code">${esc(it.itemCode)}</span></td>
        <td><input class="input compact" value="${esc(it.itemName)}" data-db-name="${i}"></td>
        <td><input class="input compact" value="${esc(it.unit)}" data-db-unit="${i}"></td>
        <td><input class="input compact" type="number" value="${esc(it.minimum)}" data-db-min="${i}"></td>
        <td><input class="input compact" value="${esc(it.imageUrl || '')}" data-db-img="${i}"></td>
        <td><select data-db-active="${i}"><option ${it.isActive !== 'N' ? 'selected' : ''}>Y</option><option ${it.isActive === 'N' ? 'selected' : ''}>N</option></select></td>
        <td><button class="btn small" data-save-db="${i}">Save</button> <button class="btn small danger" data-del-db="${i}">Deactivate</button></td>
      </tr>`;
    }).join('') : `<tr><td colspan="7" class="empty-cell">ไม่พบ item</td></tr>`;
  }

  function userPermissionBadges(permissions) {
    return PERM_LABELS.filter(([k]) => permissions && permissions[k]).map(([, label]) => `<span class="mini-badge">${esc(label)}</span>`).join('') || '<span class="muted">-</span>';
  }

  function renderUsers() {
    $('#usersBody').innerHTML = state.users.length ? state.users.map((u, i) => {
      const admin = u.role === 'Admin';
      const permHtml = admin ? '<span class="mini-badge strong">All Admin</span>' : userPermissionBadges(u.permissions);
      return `<tr>
        <td><span class="code">${esc(u.staffId)}</span></td>
        <td><input class="input compact" value="${esc(u.fullName || '')}" data-user-full="${i}"></td>
        <td><select data-user-dept="${i}">${(state.config.departments || []).map(d => `<option ${u.department === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></td>
        <td><select data-user-role="${i}"><option ${u.role !== 'Admin' ? 'selected' : ''}>User</option><option ${u.role === 'Admin' ? 'selected' : ''}>Admin</option></select></td>
        <td><select data-user-active="${i}"><option ${u.isActive !== 'N' ? 'selected' : ''}>Y</option><option ${u.isActive === 'N' ? 'selected' : ''}>N</option></select></td>
        <td><div class="perm-readonly">${permHtml}</div><details><summary>แก้สิทธิ์</summary><div class="perm-grid" data-user-perms="${i}"></div></details></td>
        <td><input class="input compact" type="password" placeholder="เว้นว่างถ้าไม่เปลี่ยน" data-user-pass="${i}"></td>
        <td><button class="btn small" data-save-user="${i}">Save</button></td>
      </tr>`;
    }).join('') : `<tr><td colspan="8" class="empty-cell">ไม่พบ user</td></tr>`;

    state.users.forEach((u, i) => {
      const box = $(`[data-user-perms="${i}"]`);
      if (box) renderPermissionCheckboxes(box, u.permissions || {}, u.role === 'Admin', 'user-' + i);
    });
  }

  function addIssueFromForm() {
    try {
      const it = getSelectedItem('out');
      const qty = num($('#outQty').value);
      if (!qty || qty <= 0) throw new Error('Qty ต้องมากกว่า 0');
      if (qty > num(it.qtyRemain)) throw new Error(`Stock ไม่พอ คงเหลือ ${fmt(it.qtyRemain)} ${it.unit}`);
      const existed = state.issueList.find(x => itemKey(x) === itemKey(it));
      if (existed) existed.qty = num(existed.qty) + qty;
      else state.issueList.push({ itemCode: it.itemCode, itemName: it.itemName, unit: it.unit, qty, note: $('#outNote').value.trim() });
      $('#outQty').value = '1';
      $('#outNote').value = '';
      renderIssueList();
    } catch (err) { toast('เพิ่มรายการไม่ได้', err.message, 'error'); }
  }

  async function submitOut() {
    if (!state.issueList.length) return toast('ยังไม่มีรายการ', 'กรุณาเพิ่ม item ในใบเบิกก่อน', 'error');
    const items = state.issueList.map((it, i) => ({
      itemCode: it.itemCode,
      itemName: it.itemName,
      unit: it.unit,
      qty: num($(`[data-issue-qty="${i}"]`).value),
      note: $(`[data-issue-note="${i}"]`).value.trim()
    }));
    if (items.some(x => !x.qty || x.qty <= 0)) return toast('Qty ไม่ถูกต้อง', 'กรุณาตรวจจำนวนทุกแถว', 'error');
    try {
      setBusy(true, 'กำลังบันทึกใบเบิก...', 'ระบบกำลังตัด stock และสร้าง RefNo');
      const res = await API.request('addtxbatch', { department: $('#outDept').value, items, clientRequestId: nowId() }, { method: 'POST' });
      toast('สร้างใบเบิกสำเร็จ', `RefNo: ${res.refNo || ''}`, 'ok');
      state.issueList = [];
      state.selected.out = null;
      $('#outSearch').value = '';
      renderSelectedItem('out');
      renderIssueList();
      await forceSync();
      setTab('tx');
      await loadTransactions(true);
    } catch (err) { toast('Submit ไม่สำเร็จ', err.message, 'error'); }
    finally { setBusy(false); }
  }

  async function submitTx(type) {
    try {
      let item; let qty; let note; let department = '';
      if (type === 'IN') { item = getSelectedItem('in'); qty = num($('#inQty').value); note = $('#inNote').value.trim(); }
      if (type === 'ADJ') { item = getSelectedItem('adj'); qty = num($('#adjQty').value); note = $('#adjNote').value.trim(); if (!note) throw new Error('ADJ ต้องระบุ note'); }
      if (!qty || (qty <= 0 && type !== 'ADJ')) throw new Error('Qty ไม่ถูกต้อง');
      setBusy(true, 'กำลังบันทึกรายการ...', 'ระบบกำลังอัปเดต stock ใน Google Sheets');
      await API.request('addtx', { tx: { type, ...item, qty, note, department, clientRequestId: nowId() } }, { method: 'POST' });
      toast('บันทึกสำเร็จ', type, 'ok');
      if (type === 'IN') { $('#inQty').value = '1'; $('#inNote').value = ''; state.selected.in = null; $('#inSearch').value = ''; renderSelectedItem('in'); }
      if (type === 'ADJ') { $('#adjQty').value = '0'; $('#adjNote').value = ''; state.selected.adj = null; $('#adjSearch').value = ''; renderSelectedItem('adj'); }
      await forceSync();
    } catch (err) { toast('บันทึกไม่สำเร็จ', err.message, 'error'); }
    finally { setBusy(false); }
  }

  async function loadTransactions(showBusy = true) {
    const params = { limit: 500, type: state.filters.txType, department: state.filters.txDept, from: state.filters.txFrom, to: state.filters.txTo, q: state.filters.txQ };
    try {
      if (showBusy) setBusy(true, 'กำลังโหลด Transactions...', 'โหลดเฉพาะตอนเปิดหน้านี้ เพื่อลดเวลาหน้าแรก');
      state.transactions = await API.request('transactions', params);
      state.transactionsLoaded = true;
      state.txStale = false;
      renderTransactions();
    } finally {
      if (showBusy) setBusy(false);
    }
  }

  async function sync(silent = false, includeTransactions = false) {
    if (!state.token) return;
    if (!silent) setSyncText('Syncing stock...', 'loading');
    const data = await API.request('sync', {
      stockVersion: state.versions.stock || '',
      txVersion: state.versions.tx || '',
      includeTransactions: includeTransactions ? 'Y' : '',
      txLimit: 300
    });
    state.config = data.config || state.config;
    state.user = data.user || state.user;
    if (data.versions) state.versions = data.versions;
    if (data.items) {
      state.items = data.items;
      saveLocalItems();
    }
    if (data.transactions) {
      state.transactions = data.transactions;
      state.transactionsLoaded = true;
    } else if (data.txChanged) {
      state.txStale = true;
    }
    API.saveVersions(state.versions);
    renderDepartments();
    renderItemPickers();
    renderStock();
    if (state.transactionsLoaded) renderTransactions();
    updateRoleUI();
    setSyncText('Stock synced ' + new Date().toLocaleTimeString('th-TH'), 'ok');
  }

  async function forceSync() {
    state.versions = {};
    await sync(false);
  }

  async function login() {
    try {
      setBusy(true, 'กำลังเข้าสู่ระบบ...', 'กำลังตรวจสอบ StaffID และโหลด Stock ล่าสุด');
      const staffId = $('#loginStaff').value.trim();
      const password = $('#loginPass').value;
      const data = await API.request('login', { staffId, password }, { token: '' });
      state.token = data.token;
      state.user = data.user;
      API.saveSession({ token: data.token, user: data.user, expiresAt: data.expiresAt });
      state.versions = API.getVersions();
      await forceSync();
      startAutoSync();
      toast('Login สำเร็จ', data.user.fullName || data.user.staffId, 'ok');
    } catch (err) { toast('Login ไม่สำเร็จ', err.message, 'error'); }
    finally { setBusy(false); }
  }

  function logout(show = true) {
    API.clearSession();
    clearInterval(state.syncTimer);
    state.token = '';
    state.user = null;
    state.items = [];
    state.transactions = [];
    state.transactionsLoaded = false;
    state.txStale = false;
    state.selected = { out: null, in: null, adj: null };
    $('#appMain').classList.add('hidden');
    $('#loginCard').classList.remove('hidden');
    $('#logoutBtn').classList.add('hidden');
    $('#userText').classList.add('hidden');
    setSyncText('Logged out');
    if (show) toast('Logout', 'ออกจากระบบแล้ว');
  }

  async function loadItemsDb() {
    state.itemsDb = await API.request('itemsdb');
    renderItemsDb();
  }

  async function saveNewItem() {
    try {
      setBusy(true);
      const item = { itemName: $('#newItemName').value.trim(), unit: $('#newItemUnit').value.trim(), minimum: num($('#newItemMin').value), imageUrl: $('#newItemImg').value.trim() };
      await API.request('additem', { item }, { method: 'POST' });
      toast('เพิ่ม item สำเร็จ', item.itemName, 'ok');
      ['#newItemName', '#newItemUnit', '#newItemImg'].forEach(sel => $(sel).value = '');
      $('#newItemMin').value = '0';
      await Promise.all([forceSync(), loadItemsDb()]);
    } catch (err) { toast('เพิ่ม item ไม่สำเร็จ', err.message, 'error'); }
    finally { setBusy(false); }
  }

  async function saveDbItem(i) {
    const it = state.itemsDb[i];
    try {
      setBusy(true);
      const item = {
        ...it,
        itemName: $(`[data-db-name="${i}"]`).value.trim(),
        unit: $(`[data-db-unit="${i}"]`).value.trim(),
        minimum: num($(`[data-db-min="${i}"]`).value),
        imageUrl: $(`[data-db-img="${i}"]`).value.trim(),
        isActive: $(`[data-db-active="${i}"]`).value
      };
      await API.request('updateitemdb', { item }, { method: 'POST' });
      toast('บันทึก item แล้ว', item.itemName, 'ok');
      await Promise.all([forceSync(), loadItemsDb()]);
    } catch (err) { toast('บันทึกไม่สำเร็จ', err.message, 'error'); }
    finally { setBusy(false); }
  }

  async function deleteDbItem(i) {
    if (!confirm('ยืนยันปิดใช้งาน item นี้?')) return;
    try {
      setBusy(true);
      await API.request('deleteitemdb', { itemId: state.itemsDb[i].itemId }, { method: 'POST' });
      toast('ปิดใช้งาน item แล้ว', '', 'ok');
      await Promise.all([forceSync(), loadItemsDb()]);
    } catch (err) { toast('ลบไม่สำเร็จ', err.message, 'error'); }
    finally { setBusy(false); }
  }

  async function loadUsers() {
    state.users = await API.request('users');
    renderUsers();
  }

  function newUserPerms() {
    const role = $('#newRole').value;
    const defaults = role === 'Admin'
      ? Object.fromEntries(PERM_LABELS.map(([k]) => [k, true]))
      : { canIssue: true, canReceive: false, canAdjust: false, canManageItems: false, canManageUsers: false, canViewReports: false, canRebuild: false };
    renderPermissionCheckboxes($('#newPerms'), defaults, role === 'Admin', 'new');
  }

  async function saveUser(i, isNew = false) {
    try {
      setBusy(true);
      let user;
      if (isNew) {
        user = {
          staffId: $('#newStaffId').value.trim(),
          fullName: $('#newFullName').value.trim(),
          department: $('#newDepartment').value,
          role: $('#newRole').value,
          isActive: $('#newActive').value,
          password: $('#newPassword').value,
          permissions: collectPermissions($('#newPerms'), 'new')
        };
      } else {
        user = {
          ...state.users[i],
          fullName: $(`[data-user-full="${i}"]`).value.trim(),
          department: $(`[data-user-dept="${i}"]`).value,
          role: $(`[data-user-role="${i}"]`).value,
          isActive: $(`[data-user-active="${i}"]`).value,
          password: $(`[data-user-pass="${i}"]`).value,
          permissions: collectPermissions(document, 'user-' + i)
        };
      }
      await API.request('upsertuser', { user }, { method: 'POST' });
      toast('บันทึก user สำเร็จ', user.staffId, 'ok');
      await loadUsers();
    } catch (err) { toast('บันทึก user ไม่สำเร็จ', err.message, 'error'); }
    finally { setBusy(false); }
  }

  async function rebuildInventory() {
    if (!confirm('ยืนยัน Rebuild Inventory จาก Transactions ทั้งหมด?')) return;
    try {
      setBusy(true);
      const res = await API.request('rebuildinventory', {}, { method: 'POST' });
      toast('Rebuild สำเร็จ', `rows ${res.rows || 0}`, 'ok');
      await forceSync();
    } catch (err) { toast('Rebuild ไม่สำเร็จ', err.message, 'error'); }
    finally { setBusy(false); }
  }

  async function healthCheck() {
    try {
      const h = await API.request('health', {});
      $('#healthOut').textContent = JSON.stringify(h, null, 2);
    } catch (err) { $('#healthOut').textContent = err.message; }
  }

  async function runMinStockEmail() {
    if (!confirm('ส่ง email minimum stock ตอนนี้?')) return;
    try {
      setBusy(true);
      const res = await API.request('runminstock', {}, { method: 'POST' });
      toast('Minimum stock alert', res.sent ? `ส่งแล้ว ${res.count} รายการ` : (res.reason || 'skipped'), res.sent ? 'ok' : '');
    } catch (err) { toast('ส่ง email ไม่สำเร็จ', err.message, 'error'); }
    finally { setBusy(false); }
  }

  function csvDownload(filename, rows, columns) {
    if (!rows.length) return toast('ไม่มีข้อมูล', 'ไม่มีข้อมูลสำหรับ export');
    const csv = [columns.map(c => c.label).join(',')].concat(rows.map(r => columns.map(c => '"' + String(r[c.key] ?? '').replace(/"/g, '""') + '"').join(','))).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportStock() {
    csvDownload('bhh_inventory_stock.csv', filteredStock(), [
      { key: 'itemCode', label: 'ItemCode' }, { key: 'itemName', label: 'ItemName' }, { key: 'qtyRemain', label: 'QtyRemain' }, { key: 'unit', label: 'Unit' }, { key: 'minimum', label: 'Minimum' }
    ]);
  }

  function exportTx() {
    csvDownload('bhh_inventory_transactions.csv', state.transactions, [
      { key: 'TimestampText', label: 'Time' }, { key: 'Type(IN/OUT/ADJ)', label: 'Type' }, { key: 'ItemCode', label: 'ItemCode' }, { key: 'ItemName', label: 'ItemName' }, { key: 'Qty', label: 'Qty' }, { key: 'Unit', label: 'Unit' }, { key: 'Department', label: 'Department' }, { key: 'StaffID', label: 'StaffID' }, { key: 'StaffName', label: 'StaffName' }, { key: 'Note', label: 'Note' }, { key: 'RefNo', label: 'RefNo' }
    ]);
  }

  function startAutoSync() {
    clearInterval(state.syncTimer);
    state.syncTimer = setInterval(() => sync(true).catch(err => setSyncText('Sync error', 'error')), C.SYNC_INTERVAL_MS || 45000);
  }

  async function initSession() {
    const sess = API.getSession();
    if (sess && sess.token && (!sess.expiresAt || Number(sess.expiresAt) > Date.now())) {
      state.token = sess.token;
      state.user = sess.user;
      state.versions = API.getVersions();
      loadLocalItems();
      try {
        await sync(false);
        startAutoSync();
      } catch (err) {
        logout(false);
        toast('Session expired', 'กรุณา login ใหม่', 'error');
      }
    } else {
      logout(false);
    }
  }

  function bindEvents() {
    document.addEventListener('click', e => {
      const t = e.target;
      if (t.matches('#loginBtn')) login();
      const pickBtn = t.closest('[data-pick-kind]');
      if (pickBtn) { const it = state.items.find(x => itemKey(x) === pickBtn.dataset.pickKey); selectItem(pickBtn.dataset.pickKind, it); }
      if (t.matches('#logoutBtn')) logout(true);
      if (t.matches('#syncNowBtn') || t.matches('#refreshStockBtn')) forceSync().catch(err => toast('Sync error', err.message, 'error'));
      if (t.matches('.tab')) {
        setTab(t.dataset.tab);
        if (state.tab === 'tx' && (!state.transactionsLoaded || state.txStale)) loadTransactions(true).catch(err => toast('Load transactions error', err.message, 'error'));
        if (state.tab === 'itemsdb' && hasPerm('canManageItems')) loadItemsDb().catch(err => toast('Load items error', err.message, 'error'));
        if (state.tab === 'users' && hasPerm('canManageUsers')) loadUsers().catch(err => toast('Load users error', err.message, 'error'));
      }
      if (t.matches('#addIssueBtn')) addIssueFromForm();
      if (t.matches('#submitOutBtn')) submitOut();
      if (t.matches('#submitInBtn')) submitTx('IN');
      if (t.matches('#submitAdjBtn')) submitTx('ADJ');
      if (t.matches('[data-remove-issue]')) { state.issueList.splice(Number(t.dataset.removeIssue), 1); renderIssueList(); }
      if (t.matches('[data-quick-out]')) { const it = state.items.find(x => itemKey(x) === t.dataset.quickOut); selectItem('out', it); setTab('out'); $('#outQty').focus(); }
      if (t.matches('#applyTxBtn')) { loadTransactions(true).catch(err => toast('Load transactions error', err.message, 'error')); }
      if (t.matches('#exportStockBtn')) exportStock();
      if (t.matches('#exportTxBtn')) exportTx();
      if (t.matches('#saveNewItemBtn')) saveNewItem();
      if (t.matches('#refreshItemsDbBtn')) loadItemsDb().catch(err => toast('Load items error', err.message, 'error'));
      if (t.matches('[data-save-db]')) saveDbItem(Number(t.dataset.saveDb));
      if (t.matches('[data-del-db]')) deleteDbItem(Number(t.dataset.delDb));
      if (t.matches('#refreshUsersBtn')) loadUsers().catch(err => toast('Load users error', err.message, 'error'));
      if (t.matches('#saveNewUserBtn')) saveUser(0, true);
      if (t.matches('[data-save-user]')) saveUser(Number(t.dataset.saveUser), false);
      if (t.matches('#rebuildBtn')) rebuildInventory();
      if (t.matches('#healthBtn')) healthCheck();
      if (t.matches('#minStockEmailBtn')) runMinStockEmail();
    });

    document.addEventListener('input', e => {
      const t = e.target;
      if (t.matches('#stockSearch')) { state.filters.stockQ = t.value; renderStock(); }
      if (t.matches('#itemsDbSearch')) { state.filters.itemsDbQ = t.value; renderItemsDb(); }
      if (t.matches('#txQ')) state.filters.txQ = t.value;
      if (t.matches('#outSearch')) { state.selected.out = null; renderSelectedItem('out'); renderOutRemain(); renderSuggestions('out'); }
      if (t.matches('#inSearch')) { state.selected.in = null; renderSelectedItem('in'); renderSuggestions('in'); }
      if (t.matches('#adjSearch')) { state.selected.adj = null; renderSelectedItem('adj'); renderSuggestions('adj'); }
    });

    document.addEventListener('change', e => {
      const t = e.target;
      if (t.matches('#stockStatusFilter')) { state.filters.stockStatus = t.value; renderStock(); }
      if (t.matches('#txType')) state.filters.txType = t.value;
      if (t.matches('#txDept')) state.filters.txDept = t.value;
      if (t.matches('#txFrom')) state.filters.txFrom = t.value;
      if (t.matches('#txTo')) state.filters.txTo = t.value;
      if (t.matches('#newRole')) newUserPerms();
    });

    $('#loginPass')?.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
    ['out','in','adj'].forEach(kind => {
      const input = $(inputId(kind));
      input?.addEventListener('focus', () => renderSuggestions(kind));
      input?.addEventListener('keydown', e => { if (e.key === 'Escape') hideSuggestions(kind); });
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('.picker')) ['out','in','adj'].forEach(hideSuggestions);
    });
  }

  function initStatic() {
    $('#appTitle').textContent = C.APP_NAME || 'BHH Rx Inventory';
    if (C.LOGO_URL) $('#logo').src = C.LOGO_URL;
    renderPermissionCheckboxes($('#newPerms'), { canIssue: true }, false, 'new');
  }

  bindEvents();
  initStatic();
  initSession();
})();
