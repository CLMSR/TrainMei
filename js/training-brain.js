/* ============================================================
   TRAINING BRAIN — view/controller of the single TrainingDataCore
   No independent learning model lives here.
   ============================================================ */
(()=>{
  'use strict';
  const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let model=null,weekly=null;
  async function refresh(){
  if(!window.TrainingDataCore)return;

  const from=TrainingDataCore.dayKey(Date.now()-365*86400000);
  const to=TrainingDataCore.dayKey();

  model=await TrainingDataCore.learningProfile(from,to);
  try{weekly=await TrainingDataCore.weeklyIntelligence()}catch(e){weekly=null;console.warn('[Training Brain] Weekly intelligence unavailable:',e)}

  let todayWorkout=null;

  try{
    const rows=await TrainingDataCore.training(to,to);
    todayWorkout=rows?.find(r=>r.date===to)?.data||null;
  }catch(e){
    console.warn('[Training Brain] Could not read today workout from TrainingDataCore:',e);
  }

  const ctx=await TrainingDataCore.getUnifiedContext(to,todayWorkout);

  model.context=ctx;
  model.adaptation=ctx?.adaptation||null;

  render();
}

  function render(){
    if(!model)return;
    const ctx=model.context||{},
a=model.adaptation||{},
r=TrainingDataCore.readiness(
  ctx.workout||null,
  {
    loadRatio:ctx.loadRatio,
    fuelScore:ctx.fuel?.score,
    cyclePhase:ctx.cycle?.phase,
    training:ctx.training
  }
),
score=r.score,
confidence=model.dataConfidence?.status||'Building';
   [$('#brain-ring'),$('#home-brain-ring')].forEach(x=>{if(!x)return;x.style.setProperty('--brain-score',Number.isFinite(score)?score:0);});['#brain-score','#home-brain-score'].forEach(id=>{const e=$(id);if(e)e.textContent=Number.isFinite(score)?Math.round(score):'—';});
    if($('#brain-status'))$('#brain-status').textContent=r.status;if($('#brain-score-copy'))$('#brain-score-copy').textContent=`${confidence} confidence · ${model.sample} completed sessions · one unified learning engine`;
    if($('#brain-confidence'))$('#brain-confidence').textContent=`${confidence} confidence`;if($('#home-brain-confidence'))$('#home-brain-confidence').textContent=`${confidence} model`;
    if($('#home-brain-recommendation'))$('#home-brain-recommendation').textContent=a.actions?.[0]||'The unified model is learning your response patterns.';
    if($('#home-brain-pattern'))$('#home-brain-pattern').textContent=model.patterns?.[0]?.text||'No stable personal association yet.';
    if($('#brain-drivers')){
  $('#brain-drivers').innerHTML=(r.factors||[]).length
    ? (r.factors||[])
        .map(f=>`
          <div class="brain-driver">
            <span>${esc(f.label)}</span>
            <strong>${Math.round(f.value)}%</strong>
          </div>
    `).join(''): '<div class="brain-empty">Not enough current data to calculate readiness drivers.</div>';}
    if($('#brain-baselines'))$('#brain-baselines').innerHTML=[['Sessions',model.sample,'observed'],['Nutrition days',model.nutritionSample,'FatSecret'],['Patterns',model.patterns.length,'learned'],['Weight trend',model.bodyProgress?.trend==='insufficient-data'?'Building':model.bodyProgress?.deltaKg!=null?`${model.bodyProgress.deltaKg>0?'+':''}${model.bodyProgress.deltaKg.toFixed(2)} kg`:'—',model.bodyProgress?.phase||'phase unknown'],['Cycle',ctx.cycle?.phase||'—','context'],['Data confidence',`${model.dataConfidence?.score??0}%`,'evidence'],['Baseline RPE',model.baseline?.rpe??'—','personal'],['Recovery +24h',model.recoveryLag?.[24]?.average!=null?`${model.recoveryLag[24].average}%`:'—','observed']].map(([n,v,u])=>`<div class="brain-metric"><strong>${esc(String(v))}</strong><span>${esc(n)} · ${esc(u)}</span></div>`).join('');
    if($('#brain-baseline-source')){
  $('#brain-baseline-source').textContent=
    model.sample
      ? `${model.sample} completed sessions · ${model.recentSample} in last 42 days · ${model.nutritionSample} nutrition days`
      : 'No completed sessions are available to the model yet.';
}
    renderWeeklyIntelligence();
    function relativeAge(value){const t=new Date(value||0).getTime(),delta=Date.now()-t;if(!Number.isFinite(t)||delta<0)return'ahora mismo';if(delta<60*60*1000){const h=Math.floor(delta/(60*60*1000));return h<=0?'ahora mismo':`hace ${h} hora${h===1?'':'s'}`}const d=Math.floor(delta/(24*60*60*1000));if(d<1)return'ahora mismo';return `hace ${d} día${d===1?'':'s'}`}
const patternUpdated=`Última actualización: ${relativeAge(model.generatedAt)}`;if($('#brain-patterns'))$('#brain-patterns').innerHTML=model.patterns.length?model.patterns.map(p=>`<div class="brain-pattern"><div class="brain-pattern-meta">${esc(patternUpdated)}</div><strong>${esc(p.kind)} · ${p.confidence}% confidence</strong><br>${esc(p.text)}</div>`).join(''):'<div class="brain-empty">The single engine needs more completed sessions and feedback before calling a pattern stable.</div>';
    if($('#brain-recommendation'))$('#brain-recommendation').innerHTML=`<strong>${esc(a.actions?.[0]||'No strong limiter detected')}</strong>${a.actions?.slice(1).map(x=>`<br>${esc(x)}`).join('')||''}`;
    const ni=ctx.nutrition||{},ii=ni.intake||{},tt=ni.targets||{},fc=ctx.fuel||{};
    if($('#brain-nutrition-source'))$('#brain-nutrition-source').textContent=ii.kcal!=null||ii.carb!=null||ii.prot!=null?'FatSecret synced':(ni.source==='calculator'?'Targets only':'No intake');
    if($('#brain-nutrition-context'))$('#brain-nutrition-context').innerHTML=[
      ['Calories',ii.kcal!=null?Math.round(ii.kcal):'—','logged'],
      ['Carbs',ii.carb!=null?`${Math.round(ii.carb)} g`:'—','FatSecret'],
      ['Protein',ii.prot!=null?`${Math.round(ii.prot)} g`:'—','FatSecret'],
      ['Daily target',tt.kcal!=null?`${Math.round(tt.kcal)} kcal`:'—','calculator'],
      ['Carb coverage',ni.coverage?.carb!=null?`${ni.coverage.carb}%`:'—','target'],
      ['Performance fuel',fc.score!=null?`${fc.score}%`:'—',fc.status||'not available']
    ].map(([n,v,u])=>`<div class="brain-metric"><strong>${esc(String(v))}</strong><span>${esc(n)} · ${esc(u)}</span></div>`).join('');
    const ev=(model.events||[]).slice(-8).reverse();if($('#brain-history'))$('#brain-history').innerHTML=ev.length?ev.map(e=>`<div class="brain-history"><strong>${esc(e.type)}</strong> · ${esc(new Date(e.createdAt).toLocaleDateString())}<br>${esc(e.note||e.status||'Learning event recorded.')}</div>`).join(''):'<div class="brain-empty">No learning events recorded yet.</div>';
  }
  function renderWeeklyIntelligence(){
    const root=$('#brain-weekly-intelligence');if(!root)return;
    if(!weekly){root.innerHTML='<div class="brain-empty">Weekly summary unavailable. Refresh after training and nutrition sources finish loading.</div>';return}
    const fmt=(v,suffix='')=>v==null?'Unavailable':`${v}${suffix}`;
    const q=weekly.quality||{},n=weekly.nutrition||{},t=weekly.training||{},w=weekly.weight||{},r=weekly.recovery||{},p=t.progression||{},a=t.adherence||{};
    const cards=[
      ['Weight trend',w.deltaKg==null?'Unavailable':`${w.deltaKg>0?'+':''}${w.deltaKg.toFixed(2)} kg`,w.deltaKg==null?`${w.recentCount||0} recent / ${w.previousCount||0} previous weigh-ins`:w.trend],
      ['Nutrition mean',n.averages?.kcal?.value==null?'Unavailable':`${Math.round(n.averages.kcal.value)} kcal/day`,`${n.averages?.kcal?.n||0} logged days · target ${fmt(n.targetKcal,' kcal')}`],
      ['Completed sessions',String(t.completedSessions??0),`${t.previousCompletedSessions??0} in previous 7 days`],
      ['Strength trend',p.compared?`${p.progress} up · ${p.hold} hold · ${p.caution} caution`:'Insufficient comparable exercises',`${p.compared||0} exercise comparisons · last 28 days`],
      ['Plan adherence',a.rate==null?'Unavailable':`${a.rate}%`,a.rate==null?'No explicit planned sessions found':`${a.completed}/${a.planned} planned sessions completed`],
      ['Recorded recovery',r.average==null?'Unavailable':`${r.average}%`,`${r.sample||0} usable recovery records · ${r.lowDays||0} low days`]
    ];
    root.innerHTML=`<div class="brain-metric-grid brain-weekly-grid">${cards.map(([label,value,detail])=>`<div class="brain-metric"><strong>${esc(value)}</strong><span>${esc(label)} · ${esc(detail)}</span></div>`).join('')}</div><div class="brain-weekly-quality"><strong>Data quality: ${esc(q.status||'unknown')}</strong><span>${esc((q.flags||[]).join(' ')||'No obvious coverage limitation detected. This is not proof that every source is complete.')}</span></div><div class="brain-weekly-conclusions">${(weekly.conclusions||[]).map(c=>`<p><strong>${esc(c.metric)} · ${esc(c.confidence)} confidence</strong><br>${esc(c.text)}</p>`).join('')||'<p>No supported conclusions yet. Keep logging consistent data.</p>'}</div><p class="brain-legend">Read-only deterministic summary. Missing values stay unavailable; trends and associations do not establish causation. No calories, targets or workout loads are changed.</p>`;
  }
  function showPageSafe(id){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.getElementById(id)?.classList.add('active');window.scrollTo({top:0,behavior:'smooth'})}
  async function openBrain(){document.querySelector('.home-brain-details')?.setAttribute('open','');await refresh()}
  function saveFeedback(){const outcome=$('#brain-feedback-outcome')?.value||'expected',energy=Number($('#brain-feedback-energy')?.value)||3,performance=Number($('#brain-feedback-performance')?.value)||3,note=$('#brain-feedback-note')?.value.trim()||'';const cycle=window.tpCycleSnapshot?window.tpCycleSnapshot():null;TrainingDataCore.recordEvent({type:'session_feedback',outcome,energy,performance,note,status:'Feedback learned by TrainingDataCore',payload:{outcome,energy,performance,note,cyclePhase:cycle?.phase||null,rpe:Number(window.tpAllWorkoutRows?.()?.find(r=>r.date===TrainingDataCore.dayKey())?.data?.metrics?.rpe)||0}});if($('#brain-feedback-note'))$('#brain-feedback-note').value='';refresh()}
  document.addEventListener('trainmei:nutrition-feedback',e=>{const v=e.detail||{};TrainingDataCore.recordEvent({type:'nutrition_feedback',status:'Nutrition feedback learned by TrainingDataCore',note:`${v.sessionType||'Session'} · ${v.carbs||0} g carbs · ${v.timing||0} min · energy ${v.energy||0}/5 · performance ${v.performance||0}/5`,payload:v});refresh()});
  document.addEventListener('trainmei:core-learning',()=>refresh());
  ['trainmei:pre-session-updated','trainmei:body-progress-updated','trainmei:performance-fuel-updated'].forEach(name=>document.addEventListener(name,()=>refresh()));
  document.addEventListener('click',e=>{if(e.target.closest('#brain-weekly-refresh'))refresh();if(e.target.closest('[data-brain-open]'))openBrain();if(e.target.closest('[data-brain-back]'))document.querySelector('.home-brain-details')?.removeAttribute('open');const fb=e.target.closest('[data-brain-feedback]');if(fb){const date=TrainingDataCore.dayKey(),recommendation=(model?.adaptation?.actions||[]).join(' | ')||'No specific recommendation available';const recommendationId=`${date}:${recommendation.slice(0,120)}`;try{TrainingDataCore.recordRecommendationResponse({recommendationId,recommendation,response:fb.dataset.brainFeedback,source:'training-brain',date,context:{sample:model?.sample??0,confidence:model?.dataConfidence?.status||'unknown'}})}catch(err){console.warn('[Training Brain] Could not record recommendation response:',err)}refresh()}if(e.target.closest('#brain-save-feedback'))saveFeedback()});
  document.addEventListener('DOMContentLoaded',refresh);
  window.TrainMeiBrain={refresh,open:openBrain,getModel:()=>model,getWeeklyIntelligence:()=>weekly};
})();
