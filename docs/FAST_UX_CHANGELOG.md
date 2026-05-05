# Fast UX v3 Changelog

## Performance

- Initial sync now fetches stock only, not transactions.
- Transactions are lazy-loaded when opening the Transactions tab.
- `listTransactions_()` uses a fast path that reads only the last N rows when no filter is applied.
- Stock list is cached in Apps Script CacheService for 180 seconds.
- Stock list is cached in browser localStorage for faster perceived loading on return visits.
- Schema initialization is cached for 5 minutes to reduce repeated sheet/header checks.

## UX

- Added full-screen loading animation with status message.
- Added image thumbnails in stock and autocomplete suggestions.
- Added autocomplete item picker for OUT / IN / ADJ.
- Item picker searches partial text from ItemCode, ItemName, and Unit.
- OUT picker hides zero/negative stock items by default.
- Selected item card shows code, remain, unit, and minimum.

## Backend Compatibility

- Existing sheets are preserved.
- Existing headers are migrated by adding missing columns only.
- Existing OUT batch slip / PDF / email workflow remains supported.
