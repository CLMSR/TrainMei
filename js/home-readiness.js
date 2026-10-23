/* Home Pre-Workout Readiness — date-scoped check-in, separate from workout records.
   TrainingDataCore remains the only interpretation/learning engine. */
(()=>{
  'use strict';
  const root=document.getElementById('home-readiness-panel');
  if(!root)return;
  const $=(s,scope=root)=>scope.querySelector(s), $$=(s,scope=root)=>Array.from(scope.querySelectorAll(s));
  const todayKey=()=>window.TrainingDataCore?.dayKey?.()||new Date().toLocaleDateString('en-CA');
  const empty=()=>({date:'',recovery:{sleep:null,energy:null,soreness:null},context:{stress:null,fuelStatus:'unknown',lastMeal:'unknown',hydration:'unknown',availableMinutes:null,intensity:null,volumePercent:null,goal:'unknown'},updatedAt:null});
  let date='',checkin=empty(),saveTimer=null,saveQueue=Promise.resolve(),revision=0,loaded=false;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const context=()=>checkin.context;
  function setStatus(t,state=''){const e=$('#home-readiness-save');if(e){e.textContent=t;e.dataset.state=state}}
  function renderDots(el,value,key,type){if(!el)return;const n=Number(value)||0;el.innerHTML=Array.from({length:5},(_,i)=>{const v=i+1,on=v===n;return `<button type="button" class="home-readiness-dot${on?' active':''}" ${type==='recovery'?`data-pre-recovery-key="${key}"`:`data-pre-context-dot-key="${key}"`} data-value="${v}" aria-pressed="${on}" aria-label="${esc(key)} ${v} of 5"><span aria-hidden="true">${on?'●':'○'}</span></button>`}).join('')}
  function output(key,v){const el=key==='availableMinutes'?$('#pre-time-output'):key==='intensity'?$('#pre-intensity-output'):key==='volumePercent'?$('#pre-volume-output'):null;if(el)el.textContent=v==null?'Not set':key==='availableMinutes'?`${v} min`:key==='intensity'?`${v} / 5`:`${v}%`}
  function render(){
    $$('[data-pre-recovery-group]').forEach(el=>renderDots(el,checkin.recovery[el.dataset.preRecoveryGroup],el.dataset.preRecoveryGroup,'recovery'));
    $$('[data-pre-context-dots]').forEach(el=>renderDots(el,context()[el.dataset.preContextDots],el.dataset.preContextDots,'context'));
    $$('[data-pre-context-choice]').forEach(g=>$$('button',g).forEach(b=>{const on=b.dataset.value===String(context()[g.dataset.preContextChoice]??'unknown');b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))}));
    $$('[data-pre-context-range]').forEach(i=>{const k=i.dataset.preContextRange,v=context()[k],unset=v==null||v==='';i.value=String(unset?(k==='availableMinutes'?60:k==='volumePercent'?100:3):v);i.classList.toggle('is-unset',unset);i.setAttribute('aria-valuetext',unset?'Not selected':String(v));output(k,unset?null:v)});
    refreshRecommendation();
  }
  function mutate(fn){fn(checkin);checkin.updatedAt=new Date().toISOString();render();queueSave()}
  function queueSave(){const snapshot=JSON.parse(JSON.stringify(checkin)),token=++revision;setStatus('Saving…','saving');clearTimeout(saveTimer);saveTimer=setTimeout(()=>{saveQueue=saveQueue.then(async()=>{const core=window.TrainingDataCore;if(!core?.saveDailyCheckin)throw new Error('Daily check-in storage is unavailable');const result=await core.saveDailyCheckin(date,snapshot);if(token!==revision)return;setStatus(result.synced?'Saved · Synced':result.ok?'Saved on this device':'Could not save',result.synced?'synced':result.ok?'local':'error');await refreshRecommendation()}).catch(e=>{console.error('[Home Readiness] Save failed',e);if(token===revision)setStatus('Saved locally · cloud unavailable','error')})},220)}
  async function refreshRecommendation(){const target=$('#home-readiness-recommendation');if(!target)return;let advice='Add your recovery and session-context inputs for a more useful recommendation.',actions=[];try{const d=await window.TrainingDataCore?.decisionSupport?.(date,null,checkin);if(d?.action)advice=d.action;actions=d?.actions||[]}catch(e){console.warn('[Home Readiness] Recommendation unavailable',e)}const hasRecovery=Object.values(checkin.recovery).every(v=>Number(v)>0);const selected=context().goal&& !['auto','unknown'].includes(context().goal)?`Focus: ${context().goal}.`:'';target.innerHTML=`<span class="home-readiness-recommendation-kicker">PRE-SESSION GUIDANCE · ${hasRecovery?'RECOVERY LOGGED':'MORE DATA NEEDED'}</span><strong>${esc(advice)}</strong>${selected?`<span class="home-readiness-recommendation-context">${esc(selected)}</span>`:''}${actions.length?`<ul>${actions.slice(0,3).map(a=>`<li>${esc(a)}</li>`).join('')}</ul>`:''}`}
  async function loadToday(){const core=window.TrainingDataCore;if(!core?.loadDailyCheckin){setStatus('Loading engine…','loading');return}date=todayKey();setStatus('Loading…','loading');try{checkin=await core.loadDailyCheckin(date)||empty()}catch(e){console.warn('[Home Readiness] Load failed',e);checkin=empty()}checkin={...empty(),...checkin,date,recovery:{...empty().recovery,...(checkin.recovery||{})},context:{...empty().context,...(checkin.context||{})}};loaded=true;render();setStatus(checkin.updatedAt?'Loaded today’s check-in':'Ready for today','ready')}
  root.addEventListener('click',e=>{const r=e.target.closest('[data-pre-recovery-key]');if(r&&root.contains(r)){mutate(c=>{c.recovery[r.dataset.preRecoveryKey]=Number(r.dataset.value)});return}const d=e.target.closest('[data-pre-context-dot-key]');if(d&&root.contains(d)){mutate(c=>{c.context[d.dataset.preContextDotKey]=Number(d.dataset.value)});return}const b=e.target.closest('[data-pre-context-choice] button');if(b&&root.contains(b)){const g=b.closest('[data-pre-context-choice]');mutate(c=>{c.context[g.dataset.preContextChoice]=b.dataset.value})}});
  root.addEventListener('input',e=>{const i=e.target.closest('[data-pre-context-range]');if(!i||!root.contains(i))return;const k=i.dataset.preContextRange,v=Number(i.value);checkin.context[k]=v;checkin.updatedAt=new Date().toISOString();i.classList.remove('is-unset');i.setAttribute('aria-valuetext',String(v));output(k,v);setStatus('Unsaved changes','saving');clearTimeout(saveTimer);saveTimer=setTimeout(()=>{render();queueSave()},350)});
  document.addEventListener('trainmei:home-rendered',e=>{if(e.detail?.date===todayKey()&&(!loaded||date!==todayKey()))loadToday()});
  document.addEventListener('trainmei:data-core-refreshed',()=>{if(!loaded)loadToday()});
  document.addEventListener('trainmei:user-ready',loadToday);
  document.addEventListener('trainmei:core-learning',e=>{if(e.detail?.date===date)refreshRecommendation()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadToday,{once:true});else loadToday();
  // This file is loaded before data-core.js in index.html; retry after parser scripts finish.
  setTimeout(()=>{if(!loaded)loadToday()},0);
})();
