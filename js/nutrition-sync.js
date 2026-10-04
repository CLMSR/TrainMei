/* ===== NUTRITION SYNC PROPAGATION =====
   One FatSecret sync must invalidate every downstream view that consumes
   TrainingDataCore nutrition context. Debounced to avoid duplicate renders
   when both the source module and Data Layer emit completion events.
*/
(function(){
  'use strict';
  let timer=0;
  async function refreshConsumersNow(){
    const activeDate=window.TrainMeiNutritionData?.getActiveDate?.()||new Date().toISOString().slice(0,10);
    // The Data Layer has already emitted the event after loading/caching the source data.
    // Do not call load() here: that would emit another nutrition-updated event and loop.
    try{await window.TrainMeiNutrition?.render?.();window.TrainMeiNutrition?.home?.()}catch(e){}
    try{await window.TrainMeiBrain?.refresh?.()}catch(e){}
    try{await window.tpRefreshRecoveryTrend?.()}catch(e){}
    try{await window.renderHome?.()}catch(e){}
    try{if(document.querySelector('#calendar-page.active')){window.tpRefreshWeekLoad?.();await window.tpRefreshRecoveryTrend?.()}}catch(e){}
    document.dispatchEvent(new CustomEvent('trainmei:data-core-refreshed',{detail:{source:'FatSecret',date:activeDate}}));
  }
  function refreshConsumers(){
    clearTimeout(timer);
    timer=setTimeout(()=>{refreshConsumersNow().catch(e=>console.warn('TrainMei nutrition propagation:',e))},180);
  }
  document.addEventListener('trainmei:nutrition-updated',refreshConsumers);
  document.addEventListener('trainmei:nutrition-sync-complete',refreshConsumers);
  document.addEventListener('trainmei:nutrition-targets-updated',refreshConsumers);
})();
