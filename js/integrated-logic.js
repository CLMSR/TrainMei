(()=>{
'use strict';
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const cloneSafe=o=>{try{return JSON.parse(JSON.stringify(o))}catch{return o}};

/* ─── Helpers: always read from TP so mutations apply to the right day object ─── */
const getTP=()=>window.TrainMeiState||window.__tp;
const getDay=()=>getTP()?.currentDay;
const doRenderDay=()=>{const tp=getTP();if(tp?.renderDay)tp.renderDay();else if(typeof renderDay==='function')renderDay();};
const doScheduleSave=()=>{const tp=getTP();if(tp?.scheduleSave)tp.scheduleSave();else if(typeof scheduleSave==='function')scheduleSave();};

/* Explicit Rest Day */
function syncExclusiveDaySwitches(){
  const d=getDay();
  const rest=!!d?.restDay;
  const completed=!!d?.completed;
  const restInput=document.getElementById('day-rest-toggle'),completedInput=document.getElementById('day-completed-toggle');
  const restRow=restInput?.closest('.switch-row'),completedRow=completedInput?.closest('.switch-row');
  if(restInput){restInput.checked=rest;restInput.disabled=completed;}
  if(completedInput){completedInput.checked=completed;completedInput.disabled=rest;}
  restRow?.classList.toggle('disabled',completed);
  completedRow?.classList.toggle('disabled',rest);
}

function setRestDay(on){
  const d=getDay();if(!d)return;
  d.restDay=!!on;
  if(on){d.completed=false;d.metrics=d.metrics||{};d.metrics.rpe='';d.metrics.timeMin='';}
  syncExclusiveDaySwitches();
  doRenderDay();
  syncExclusiveDaySwitches();
  doScheduleSave();
}

/* Navigation: desktop + horizontal = labels, vertical iPhone = icons. */
function refreshNav(){
  const portrait=window.matchMedia('(max-width:560px)').matches;
$$('#main-nav .btn[data-page],#templates-btn,#daily-briefing-btn,#settings-btn').forEach(b=>{
    const label=b.querySelector('.nav-label');const svg=b.querySelector('svg');
    if(label)label.hidden=portrait;
    if(svg)svg.hidden=!portrait;
  });
}
window.addEventListener('resize',refreshNav,{passive:true});
refreshNav();

function patchCore(){
 return !!window.TrainingDataCore;
}

/* Cycle Tracker persistence hardening */
function hardenCycleStorage(){
 const oldKey='cycle_tracker_records_v2',newKey='cycle_tracker_records_v3';
 try{
   let raw=localStorage.getItem(newKey);
   if(!raw){raw=localStorage.getItem(oldKey);if(raw)localStorage.setItem(newKey,raw)}
   const parsed=raw?JSON.parse(raw):[];
   const map=new Map();
   (Array.isArray(parsed)?parsed:[]).forEach(r=>{
     if(!r||!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date||'')))return;
     const clean={...r,date:String(r.date),duration:Math.max(1,Math.min(15,Number(r.duration)||5)),symptoms:Array.isArray(r.symptoms)?[...new Set(r.symptoms.map(String))]:[]};
     map.set(clean.date,clean);
   });
   const clean=[...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
   localStorage.setItem(newKey,JSON.stringify(clean));
   if(!localStorage.getItem(oldKey))localStorage.setItem(oldKey,JSON.stringify(clean));
 }catch(e){/* keep existing tracker behavior if storage is unavailable */}
}

document.addEventListener('trainmei:day-rendered',()=>syncExclusiveDaySwitches());

document.addEventListener('change',e=>{
 if(e.target?.id==='day-rest-toggle'){setRestDay(e.target.checked);return;}
 if(e.target?.id==='day-completed-toggle'){
   const d=getDay();if(!d)return;
   d.completed=!!e.target.checked;
   if(d.completed)d.restDay=false;
   syncExclusiveDaySwitches();
   doRenderDay();
   syncExclusiveDaySwitches();
   doScheduleSave();
 }
});

document.addEventListener('DOMContentLoaded',()=>{
 hardenCycleStorage();
 const run=()=>{patchCore();if(typeof renderDayContext==='function')renderDayContext();};
 if(!patchCore())setTimeout(run,250);else run();
});
setTimeout(()=>{patchCore();refreshNav()},0);

/* Re-render calendar/home when an explicit rest day is saved. */
document.addEventListener('trainmei:core-learning',()=>{if(typeof renderHome==='function'&&document.querySelector('#home-page.active'))renderHome();});

/* === PWA STATE PERSISTENCE & COPY/PASTE BLOCK SYSTEM === */

const PWAStateManager = {
  STORAGE_KEY: 'trainmei_pwa_state',

  saveState() {
    try {
      const tp = getTP();
      const activePage = document.querySelector('.page.active');

      const state = {
        timestamp: Date.now(),
        /* ─── FIX BUG 2 (part A): save the selectedDateKey from TP, NOT from
           bare currentDate/currentYear/currentMonth globals which are stale
           on iPhone after the day view is opened. ─────────────────────────── */
        activePage: activePage ? activePage.id : 'home-page',
        selectedDateKey: tp?.selectedDateKey || null,
        monthCursorISO: tp?.monthCursor ? tp.monthCursor().toISOString() : null,
        /* Never save that we're mid-day-view: restoring into the day view
           would let the PWA try to re-open a day without a valid currentDay
           object, which can then mutate unintended dates on save. */
        isDayView: false
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('PWA State save failed:', e);
    }
  },

  restoreState() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (!saved) return null;
      const state = JSON.parse(saved);
      // Only restore if less than 30 days old
      if (Date.now() - state.timestamp > 30 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(this.STORAGE_KEY);
        return null;
      }
      return state;
    } catch (e) {
      console.warn('PWA State restore failed:', e);
      return null;
    }
  },

  applyState(state) {
    if (!state) return;
    try {
      const tp = getTP();

      // Restore the month cursor on TP so the calendar renders the right month
      if (state.monthCursorISO && tp && typeof tp.setMonthCursor === 'function') {
        try { tp.setMonthCursor(new Date(state.monthCursorISO)); } catch {}
      }

      // Restore selectedDateKey without opening the day view
      if (state.selectedDateKey && tp) {
        tp.selectedDateKey = state.selectedDateKey;
      }

      const targetPageId = state.activePage || 'home-page';
      // Safety: never auto-restore into a day-view page — always fall back to calendar
      const safePageId = (targetPageId === 'day-page' || targetPageId === 'day-view') ? 'calendar-page' : targetPageId;
      const targetPage = document.getElementById(safePageId);

      if (targetPage) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        targetPage.classList.add('active');

        document.querySelectorAll('.btn[data-page]').forEach(btn => {
          btn.classList.toggle('active', btn.getAttribute('data-page') === safePageId);
        });

        if (safePageId === 'calendar-page') {
          const renderFn = tp?.TrainMeiCalendar?.renderMonth || (typeof renderMonth === 'function' ? renderMonth : null);
          if (renderFn) setTimeout(() => renderFn(), 150);
        } else if (safePageId === 'home-page') {
          if (typeof renderHome === 'function') setTimeout(() => renderHome(), 150);
        }
      }
    } catch (e) {
      console.warn('PWA State apply failed:', e);
    }
  }
};

// Copy/Paste Block system
const BlockClipboard = {
  STORAGE_KEY: 'trainmei_block_clipboard',

  copyBlock(element) {
    try {
      let block = element.closest('tr') ||
                  element.closest('section') ||
                  element.closest('.block') ||
                  element.closest('[data-block]');
      if (!block) { console.warn('No block found to copy'); return false; }
      const clipboard = {
        timestamp: Date.now(),
        type: block.tagName.toLowerCase(),
        data: this.extractBlockData(block),
        source: block.className
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(clipboard));
      this.showFeedback(element, 'Bloque copiado ✓');
      return true;
    } catch (e) { console.error('Copy block failed:', e); return false; }
  },

  extractBlockData(block) {
    const data = {};
    if (block.tagName.toLowerCase() === 'tr') {
      block.querySelectorAll('td input, td textarea, td select').forEach((cell, i) => {
        data['col_' + i] = cell.value || cell.textContent;
      });
    } else {
      block.querySelectorAll('input, textarea, select').forEach((input, i) => {
        const key = input.name || input.id || 'field_' + i;
        data[key] = input.value || input.textContent;
      });
    }
    return data;
  },

  pasteBlock(targetElement) {
    try {
      const clipboard = localStorage.getItem(this.STORAGE_KEY);
      if (!clipboard) { this.showFeedback(targetElement, 'Sin bloques copiados'); return false; }
      const clipData = JSON.parse(clipboard);
      const block = targetElement.closest('tr') || targetElement.closest('section');
      if (!block) { console.warn('No target block found to paste'); return false; }
      if (block.tagName.toLowerCase() === 'tr') {
        block.querySelectorAll('td input, td textarea, td select').forEach((cell, i) => {
          const key = 'col_' + i;
          if (clipData.data[key]) {
            cell.value = clipData.data[key];
            cell.dispatchEvent(new Event('input', { bubbles: true }));
            cell.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      } else {
        block.querySelectorAll('input, textarea, select').forEach((input) => {
          const key = input.name || input.id;
          if (key && clipData.data[key]) {
            input.value = clipData.data[key];
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      }
      this.showFeedback(targetElement, 'Bloque pegado ✓');
      doScheduleSave();
      return true;
    } catch (e) { console.error('Paste block failed:', e); return false; }
  },

  showFeedback(element, message) {
    const feedback = document.createElement('div');
    feedback.style.cssText = `
      position: fixed;
      bottom: 60px;
      right: 18px;
      background: var(--ink);
      color: var(--on-primary);
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 13px;
      z-index: 1000;
      animation: slideUp 0.3s ease-out;
    `;
    feedback.textContent = message;
    document.body.appendChild(feedback);
    setTimeout(() => {
      feedback.style.animation = 'slideDown 0.3s ease-in';
      setTimeout(() => feedback.remove(), 300);
    }, 2000);
  }
};

// Animation styles
if (!document.querySelector('style[data-animations]')) {
  const style = document.createElement('style');
  style.setAttribute('data-animations', 'true');
  style.textContent = `
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes slideDown {
      from { transform: translateY(0); opacity: 1; }
      to { transform: translateY(20px); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

// Save state on page navigation and on hide
document.addEventListener('click', (e) => {
  if (e.target.closest('.btn[data-page]')) {
    setTimeout(() => { PWAStateManager.saveState(); }, 200);
  }
  if (e.target.closest('[data-action="copy-block"]')) {
    BlockClipboard.copyBlock(e.target);
    e.preventDefault();
  }
  if (e.target.closest('[data-action="paste-block"]')) {
    BlockClipboard.pasteBlock(e.target);
    e.preventDefault();
  }
}, { passive: true });

document.addEventListener('visibilitychange', () => {

  if (document.hidden && !getDay()) {
    PWAStateManager.saveState();
  }
}, { passive: true });

let savedPWAState = null;
let PWAStateRestored = false;

function restorePWAStateNow() {
  if (PWAStateRestored) return;
  PWAStateRestored = true;
  savedPWAState = PWAStateManager.restoreState();
  if (savedPWAState) console.log('PWA State loaded:', savedPWAState.activePage);
  return savedPWAState;
}
restorePWAStateNow();

const _origStartApp = window.startApp;
if (_origStartApp) {
  window.startApp = async function() {
    const result = await _origStartApp.call(this);
    if (savedPWAState && savedPWAState.activePage !== 'home-page') {
      setTimeout(() => { PWAStateManager.applyState(savedPWAState); }, 350);
    }
    return result;
  };
}

})();