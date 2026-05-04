# Deployment Guide

## 1) Google Sheet

ใช้ Google Sheet เดิมได้ หรือสร้างใหม่ก็ได้ ถ้าใช้เดิมให้ backup ก่อน

แนะนำให้มี sheets เหล่านี้:

- `ItemsSeed` optional
- `Items`
- `Transactions`
- `Inventory`
- `Users`
- `Config`
- `SLIPS`
- `AUDIT_LOG`

ถ้ายังไม่มี ระบบจะสร้างให้อัตโนมัติเมื่อเรียก `setup`

## 2) Apps Script

1. เปิด Google Sheet
2. Extensions → Apps Script
3. วางไฟล์ `apps-script/Code.gs`
4. ตั้ง Script Properties:

```text
DB_SHEET_ID = Google Sheet ID
AUTH_SECRET = random-long-secret
```

5. Run function `setupDatabase_()` 1 ครั้ง และอนุญาต permission
6. Deploy → New deployment → Web app
7. Execute as: Me
8. Who has access: Anyone with the link หรือภายใน organization ตาม policy
9. Copy Web App URL ที่ลงท้าย `/exec`

## 3) Frontend GitHub Pages

1. เปิด `js/config.js`
2. ใส่ URL:

```js
API_URL: 'https://script.google.com/macros/s/xxxx/exec'
```

3. Push ไฟล์ทั้งหมดไป repo
4. Settings → Pages → Deploy from branch หรือ GitHub Actions
5. เปิดหน้าเว็บแล้ว login

## 4) Test checklist

เปิด browser แล้วทดสอบตามลำดับ:

1. Login admin ได้
2. Stock แสดงข้อมูล
3. Search/filter stock ทำงาน
4. OUT เพิ่ม item เข้า slip ได้
5. OUT submit ได้ RefNo
6. User ปกติไม่เห็นเมนู IN/ADJ/Users ถ้าไม่มีสิทธิ์
7. Admin สร้าง user ใหม่ได้
8. ตั้ง user ให้มี CanIssue อย่างเดียว แล้ว login ทดสอบ
9. Admin เพิ่ม item ใหม่แล้ว stock list เห็น item
10. Rebuild Inventory ทำงาน
11. Health Check แสดง version และ sheets

## 5) Troubleshooting

### Login ได้ แต่ข้อมูลไม่โหลด

ตรวจ `API_URL` และเปิด URL นี้ใน browser:

```text
YOUR_EXEC_URL?action=health
```

### GitHub Pages เรียก POST ไม่ได้

ใน `js/config.js` ลองเปิด:

```js
JSONP_WRITE_FALLBACK: true
```

ใช้เฉพาะกรณีจำเป็น และไม่ควรใช้กับ secret/highly sensitive data

### OUT submit แล้ว email ไม่ส่ง

ตรวจ Apps Script permissions และแก้ routing ใน `ISSUE_MAIL_ROUTING` หรือปิดการส่ง email ใน Config:

```text
ISSUE_EMAIL_ENABLED = N
```
