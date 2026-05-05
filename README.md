# BHH Rx Inventory - Fast UX Google Sheets Version v3

เวอร์ชันนี้ออกแบบใหม่เพื่อแก้ปัญหาโหลดนานบน Google Sheets โดยยังใช้สถาปัตยกรรมเดิม:

- GitHub Pages frontend
- Google Apps Script Web App backend
- Google Sheets database

## จุดปรับปรุงหลัก

1. หน้าแรกไม่โหลด Transactions อัตโนมัติแล้ว
   - โหลดเฉพาะ Stock / Items / Config ที่จำเป็น
   - Transactions จะโหลดเมื่อกดเมนู Transactions หรือกด Apply filter เท่านั้น

2. เพิ่ม Loading animation
   - Login
   - Sync stock
   - Submit OUT / IN / ADJ
   - Load Transactions
   - Admin actions

3. คืนการแสดงรูปจาก ImageURL
   - Stock table แสดงรูป thumbnail
   - Autocomplete suggestion แสดงรูปประกอบ
   - มี placeholder ถ้าไม่มีรูปหรือรูปโหลดไม่ได้

4. เปลี่ยน Item selection เป็น autocomplete
   - Issue OUT
   - Receive IN
   - Adjust ADJ
   - พิมพ์บางส่วนของชื่อ / code / unit แล้วเลือกรายการได้ทันที

5. ลดเวลารอจาก Google Sheets
   - `sync` endpoint ไม่ส่ง Transactions กลับมาโดย default
   - `listTransactions_()` อ่านเฉพาะท้ายตารางเมื่อไม่มี filter
   - `CacheService` เก็บ stock list 180 วินาที
   - browser เก็บ stock cache ใน localStorage เพื่อแสดงผลได้เร็วขึ้นตอนกลับมาใช้ซ้ำ
   - `ensureInitialized_()` ใช้ init cache เพื่อลดการตรวจ schema ซ้ำทุก request

## Deploy สั้น ๆ

1. Backup Google Sheet เดิม
2. เปิด Apps Script แล้วแทนที่ด้วย `apps-script/Code.gs`
3. ตั้ง Script Properties:
   - `DB_SHEET_ID`
   - `AUTH_SECRET`
4. Run `setupDatabase_()` 1 ครั้ง
5. Deploy as Web App
   - Execute as: Me
   - Access: Anyone with link หรือ Organization ตามนโยบายโรงพยาบาล
6. Copy Web App `/exec` URL ไปใส่ใน `js/config.js`
7. Push โฟลเดอร์นี้ขึ้น GitHub repo แล้วเปิด GitHub Pages

## ทดสอบหลัง Deploy

- Login ได้
- Stock แสดงเร็วขึ้นและมีรูป
- OUT: พิมพ์บางส่วนแล้วเลือก item ได้
- IN: พิมพ์บางส่วนแล้วเลือก item ได้
- ADJ: พิมพ์บางส่วนแล้วเลือก item ได้
- Transactions ไม่โหลดจนกว่าจะเปิดเมนู Transactions
- Submit OUT แล้ว stock ลด และ RefNo ถูกสร้าง
- Refresh stock แล้วข้อมูลเปลี่ยนตาม

## หมายเหตุ

- หาก Google Sheets มี Transactions จำนวนมากมาก ๆ การ filter แบบ keyword/date ที่ต้อง scan ทั้งตารางยังอาจช้าอยู่บ้าง เพราะข้อจำกัดของ Google Sheets
- ถ้าต้องการเร็วระดับ real-time สำหรับข้อมูลหลักหมื่นถึงแสน rows ควรพิจารณาย้ายฐานข้อมูลไป Supabase/PostgreSQL
- ห้าม commit secret, Sheet ID ที่ไม่ต้องการเปิดเผย, admin password หรือข้อมูลผู้ป่วยลง public repo
