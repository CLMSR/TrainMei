/* TrainMei Stats 2.0 — read-only analytics over existing workout and weigh-in records. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const MUSCLES = ['Chest','Back','Shoulders','Biceps','Triceps','Quadriceps','Hamstrings','Glutes','Calves','Core'];
  const COLORS = ['#8c9f83','#d4a36a','#9b8db7','#6f9ba4','#c98176','#b0a16e','#7992bb','#b78c9a','#83a99b','#9c9c9c'];
  let range = '30', rows = [], activityRows = [], charts = {}, weightRows = [], bound = false, statsMode='muscle', musclePeriod='week', weekOffset=0;
  const num = v => { if(v===null||v===undefined||v==='') return null; const n=Number(String(v).replace(',','.')); return Number.isFinite(n)?n:null; };
  const fmt = (v,d=0) => Number(v||0).toLocaleString(undefined,{maximumFractionDigits:d,minimumFractionDigits:d});
  const dateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const parseDate = s => new Date(`${s}T12:00:00`);
  const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function exerciseGroups(ex){return Array.isArray(ex?.setGroups)&&ex.setGroups.length?ex.setGroups:[{sets:ex?.sets,reps:ex?.reps,weight:ex?.weight}];}
  function exerciseSets(ex){return exerciseGroups(ex).reduce((n,g)=>n+Math.max(0,num(g?.sets)||0),0);}
  function repsNum(v){const m=String(v??'').match(/\d+(?:[.,]\d+)?/);return m?num(m[0]):null;}
  function getExerciseMetrics(ex){
    let sets=0,reps=0,volume=0,maxLoad=0,bestE1RM=null;
    exerciseGroups(ex).forEach(g=>{
      const s=Math.max(0,num(g?.sets)||0), r=repsNum(g?.reps), w=num(g?.weight);
      sets+=s;
      if(r!=null) reps+=s*r;
      if(s>0&&r>0&&w>0){volume+=s*r*w;maxLoad=Math.max(maxLoad,w);const e=w*(1+r/30);bestE1RM=Math.max(bestE1RM||0,e);}
    });
    return {sets,reps,volume,maxLoad,bestE1RM};
  }
  function musclesFor(ex){
    const core=window.TrainingDataCore;
    try{
      const list=core?.muscleGroupsForExercise?.(ex)||core?.classifyMuscleGroups?.(ex?.name,ex?.muscleGroups)||[];
      return list.filter(x=>MUSCLES.includes(x));
    }catch{return [];}
  }
  function summarize(sourceRows=rows){
    const completed=sourceRows.filter(r=>r.data?.completed&&!r.data?.restDay);
    const active=completed.map(r=>r.date);
    let sets=0,reps=0,volume=0,exerciseNames=new Set(),workoutMinutes=0;
    const muscleCounts=Object.fromEntries(MUSCLES.map(m=>[m,0]));
    const exerciseMap=new Map(), dayMap=new Map();
    sourceRows.forEach(row=>{
      const d=row.data||{};
      if(!d.completed||d.restDay)return;
      let daySets=0,dayVolume=0;
      (d.blocks||[]).forEach(b=>(b.exercises||[]).forEach(ex=>{
        if(!String(ex?.name||'').trim())return;
        const met=getExerciseMetrics(ex),name=String(ex.name).trim(),key=name.toLocaleLowerCase();
        exerciseNames.add(name);
        sets+=met.sets; reps+=met.reps; volume+=met.volume; daySets+=met.sets;dayVolume+=met.volume;
        musclesFor(ex).forEach(m=>muscleCounts[m]+=met.sets||1);
        if(!exerciseMap.has(key))exerciseMap.set(key,{name,sessions:[],sets:0,volume:0});
        const rec=exerciseMap.get(key);rec.sets+=met.sets;rec.volume+=met.volume;
        if(met.bestE1RM!=null&&met.bestE1RM>0)rec.sessions.push({date:row.date,e1rm:met.bestE1RM,load:met.maxLoad,sets:met.sets,reps:met.reps,volume:met.volume});
      }));
      if(d.completed&&!d.restDay){dayMap.set(row.date,{sets:daySets,volume:dayVolume,minutes:Math.max(0,num(d.metrics?.timeMin)||0)});workoutMinutes+=Math.max(0,num(d.metrics?.timeMin)||0);}
    });
    return {completed,active,sets,reps,volume,exerciseNames,workoutMinutes,muscleCounts,exerciseMap,dayMap};
  }
  function currentRange(){
    const end=new Date();end.setHours(12,0,0,0);
    if(range==='all')return {from:'2000-01-01',to:dateKey(end)};
    const start=new Date(end);start.setDate(start.getDate()-Number(range)+1);
    return {from:dateKey(start),to:dateKey(end)};
  }
  async function loadRows(){
    const {from,to}=currentRange();
    const core=window.TrainingDataCore;
    if(core?.training) rows=await core.training(from,to);
    else if((window.TrainMeiState||window.__tp)?.getAnalyticsRows) rows=await (window.TrainMeiState||window.__tp).getAnalyticsRows(from,to);
    else rows=[];
    rows=(rows||[]).filter(r=>r?.date&&r.date>=from&&r.date<=to).sort((a,b)=>a.date.localeCompare(b.date));
    const activityStart=new Date();activityStart.setHours(12,0,0,0);activityStart.setDate(activityStart.getDate()-83);
    const activityFrom=dateKey(activityStart);
    if(core?.training) activityRows=await core.training(activityFrom,to);
    else activityRows=rows.filter(r=>r.date>=activityFrom);
    activityRows=(activityRows||[]).filter(r=>r?.date&&r.date>=activityFrom&&r.date<=to).sort((a,b)=>a.date.localeCompare(b.date));
    const allWeights=(window.TrainMeiProgressTools?.getWeightHistory?.()||[]).filter(x=>x?.date&&num(x.weight)>0).sort((a,b)=>a.date.localeCompare(b.date));
    weightRows=range==='all'?allWeights:allWeights.filter(x=>x.date>=from&&x.date<=to);
    const caption=$('#stats-weight-caption');if(caption)caption.textContent=range==='all'?'All saved weigh-ins':`Last ${range} days`;
  }
  function setChart(id,config){
    const canvas=$(id); if(!canvas||!window.Chart)return;
    if(charts[id]){charts[id].destroy();delete charts[id];}
    charts[id]=new Chart(canvas,config);
  }
  const chartOptions={responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{mode:'index',intersect:false}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:7}},y:{beginAtZero:true,grid:{color:'rgba(120,120,120,.12)'},ticks:{maxTicksLimit:5}}}};
  function renderKpis(s){
    const previous=new Date();previous.setDate(previous.getDate()-Number(range==='all'?365:Number(range)));const from=range==='all'?'2000-01-01':dateKey(previous);
    const days=new Set(s.completed.map(r=>r.date)).size;
    const totalDays=Math.max(1,Math.round((Date.now()-parseDate(from).getTime())/86400000)+1);
    const consistency=range==='all'?null:Math.round(days/Math.max(1,Number(range))*100);
    let streak=0,d=new Date();if(!s.completed.some(r=>r.date===dateKey(d)))d.setDate(d.getDate()-1);while(streak<370){const key=dateKey(d);if(!s.completed.some(r=>r.date===key))break;streak++;d.setDate(d.getDate()-1);}
    const cards=[
      ['Workouts',s.completed.length,range==='all'?'All time':`Last ${range} days`],
      ['Volume lifted',fmt(s.volume/1000,1)+' t','Logged load × reps × sets'],
      ['Working sets',fmt(s.sets),'Across saved exercises'],
      ['Active days',days,consistency==null?'Recorded training days':`${consistency}% of selected days`],
      ['Exercises',s.exerciseNames.size,'Unique exercise names'],
      ['Current streak',streak,streak===1?'consecutive day':'consecutive days']
    ];
    $('#stats-kpis').innerHTML=cards.map((c,i)=>`<article class="stats-kpi"><span class="stats-kpi-label">${c[0]}</span><strong>${c[1]}</strong><small>${c[2]}</small></article>`).join('');
  }
  function renderHeatmap(s, selectedWorkoutCount){
    const el=$('#stats-heatmap');if(!el)return;
    const end=new Date();end.setHours(12,0,0,0);const start=new Date(end);start.setDate(start.getDate()-83);
    const mondayOffset=(start.getDay()+6)%7;start.setDate(start.getDate()-mondayOffset);
    const byDate=new Map(s.completed.map(r=>[r.date,(s.dayMap.get(r.date)?.sets||0)]));
    let cells='',days=0;
    for(let i=0;i<84;i++){const d=new Date(start);d.setDate(start.getDate()+i);const key=dateKey(d),n=byDate.has(key)?Math.max(1,byDate.get(key)):0;if(n)days++;
      const level=n===0?0:n<=8?1:n<=16?2:n<=25?3:4;
      cells+=`<div class="stats-heat-cell level-${level}" title="${key}: ${byDate.has(key)?'training recorded':'no completed workout'}" aria-label="${key}: ${level?'training recorded':'no completed workout'}"></div>`;
    }
    el.innerHTML=cells;
    $('#stats-activity-foot').innerHTML=`<strong>${days}</strong> active days in the last 12 weeks <span>·</span> <strong>${selectedWorkoutCount}</strong> workouts in the selected range`;
  }
  function renderVolume(s){
    const byWeek=new Map();
    s.completed.forEach(r=>{const d=parseDate(r.date),monday=new Date(d);monday.setDate(d.getDate()-((d.getDay()+6)%7));const key=dateKey(monday);byWeek.set(key,(byWeek.get(key)||0)+(s.dayMap.get(r.date)?.volume||0));});
    const all=[...byWeek.entries()].sort((a,b)=>a[0].localeCompare(b[0])).slice(-12);
    setChart('#stats-volume-chart',{type:'bar',data:{labels:all.map(x=>x[0].slice(5)),datasets:[{data:all.map(x=>Math.round(x[1])),backgroundColor:'#8c9f83',borderRadius:5,maxBarThickness:34}]},options:{...chartOptions,scales:{...chartOptions.scales,y:{...chartOptions.scales.y,ticks:{callback:v=>v>=1000?(v/1000)+'k':v}}}}});
  }
  function renderMuscles(s){
    const total=Object.values(s.muscleCounts).reduce((a,b)=>a+b,0);
    const sorted=MUSCLES.map((name,i)=>({name,count:s.muscleCounts[name],color:COLORS[i]})).sort((a,b)=>b.count-a.count);
    const bodyMap=`<div class="stats-body-map" role="img" aria-label="Front and back body map showing muscle groups inferred from logged exercises">
      <div class="stats-body-figure"><span>FRONT</span><svg viewBox="0 0 120 190" aria-hidden="true"><circle cx="60" cy="17" r="11"/><path d="M48 31 Q37 32 31 43 L20 77 Q18 83 24 85 L31 86 L39 61 L42 91 L37 124 L33 169 Q33 177 41 177 L47 177 L54 128 L60 125 L66 128 L73 177 L79 177 Q87 177 87 169 L83 124 L78 91 L81 61 L89 86 L96 85 Q102 83 100 77 L89 43 Q83 32 72 31 L67 29 L53 29 Z"/><path class="muscle-zone chest-zone" d="M43 42 Q60 35 77 42 L73 61 L60 66 L47 61 Z"/><path class="muscle-zone shoulder-zone" d="M34 43 L45 37 L47 50 L38 57 Z M86 43 L75 37 L73 50 L82 57 Z"/><path class="muscle-zone quad-zone" d="M43 96 L58 98 L54 124 L47 151 L40 150 Z M62 98 L77 96 L80 150 L73 151 L66 124 Z"/><path class="muscle-zone core-zone" d="M48 66 L72 66 L75 91 L45 91 Z"/></svg></div>
      <div class="stats-body-figure"><span>BACK</span><svg viewBox="0 0 120 190" aria-hidden="true"><circle cx="60" cy="17" r="11"/><path d="M48 31 Q37 32 31 43 L20 77 Q18 83 24 85 L31 86 L39 61 L42 91 L37 124 L33 169 Q33 177 41 177 L47 177 L54 128 L60 125 L66 128 L73 177 L79 177 Q87 177 87 169 L83 124 L78 91 L81 61 L89 86 L96 85 Q102 83 100 77 L89 43 Q83 32 72 31 L67 29 L53 29 Z"/><path class="muscle-zone back-zone" d="M43 39 L58 34 L60 68 L45 63 Z M62 34 L77 39 L75 63 L60 68 Z"/><path class="muscle-zone glute-zone" d="M43 88 L59 91 L57 108 L45 108 Z M61 91 L77 88 L75 108 L63 108 Z"/><path class="muscle-zone ham-zone" d="M43 111 L57 111 L54 149 L46 154 Z M63 111 L77 111 L74 154 L66 149 Z"/></svg></div></div>`;
    const bars=total?sorted.map(m=>`<div class="stats-muscle-row"><span>${esc(m.name)}</span><div class="stats-muscle-track"><i style="width:${Math.round(m.count/Math.max(1,sorted[0].count)*100)}%;background:${m.color}"></i></div><strong>${Math.round(m.count/total*100)}%</strong></div>`).join(''):`<div class="stats-empty">No muscle groups could be inferred yet. Log exercises with recognizable names, or add manual muscle mappings in TrainMei.</div>`;
    $('#stats-muscle-map').innerHTML=bodyMap+`<div class="stats-muscle-distribution">${bars}</div>`;
  }
  function renderStrength(s){
    const select=$('#stats-exercise-select'),previous=select.value;
    const names=[...s.exerciseMap.values()].filter(x=>x.sessions.length).sort((a,b)=>a.name.localeCompare(b.name));
    select.innerHTML='<option value="">Choose an exercise</option>'+names.map(x=>`<option value="${esc(x.name.toLocaleLowerCase())}">${esc(x.name)}</option>`).join('');
    if(names.some(x=>x.name.toLocaleLowerCase()===previous))select.value=previous;
    else if(names.length)select.value=names[0].name.toLocaleLowerCase();
    const chosen=s.exerciseMap.get(select.value);
    const sessions=(chosen?.sessions||[]).sort((a,b)=>a.date.localeCompare(b.date));
    if(!chosen){$('#stats-strength-summary').innerHTML='<div class="stats-empty">Add at least one exercise set with numeric load and reps to see strength progression.</div>';setChart('#stats-strength-chart',{type:'line',data:{labels:[],datasets:[]},options:chartOptions});return;}
    const best=sessions.length?Math.max(...sessions.map(x=>x.e1rm)):null,latest=sessions[sessions.length-1],first=sessions[0],change=first&&latest&&first.e1rm?((latest.e1rm-first.e1rm)/first.e1rm)*100:null;
    $('#stats-strength-summary').innerHTML=`<div><span>Latest estimated 1RM</span><strong>${latest?fmt(latest.e1rm,1)+' kg':'—'}</strong></div><div><span>Best estimated 1RM</span><strong>${best?fmt(best,1)+' kg':'—'}</strong></div><div><span>Change in range</span><strong class="${change>0?'is-up':change<0?'is-down':''}">${change==null?'—':(change>0?'+':'')+fmt(change,1)+'%'}</strong></div>`;
    setChart('#stats-strength-chart',{type:'line',data:{labels:sessions.map(x=>x.date.slice(5)),datasets:[{data:sessions.map(x=>Number(x.e1rm.toFixed(1))),borderColor:'#8c9f83',backgroundColor:'rgba(140,159,131,.15)',fill:true,tension:.25,pointRadius:3,pointHoverRadius:5}]},options:{...chartOptions,scales:{...chartOptions.scales,y:{...chartOptions.scales.y,beginAtZero:false,ticks:{callback:v=>v+' kg'}}}}});
  }
  function renderWeight(){
    const valid=weightRows.filter(x=>x.date&&num(x.weight)>0);
    const first=valid[0],last=valid[valid.length-1],delta=first&&last?num(last.weight)-num(first.weight):null;
    $('#stats-body-summary').innerHTML=last?`<div><span>Latest weight</span><strong>${fmt(last.weight,1)} kg</strong></div><div><span>Change since first saved entry</span><strong>${delta==null?'—':(delta>0?'+':'')+fmt(delta,1)+' kg'}</strong></div><div><span>Weigh-ins</span><strong>${valid.length}</strong></div>`:'<div class="stats-empty">No saved weigh-ins yet. Add weight entries below to build your trend.</div>';
    const weightCanvas=$('#stats-weight-chart');if(weightCanvas)setChart('#stats-weight-chart',{type:'line',data:{labels:valid.map(x=>x.date.slice(5)),datasets:[{data:valid.map(x=>num(x.weight)),borderColor:'#8c9f83',backgroundColor:'rgba(140,159,131,.12)',fill:true,tension:.2,pointRadius:2}]},options:{...chartOptions,scales:{...chartOptions.scales,y:{...chartOptions.scales.y,beginAtZero:false,ticks:{callback:v=>v+' kg'}}}}});
  }
  function renderMode(){
    document.querySelectorAll('[data-stats-mode]').forEach(b=>{const active=b.dataset.statsMode===statsMode;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));});
    const muscle=$('.stats-muscles-card'),strength=$('.stats-strength-card'),volume=$('.stats-main-grid .stats-card:not(.stats-activity-card):not(.stats-muscles-card):not(.stats-strength-card):not(.stats-body-card)'),activity=$('.stats-activity-card');
    if(muscle)muscle.hidden=statsMode!=='muscle';if(strength)strength.hidden=statsMode!=='strength';if(volume)volume.hidden=statsMode==='muscle';if(activity)activity.hidden=statsMode==='strength';
    const label=$('#stats-period-label');if(label){if(musclePeriod==='week'){const d=new Date();d.setDate(d.getDate()-((d.getDay()+6)%7)+weekOffset*7);label.textContent='Week of '+d.toLocaleDateString(undefined,{day:'numeric',month:'short'});}else label.textContent=musclePeriod==='all'?'All recorded history':`Last ${musclePeriod} days`;}
    const prev=$('#stats-period-prev'),next=$('#stats-period-next');if(prev)prev.disabled=musclePeriod!=='week';if(next)next.disabled=musclePeriod!=='week'||weekOffset>=0;
  }

  function renderLibrary(){
    const grid=$('#exercise-library-grid');if(!grid)return;
    const found=new Map();
    activityRows.forEach(row=>{const d=row.data||{};(d.blocks||[]).forEach(b=>(b.exercises||[]).forEach(ex=>{const name=String(ex?.name||'').trim();if(!name)return;const key=name.toLocaleLowerCase();if(!found.has(key))found.set(key,{name,sets:0,sessions:0,muscles:new Set(),volume:0});const item=found.get(key);item.sets+=getExerciseMetrics(ex).sets;item.volume+=getExerciseMetrics(ex).volume;if(d.completed&&!d.restDay)item.sessions++;musclesFor(ex).forEach(m=>item.muscles.add(m));}));});
    const q=($('#exercise-library-search')?.value||'').trim().toLowerCase(),muscle=$('#exercise-library-muscle')?.value||'',sort=$('#exercise-library-sort')?.value||'name';
    let items=[...found.values()].filter(x=>(!q||(x.name+' '+[...x.muscles].join(' ')).toLowerCase().includes(q))&&(!muscle||x.muscles.has(muscle)));items.sort(sort==='frequency'?(a,b)=>b.sessions-a.sessions||a.name.localeCompare(b.name):(a,b)=>a.name.localeCompare(b.name));
    $('#exercise-library-count').textContent=`${items.length} exercises found in saved training history`;
    grid.innerHTML=items.length?items.map(x=>`<article class="exercise-library-card"><div class="exercise-library-card-top"><h3>${esc(x.name)}</h3><span>${x.sessions} sessions</span></div><div class="exercise-library-tags">${[...x.muscles].map(m=>`<span>${esc(m)}</span>`).join('')||'<span>Muscles not classified</span>'}</div><div class="exercise-library-stats"><span><strong>${fmt(x.sets)}</strong> sets</span><span><strong>${fmt(x.volume/1000,1)} t</strong> logged volume</span></div><p>${x.muscles.size?'Muscle groups are inferred from TrainMei exercise mapping. Verify ambiguous or compound movements.':'No muscle mapping found yet. Rename the exercise clearly or add a muscle mapping in the existing exercise editor.'}</p></article>`).join(''):'<div class="stats-empty">No matching exercises in the loaded history. Try another search or log an exercise first.</div>';
  }
  function relocateWeightCard(){
    const card=$('.stats-body-card'),slot=$('#user-weight-content');if(card&&slot&&!card.dataset.relocated){card.dataset.relocated='true';card.classList.add('stats-weight-relocated');slot.prepend(card);}
    const old=$('#nt-weight-chart');if(old){const wrap=old.closest('.nt-chart-wrap');if(wrap)wrap.hidden=true;}
  }
  function renderAll(){
    const s=summarize();renderKpis(s);renderHeatmap(summarize(activityRows),s.completed.length);renderVolume(s);renderMuscles(s);renderStrength(s);renderWeight();renderMode();renderLibrary();
    $('#stats-status').textContent=`${rows.length} saved training day${rows.length===1?'':'s'} checked · Existing workout and weight records are read-only.`;
  }
  async function refresh(){
    const kpis=$('#stats-kpis');if(kpis)kpis.innerHTML='<div class="stats-loading">Updating stats…</div>';
    try{await loadRows();renderAll();}catch(e){console.error('[TrainMei Stats] Could not load history',e);if(kpis)kpis.innerHTML='<div class="stats-empty">Stats could not load right now. Your saved records have not been changed.</div>';}
  }
  function bind(){
    if(bound)return;bound=true;
    document.querySelectorAll('[data-stats-range]').forEach(b=>b.addEventListener('click',()=>{range=b.dataset.statsRange;document.querySelectorAll('[data-stats-range]').forEach(x=>x.classList.toggle('active',x===b));refresh();}));
    $('#stats-exercise-select')?.addEventListener('change',()=>renderStrength(summarize()));
    document.querySelector('#main-nav')?.addEventListener('click',e=>{if(e.target.closest('[data-page="user-page"]'))setTimeout(refresh,60);});
    document.addEventListener('trainmei:remote-data-updated',refresh);
    document.addEventListener('trainmei:weight-updated',refresh);
    document.addEventListener('trainmei:workout-saved',refresh);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&$('#user-page')?.classList.contains('active'))refresh();});
    document.querySelectorAll('[data-stats-mode]').forEach(b=>b.addEventListener('click',()=>{statsMode=b.dataset.statsMode;renderMode();}));
    document.querySelectorAll('[data-muscle-period]').forEach(b=>b.addEventListener('click',()=>{musclePeriod=b.dataset.musclePeriod;weekOffset=0;document.querySelectorAll('[data-muscle-period]').forEach(x=>x.classList.toggle('active',x===b));if(musclePeriod==='all')range='all';else if(musclePeriod!=='week')range=musclePeriod;document.querySelectorAll('[data-stats-range]').forEach(x=>x.classList.toggle('active',x.dataset.statsRange===range));refresh();}));
    $('#stats-period-prev')?.addEventListener('click',()=>{if(musclePeriod==='week'){weekOffset--;renderMode();}});$('#stats-period-next')?.addEventListener('click',()=>{if(musclePeriod==='week'&&weekOffset<0){weekOffset++;renderMode();}});
    ['exercise-library-search','exercise-library-muscle','exercise-library-sort'].forEach(id=>$('#'+id)?.addEventListener(id==='exercise-library-search'?'input':'change',renderLibrary));
    document.querySelectorAll('[data-page="exercise-library-page"],[data-ios-page="exercise-library-page"]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>{refresh();},50)));
  }
  function init(){if(!$('#stats-dashboard'))return;bind();relocateWeightCard();refresh();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.TrainMeiStats={refresh,getSnapshot:()=>({range,days:rows.length})};
})();
