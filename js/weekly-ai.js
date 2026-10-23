/* ============================================================
   WEEKLY INTELLIGENCE AI — optional read-only explanation layer
   Calls an authenticated Supabase Edge Function. No browser API key.
   ============================================================ */
(()=>{
  'use strict';
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const MAX_INPUT_CHARS=18000;
  const validShape=x=>!!x&&typeof x==='object'&&!Array.isArray(x)&&
    typeof x.summary==='string'&&Array.isArray(x.observations)&&Array.isArray(x.hypotheses)&&
    Array.isArray(x.watchItems)&&Array.isArray(x.dataLimitations)&&typeof x.disclaimer==='string'&&
    x.summary.length<=1200&&x.observations.length<=5&&x.hypotheses.length<=3&&
    x.watchItems.length<=4&&x.dataLimitations.length<=8&&x.disclaimer.length<=240&&
    x.observations.every(o=>o&&typeof o.metric==='string'&&typeof o.statement==='string'&&typeof o.evidenceRef==='string')&&
    x.hypotheses.every(h=>h&&typeof h.statement==='string'&&typeof h.whyItMightFit==='string'&&['low','moderate'].includes(h.confidence))&&
    x.watchItems.every(v=>typeof v==='string')&&x.dataLimitations.every(v=>typeof v==='string');
  function render(result,status=''){
    const root=$('#brain-weekly-ai');if(!root)return;
    if(!result){root.innerHTML=`<div class="brain-empty">${esc(status||'AI explanation unavailable. The deterministic report remains available above.')}</div>`;return;}
    root.innerHTML=`<section class="brain-weekly-ai-result"><div class="brain-kicker">AI interpretation · read-only</div><p>${esc(result.summary)}</p>${result.observations.length?`<h3>Supported observations</h3><ul>${result.observations.map(x=>`<li><strong>${esc(x.metric)}</strong>: ${esc(x.statement)} <span class="brain-source">(${esc(x.evidenceRef)})</span></li>`).join('')}</ul>`:''}${result.hypotheses.length?`<h3>Possible explanations</h3><ul>${result.hypotheses.map(x=>`<li>${esc(x.statement)} <span class="brain-source">(${esc(x.confidence)} confidence)</span><br>${esc(x.whyItMightFit)}</li>`).join('')}</ul>`:''}${result.watchItems.length?`<h3>Worth monitoring</h3><ul>${result.watchItems.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}${result.dataLimitations.length?`<h3>Data limitations</h3><ul>${result.dataLimitations.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}<p class="brain-legend">${esc(result.disclaimer)}</p><p class="brain-legend">Generated interpretation, not a diagnosis or an instruction to change targets or training loads.</p></section>`;
  }
  async function explain(){
    const button=$('#brain-weekly-ai-request'),root=$('#brain-weekly-ai');
    if(!button||!root)return;
    if(!window.TrainingDataCore?.weeklyIntelligence){render(null,'The deterministic summary engine is not ready yet.');return;}
    if(!window.supabaseClient?.functions?.invoke){render(null,'AI endpoint is not connected. The deterministic report continues to work.');return;}
    button.disabled=true;button.textContent='Explaining…';render(null,'Preparing the structured weekly summary…');
    try{
      const to=TrainingDataCore.dayKey();
      const from=TrainingDataCore.dayKey(Date.parse(to+'T12:00:00')-6*86400000);
      const summary=await TrainingDataCore.weeklyIntelligence(from,to);
      const serialized=JSON.stringify(summary);
      if(serialized.length>MAX_INPUT_CHARS)throw new Error('The weekly summary exceeds the allowed request size.');
      const {data,error}=await window.supabaseClient.functions.invoke('weekly-intelligence-ai',{body:{contractVersion:1,summary}});
      if(error)throw error;
      const result=data?.interpretation??data;
      if(!validShape(result))throw new Error('The AI endpoint returned an invalid response format.');
      render(result);
    }catch(err){
      console.warn('[Weekly Intelligence AI] Optional explanation failed:',err);
      render(null,'AI explanation unavailable. Your deterministic weekly report remains available above. Check Edge Function deployment and secrets if you want to enable AI.');
    }finally{button.disabled=false;button.textContent='Explain with AI';}
  }
  document.addEventListener('click',e=>{if(e.target.closest('#brain-weekly-ai-request'))explain();});
  window.TrainMeiWeeklyAI={explain,validateResponse:validShape};
})();
