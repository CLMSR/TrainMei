(function(){
  'use strict';
  let timer=0;
  async function refreshConsumersNow(){
  const dataLayer=window.TrainMeiNutritionData;

  if(dataLayer?.whenReady){
    await dataLayer.whenReady();
  }

  const activeDate=
    dataLayer?.getActiveDate?.()||
    new Date().toISOString().slice(0,10);

  try{
    await window.TrainMeiNutrition?.render?.();
    window.TrainMeiNutrition?.home?.();
  }catch(e){}

  try{
    await window.TrainMeiBrain?.refresh?.();
  }catch(e){}

  try{
    await window.tpRefreshRecoveryTrend?.();
  }catch(e){}

  try{
    await window.renderHome?.();
  }catch(e){}

  try{
    if(document.querySelector('#calendar-page.active')){
      window.tpRefreshWeekLoad?.();
      await window.tpRefreshRecoveryTrend?.();
    }
  }catch(e){}

  document.dispatchEvent(
    new CustomEvent('trainmei:data-core-refreshed',{
      detail:{
        source:'FatSecret',
        date:activeDate
      }
    })
  );
}
  function refreshConsumers(){
  clearTimeout(timer);

  timer=setTimeout(()=>{
    refreshConsumersNow().catch(e=>{
      console.warn(
        'TrainMei nutrition propagation:',
        e
      );
    });
  },0);
}
  document.addEventListener('trainmei:nutrition-updated',refreshConsumers);
  document.addEventListener('trainmei:nutrition-sync-complete',refreshConsumers);
  document.addEventListener('trainmei:nutrition-targets-updated',refreshConsumers);
})();
