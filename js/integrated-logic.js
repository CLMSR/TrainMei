(()=>{
'use strict';
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const cloneSafe=o=>{try{return JSON.parse(JSON.stringify(o))}catch{return o}};

/* Explicit Rest Day: stored inside the existing workout row, so it feeds the
   same TrainingDataCore without creating another learning/storage engine. */
function syncExclusiveDaySwitches(){
  const rest=typeof currentDay!=='undefined'&&!!currentDay?.restDay;
  const completed=typeof currentDay!=='undefined'&&!!currentDay?.completed;
  const restInput=document.getElementById('day-rest-toggle'),completedInput=document.getElementById('day-completed-toggle');
  const restRow=restInput?.closest('.switch-row'),completedRow=completedInput?.closest('.switch-row');
  if(restInput){restInput.checked=rest;restInput.disabled=completed;}
  if(completedInput){completedInput.checked=completed;completedInput.disabled=rest;}
  restRow?.classList.toggle('disabled',completed);
  completedRow?.classList.toggle('disabled',rest);
}
function setRestDay(on){
  if(typeof currentDay==='undefined'||!currentDay)return;
  currentDay.restDay=!!on;
  if(on){currentDay.completed=false;currentDay.metrics=currentDay.metrics||{};currentDay.metrics.rpe='';currentDay.metrics.timeMin='';}
  syncExclusiveDaySwitches();
  if(typeof renderDay==='function')renderDay();
  syncExclusiveDaySwitches();
  if(typeof scheduleSave==='function')scheduleSave();
}

/* Navigation: desktop + horizontal = labels, vertical iPhone = icons. */
function refreshNav(){
  const portrait=window.matchMedia('(max-width:560px)').matches;
  $$('#main-nav .btn[data-page],#templates-btn,#settings-btn').forEach(b=>{
    const label=b.querySelector('.nav-label');const svg=b.querySelector('svg');
    if(label)label.hidden=portrait;
    if(svg)svg.hidden=!portrait;
  });
}
window.addEventListener('resize',refreshNav,{passive:true});
refreshNav();

/* The calendar renderer already understands day.restDay directly via the
   existing renderMonth() logic, so no restDayCalendarPatch() is needed. */

/* Improve the single Data Core calculations without adding a second model. */
function patchCore(){
 const core=window.TrainingDataCore;if(!core)return false;
 // Compatibility shim only. Core calculations now live in TrainingDataCore itself;
 // do not wrap trainingDemand/performanceFuel here or create a second calculation path.
 if(typeof core.totalTime!=='function')core.totalTime=d=>d&&!d.restDay?Math.max(0,Number(d.metrics?.timeMin)||0):0;
 return true;
}

/* Cycle Tracker persistence hardening: sanitize, deduplicate and version the
   existing local store so previous logs cannot be duplicated by malformed data. */
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
 if(e.target?.id==='day-completed-toggle'&&typeof currentDay!=='undefined'&&currentDay){
   currentDay.completed=!!e.target.checked;
   if(currentDay.completed)currentDay.restDay=false;
   syncExclusiveDaySwitches();
   if(typeof renderDay==='function')renderDay();
   syncExclusiveDaySwitches();
   if(typeof scheduleSave==='function')scheduleSave();
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

// Sistema de persistencia de estado para iPhone/PWA
const PWAStateManager = {
  STORAGE_KEY: 'trainmei_pwa_state',
  
  // Guardar el estado actual (página activa, fecha, etc.)
  saveState() {
    try {
      const activePage = document.querySelector('.page.active');
      const activeDayView = document.querySelector('.day-view.active');
      
      const state = {
        timestamp: Date.now(),
        activePage: activePage ? activePage.id : 'home-page',
        currentDate: typeof currentDate !== 'undefined' ? currentDate : null,
        currentYear: typeof currentYear !== 'undefined' ? currentYear : new Date().getFullYear(),
        currentMonth: typeof currentMonth !== 'undefined' ? currentMonth : new Date().getMonth(),
        isDayView: !!activeDayView,
        dayViewId: activeDayView ? activeDayView.id : null
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('PWA State save failed:', e);
    }
  },
  
  // Restaurar el estado guardado
  restoreState() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (!saved) return null;
      
      const state = JSON.parse(saved);
      // Solo restaurar si es relativamente reciente (menos de 30 días)
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
  
  // Aplicar el estado restaurado
  applyState(state) {
    if (!state) return;
    
    try {
      // Restaurar página activa
      const targetPage = document.getElementById(state.activePage);
      if (targetPage) {
        // Desactivar todas las páginas
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        // Activar la página guardada
        targetPage.classList.add('active');
        
        // Actualizar botón de navegación activo
        document.querySelectorAll('.btn[data-page]').forEach(btn => {
          btn.classList.toggle('active', btn.getAttribute('data-page') === state.activePage);
        });
        
        // Si es una página que necesita renderizado, dispara el evento apropiado
        if (typeof renderMonth === 'function' && state.activePage === 'calendar-page') {
          setTimeout(() => renderMonth(), 100);
        }
        if (typeof renderHome === 'function' && state.activePage === 'home-page') {
          setTimeout(() => renderHome(), 100);
        }
      }
    } catch (e) {
      console.warn('PWA State apply failed:', e);
    }
  }
};

// Sistema de Copy/Paste Block
const BlockClipboard = {
  STORAGE_KEY: 'trainmei_block_clipboard',
  
  // Copiar un bloque (fila de tabla o sección)
  copyBlock(element) {
    try {
      // Encuentra el bloque más cercano (tr, section, .block, etc.)
      let block = element.closest('tr') || 
                  element.closest('section') || 
                  element.closest('.block') ||
                  element.closest('[data-block]');
      
      if (!block) {
        console.warn('No block found to copy');
        return false;
      }
      
      // Extraer datos del bloque según su tipo
      let blockData = this.extractBlockData(block);
      
      // Guardar en clipboard local
      const clipboard = {
        timestamp: Date.now(),
        type: block.tagName.toLowerCase(),
        data: blockData,
        source: block.className
      };
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(clipboard));
      
      // Feedback visual
      this.showFeedback(element, 'Bloque copiado ✓');
      
      return true;
    } catch (e) {
      console.error('Copy block failed:', e);
      return false;
    }
  },
  
  // Extraer datos de un bloque
  extractBlockData(block) {
    const data = {};
    
    // Si es una fila de tabla
    if (block.tagName.toLowerCase() === 'tr') {
      const cells = block.querySelectorAll('td input, td textarea, td select');
      cells.forEach((cell, i) => {
        data['col_' + i] = cell.value || cell.textContent;
      });
    } 
    // Si es una sección o div
    else {
      const inputs = block.querySelectorAll('input, textarea, select');
      inputs.forEach((input, i) => {
        const key = input.name || input.id || 'field_' + i;
        data[key] = input.value || input.textContent;
      });
    }
    
    return data;
  },
  
  // Pegar un bloque
  pasteBlock(targetElement) {
    try {
      const clipboard = localStorage.getItem(this.STORAGE_KEY);
      if (!clipboard) {
        this.showFeedback(targetElement, 'Sin bloques copiados');
        return false;
      }
      
      const clipData = JSON.parse(clipboard);
      const block = targetElement.closest('tr') || targetElement.closest('section');
      
      if (!block) {
        console.warn('No target block found to paste');
        return false;
      }
      
      // Pegar datos según el tipo
      if (block.tagName.toLowerCase() === 'tr') {
        const cells = block.querySelectorAll('td input, td textarea, td select');
        cells.forEach((cell, i) => {
          const key = 'col_' + i;
          if (clipData.data[key]) {
            cell.value = clipData.data[key];
            cell.dispatchEvent(new Event('input', { bubbles: true }));
            cell.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      } else {
        const inputs = block.querySelectorAll('input, textarea, select');
        inputs.forEach((input) => {
          const key = input.name || input.id;
          if (key && clipData.data[key]) {
            input.value = clipData.data[key];
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      }
      
      this.showFeedback(targetElement, 'Bloque pegado ✓');
      
      // Guardar cambios
      if (typeof scheduleSave === 'function') {
        scheduleSave();
      }
      
      return true;
    } catch (e) {
      console.error('Paste block failed:', e);
      return false;
    }
  },
  
  // Mostrar feedback temporal
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

// Agregar estilos de animación si no existen
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

// Detectar cambios de página y guardar estado - VERSIÓN OPTIMIZADA PARA MÓVIL
document.addEventListener('click', (e) => {
  // Guardar estado SOLO cuando se cambia de página (lo más importante)
  if (e.target.closest('.btn[data-page]')) {
    setTimeout(() => {
      PWAStateManager.saveState();
    }, 200);
  }
  
  // Copy/Paste con atajos
  if (e.target.closest('[data-action="copy-block"]')) {
    BlockClipboard.copyBlock(e.target);
    e.preventDefault();
  }
  if (e.target.closest('[data-action="paste-block"]')) {
    BlockClipboard.pasteBlock(e.target);
    e.preventDefault();
  }
}, { passive: true });

// Guardar estado SOLO cuando el navegador se oculta (importante para PWA)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    PWAStateManager.saveState();
  }
}, { passive: true });

// Restaurar estado INMEDIATAMENTE (antes de que startApp lo sobrescriba)
let savedPWAState = null;
let PWAStateRestored = false;

function restorePWAStateNow() {
  if (PWAStateRestored) return;
  PWAStateRestored = true;
  
  savedPWAState = PWAStateManager.restoreState();
  
  // Log para debugging en móvil
  if (savedPWAState) {
    console.log('PWA State restaurado:', savedPWAState.activePage);
  }
  
  return savedPWAState;
}

// Restaurar inmediatamente
restorePWAStateNow();

// Hook: interceptar startApp para restaurar estado DESPUÉS
const originalStartApp = window.startApp;
if (originalStartApp && savedPWAState) {
  window.startApp = async function() {
    const result = await originalStartApp.call(this);
    
    // Restaurar SOLO UNA VEZ después de que startApp termine
    if (savedPWAState.activePage !== 'home-page') {
      setTimeout(() => {
        PWAStateManager.applyState(savedPWAState);
      }, 300);
    }
    
    return result;
  };
}

})();
