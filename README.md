# BHH Rx Inventory - Google Sheets UX + Permissions v2

ชุดนี้เป็นเวอร์ชันปรับปรุงสำหรับใช้งานต่อบน Google Sheets + Google Apps Script + GitHub Pages โดยไม่ย้าย database ไป Supabase

## จุดที่ปรับปรุงสำคัญ

1. UX สำหรับ User / Admin แยกตามสิทธิ์จริง
2. เพิ่ม permission แบบละเอียด ไม่ใช่มีแค่ Admin/User
3. เพิ่ม fast sync ผ่าน `sync` endpoint + version check
4. ใช้ `Inventory` materialized table ลดการคำนวณ stock จาก Transactions ทุกครั้ง
5. ตรวจ stock ก่อน OUT เพื่อป้องกัน stock ติดลบโดยไม่ตั้งใจ
6. เพิ่ม transaction idempotency ด้วย `ClientRequestId` ลดปัญหากด submit ซ้ำ
7. เพิ่ม audit log สำหรับ login, transaction, item, user, rebuild
8. เพิ่ม UI ค้นหา stock, filter status, dashboard risk cards, CSV export
9. เพิ่ม role-aware transactions: user ปกติเห็นรายการของตน/หน่วยงาน ส่วน Admin หรือ CanViewReports เห็นทั้งหมด

## โครงสร้างไฟล์

```text
apps-script/Code.gs          Google Apps Script backend
index.html                   GitHub Pages frontend
css/styles.css               Hospital-grade UI
js/config.js                 API config
js/api.js                    API client + JSONP read support
js/app.js                    Main UI logic
docs/DEPLOYMENT.md           วิธี deploy
docs/USER_ROLES.md           คำอธิบายสิทธิ์
docs/SHEET_SCHEMA.md         โครงสร้าง Sheet
```

## สิทธิ์ผู้ใช้

- `Admin`: เห็นทุกเมนูและทำได้ทั้งหมด
- `User + CanIssue`: เบิก OUT ได้
- `CanReceive`: รับเข้า IN ได้
- `CanAdjust`: ปรับยอด ADJ ได้
- `CanManageItems`: จัดการ item database ได้
- `CanManageUsers`: จัดการ user/role ได้
- `CanViewReports`: เห็น transaction ทั้งหมด
- `CanRebuild`: ใช้ maintenance rebuild inventory ได้

## ค่าเริ่มต้น

ถ้า Sheet `Users` ยังว่าง ระบบจะ seed:

```text
StaffID: 520294
Password: 520294
Role: Admin
```

ควรเปลี่ยน password หลัง deploy ทันที

## หมายเหตุด้าน CORS

Reads ใช้ JSONP ได้ (`JSONP_READS: true`) เพื่อช่วยกรณี Apps Script + GitHub Pages มีปัญหา CORS

Writes ใช้ POST `text/plain` เป็นหลัก ถ้าเจอ CORS จริง ๆ สามารถเปิด `JSONP_WRITE_FALLBACK: true` ใน `js/config.js` ได้ แต่ควรใช้เฉพาะระบบภายใน เพราะ payload/token จะอยู่ใน URL
