# Google Sheet Schema

## Items

| Column | Meaning |
|---|---|
| ItemID | UUID |
| ItemCode | Auto code เช่น ITM-000001 |
| ItemName | ชื่อรายการ |
| Unit | หน่วย |
| Minimum | minimum stock |
| ImageURL | รูป item |
| IsActive | Y/N |
| CreatedAt | created time |
| UpdatedAt | updated time |

## Transactions

| Column | Meaning |
|---|---|
| TxID | UUID |
| Timestamp | เวลาทำรายการ |
| Type(IN/OUT/ADJ) | IN, OUT, ADJ |
| ItemCode | code |
| ItemName | ชื่อรายการ ณ เวลาทำรายการ |
| Unit | หน่วย |
| Qty | จำนวน |
| StaffID | ผู้ทำรายการ |
| StaffName | ชื่อผู้ทำรายการ |
| Department | หน่วยงานสำหรับ OUT |
| Note | หมายเหตุ |
| RefNo | เลขใบเบิก |

## Inventory

Materialized table ที่ backend update ทุกครั้งเมื่อมี transaction เพื่อให้หน้า Stock เร็วขึ้น

| Column | Meaning |
|---|---|
| Key | ItemCode + ItemName + Unit |
| ItemCode | code |
| ItemName | ชื่อรายการ |
| Unit | หน่วย |
| QtyRemain | คงเหลือ |
| UpdatedAt | เวลาอัปเดตล่าสุด |

## Users

| Column | Meaning |
|---|---|
| StaffID | username |
| Password | plain password หรือ sha256:base64 |
| Role | Admin/User |
| FullName | ชื่อผู้ใช้ |
| IsActive | Y/N |

## Config

| Key | Meaning |
|---|---|
| ENABLE_EMAIL | Y/N |
| ENABLE_PDF | Y/N |
| MIN_STOCK_EMAIL_TO | ผู้รับ minimum stock alert |
| MIN_STOCK_EMAIL_CC | cc |
| MIN_STOCK_EMAIL_SUBJECT | subject |
