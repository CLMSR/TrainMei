# Training Planner

Static workout planner hosted on GitHub Pages, with Supabase authentication and cloud sync.

## Files
- `index.html` — app, login and Supabase sync
- `manifest.webmanifest` — installable web-app metadata
- `sw.js` — service worker for PWA/offline shell

## GitHub Pages
Put all three files in the repository root, then:
Repository → Settings → Pages → Deploy from a branch → `main` → `/ (root)` → Save.

## Supabase
The app uses the Supabase Project URL and Publishable Key in `index.html`. The publishable key is intended for browser use; never put a Supabase Secret Key in the frontend.

The database table is expected to be named `workouts` with:
- `id` uuid primary key
- `user_id` uuid referencing `auth.users(id)`
- `date` date
- `data` jsonb
- `updated_at` timestamptz
- unique constraint on `(user_id, date)`

RLS must be enabled with policies restricting each user to their own `user_id`.
