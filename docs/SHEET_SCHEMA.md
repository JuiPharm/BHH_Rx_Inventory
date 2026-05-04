# Sheet Schema

## Users

```text
StaffID
Password
Role
FullName
Department
CanIssue
CanReceive
CanAdjust
CanManageItems
CanManageUsers
CanViewReports
CanRebuild
IsActive
LastLoginAt
CreatedAt
UpdatedAt
```

## Items

```text
ItemID
ItemCode
ItemName
Unit
Minimum
ImageURL
IsActive
CreatedAt
UpdatedAt
```

## Transactions

```text
TxID
Timestamp
Type(IN/OUT/ADJ)
ItemCode
ItemName
Unit
Qty
StaffID
StaffName
Department
Note
RefNo
ClientRequestId
```

## Inventory

```text
Key
ItemCode
ItemName
Unit
QtyRemain
UpdatedAt
```

## Config

```text
Key
Value
Description
```

Default config:

```text
APP_NAME
DEPARTMENTS
ALLOW_NEGATIVE_STOCK
REQUIRE_DEPARTMENT_MATCH
MIN_STOCK_EMAIL_TO
MIN_STOCK_EMAIL_CC
ISSUE_EMAIL_ENABLED
PDF_ENABLED
LOGO_URL
```

## AUDIT_LOG

```text
Time
StaffID
Role
Action
Target
Detail
Result
ClientInfo
```
