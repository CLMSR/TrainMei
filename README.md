# Training Planner

## What this version fixes
- The original file used `window.storage`, which is Claude Artifacts' storage API.
- This version uses browser `localStorage`, so it works when opened normally in Chrome/Safari.
- Data survives closing/reopening the browser on the same device/browser profile.
- Includes JSON Backup/Restore buttons.
- Includes PWA files (`manifest.webmanifest` and `sw.js`) so it can be installed as a web app once hosted over HTTPS.

## Important limitation
LocalStorage does NOT sync between Mac and iPhone.

For true cross-device sync, the app needs a cloud database (for example Supabase) and authentication/security rules. The HTML is structured with a `CLOUD_CONFIG` section ready for that next step, but cloud sync is not enabled until a database is configured.

## PWA hosting
Upload this folder to an HTTPS static host. Then open the URL on iPhone in Safari and use:
Share -> Add to Home Screen.

Do not open the HTML directly from a `file://` URL if you want PWA installation/service-worker functionality.
