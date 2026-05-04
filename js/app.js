(function(){
  const C = window.INVENTORY_CONFIG;
  const API = window.InventoryAPI;
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const state = {
    user: null, token: '', busy: false, tab: 'stock',
    items: [], transactions: [], itemsDb: [], users: [],
    issueList: [], selectedRefNos: new Set(), versions: {},
    filters: { inventorySearch:'', txType:'', txQ:'', txFrom:'', txTo:'' },
    syncTimer: null, idleTimer: null, lastActivity: Date.now()
  };

  function escapeHtml(s){ return String(s??'').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function n(v){ const x = Number(String(v??0).replace(/,/g,'')); return Number.isFinite(x) ? x : 0; }
  function fmtNum(v){ return new Intl.NumberFormat('th-TH',{maximumFractionDigits:2}).format(n(v)); }
  function keyOf(it){ return [it.itemCode||'',it.itemName||'',it.unit||''].join('|'); }
  function splitKey(k){ const a=String(k||'').split('|'); return {itemCode:a[0]||'', itemName:a[1]||'', unit:a[2]||''}; }
  function imageSrc(url){
    const raw=String(url||'').trim(); if(!raw) return '';
    let m=raw.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i)||raw.match(/[?&]id=([a-zA-Z0-9_-]+)/i)||raw.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/i);
    return m && m[1] ? `https://lh5.googleusercontent.com/d/${m[1]}=w180` : raw;
  }
  function toast(title,msg){
    const area=$('#toastArea'); const el=document.createElement('div'); el.className='toast';
    el.innerHTML=`<b>${escapeHtml(title)}</b><span>${escapeHtml(msg||'')}</span>`; area.appendChild(el);
    setTimeout(()=>el.remove(),4200);
  }
  function setBusy(v){ state.busy=!!v; $$('button,input,select,textarea').forEach(el=>{ if(el.dataset.noBusy!=='1') el.disabled=state.busy && el.dataset.keepEnabled!=='1'; }); }
  function show(el, yes){ if(!el) return; el.classList.toggle('hidden', !yes); }

  function initSession(){
    const s=API.getSession(); state.token=s.token||''; state.user=s.user||null; state.versions=API.getVersions()||{};
    if(state.user){ $('#loginCard').classList.add('hidden'); $('#appMain').classList.remove('hidden'); $('#userText').textContent = `${state.user.fullName||state.user.staffId} (${state.user.role})`; startIdle(); startSync(); loadInitial(); }
    else { $('#loginCard').classList.remove('hidden'); $('#appMain').classList.add('hidden'); }
  }
  function isAdmin(){ return state.user && String(state.user.role||'').toLowerCase()==='admin'; }
  function requireAdminUi(){ $$('.admin-only').forEach(el=>show(el,isAdmin())); }
  function markActive(){ state.lastActivity=Date.now(); localStorage.setItem('bhh_inv_last_active', String(state.lastActivity)); }
  function startIdle(){
    ['click','mousemove','keydown','scroll','touchstart'].forEach(ev=>window.addEventListener(ev, markActive, {passive:true}));
    if(state.idleTimer) clearInterval(state.idleTimer);
    state.idleTimer=setInterval(()=>{ const last=Number(localStorage.getItem('bhh_inv_last_active')||Date.now()); if(Date.now()-last > C.IDLE_TIMEOUT_MS){ logout(true); } },10000);
  }
  function startSync(){ if(state.syncTimer) clearInterval(state.syncTimer); state.syncTimer=setInterval(syncFast, C.SYNC_INTERVAL_MS||15000); }

  async function login(){
    try{
      setBusy(true); const staffId=$('#loginStaff').value.trim(); const password=$('#loginPass').value;
      const data=await API.request('login',{staffId,password}); state.token=data.token; state.user=data.user; API.saveSession({token:state.token,user:state.user}); markActive(); toast('Success','เข้าสู่ระบบสำเร็จ'); initSession();
    }catch(e){ toast('Login error',e.message||String(e)); }
    finally{ setBusy(false); }
  }
  function logout(auto){ API.clearSession(); state.user=null; state.token=''; state.items=[]; state.transactions=[]; if(state.syncTimer) clearInterval(state.syncTimer); if(state.idleTimer) clearInterval(state.idleTimer); renderAll(); initSession(); toast(auto?'Session expired':'Logout',auto?'ไม่มีการใช้งานเกินเวลาที่กำหนด':'ออกจากระบบแล้ว'); }

  async function loadInitial(){
    try{ setBusy(true); requireAdminUi(); await Promise.all([loadItems(), loadTransactions()]); renderAll(); syncFast(); }
    catch(e){ toast('Load error',e.message||String(e)); }
    finally{ setBusy(false); }
  }
  async function syncFast(){
    if(!state.user || state.busy) return;
    try{
      const data=await API.request('sync',{ itemVersion: state.versions.itemVersion||'', txVersion: state.versions.txVersion||'', limit: C.TRANSACTION_LIMIT||1200 });
      if(data.versions){ state.versions=data.versions; API.saveVersions(state.versions); }
      if(Array.isArray(data.items)){ state.items=data.items; renderStock(); renderOptions(); }
      if(Array.isArray(data.transactions)){ state.transactions=data.transactions; renderTransactions(); renderStats(); }
      $('#syncText').textContent='Synced '+new Date().toLocaleTimeString('th-TH');
    }catch(e){ $('#syncText').textContent='Sync error'; }
  }
  async function loadItems(){ state.items=await API.request('list'); renderStock(); renderOptions(); renderStats(); }
  async function loadTransactions(){ state.transactions=await API.request('transactions',{limit:C.TRANSACTION_LIMIT||1200, type:state.filters.txType, q:state.filters.txQ, from:state.filters.txFrom, to:state.filters.txTo}); renderTransactions(); renderStats(); }
  async function loadItemsDb(){ if(!isAdmin()) return; state.itemsDb=await API.request('itemsdb'); renderItemsDb(); }
  async function loadUsers(){ if(!isAdmin()) return; state.users=await API.request('users'); renderUsers(); }

  function setTab(tab){ state.tab=tab; $$('.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab)); $$('.page').forEach(p=>show(p,p.id===`page-${tab}`)); requireAdminUi(); if(tab==='itemsdb') loadItemsDb().catch(e=>toast('Error',e.message)); if(tab==='users') loadUsers().catch(e=>toast('Error',e.message)); }
  function renderAll(){ renderStats(); renderStock(); renderTransactions(); renderOptions(); renderIssueList(); requireAdminUi(); }
  function filteredItems(){ const q=state.filters.inventorySearch.toLowerCase().trim(); if(!q) return state.items; return state.items.filter(it=>[it.itemCode,it.itemName,it.unit].join(' ').toLowerCase().includes(q)); }
  function renderStats(){
    const itemCount=state.items.length, low=state.items.filter(x=>x.belowMin).length, stockValue=state.items.reduce((s,x)=>s+n(x.qtyRemain),0), txToday=state.transactions.filter(x=>String(x.TimestampText||'').slice(0,10)===new Date().toISOString().slice(0,10)).length;
    $('#statItems').textContent=fmtNum(itemCount); $('#statLow').textContent=fmtNum(low); $('#statQty').textContent=fmtNum(stockValue); $('#statTx').textContent=fmtNum(txToday);
  }
  function renderStock(){
    const tbody=$('#stockBody'); const rows=filteredItems();
    if(!rows.length){ tbody.innerHTML=`<tr><td colspan="7" class="empty">ไม่พบรายการ</td></tr>`; return; }
    tbody.innerHTML=rows.map(it=>{
      const qty=n(it.qtyRemain), min=n(it.minimum); const low=it.belowMin, watch=!low && min>0 && qty<=min*1.25;
      return `<tr class="${low?'stock-low':watch?'stock-watch':''}"><td>${it.imageUrl?`<img src="${escapeHtml(imageSrc(it.imageUrl))}" style="width:56px;height:42px;object-fit:contain;border-radius:10px" onerror="this.style.display='none'">`:''}</td><td><b>${escapeHtml(it.itemName)}</b><div class="muted mono">${escapeHtml(it.itemCode||'')}</div></td><td class="mono">${fmtNum(qty)}</td><td>${escapeHtml(it.unit)}</td><td>${fmtNum(min)}</td><td>${low?'<span class="status low">ต่ำกว่า Minimum</span>':watch?'<span class="status watch">Watch</span>':'<span class="status ok">OK</span>'}</td><td><button class="btn small secondary" data-quick-out="${escapeHtml(keyOf(it))}">เบิก</button></td></tr>`;
    }).join('');
  }
  function renderOptions(){
    const opts=state.items.map(it=>`<option value="${escapeHtml(keyOf(it))}">${escapeHtml(it.itemName)} — ${escapeHtml(it.unit)} | คงเหลือ ${fmtNum(it.qtyRemain)}</option>`).join('');
    ['#inItem','#outItem'].forEach(sel=>{ const old=$(sel).value; $(sel).innerHTML=opts; if(old) $(sel).value=old; });
  }
  function renderTransactions(){
    const tbody=$('#txBody'); const rows=state.transactions;
    if(!rows.length){ tbody.innerHTML=`<tr><td colspan="10" class="empty">ไม่พบประวัติ</td></tr>`; return; }
    tbody.innerHTML=rows.map(r=>`<tr><td>${escapeHtml(r.TimestampText||r.Timestamp||'')}</td><td><span class="status ${String(r['Type(IN/OUT/ADJ)']).toUpperCase()==='OUT'?'watch':'ok'}">${escapeHtml(r['Type(IN/OUT/ADJ)']||r.type||'')}</span></td><td><b>${escapeHtml(r.ItemName||r.itemName||'')}</b><div class="muted mono">${escapeHtml(r.ItemCode||r.itemCode||'')}</div></td><td class="mono">${fmtNum(r.Qty||r.qty)}</td><td>${escapeHtml(r.Unit||r.unit||'')}</td><td>${escapeHtml(r.Department||r.department||'')}</td><td>${escapeHtml(r.StaffName||r.staffName||r.StaffID||'')}</td><td>${escapeHtml(r.Note||r.note||'')}</td><td class="mono">${escapeHtml(r.RefNo||r.refNo||'')}</td><td>${r.RefNo?`<input type="checkbox" data-ref="${escapeHtml(r.RefNo)}">`:''}</td></tr>`).join('');
  }
  function renderIssueList(){
    const box=$('#issueList');
    if(!state.issueList.length){ box.innerHTML='<div class="empty">ยังไม่มีรายการในใบเบิก</div>'; return; }
    box.innerHTML=state.issueList.map((it,i)=>`<div class="slip-item"><b>${escapeHtml(it.itemName)}</b><input class="input" type="number" min="1" value="${escapeHtml(it.qty)}" data-issue-qty="${i}"><span>${escapeHtml(it.unit)}</span><input class="input" value="${escapeHtml(it.note||'')}" data-issue-note="${i}"><button class="btn small danger" data-remove-issue="${i}">Remove</button></div>`).join('');
  }
  function renderItemsDb(){
    const tbody=$('#itemsDbBody'); if(!state.itemsDb.length){ tbody.innerHTML=`<tr><td colspan="7" class="empty">ไม่พบข้อมูล</td></tr>`; return; }
    tbody.innerHTML=state.itemsDb.map((it,i)=>`<tr><td class="mono">${escapeHtml(it.itemCode||'')}</td><td><input class="input" value="${escapeHtml(it.itemName||'')}" data-db-name="${i}"></td><td><input class="input" value="${escapeHtml(it.unit||'')}" data-db-unit="${i}"></td><td><input class="input" type="number" value="${escapeHtml(it.minimum||0)}" data-db-min="${i}"></td><td><input class="input" value="${escapeHtml(it.imageUrl||'')}" data-db-img="${i}"></td><td><select data-db-active="${i}"><option ${it.isActive!=='N'?'selected':''}>Y</option><option ${it.isActive==='N'?'selected':''}>N</option></select></td><td><button class="btn small" data-save-db="${i}">Save</button> <button class="btn small danger" data-del-db="${i}">Delete</button></td></tr>`).join('');
  }
  function renderUsers(){
    const tbody=$('#usersBody'); if(!state.users.length){ tbody.innerHTML=`<tr><td colspan="6" class="empty">ไม่พบผู้ใช้</td></tr>`; return; }
    tbody.innerHTML=state.users.map((u,i)=>`<tr><td class="mono">${escapeHtml(u.staffId)}</td><td><input class="input" value="${escapeHtml(u.fullName||'')}" data-user-full="${i}"></td><td><select data-user-role="${i}"><option ${u.role==='Admin'?'selected':''}>Admin</option><option ${u.role!=='Admin'?'selected':''}>User</option></select></td><td><select data-user-active="${i}"><option ${u.isActive!=='N'?'selected':''}>Y</option><option ${u.isActive==='N'?'selected':''}>N</option></select></td><td><input type="password" class="input" placeholder="เว้นว่างถ้าไม่เปลี่ยน" data-user-pass="${i}"></td><td><button class="btn small" data-save-user="${i}">Save</button></td></tr>`).join('');
  }

  function addIssueFromForm(){ const k=$('#outItem').value; const it=splitKey(k); if(!it.itemName) return toast('Missing item','กรุณาเลือก Item'); state.issueList.push({...it, qty:n($('#outQty').value)||1, note:$('#outNote').value.trim()}); $('#outNote').value=''; renderIssueList(); }
  async function submitOutBatch(){
    if(!state.issueList.length) return toast('Missing items','กรุณาเพิ่มรายการในใบเบิกก่อน');
    const department=$('#outDept').value; const items=state.issueList.map((it,i)=>({...it, qty:n(($(`[data-issue-qty="${i}"]`)||{}).value||it.qty), note:($(`[data-issue-note="${i}"]`)||{}).value||it.note}));
    try{ setBusy(true); const res=await API.request('addtxbatch',{department,items},{method:'POST'}); toast('Created',`สร้างใบเบิก ${res.refNo||''} สำเร็จ`); state.issueList=[]; await Promise.all([loadItems(),loadTransactions()]); renderIssueList(); }
    catch(e){ toast('Submit error',e.message||String(e)); } finally{ setBusy(false); }
  }
  async function submitIn(){
    const it=splitKey($('#inItem').value); const tx={type:'IN',...it,qty:n($('#inQty').value),note:$('#inNote').value.trim()};
    try{ setBusy(true); await API.request('addtx',{tx},{method:'POST'}); toast('Saved','รับเข้า Stock สำเร็จ'); await Promise.all([loadItems(),loadTransactions()]); }
    catch(e){ toast('Save error',e.message||String(e)); } finally{ setBusy(false); }
  }
  async function saveNewItem(){
    const item={itemName:$('#newItemName').value.trim(),unit:$('#newItemUnit').value.trim(),minimum:n($('#newItemMin').value),imageUrl:$('#newItemImg').value.trim()};
    try{ setBusy(true); await API.request('additem',{item},{method:'POST'}); toast('Saved','เพิ่ม Item สำเร็จ'); ['#newItemName','#newItemUnit','#newItemMin','#newItemImg'].forEach(s=>$(s).value=''); await loadItems(); }
    catch(e){ toast('Save item error',e.message||String(e)); } finally{ setBusy(false); }
  }
  async function saveDbItem(i){ const it=state.itemsDb[i]; const item={...it,itemName:$(`[data-db-name="${i}"]`).value.trim(),unit:$(`[data-db-unit="${i}"]`).value.trim(),minimum:n($(`[data-db-min="${i}"]`).value),imageUrl:$(`[data-db-img="${i}"]`).value.trim(),isActive:$(`[data-db-active="${i}"]`).value}; try{setBusy(true); await API.request('updateitemdb',{item},{method:'POST'}); toast('Saved','อัปเดต Item แล้ว'); await Promise.all([loadItems(),loadItemsDb()]);}catch(e){toast('Error',e.message)}finally{setBusy(false);} }
  async function deleteDbItem(i){ if(!confirm('ยืนยันปิดใช้งาน Item นี้?')) return; try{setBusy(true); await API.request('deleteitemdb',{itemId:state.itemsDb[i].itemId},{method:'POST'}); toast('Deleted','ปิดใช้งาน Item แล้ว'); await Promise.all([loadItems(),loadItemsDb()]);}catch(e){toast('Error',e.message)}finally{setBusy(false);} }
  async function saveUser(i,isNew){ const user=isNew?{staffId:$('#newStaffId').value.trim(),fullName:$('#newFullName').value.trim(),role:$('#newRole').value,isActive:$('#newActive').value,password:$('#newPassword').value}:{...state.users[i],fullName:$(`[data-user-full="${i}"]`).value.trim(),role:$(`[data-user-role="${i}"]`).value,isActive:$(`[data-user-active="${i}"]`).value,password:$(`[data-user-pass="${i}"]`).value}; try{setBusy(true); await API.request('upsertuser',{user},{method:'POST'}); toast('Saved','บันทึกผู้ใช้แล้ว'); await loadUsers();}catch(e){toast('Error',e.message)}finally{setBusy(false);} }
  async function rebuildInventory(){ if(!confirm('Rebuild Inventory จาก Transactions ทั้งหมด?')) return; try{setBusy(true); const r=await API.request('rebuildinventory',{}, {method:'POST'}); toast('Rebuilt',`rows: ${r.rows||0}`); await Promise.all([loadItems(),loadTransactions()]);}catch(e){toast('Error',e.message)}finally{setBusy(false);} }
  async function health(){ try{ const h=await API.request('health',{}); $('#healthOut').textContent=JSON.stringify(h,null,2);}catch(e){$('#healthOut').textContent=e.message;} }
  function downloadCsv(){ const rows=state.transactions; if(!rows.length) return; const cols=['TimestampText','Type(IN/OUT/ADJ)','ItemCode','ItemName','Unit','Qty','Department','StaffID','StaffName','Note','RefNo']; const csv=[cols.join(',')].concat(rows.map(r=>cols.map(c=>'"'+String(r[c]??'').replace(/"/g,'""')+'"').join(','))).join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='inventory_transactions.csv'; a.click(); URL.revokeObjectURL(a.href); }

  document.addEventListener('click', e=>{
    const t=e.target;
    if(t.matches('#loginBtn')) login(); if(t.matches('#logoutBtn')) logout(false); if(t.matches('.tab')) setTab(t.dataset.tab);
    if(t.matches('#refreshStock')) loadItems().catch(err=>toast('Error',err.message)); if(t.matches('#refreshTx')) loadTransactions().catch(err=>toast('Error',err.message));
    if(t.matches('#addIssue')) addIssueFromForm(); if(t.matches('#submitOut')) submitOutBatch(); if(t.matches('#submitIn')) submitIn(); if(t.matches('#saveNewItem')) saveNewItem();
    if(t.matches('[data-remove-issue]')){ state.issueList.splice(Number(t.dataset.removeIssue),1); renderIssueList(); }
    if(t.matches('[data-save-db]')) saveDbItem(Number(t.dataset.saveDb)); if(t.matches('[data-del-db]')) deleteDbItem(Number(t.dataset.delDb)); if(t.matches('#refreshItemsDb')) loadItemsDb().catch(err=>toast('Error',err.message));
    if(t.matches('#saveNewUser')) saveUser(0,true); if(t.matches('[data-save-user]')) saveUser(Number(t.dataset.saveUser),false); if(t.matches('#refreshUsers')) loadUsers().catch(err=>toast('Error',err.message));
    if(t.matches('#rebuildBtn')) rebuildInventory(); if(t.matches('#healthBtn')) health(); if(t.matches('#downloadCsv')) downloadCsv();
    if(t.matches('[data-quick-out]')){ setTab('out'); $('#outItem').value=t.dataset.quickOut; $('#outQty').focus(); }
  });
  document.addEventListener('input', e=>{
    const t=e.target;
    if(t.matches('#inventorySearch')){ state.filters.inventorySearch=t.value; renderStock(); }
    if(t.matches('#txQ')) state.filters.txQ=t.value;
  });
  document.addEventListener('change', e=>{ const t=e.target; if(t.matches('#txType')) state.filters.txType=t.value; if(t.matches('#txFrom')) state.filters.txFrom=t.value; if(t.matches('#txTo')) state.filters.txTo=t.value; if(t.matches('[data-ref]')){ t.checked?state.selectedRefNos.add(t.dataset.ref):state.selectedRefNos.delete(t.dataset.ref); } });
  $('#applyTxFilter')?.addEventListener('click',()=>loadTransactions().catch(err=>toast('Error',err.message)));
  $('#loginPass')?.addEventListener('keydown',e=>{ if(e.key==='Enter') login(); });
  initSession();
})();
