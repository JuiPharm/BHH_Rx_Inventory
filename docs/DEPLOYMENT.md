# Deploy — Google Sheets Optimized

## 1) Google Sheet

สร้าง Google Sheet หรือใช้ไฟล์เดิม แล้วให้ระบบมี sheets ต่อไปนี้:

- ItemsSeed
- Items
- Transactions
- Inventory
- Users
- Config
- SLIPS
- AUDIT_LOG

ถ้ายังไม่มี `Code.gs` จะ auto-create sheets/header ให้

## 2) Apps Script

1. เปิด Extensions → Apps Script
2. วางไฟล์ `apps-script/Code.gs`
3. ตั้ง Script Properties:
   - `DB_SHEET_ID` = Google Sheet ID
   - `AUTH_SECRET` = random long string (optional แต่แนะนำ)
4. Run function `setupDatabase_()` หนึ่งครั้ง
5. Deploy → New deployment → Web app
   - Execute as: Me
   - Who has access: Anyone with the link หรือ domain ตามนโยบายโรงพยาบาล
6. Copy Web App URL ที่ลงท้าย `/exec`

## 3) Frontend / GitHub Pages

1. แก้ `js/config.js`
   ```js
   API_URL: 'https://script.google.com/macros/s/xxxxx/exec'
   ```
2. Upload ไฟล์ใน folder นี้ไป repo GitHub Pages
3. เปิดหน้าเว็บและ login

## 4) Test checklist

- เปิด `?action=health` ได้ JSON
- login ได้
- Stock โหลดได้เร็ว
- OUT batch ได้ RefNo เดียว
- IN เฉพาะ Admin
- Rebuild Inventory สำเร็จ
- Email/PDF ทำงานหลัง submit โดยไม่ทำให้การ write transaction ช้า
