/* Smart Integrations health & data-flow visibility.
   Observability only: reuses TrainingDataCore and existing data-layer APIs.
   Does not create another learner, store duplicate nutrition data, or modify sessions. */
(() => {
  'use strict';
  if (window.TrainMeiIntegrationHealth) return;
  const $ = (s, root = document) => root.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let running = false, queued = false, lastUpdated = null;
  const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const shift = (key, days) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate()+days); return dateKey(d); };
  function ensurePanel() {
    const wrap = $('.smart-int-wrap');
    const grid = $('.smart-launch-grid', wrap);
    if (!wrap || !grid) return null;
    let panel = $('#integration-health-panel', wrap);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'integration-health-panel';
      panel.className = 'ih-panel';
      panel.innerHTML = `<div class="ih-head"><div><h2>Integration status</h2></div><button type="button" class="btn" id="ih-refresh" aria-label="Refresh integration status">Refresh</button></div><div class="ih-flow" aria-label="Shared data flow"><div class="ih-flow-node"><strong>Workout</strong></div><i aria-hidden="true">→</i><div class="ih-flow-node ih-flow-core"><strong>TrainingDataCore</strong></div><i aria-hidden="true">→</i><div class="ih-flow-node"><strong>Briefing · Insights · Fuel</strong></div></div><div class="ih-status-grid" id="ih-status-grid"><div class="ih-loading">Checking sources…</div></div><div class="ih-footer" id="ih-footer">One shared learning engine · missing data remains unknown.</div>`;
      wrap.insertBefore(panel, grid);
      $('#ih-refresh', panel)?.addEventListener('click', refresh);
    }
    return panel;
  }
  function statusCard(title, state, detail, type='ready') {
    return `<article class="ih-status-card" title="${esc(detail)}"><div class="ih-status-top"><strong>${esc(title)}</strong><span class="ih-state ${type}"><i></i>${esc(state)}</span></div></article>`;
  }
  async function refresh() {
    const panel = ensurePanel();
    if (!panel) return;
    if (running) { queued = true; return; }
    running = true;
    const out = $('#ih-status-grid', panel);
    if (out) out.innerHTML = '<div class="ih-loading">Checking the existing data sources…</div>';
    const core = window.TrainingDataCore;
    const nutrition = window.TrainMeiNutritionData;
    const cards = [];
    let count = null, feedbackCount = 0, recentRows = [];
    if (core && typeof core.training === 'function' && typeof core.learningProfile === 'function') {
      try {
        const today = dateKey(), from = shift(today, -41);
        recentRows = await core.training(from, today) || [];
        const completed = recentRows.filter(r => r?.data?.completed);
        count = completed.length;
        feedbackCount = completed.filter(r => {
          const d = r.data || {}, f = d.sessionFeedback || {};
          return Number(f.performance)>0 || Number(f.energyRating)>0 || Number(f.technique)>0 || Number(d.metrics?.rpe)>0 || d.pain!=null || String(f.feelings||'').trim();
        }).length;
        cards.push(statusCard('Training history', 'Available', `${count} completed session${count===1?'':'s'} found in the last 42 days. ${feedbackCount} include at least one useful effort/outcome signal.`, 'ready'));
      } catch (_) {
        cards.push(statusCard('Training history', 'Needs refresh', 'The central API exists, but recent session history could not be read in this pass.', 'warn'));
      }
      cards.push(statusCard('TrainingDataCore', 'Ready', 'Central source for training history, personal patterns, recovery context and training demand. No parallel learning engine.', 'ready'));
    } else {
      cards.push(statusCard('TrainingDataCore', 'Unavailable', 'The central data API has not finished loading. Refresh after the app finishes initialising.', 'warn'));
    }
    if (nutrition && typeof nutrition.getSnapshot === 'function') {
      try {
        const snap = nutrition.getSnapshot() || {};
        const intake = snap.intake || {};
        const hasToday = ['kcal','carb','prot'].some(k => intake[k] != null);
        const connected = snap.connected === true;
        const detail = connected
          ? `${hasToday ? 'Current snapshot contains intake values.' : 'Connection is marked connected, but today’s intake is not yet available.'}${snap.lastSyncAt ? ` Last sync: ${new Date(snap.lastSyncAt).toLocaleString()}.` : ''}`
          : 'Nutrition data layer is loaded. A live connection or today’s intake has not been confirmed by the current snapshot.';
        cards.push(statusCard('FatSecret → Nutrition layer', connected ? (hasToday?'Connected':'Connected · no intake') : 'Loaded · verify sync', detail, connected && hasToday ? 'ready' : 'warn'));
      } catch (_) {
        cards.push(statusCard('FatSecret → Nutrition layer', 'Needs refresh', 'The nutrition API is loaded but its current snapshot could not be read.', 'warn'));
      }
    } else {
      cards.push(statusCard('FatSecret → Nutrition layer', 'Unavailable', 'Nutrition data layer is not currently exposed to the page.', 'warn'));
    }
    const cycleLoaded = !!document.querySelector('#cycle-tool-slot .cycle-app');
    cards.push(statusCard('Cycle context', cycleLoaded ? 'Module loaded' : 'Not loaded', cycleLoaded ? 'Cycle Tracker workspace is present. Cycle observations are useful only when explicitly logged; this check does not infer a phase.' : 'Cycle Tracker workspace is not currently mounted.', cycleLoaded ? 'ready' : 'warn'));
    const consumers = !!window.TrainMeiTrainingInsights && !!window.TrainMeiDailyBriefing;
    cards.push(statusCard('Briefing + Insights', consumers ? 'Available' : 'Partially loaded', consumers ? 'Both consumers use the shared model; recommendations remain evidence-limited when input data is missing.' : 'One or more consumer modules have not exposed their public API yet.', consumers ? 'ready' : 'warn'));
    let audit=null;try{audit=await core?.qualityAudit?.(shift(dateKey(),-179),dateKey())||null}catch(e){console.warn('[Integration health] audit failed',e)}
    if (out) out.innerHTML = cards.join('') + (audit ? `<section class="ih-audit"><div class="ih-audit-head"><strong>Data-quality audit</strong><span>${audit.issues.length} finding(s)</span></div>${audit.issues.map(i=>`<details class="ih-audit-item ${esc(i.severity)}"><summary><span>${esc(i.title)}</span><small>${esc(i.severity)}</small></summary><p>${esc(i.detail)}</p></details>`).join('')}<div class="ih-audit-foot">${audit.completed} completed sessions · ${audit.duplicateDates} duplicate date(s) · ${audit.unclassifiedExercises} unclassified exercises · ${audit.timedNutritionEntries}/${audit.nutritionEntries} nutrition times</div></section>` : '');
    lastUpdated = new Date();
    const footer = $('#ih-footer', panel);
    if (footer) footer.textContent = `Checked ${lastUpdated.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}. Availability is not the same as data completeness; missing signals are not treated as zero.`;
    running = false;
    if (queued) { queued = false; refresh(); }
  }
  document.addEventListener('click', e => {
    if (e.target.closest('[data-page="integrations-page"]') || e.target.closest('[data-ios-page="integrations-page"]')) refresh();
  });
  ['trainmei:data-core-refreshed','trainmei:day-saved','trainmei:nutrition-updated','trainmei:nutrition-sync-complete','trainmei:core-learning'].forEach(name => document.addEventListener(name, () => {
    if ($('#integrations-page')?.classList.contains('active')) refresh();
  }));
  document.addEventListener('DOMContentLoaded', ensurePanel);
  window.TrainMeiIntegrationHealth = { refresh };
})();
