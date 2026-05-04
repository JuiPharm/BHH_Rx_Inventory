# User Roles & Permissions

## แนวคิด

ระบบแยก `Role` ออกจาก `Permission` เพื่อให้ workflow ยืดหยุ่นกว่าเดิม

- Role = กลุ่มใหญ่ เช่น Admin / User
- Permission = สิทธิ์จริงที่เปิดเมนูและ backend action

## Permission Matrix

| Permission | เมนู | Backend action | เหมาะกับ |
|---|---|---|---|
| CanIssue | Issue (OUT) | addtx OUT, addtxbatch | User หน่วยงาน |
| CanReceive | Receive (IN) | addtx IN | คลัง/เจ้าหน้าที่รับเข้า |
| CanAdjust | Adjust | addtx ADJ | Admin คลัง / ตรวจนับ |
| CanManageItems | Database Items | additem, updateitemdb, deleteitemdb | Admin item master |
| CanManageUsers | Users & Roles | upsertuser | IT/Admin |
| CanViewReports | Transactions all | transactions all | หัวหน้า/ผู้บริหาร |
| CanRebuild | Settings | rebuildinventory | IT/Admin |

## Recommended Roles

### Standard User

```text
Role = User
CanIssue = Y
อื่น ๆ = N
```

เห็นเฉพาะ Stock, Issue, Transactions ที่เกี่ยวข้อง

### Department Supervisor

```text
Role = User
CanIssue = Y
CanViewReports = Y
```

ดู transaction ทั้งหมดได้ แต่ไม่แก้ master data

### Inventory Clerk

```text
Role = User
CanIssue = Y
CanReceive = Y
CanViewReports = Y
```

เบิก/รับเข้าได้ แต่ยังไม่จัดการ user

### Admin

```text
Role = Admin
ทุก permission = Y อัตโนมัติ
```

เห็นทุกเมนูและทำทุก action ได้

## Security Notes

- ห้าม commit password จริงลง public repo
- ควรเปลี่ยน password default 520294 หลัง deploy
- ถ้าผู้ใช้ลาออก ให้ตั้ง `IsActive = N`
- ระบบป้องกันการ deactivate/downgrade admin คนสุดท้าย
