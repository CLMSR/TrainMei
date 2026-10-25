/* TrainMei PWA service worker.
 * Deliberately does not reload open tabs or force clients to take control.
 * Update CACHE_VERSION when changing this file's cache strategy or shell.
 */
'use strict';
const CACHE_VERSION = 'trainmei-pwa-shell-v15';
const SHELL_CACHE = CACHE_VERSION;
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/responsive.css',
  './css/stats-dashboard.css',
  './icons/trainmei-icon.png',
  './icons/trainmei-icon-192.png',
  './icons/trainmei-icon-512.png',
  './icons/trainmei-icon-512-maskable.png',
  './js/cycle-tracker.js',
  './js/training-planner-core.js',
  './js/unified-state.js',
  './js/home-readiness.js',
  './js/data-core.js',
  './js/day-view.js',
  './js/workout-editor.js',
  './js/planning.js',
  './js/calendar.js',
  './js/templates.js',
  './js/mobile-navigation.js',
  './js/smart-training.js',
  './js/ocr.js',
  './js/nutrition-calculator.js',
  './js/progress-tools.js',
  './js/trainmei-backup-migrator.js',
  './js/settings-theme.js',
  './js/keyboard-shortcuts.js',
  './js/smart-workout.js',
  './js/smart-integrations-router.js',
  './js/exercise-library-integration.js',
  './js/integration-health.js',
  './js/nutrition-optimizer.js',
  './js/training-brain.js',
  './js/deterministic-brains.js',
  './js/training-insights.js',
  './js/decision-assistant.js',
  './js/fatsecret.js',
  './js/nutrition-data-layer.js',
  './js/nutrition-sync.js',
  './js/morning-briefing.js',
  './js/integrated-logic.js',
  './js/app-bootstrap.js',
  './js/stats-dashboard.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // Do not fail installation because an optional asset is unavailable.
    await Promise.allSettled(APP_SHELL.map(async path => {
      try {
        const response = await fetch(path, { cache: 'reload' });
        if (response.ok && response.type === 'basic') await cache.put(path, response);
      } catch (_) {}
    }));
    // Do not call skipWaiting(): an open session must not be interrupted.
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('trainmei-pwa-shell-') && key !== SHELL_CACHE).map(key => caches.delete(key)));
    // Do not call clients.claim(): existing tabs keep their current controller
    // until naturally reopened, avoiding an update-triggered page transition.
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Never cache Supabase, OAuth, or external APIs.

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(SHELL_CACHE);
          await cache.put('./index.html', response.clone());
        }
        return response;
      } catch (_) {
        return (await caches.match(request)) || (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Static same-origin files: cache-first, then network. No API/data endpoints
  // are cached by this handler because cross-origin requests are excluded.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok && response.type === 'basic') {
        const cache = await caches.open(SHELL_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (_) {
      return Response.error();
    }
  })());
});
