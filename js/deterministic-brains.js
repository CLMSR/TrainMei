/* TrainMei Deterministic Brains
   Explainable, read-only analysis for exercise progression and nutrition.
   Uses the existing TrainingDataCore and FatSecret-backed history; no generative API. */
(()=>{
  'use strict';
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>v==null||v===''||!Number.isFinite(Number(v))?null:Number(v);
  const avg=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
  const shift=(date,days)=>{const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const metric=(label,value,detail='')=>`<article class="brain-deterministic-metric"><span>${esc(label)}</span><strong>${esc(value)}</strong>${detail?`<small>${esc(detail)}</small>`:''}</article>`;
  const notice=(kind,title,text)=>`<article class="brain-deterministic-note ${esc(kind)}"><strong>${esc(title)}</strong><p>${esc(text)}</p></article>`;
  let busy=false;
  async function refresh(){
    if(busy)return;const root=$('#brain-deterministic-detail'),c=window.TrainingDataCore;if(!root||!c)return;busy=true;
    root.innerHTML='<div class="brain-empty">Analysing completed sessions and recorded nutrition…</div>';
    try{
      const end=c.dayKey(),from90=shift(end,-89),fromNutrition=shift(end,-27);
      // Reuse the fetched training rows for progression analysis instead of querying the same 90-day range twice.
      const rows=await c.training(from90,end);
      const [progression,nutrition]=await Promise.all([
        c.exerciseProgression(from90,end,Array.isArray(rows)?rows:[]),
        c.nutritionHistory(fromNutrition,end)
      ]);
      const completed=(Array.isArray(rows)?rows:[]).filter(r=>r?.data?.completed&&!r.data?.restDay);
      const exercises=(Array.isArray(progression)?progression:[]).slice(0,12);
      const nutritionRows=(Array.isArray(nutrition)?nutrition:[]).filter(r=>['kcal','carb','prot','fat'].some(k=>num(r?.[k])!=null&&num(r[k])>=0));
      const mean=k=>avg(nutritionRows.map(r=>num(r[k])).filter(v=>v!=null&&v>=0));
      const targets=c.nutrition()?.targets||{};const kcal=mean('kcal'),carb=mean('carb'),prot=mean('prot'),fat=mean('fat');
      const weightRows=(window.TrainMeiProgressTools?.getWeightHistory?.()||[]).filter(x=>x?.date>=fromNutrition&&x.date<=end&&num(x.weight)>0).sort((a,b)=>a.date.localeCompare(b.date));
      const weightValues=weightRows.map(x=>num(x.weight)).filter(v=>v!=null);
      const recent=weightRows.filter(x=>x.date>=shift(end,-13)).map(x=>num(x.weight)).filter(v=>v!=null);
      const prior=weightRows.filter(x=>x.date>=shift(end,-27)&&x.date<shift(end,-13)).map(x=>num(x.weight)).filter(v=>v!=null);
      const weightDelta=recent.length>=3&&prior.length>=3?avg(recent)-avg(prior):null;
      const up=exercises.filter(x=>x.kind==='progress').length,hold=exercises.filter(x=>x.kind==='hold').length,caution=exercises.filter(x=>x.kind==='caution').length;
      const exerciseHtml=exercises.length?`<div class="brain-deterministic-list">${exercises.map(x=>{
        const kind=x.kind==='progress'?'good':x.kind==='caution'?'warn':'neutral';
        return `<article class="brain-deterministic-row"><div class="brain-deterministic-row-head"><strong>${esc(x.name)}</strong><span class="brain-deterministic-tag ${kind}">${x.kind==='progress'?'Progression candidate':x.kind==='caution'?'Review response':'Maintain'}</span></div><p>${esc(x.reason||x.recommendation||'Not enough comparable data.')}</p><small>Last recorded: ${esc(x.latest?.date||'—')} · ${x.records?.length||0} comparable appearances</small></article>`;
      }).join('')}</div>`:'<div class="brain-empty">No exercise has at least two completed, named appearances with comparable records yet. This is insufficient evidence, not a failure.</div>';
      const nutritionNotes=[];
      if(nutritionRows.length<4)nutritionNotes.push(notice('warn','Limited nutrition evidence',`Only ${nutritionRows.length} days with at least one logged nutrient were found in the last 28 days. Do not treat unlogged days as zero intake.`));
      if(kcal!=null&&num(targets.kcal)>0){const delta=kcal-num(targets.kcal);nutritionNotes.push(notice(Math.abs(delta)<=num(targets.kcal)*.05?'good':'neutral','Calories versus target',`Recorded days averaged ${Math.round(kcal)} kcal versus a target of ${Math.round(num(targets.kcal))} kcal (${delta>0?'+':''}${Math.round(delta)} kcal/day). This applies only to days with recorded calories.`));}
      else nutritionNotes.push(notice('neutral','Calories versus target','A valid calorie average or current target is unavailable; no comparison is made.'));
      if(weightDelta!=null)nutritionNotes.push(notice(Math.abs(weightDelta)<.15?'neutral':weightDelta<0?'good':'neutral','Weight trend',`Mean of recent recorded weigh-ins ${weightDelta<0?'decreased':weightDelta>0?'increased':'was stable'} by ${Math.abs(weightDelta).toFixed(2)} kg versus the preceding two-week window. This is descriptive and does not establish why weight changed.`));
      else nutritionNotes.push(notice('warn','Weight trend needs more data',`Found ${recent.length} recent and ${prior.length} prior weigh-ins. The comparison requires at least 3 in each window.`));
      if(prot!=null&&num(targets.prot)>0)nutritionNotes.push(notice(prot>=num(targets.prot)*.95?'good':'neutral','Protein coverage',`Recorded days averaged ${Math.round(prot)} g versus a target of ${Math.round(num(targets.prot))} g. Missing days are excluded.`));
      const nutritionHtml=`<div class="brain-deterministic-metrics">${metric('Logged nutrition days',nutritionRows.length,'last 28 days')}${metric('Average kcal',kcal==null?'—':Math.round(kcal),num(targets.kcal)>0?`target ${Math.round(num(targets.kcal))}`:'target unavailable')}${metric('Average carbs',carb==null?'—':`${Math.round(carb)} g`,'recorded days')}${metric('Average protein',prot==null?'—':`${Math.round(prot)} g`,num(targets.prot)>0?`target ${Math.round(num(targets.prot))} g`:'recorded days')}${metric('Average fat',fat==null?'—':`${Math.round(fat)} g`,'recorded days')}${metric('Weight entries',weightValues.length,'last 28 days')}</div><div class="brain-deterministic-notes">${nutritionNotes.join('')}</div>`;
      // This panel reports its own evidence limits; avoid rerunning the heavier weekly intelligence pipeline here.
      root.innerHTML=`<div class="brain-deterministic-columns"><section class="brain-deterministic-panel"><div class="brain-deterministic-head"><div><div class="brain-kicker">Training Brain · last 90 days</div><h3>Exercise progression</h3></div><span class="brain-deterministic-count">${completed.length} sessions</span></div><div class="brain-deterministic-metrics">${metric('Progression signals',up,'rule-based candidates')}${metric('Maintain',hold,'no change supported')}${metric('Caution',caution,'review before progressing')}</div>${exerciseHtml}<p class="brain-legend">These are decision-support signals, not automatic changes. The current engine compares the last two recorded appearances and uses logged pain, RIR, RPE and performance where available.</p></section><section class="brain-deterministic-panel"><div class="brain-deterministic-head"><div><div class="brain-kicker">Nutrition Brain · last 28 days</div><h3>Nutrition and weight</h3></div><span class="brain-deterministic-count">${nutritionRows.length} days</span></div>${nutritionHtml}<p class="brain-legend">Source: TrainMei's existing nutrition data layer (FatSecret where synced). Averages use days with recorded values only; weight trend is not proof of a calorie deficit or plateau.</p></section></div>`;
    }catch(err){console.warn('[Deterministic Brains] Could not refresh analysis:',err);root.innerHTML='<div class="brain-empty">The deterministic analysis could not be refreshed. Existing training and nutrition records have not been changed. Check the browser console if this persists.</div>'}
    finally{busy=false}
  }
  document.addEventListener('DOMContentLoaded',()=>{refresh();document.addEventListener('trainmei:user-ready',refresh);document.addEventListener('trainmei:nutrition-updated',refresh);document.addEventListener('trainmei:nutrition-sync-complete',refresh);document.addEventListener('trainmei:weight-updated',refresh);document.addEventListener('click',e=>{if(e.target.closest('#brain-weekly-refresh'))setTimeout(refresh,0)});});
  window.TrainMeiDeterministicBrains={refresh};
})();
