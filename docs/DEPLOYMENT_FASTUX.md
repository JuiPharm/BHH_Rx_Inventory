# Deployment Guide - Fast UX Google Sheets Version

## 1. Apps Script

1. Open Apps Script project.
2. Replace current `Code.gs` with `apps-script/Code.gs` from this package.
3. Set Script Properties:

```text
DB_SHEET_ID = your_google_sheet_id
AUTH_SECRET = long_random_secret
```

4. Run:

```javascript
setupDatabase_()
```

5. Deploy > New deployment > Web app.
6. Use `/exec` URL for frontend config.

## 2. Frontend

Edit `js/config.js`:

```javascript
API_URL: 'https://script.google.com/macros/s/XXXXX/exec'
```

Then commit and push to GitHub Pages repo.

## 3. Recommended Config values in Config sheet

```text
APP_NAME = BHH Rx Inventory
DEPARTMENTS = OPD Pharmacy|IPD Pharmacy|IV Chemo
ALLOW_NEGATIVE_STOCK = N
REQUIRE_DEPARTMENT_MATCH = N
LOGO_URL = optional_logo_url
```

## 4. First test

```text
YOUR_EXEC_URL?action=health
YOUR_EXEC_URL?action=health&callback=testCallback
```

Expected:

```javascript
testCallback({ ok: true, data: ... })
```

## 5. Troubleshooting

### Login slow
Usually first request after deployment is slower because Apps Script cold-starts and validates schema. Later requests should be faster due to init cache.

### Transactions still slow
Open Transactions with no filter first. This uses the fast path and reads last 500 rows only. Heavy keyword/date filters still require scanning the sheet.

### Images not showing
Check `ImageURL` column in Items sheet. Public image URLs are easiest. If using Google Drive links, ensure they are direct image-accessible links.

### POST CORS problem
Default uses `text/plain` POST. If your browser still blocks it, set in `js/config.js`:

```javascript
JSONP_WRITE_FALLBACK: true
```

Use only in internal environments because payload/token may appear in URL logs.
