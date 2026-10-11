/* TrainMei Training Insights
   Weekly Review + Adaptive Training + Muscle Group Analytics + Pattern Discovery.
   All interpretation is read-only and reuses TrainingDataCore's existing unified
   profile, training rows, adaptation and readiness APIs. No separate learner. */
(()=>{
  'use strict';
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const core=()=>window.TrainingDataCore||null;
  let activeTab='weekly', cache=null, loading=false, queued=false;

  const todayKey=()=>core()?.dayKey?.()||(()=>{
    const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();
  const shift=(key,days)=>{const d=new Date(`${key}T12:00:00`);d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const fmtDate=key=>{try{return new Date(`${key}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric'})}catch{return key}};
  const avg=xs=>xs.length?xs.reduce((s,n)=>s+Number(n||0),0)/xs.length:null;
  const num=(v)=>v==null||v===''||!Number.isFinite(Number(v))?null:Number(v);
  const round=(v,d=0)=>v==null?'—':Number(v).toFixed(d);
  const card=(label,value,detail='')=>`<article class="ti-metric"><span>${esc(label)}</span><strong>${esc(value)}</strong>${detail?`<small>${esc(detail)}</small>`:''}</article>`;
  const empty=(title,body)=>`<div class="ti-empty"><strong>${esc(title)}</strong><p>${esc(body)}</p></div>`;
  const pill=(text,kind='neutral')=>`<span class="ti-pill ${kind}">${esc(text)}</span>`;
  const exerciseName=e=>String(e?.name||e?.exercise||e?.exerciseName||'').trim();
  const getExercises=day=>{
    const out=[];
    const blocks=Array.isArray(day?.blocks)?day.blocks:[];
    for(const b of blocks){
      for(const e of (Array.isArray(b?.exercises)?b.exercises:[])){
        const name=exerciseName(e);if(!name)continue;
        const groups=Array.isArray(e.setGroups)&&e.setGroups.length?e.setGroups:[e];
        const sets=groups.reduce((s,g)=>s+Math.max(0,Number(g?.sets)||0),0);
        const reps=groups.reduce((s,g)=>s+Math.max(0,Number(String(g?.reps??'').match(/\d+(?:\.\d+)?/)?.[0])||0),0);
        const weights=groups.map(g=>num(g?.weight)).filter(v=>v!=null);
        const rirs=groups.map(g=>num(g?.rir??g?.RIR??g?.repsInReserve)).filter(v=>v!=null&&v>=0&&v<=10);
        out.push({name,sets,reps,weight:weights.length?Math.max(...weights):null,rir:rirs.length?rirs.reduce((a,b)=>a+b,0)/rirs.length:null,groups,block:b?.title||b?.name||''});
      }
    }
    return out;
  };
  const muscleRules=[
    ['Quadriceps',/\b(quad|quadriceps|leg extension|front squat|hack squat|leg press|split squat|lunge|step.?up)\b/i],
    ['Hamstrings',/\b(hamstring|lying curl|seated curl|leg curl|nordic|romanian deadlift|\brdl\b|good morning)\b/i],
    ['Glutes',/\b(glute|hip thrust|glute bridge|kickback|bulgarian split squat|sumo deadlift)\b/i],
    ['Calves',/\b(calf|calves|gastroc|soleus)\b/i],
    ['Chest',/\b(chest|bench press|chest press|pec deck|flye?|push.?up)\b/i],
    ['Back',/\b(back|row|lat pulldown|pull.?up|chin.?up|pullover|deadlift|face pull)\b/i],
    ['Shoulders',/\b(shoulder|deltoid|lateral raise|front raise|overhead press|military press|rear delt)\b/i],
    ['Biceps',/\b(biceps?|preacher curl|hammer curl|concentration curl|incline curl|cable curl|spider curl|ez[- ]?bar curl|dumbbell curl)\b/i],
    ['Triceps',/\b(triceps?|pushdown|skull crusher|overhead extension|dip)\b/i],
    ['Core',/\b(core|abs|abdominal|crunch|plank|sit.?up|hanging leg raise|pallof)\b/i]
  ];
  const classify=name=>{
    const matches=muscleRules.filter(([,re])=>re.test(name)).map(([label])=>label);
    // Do not force an unknown exercise into a guessed muscle group.
    return [...new Set(matches)];
  };
  const weekBounds=()=>{
    const end=todayKey(),d=new Date(`${end}T12:00:00`),day=(d.getDay()+6)%7;
    const start=shift(end,-day);
    return {start,end};
  };
  const getWeekPlan=(start,end)=>{
    const c=core(),dates=[];for(let d=start;d<=end;d=shift(d,1))dates.push(d);
    const planned=[];
    for(const date of dates){
      try{
        const w=c?.plannedWorkout?.(date);
        if(w&&!w.restDay)planned.push({date,workout:w});
      }catch{}
    }
    return planned;
  };
  const build=async()=>{
    const c=core();if(!c)return {error:'TrainingDataCore is not available yet.'};
    const today=todayKey(),from365=shift(today,-364),from90=shift(today,-89),{start,end}=weekBounds();
    const [profile,rows,exerciseProgress,qualityAudit]=await Promise.all([
      c.learningProfile?c.learningProfile(from365,today):Promise.resolve(null),
      Promise.resolve(c.training?.(from365,today)||[]),
      c.exerciseProgression?c.exerciseProgression(from365,today):Promise.resolve([]),
      c.qualityAudit?c.qualityAudit(shift(today,-179),today):Promise.resolve(null)
    ]);
    const allRows=Array.isArray(rows)?rows:[];
    const completed=allRows.filter(r=>r?.data?.completed).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    const weekRows=completed.filter(r=>r.date>=start&&r.date<=end);
    const planned=getWeekPlan(start,end);
    const completedDates=new Set(weekRows.map(r=>r.date));
    const pastPlanned=planned.filter(p=>p.date<today);
    const adherenceDenom=planned.filter(p=>p.date<=today).length;
    const adherence=adherenceDenom?Math.round(planned.filter(p=>p.date<=today&&completedDates.has(p.date)).length/adherenceDenom*100):null;
    const weekDurations=weekRows.map(r=>num(r.data?.metrics?.timeMin)).filter(v=>v!=null);
    const weekVolumes=weekRows.map(r=>num(r.data?.metrics?.volume)).filter(v=>v!=null);
    const weekRpes=weekRows.map(r=>num(r.data?.metrics?.rpe)).filter(v=>v!=null&&v>0);
    const recoveryValues=weekRows.map(r=>c.recoveryPercent?.(r.data)).filter(v=>v!=null);
    const nutritionDays=weekRows.map(r=>c.nutritionContext?.(r.date)).filter(n=>n?.intake?.kcal!=null);
    const centralProgress=Array.isArray(exerciseProgress)?exerciseProgress:[];
    const muscleTotals=new Map();
    weekRows.forEach(r=>getExercises(r.data).forEach(ex=>{
      const groups=c.classifyMuscleGroups?c.classifyMuscleGroups(ex.name,ex.muscleGroups):((ex.muscleGroups||[]).length?ex.muscleGroups:classify(ex.name));
      if(!groups.length){const cur=muscleTotals.get('Unclassified')||{sets:0,exercises:new Set(),sessions:new Set()};cur.sets+=ex.sets;cur.exercises.add(ex.name);cur.sessions.add(r.date);muscleTotals.set('Unclassified',cur);return;}
      groups.forEach((g,i)=>{
        const cur=muscleTotals.get(g)||{sets:0,exercises:new Set(),sessions:new Set()};
        // The logged exercise sets are counted as direct volume for the primary
        // heuristic match; multi-match exercises are split to avoid double count.
        cur.sets+=ex.sets/groups.length;cur.exercises.add(ex.name);cur.sessions.add(r.date);muscleTotals.set(g,cur);
      });
    }));
    const muscles=[...muscleTotals.entries()].map(([name,v])=>({name,sets:Math.round(v.sets*10)/10,exerciseCount:v.exercises.size,frequency:v.sessions.size})).sort((a,b)=>b.sets-a.sets);
    return {
      today,start,end,profile,allRows,completed,weekRows,planned,pastPlanned,adherence,adherenceDenom,
      weekDurations,weekVolumes,weekRpes,recoveryValues,nutritionDays,exerciseProgress:centralProgress,muscles,qualityAudit,
      from90,trainingCount:completed.length
    };
  };
  function renderWeekly(m){
    const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const bars=days.map((d,i)=>{const date=shift(m.start,i),count=m.weekRows.filter(r=>r.date===date).length;return {d,date,count}});
    const max=Math.max(1,...bars.map(x=>x.count));
    const barHtml=bars.map(x=>`<div class="ti-weekbar"><div class="ti-weekbar-track"><i style="height:${Math.max(4,x.count/max*100)}%"></i></div><strong>${x.count}</strong><small>${x.d}</small></div>`).join('');
    const plannedHtml=m.planned.length?m.planned.map(p=>`<div class="ti-list-row"><span>${esc(fmtDate(p.date))}</span><strong>${esc(p.workout.focus||p.workout.title||p.workout.trainingCategory||'Planned session')}</strong>${m.weekRows.some(r=>r.date===p.date)?pill('Completed','good'):p.date<m.today?pill('Not logged','warn'):pill('Upcoming')}</div>`).join(''):empty('No planned sessions found','No explicit plan data was available for this week. This is not interpreted as a missed workout.');
    return `<div class="ti-section-head"><div><div class="eyebrow">WEEK OF ${esc(fmtDate(m.start))} — ${esc(fmtDate(m.end))}</div><h2>Your week at a glance</h2></div>${pill(`${m.weekRows.length} completed`,m.weekRows.length?'good':'neutral')}</div>
      <div class="ti-metrics">${card('Completed sessions',m.weekRows.length)}${card('Total time',m.weekDurations.length?`${Math.round(m.weekDurations.reduce((a,b)=>a+b,0))} min`:'—',m.weekDurations.length?'from logged session time':'No session duration data')}${card('Average RPE',round(avg(m.weekRpes),1),m.weekRpes.length?'logged sessions only':'No RPE logged')}${card('Average recovery',avg(m.recoveryValues)!=null?`${Math.round(avg(m.recoveryValues))}%`:'—',m.recoveryValues.length?'based on recorded recovery':'No recovery entries')}</div>
      <div class="ti-grid-two"><section class="ti-panel"><h3>Sessions completed</h3><div class="ti-weekbars">${barHtml}</div><p class="ti-muted">${m.planned.length?`${m.planned.length} planned training days found this week.`:'Planned-session count unavailable; completed sessions are still shown.'}</p></section>
      <section class="ti-panel"><h3>Plan adherence</h3><div class="ti-big-number">${m.adherence==null?'—':`${m.adherence}%`}</div><p class="ti-muted">${m.adherence==null?'No explicit planned sessions available to calculate adherence.':'Calculated only from planned sessions due today or earlier.'}</p>${m.weekVolumes.length?`<div class="ti-inline-stat"><span>Recorded volume</span><strong>${Math.round(m.weekVolumes.reduce((a,b)=>a+b,0)).toLocaleString()}</strong></div>`:''}</section></div>
      <section class="ti-panel"><div class="ti-panel-heading"><h3>Training time by day</h3><span>logged minutes only</span></div><div class="ti-duration-chart">${days.map((d,i)=>{const date=shift(m.start,i);const mins=m.weekRows.filter(r=>r.date===date).reduce((sum,r)=>sum+(num(r.data?.metrics?.timeMin)||0),0);const top=Math.max(1,...days.map((_,j)=>m.weekRows.filter(r=>r.date===shift(m.start,j)).reduce((sum,r)=>sum+(num(r.data?.metrics?.timeMin)||0),0)));return `<div class="ti-duration-col"><strong>${mins?`${Math.round(mins)}m`:'—'}</strong><div class="ti-duration-track"><i style="height:${mins?Math.max(4,mins/top*100):0}%"></i></div><small>${d}</small></div>`}).join('')}</div><p class="ti-muted">Days without logged duration are shown as unavailable, not as zero training load.</p></section>
      <section class="ti-panel"><h3>Planned sessions</h3>${plannedHtml}</section>
      <section class="ti-panel"><h3>Weekly readout</h3><ul class="ti-bullets">${m.weekRows.length?`<li>${m.weekRows.length} completed session${m.weekRows.length===1?'':'s'} in the current Monday–Sunday window.</li>`:'<li>No completed sessions are recorded in the current Monday–Sunday window.</li>'}${m.weekRpes.length?`<li>Average logged RPE: ${round(avg(m.weekRpes),1)}/10.</li>`:''}${m.nutritionDays.length?`<li>FatSecret nutrition totals are available for ${m.nutritionDays.length} completed training day${m.nutritionDays.length===1?'':'s'}.</li>`:'<li>Nutrition coverage for training days is not sufficient to report a weekly average.</li>'}</ul></section>`;
  }
  function renderAdaptive(m){
    const list=m.exerciseProgress.filter(x=>x.records.length>=2).slice(0,30);
    if(!list.length)return empty('Not enough repeated exercise history','Adaptive suggestions appear after the same exercise is logged in at least two completed sessions. Suggestions never change saved workouts.');
    return `<div class="ti-section-head"><div><div class="eyebrow">DECISION SUPPORT · NO AUTOMATIC EDITS</div><h2>Exercise progression candidates</h2></div>${pill(`${list.length} candidates`)}</div>
      <div class="ti-notice">Recommendations use the last two logged appearances of each exercise. They are deliberately conservative: progression also depends on target reps, RIR, technique and how the session felt.</div>
      <div class="ti-adaptive-list">${list.map(x=>`<article class="ti-exercise-card"><div class="ti-exercise-top"><div><h3>${esc(x.name)}</h3><small>${esc(fmtDate(x.prev.date))} → ${esc(fmtDate(x.latest.date))} · ${x.records.length} logged appearances</small></div>${pill(x.kind==='caution'?'Review first':x.kind==='progress'?'Progress candidate':'Hold',x.kind==='caution'?'warn':x.kind==='progress'?'good':'neutral')}</div><strong>${esc(x.recommendation)}</strong><p>${esc(x.reason)}</p><div class="ti-exercise-meta"><span>Latest load: ${x.latest.weight==null?'—':esc(x.latest.weight)}</span><span>Sets: ${x.latest.sets||'—'}</span><span>Session RPE: ${x.latest.rpe==null?'—':esc(x.latest.rpe)}</span><span>RIR: ${x.latest.rir==null?'Not logged':round(x.latest.rir,1)}</span></div><div class="ti-feedback-actions"><span>After the next comparable session:</span><button type="button" class="btn" data-ti-adjustment-feedback="worked" data-ti-exercise="${esc(x.name)}" data-ti-recommendation="${esc(x.kind)}">Helped</button><button type="button" class="btn" data-ti-adjustment-feedback="not-helped" data-ti-exercise="${esc(x.name)}" data-ti-recommendation="${esc(x.kind)}">Did not help</button></div></article>`).join('')}</div>`;
  }
  function muscleMapSvg(muscles){
    const totals=new Map((muscles||[]).map(x=>[x.name,Number(x.sets)||0]));
    const max=Math.max(1,...totals.values());
    const heat=name=>totals.has(name)?Math.max(.28,Math.min(.95,.28+.67*(totals.get(name)/max))):.08;
    const region=(name,cx,cy,rx,ry,rotation=0)=>`<ellipse class="ti-body-region" data-muscle="${name}" aria-label="${name}: ${totals.has(name)?totals.get(name)+' estimated sets':'no classified sets'}" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rotation} ${cx} ${cy})" style="opacity:${heat(name)}"><title>${name}: ${totals.has(name)?totals.get(name)+' estimated sets':'no classified sets'}</title></ellipse>`;
    const base=`<g class="ti-body-base"><circle cx="90" cy="22" r="13"/><rect x="83" y="34" width="14" height="15" rx="4"/><path d="M72 47 Q80 43 90 45 Q100 43 108 47 L117 65 L110 101 L105 136 L99 148 L81 148 L75 136 L70 101 L63 65Z"/><path d="M70 50 Q62 50 59 60 L47 91 Q44 99 49 103 Q54 106 58 98 L69 74 L73 103 L79 101 L76 66Z"/><path d="M110 50 Q118 50 121 60 L133 91 Q136 99 131 103 Q126 106 122 98 L111 74 L107 103 L101 101 L104 66Z"/><path d="M78 141 L89 146 L87 188 L84 220 Q83 228 78 228 Q73 228 73 220 L74 181Z"/><path d="M102 141 L91 146 L93 188 L96 220 Q97 228 102 228 Q107 228 107 220 L106 181Z"/><path d="M74 218 Q79 216 84 220 L82 247 Q81 252 76 252 Q72 251 72 246Z"/><path d="M96 220 Q101 216 106 218 L108 246 Q108 251 104 252 Q99 252 98 247Z"/><path d="M73 251 L82 251 L85 258 L69 258 Q67 255 73 251Z"/><path d="M98 251 L107 251 Q113 255 111 258 L95 258Z"/></g>`;
    const front=`${region('Shoulders',72,55,8,8,-20)}${region('Shoulders',108,55,8,8,20)}${region('Chest',82,66,9,10,-10)}${region('Chest',98,66,9,10,10)}${region('Biceps',63,75,4.5,12,-20)}${region('Biceps',117,75,4.5,12,20)}${region('Core',90,96,10,22)}${region('Quadriceps',81,166,6.5,20,-3)}${region('Quadriceps',99,166,6.5,20,3)}${region('Calves',78,234,4.5,13,-2)}${region('Calves',102,234,4.5,13,2)}`;
    const back=`${region('Shoulders',72,55,8,8,-20)}${region('Shoulders',108,55,8,8,20)}${region('Back',90,78,13,27)}${region('Triceps',62,75,4.5,12,-20)}${region('Triceps',118,75,4.5,12,20)}${region('Glutes',82,145,8,8,-8)}${region('Glutes',98,145,8,8,8)}${region('Hamstrings',81,169,6,18,-3)}${region('Hamstrings',99,169,6,18,3)}${region('Calves',78,234,4.5,13,-2)}${region('Calves',102,234,4.5,13,2)}`;
    const svg=(label,regions)=>`<svg viewBox="0 0 180 270" role="img" aria-label="${label} body map; region intensity represents estimated logged sets"><title>${label} muscle-group distribution</title>${base}${regions}</svg>`;
    return `<div class="ti-body-map-wrap"><div class="ti-body-map-head"><div><span class="eyebrow">BODY MAP</span><h3>Where your sets are going</h3></div><span class="ti-map-legend"><i></i> Higher relative volume</span></div><div class="ti-body-map-grid"><div class="ti-body-view"><strong>FRONT</strong>${svg('Front',front)}</div><div class="ti-body-view"><strong>BACK</strong>${svg('Back',back)}</div></div><p class="ti-map-note">Region colour is relative to the highest classified set total this week. Hover or tap a region where supported to see its estimated set count. Compound-exercise mapping is approximate.</p></div>`;
  }
  function renderMuscles(m){
    const muscles=m.muscles||[];
    const map=muscleMapSvg(muscles);
    if(!muscles.length)return `<div class="ti-section-head"><div><div class="eyebrow">${esc(fmtDate(m.start))} — ${esc(fmtDate(m.end))}</div><h2>Weekly muscle-group volume</h2></div>${pill('Estimated from exercise names')}</div>${map}<div class="ti-notice">No classifiable sets have been logged this week yet. Once completed sessions include named exercises and set counts, the map and distribution bars will fill in automatically.</div>`;
    const max=Math.max(1,...muscles.map(x=>x.sets));
    return `<div class="ti-section-head"><div><div class="eyebrow">${esc(fmtDate(m.start))} — ${esc(fmtDate(m.end))}</div><h2>Weekly muscle-group volume</h2></div>${pill('Estimated from exercise names')}</div>
      <div class="ti-notice">Logged sets are assigned by exercise-name matching. Compound exercises may involve several muscles; multi-match sets are split across matches to avoid double-counting. This is an estimate, not a validated biomechanical model.</div>
      ${map}
      <section class="ti-panel"><div class="ti-panel-heading"><h3>Set distribution</h3><span>sets · training days · exercises</span></div><div class="ti-muscle-list">${muscles.map(x=>`<div class="ti-muscle-row"><div class="ti-muscle-label"><strong>${esc(x.name)}</strong><span>${round(x.sets,1)} sets · ${x.frequency} day${x.frequency===1?'':'s'} · ${x.exerciseCount} exercise${x.exerciseCount===1?'':'s'}</span></div><div class="ti-muscle-track"><i style="width:${Math.max(0,Math.min(100,x.sets/max*100))}%"></i></div></div>`).join('')}</div></section>
      <div class="ti-metrics">${card('Classified groups',muscles.filter(x=>x.name!=='Unclassified').length)}${card('Total logged sets',round(muscles.reduce((sum,x)=>sum+x.sets,0),1))}${card('Unclassified sets',round(muscles.find(x=>x.name==='Unclassified')?.sets||0,1),'Exercise names not matched')}</div>`;
  }
  function renderPatterns(m){
    const p=m.profile;
    const patterns=Array.isArray(p?.patterns)?p.patterns:[];
    const sample=Number(p?.sample)||0;
    const audit=m.qualityAudit;
    const auditHtml=audit?`<section class="ti-panel ti-audit-panel"><div class="ti-panel-heading"><h3>Data quality used by the model</h3><span>${esc(audit.uniqueDates)} unique dates · ${esc(audit.rawRows)} source rows</span></div><div class="ti-audit-summary">${(audit.issues||[]).map(i=>`<article class="ti-audit-item ${esc(i.severity)}"><strong>${esc(i.title)}</strong><p>${esc(i.detail)}</p></article>`).join('')}</div></section>`:'';
    return `<div class="ti-section-head"><div><div class="eyebrow">TRAININGDATA CORE · PERSONAL HISTORY</div><h2>Patterns in your data</h2></div>${pill(`${sample} completed sessions`,sample>=12?'good':sample>=6?'warn':'neutral')}</div>
      <div class="ti-metrics">${card('Completed sessions',sample)}${card('Recent sessions',p?.recentSample??'—','last 42 days')}${card('Nutrition days',p?.nutritionSample??'—','synced history')}${card('Data confidence',p?.dataConfidence?.status||'—',p?.dataConfidence?.score!=null?`${p.dataConfidence.score}% evidence score`:'Not available')}</div>
      <section class="ti-panel ti-model-quality"><div class="ti-panel-heading"><h3>How to make your model smarter</h3><span>Highest-value inputs</span></div><div class="ti-quality-grid"><article><strong>1. Session outcome</strong><p>After training, record performance, energy, technique and whether the adjustment worked. ${sample?`${p?.completeFeedbackSample??0} of ${sample} sessions currently contain at least one feedback signal.`:'Feedback coverage will appear once completed sessions are logged.'}</p></article><article><strong>2. Effort and dose</strong><p>Log total time, session RPE and exercise-level RIR where available. This helps distinguish a hard session from a long one and improves progression gates.</p></article><article><strong>3. Context around training</strong><p>Keep FatSecret sync and meal-consumption times current, and log sleep, pain, energy and cycle context when relevant. Missing data should stay unknown rather than being interpreted as zero.</p></article></div><p class="ti-muted">Pattern strength depends on repeated, comparable observations. The model reports associations with sample size and confidence; it does not infer causation or change a saved workout automatically.</p></section>
      ${auditHtml}
      ${patterns.length?`<div class="ti-pattern-list">${patterns.map(x=>`<article class="ti-pattern-card"><div class="ti-pattern-head"><h3>${esc(x.kind||'Personal pattern')}</h3>${pill(`${x.confidence??'—'}% confidence`,Number(x.confidence)>=75?'good':'neutral')}</div><p>${esc(x.text||'')}</p><div class="ti-pattern-meta">${esc(x.n??'—')} comparable observations · correlation is not causation</div><details class="ti-pattern-detail"><summary>How to interpret this pattern</summary><p>This is a descriptive association in logged data, not a causal result. Unlogged factors may explain some or all of the difference. Compare similar exercises and session demands, and look for the same direction across future observations before changing your plan.</p><p>Confidence is an evidence indicator, not a probability that the pattern is true.</p></details></article>`).join('')}</div>`:empty('No stable patterns detected yet','The unified model needs more completed sessions and relevant feedback before it reports personal associations. This is not a negative result; it means there is not enough evidence yet.')}`;
  }
  function render(){
    const target=$('#ti-content'),status=$('#ti-status');if(!target||!status)return;
    if(!cache){target.innerHTML=empty('Analysis not ready','Refresh after TrainMei finishes loading its data.');return;}
    if(cache.error){status.textContent=cache.error;target.innerHTML=empty('Insights unavailable',cache.error);return;}
    status.textContent=`Updated ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} · source: TrainingDataCore · no separate learning engine`;
    target.innerHTML=activeTab==='weekly'?renderWeekly(cache):activeTab==='adaptive'?renderAdaptive(cache):activeTab==='muscles'?renderMuscles(cache):renderPatterns(cache);
  }
  async function refresh(){
    if(loading){queued=true;return;}
    loading=true;const status=$('#ti-status');if(status)status.textContent='Analysing the existing training history…';
    try{cache=await build()}catch(e){console.warn('[Training Insights] Refresh failed',e);cache={error:'Could not build insights from the available data.'}}
    loading=false;render();
    if(queued){queued=false;refresh()}
  }
  function setTab(tab){
    if(!['weekly','adaptive','muscles','patterns'].includes(tab))return;
    activeTab=tab;
    document.querySelectorAll('[data-ti-tab]').forEach(b=>{const on=b.dataset.tiTab===tab;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on))});
    render();
  }
  document.addEventListener('click',e=>{
    const feedback=e.target.closest('[data-ti-adjustment-feedback]');if(feedback){const c=core();if(c?.recordEvent){c.recordEvent({type:'session_adjustment',date:todayKey(),status:'Post-adjustment outcome recorded',note:`${feedback.dataset.tiExercise}: ${feedback.dataset.tiAdjustmentFeedback}`,payload:{exercise:feedback.dataset.tiExercise,outcome:feedback.dataset.tiAdjustmentFeedback,recommendation:feedback.dataset.tiRecommendation,recordedAfterComparableSession:true}});feedback.textContent='Recorded';feedback.disabled=true;}return;}
    const tab=e.target.closest('[data-ti-tab]');if(tab){setTab(tab.dataset.tiTab);return}
    if(e.target.closest('#ti-refresh-btn')){refresh();return}
    const nav=e.target.closest('[data-page="insights-page"],[data-ios-page="insights-page"]');if(nav){refresh()}
  });
  ['trainmei:core-learning','trainmei:data-core-refreshed','trainmei:day-saved','trainmei:nutrition-updated','trainmei:nutrition-sync-complete'].forEach(name=>document.addEventListener(name,()=>{if($('#insights-page')?.classList.contains('active'))refresh()}));
  window.TrainMeiTrainingInsights={refresh,getModel:()=>cache,setTab};
  // Initial data is loaded lazily when the user opens the page.
})();
