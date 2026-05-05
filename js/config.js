window.INVENTORY_CONFIG = {
  API_URL: 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_EXEC_URL_HERE',
  APP_NAME: 'BHH Rx Inventory',
  LOGO_URL: '',
  SYNC_INTERVAL_MS: 60000,
  SESSION_KEY: 'bhh_rx_inventory_session_fastux_v3',
  JSONP_READS: true,
  // เปิดเป็น true เฉพาะกรณี GitHub Pages เจอ CORS กับ Apps Script POST
  // ข้อควรระวัง: token/payload จะอยู่ใน URL history/log จึงควรใช้เฉพาะระบบภายในที่จำเป็น
  JSONP_WRITE_FALLBACK: false
};
