/* TrainMei Phase 3 — Smart Training domain module.
   It consumes the explicit Training Planner API instead of reaching into
   the planner's private lexical state. */
(function(){
  const TP=window.TrainMeiState||window.__tp;
  if(!TP){console.error('TrainMei Smart Training: planner API unavailable');return;}
/* ===== SMART TRAINING SUITE JS ===== */
(function(){
  const SMART='training-planner:smart:';
  const NOTES='training-planner:smart-notes:';
  const TEMPLATES='training-planner:smart-templates';
  const REC='training-planner:recurring';
  const $s=s=>document.querySelector(s), $$s=s=>Array.from(document.querySelectorAll(s));
  const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch{return d}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const clean=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const esc2=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const aliases={
    'rdl':'Romanian Deadlift','romanian deadlift':'Romanian Deadlift','peso muerto rumano':'Romanian Deadlift','deadlift':'Deadlift','peso muerto':'Deadlift',
    'back squat':'Back Squat','sentadilla':'Back Squat','squat':'Back Squat','front squat':'Front Squat',
    'bench press':'Bench Press','press banca':'Bench Press','pull up':'Pull-Up','pull ups':'Pull-Up','dominadas':'Pull-Up',
    'push up':'Push-Up','push ups':'Push-Up','flexiones':'Push-Up','wall ball':'Wall Balls','wall balls':'Wall Balls',
    'kb swing':'KB Swing','kb swings':'KB Swing','kettlebell swing':'KB Swing','burpee':'Burpee','running':'Run','run':'Run','running  ':'Run',
    'walking lunge':'Walking Lunge','walking lunges':'Walking Lunge','lunges':'Lunge','overhead lunge':'Overhead Lunge','devil press':'Devil Press'
  };
  const groups={
    'Back Squat':['legs','strength','lower body'],'Front Squat':['legs','strength','lower body'],'Romanian Deadlift':['hamstrings','posterior chain','strength'],'Deadlift':['posterior chain','strength','lower body'],
    'Bench Press':['chest','push','strength'],'Pull-Up':['back','pull','strength'],'Push-Up':['chest','push','conditioning'],'Wall Balls':['legs','shoulders','conditioning','hyrox'],
    'KB Swing':['posterior chain','conditioning'],'Burpee':['full body','conditioning'],'Run':['running','conditioning'],'Walking Lunge':['legs','unilateral','conditioning'],'Overhead Lunge':['legs','shoulders','hyrox'],'Devil Press':['full body','conditioning']
  };
  function canonical(name){const c=clean(name);if(aliases[c])return aliases[c];const hit=Object.keys(aliases).find(k=>c.includes(k));return hit?aliases[hit]:String(name||'').trim()}
  function dayText(d){return [d.focus,d.trainingCategory,d.tagline,d.strap,d.notes,d.exercises?.map(e=>[e.name,TP.exerciseSetText(e)].join(' ')).join(' ')].join(' ')}
  function deriveTags(d){
  const set = new Set();
  const text = String(
    [d.focus, d.trainingCategory, d.tagline, d.strap, d.notes,
     (d.blocks||[]).flatMap(b => (b.exercises||[]).map(e => e.name)).join(' ')]
  ).toLowerCase();
  if(/run|running|5k|10k|km/.test(text)) set.add('running');
  if(/hyrox|wall ball|sled|ski erg|row/.test(text)) set.add('hyrox');
  if(/strength|squat|deadlift|bench|press|pull/.test(text)) set.add('strength');
  if(/conditioning|for time|amrap|emom|time cap|burpee/.test(text)) set.add('conditioning');
  if(/upper|bench|pull|back|chest|shoulder/.test(text)) set.add('upper body');
  if(/lower|squat|lunge|hamstring|deadlift|glute/.test(text)) set.add('lower body');
  if(/mobility|stretch/.test(text)) set.add('mobility');
  if(/recovery/.test(text)) set.add('recovery');
  return Array.from(set).slice(0, 8);
}
  function smartMeta(date){return read(SMART+date,{tags:[],status:'planned',analyzedAt:null,score:0})}
  function saveSmartMeta(date,patch){const m={...smartMeta(date),...patch};write(SMART+date,m);return m}
  function getRows(){if(typeof window.tpAllWorkoutRows==='function')return window.tpAllWorkoutRows();const rows=[];Object.keys(localStorage).filter(k=>k.startsWith('training-planner:workout:')).forEach(k=>{try{rows.push({date:k.split(':').pop(),data:JSON.parse(localStorage.getItem(k))})}catch{}});return rows}
  function nonEmptyExercises(d){return (d.exercises||[]).filter(e=>String(e.name||'').trim())}
  function scoreWorkout(d){const ex=nonEmptyExercises(d);const sets=ex.reduce((s,e)=>s+TP.totalExerciseSets(e),0);const reps=ex.reduce((s,e)=>s+TP.totalExerciseReps(e),0);const mins=parseFloat(d.metrics?.timeMin)||0;const rpe=parseFloat(d.metrics?.rpe)||0;return Math.min(100,Math.round(sets*3+reps*.25+mins*.35+rpe*2))}
  function analyzeDay(){if(!TP.currentDay)return null;const ex=nonEmptyExercises(TP.currentDay);const tags=deriveTags(TP.currentDay);const score=scoreWorkout(TP.currentDay);const canonicalized=ex.map(e=>({...e,name:canonical(e.name)}));const groupsCount={};canonicalized.forEach(e=>(groups[canonical(e.name)]||[]).forEach(g=>groupsCount[g]=(groupsCount[g]||0)+1));saveSmartMeta(TP.selectedDateKey,{tags,score,analyzedAt:new Date().toISOString(),exerciseCount:ex.length});return {tags,score,exerciseCount:ex.length,sets:ex.reduce((s,e)=>s+TP.totalExerciseSets(e),0),reps:ex.reduce((s,e)=>s+TP.totalExerciseReps(e),0),canonicalized,groupsCount}}
  function ensureSuite(){
    const day=$s('#day-page');
    if(!day)return;
    const dayView=day.querySelector('.day-view');
    const anchor=dayView?.querySelector('.day-header');
    let box=$s('#smart-suite');
    if(!box){
      box=document.createElement('div');
      box.id='smart-suite';
      box.className='smart-suite is-collapsed';
      box.innerHTML='<div class="smart-suite-head"><div><div class="smart-suite-title">Smart Training</div><div class="smart-suite-sub">Analyze, reuse and progress this session.</div></div><button type="button" class="smart-suite-collapse" id="smart-suite-collapse" aria-label="Expand Smart Training" aria-expanded="false">⌄</button></div><div id="smart-suite-body" class="smart-suite-body"></div>';
      if(anchor)anchor.insertAdjacentElement('afterend',box);else if(dayView)dayView.prepend(box);else day.prepend(box);
    }
    let nav=$s('#smart-training-nav');
    if(!nav){
      nav=document.createElement('div');
      nav.id='smart-training-nav';
      nav.className='smart-tool-dock';
      nav.innerHTML='<div class="tool-group"><span class="tool-group-label">Smart Training</span><button type="button" class="btn" id="open-smart-analyze-inline">Analyze</button><button type="button" class="btn" id="open-smart-search-inline">Search</button><button type="button" class="btn" id="open-block-library-inline">Blocks</button><button type="button" class="btn" id="open-recurring-inline">Repeat</button><button type="button" class="btn" id="open-templates-inline">Templates</button><button type="button" class="btn" id="open-smart-duplicate-inline">Duplicate</button></div>';
      box.insertAdjacentElement('afterend',nav);
      $s('#open-smart-analyze-inline').onclick=()=>openAnalyzer();
      $s('#open-smart-search-inline').onclick=()=>openSearch();
      $s('#open-block-library-inline').onclick=()=>{try{openBlockLibrary();}catch(err){console.error(err);const m=$s('#block-library-modal');if(m)m.classList.add('show');}};
      $s('#open-recurring-inline').onclick=()=>openRecurring();
      $s('#open-templates-inline').onclick=async()=>{$s('#templates-modal').classList.add('show');await loadTemplates()};
      $s('#open-smart-duplicate-inline').onclick=()=>duplicateSmart();
      const smartCollapse=$s('#smart-suite-collapse');
      if(smartCollapse&&!smartCollapse.dataset.bound){
        smartCollapse.dataset.bound='1';
        smartCollapse.onclick=()=>{
          const collapsed=box.classList.toggle('is-collapsed');
          smartCollapse.textContent=collapsed?'⌄':'⌃';
          smartCollapse.setAttribute('aria-expanded',String(!collapsed));
          smartCollapse.setAttribute('aria-label',collapsed?'Expand Smart Training':'Collapse Smart Training');
        };
      }
    }
    const completionTools=$s('#day-completion-tools');
    if(completionTools && !completionTools.dataset.ready){
      completionTools.dataset.ready='1';
      completionTools.innerHTML='<button type="button" class="btn completion-tool" id="open-templates-completion">Templates</button><button type="button" class="btn completion-tool" id="open-duplicate-completion">Duplicate</button>';
      $s('#open-templates-completion').onclick=async()=>{$s('#templates-modal').classList.add('show');await loadTemplates()};
      $s('#open-duplicate-completion').onclick=()=>duplicateSmart();
    }
  }
  function renderSuite(){ensureSuite();const body=$s('#smart-suite-body');if(!body||!TP.currentDay)return;const a=analyzeDay();const meta=smartMeta(TP.selectedDateKey);body.innerHTML='<div class="smart-tags">'+a.tags.map(t=>`<span class="smart-tag">${esc2(t)}</span>`).join('')+'</div><div class="smart-insight-grid"><div class="smart-insight"><strong>'+a.exerciseCount+'</strong><span>Exercises</span></div><div class="smart-insight"><strong>'+a.sets+'</strong><span>Sets</span></div><div class="smart-insight"><strong>'+a.score+'</strong><span>Load index</span></div><div class="smart-insight"><strong>'+a.reps+'</strong><span>Reps</span></div></div><div class="smart-progress-list">'+progressionHTML().slice(0,1200)+'</div>'}
  function progressionHTML(){if(!TP.currentDay)return '';const ex=nonEmptyExercises(TP.currentDay).slice(0,4);const rows=getRows();return ex.map(e=>{const name=canonical(e.name);const hist=[];rows.forEach(r=>(r.data.exercises||[]).forEach(x=>{if(canonical(x.name)===name&&r.date!==TP.selectedDateKey)hist.push({date:r.date,text:TP.exerciseSetText(x)})}));const last=hist[hist.length-1];return '<div class="smart-progress-row"><div><strong>'+esc2(name)+'</strong><small>'+(last?('Previous · '+last.date):'No previous entry')+'</small></div><div class="smart-progress-value">'+esc2(TP.exerciseSetText(e)||'—')+'</div></div>'}).join('')}
  function openSearch(){const m=$s('#smart-search-modal');if(m)m.classList.add('show');const i=$s('#smart-search-input');if(i){i.value='';i.focus()}renderSearch('')}
  function renderSearch(q){const out=$s('#smart-search-results');if(!out)return;const needle=clean(q);let rows=getRows();if(needle)rows=rows.filter(r=>clean(r.date+' '+dayText(r.data)+' '+deriveTags(r.data).join(' ')).includes(needle));rows=rows.slice().reverse().slice(0,40);out.innerHTML=rows.length?rows.map(r=>{const d=r.data, names=nonEmptyExercises(d).slice(0,4).map(e=>canonical(e.name)).join(' · '),meta=smartMeta(r.date);return `<button class="search-result smart-search-result" data-smart-date="${r.date}"><div><strong>${esc2(d.focus||d.trainingCategory||'Workout')}</strong><div class="search-result-meta">${r.date}${names?' · '+esc2(names):''}</div><div class="smart-tags">${meta.tags.slice(0,4).map(t=>`<span class="smart-tag">${esc2(t)}</span>`).join('')}</div></div><span class="search-result-status">${esc2(meta.status||'planned')}</span></button>`}).join(''):'<div class="smart-search-empty">No workouts match this search.</div>'}
  function openAnalyzer(){if(!TP.currentDay)return;const a=analyzeDay();const m=document.createElement('div');m.className='modal-backdrop show';m.id='smart-analyzer-modal';m.innerHTML=`<div class="modal smart-modal"><div class="modal-head"><div><div class="eyebrow">Smart Workout Analyzer</div><div class="modal-title">${esc2(TP.currentDay.focus||TP.currentDay.trainingCategory||'Workout')}</div></div><button class="icon-btn" data-close-smart>×</button></div><div class="smart-dashboard-card"><div class="smart-dashboard-stats"><div class="smart-dashboard-stat"><strong>${a.exerciseCount}</strong><span>Exercises</span></div><div class="smart-dashboard-stat"><strong>${a.sets}</strong><span>Sets</span></div><div class="smart-dashboard-stat"><strong>${a.reps}</strong><span>Reps</span></div><div class="smart-dashboard-stat"><strong>${a.score}</strong><span>Load index</span></div></div></div><div class="smart-suite"><div class="smart-suite-title">Smart tags</div><div class="smart-tags">${a.tags.map(t=>`<span class="smart-tag">${esc2(t)}</span>`).join('')}</div></div><div class="smart-suite"><div class="smart-suite-title">Exercise recognition</div><div class="smart-progress-list">${a.canonicalized.map((e,i)=>`<div class="smart-progress-row"><div><strong>${esc2(e.name)}</strong><small>Original: ${esc2(nonEmptyExercises(TP.currentDay)[i]?.name||'')}</small></div><div class="smart-progress-value">${esc2(TP.exerciseSetText(e)||'—')}</div></div>`).join('')}</div><button class="btn" data-normalize-exercises style="margin-top:9px">Normalize exercise names</button></div><div class="smart-suite"><div class="smart-suite-title">Progression</div>${progressionHTML()}</div></div>`;document.body.appendChild(m)}
  function duplicateSmart(){
    if(!TP.currentDay||!TP.selectedDateKey)return;
    const date=prompt('Duplicate to date (YYYY-MM-DD):',nextDate(TP.selectedDateKey));
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;

    /*
     * Duplicate Workout copies only the reusable workout structure:
     * title/focus + training blocks + conditioning/running tables.
     * All session-specific state is intentionally reset.
     */
    const source=TP.normalizeDay(TP.clone(TP.currentDay));
    const copy=TP.normalizeDay(TP.defaultDay());
    copy.focus=source.focus||'';
    copy.blocks=TP.clone(source.blocks||[]);
    copy.exercises=copy.blocks.flatMap(b=>b.exercises||[]);
    copy.isRunDay=!!source.isRunDay;
    copy.runningRowing=TP.clone(source.runningRowing||copy.runningRowing);

    copy.tagline='';
    copy.strap='';
    copy.trainingCategory='';
    copy.color='';
    copy.metrics={distanceKm:'',timeMin:'',pace:'',rpe:'',load:''};
    copy.caffeine={taken:false,mg:''};
    copy.carbohydratesGrams='';
    copy.recovery={sleep:0,energy:0,soreness:0};
    copy.completed=false;
    copy.restDay=false;
    copy.notes='';
    copy.noteTags=[];
    copy.sessionFeedback={feelings:'',adjustNextTime:'',nextFocus:'',tags:[],performance:'',energyRating:'',technique:'',pain:'',adjustmentOutcome:''};
    copy.previousFeedback=null;

    templateEditorMode=false;
    templateEditorId=null;
    TP.selectedDateKey=date;
    TP.currentDay=TP.normalizeDay(copy);
    TP.saveDay().then(()=>TP.openDay(date));
  }
  function nextDate(k){const d=new Date(k+'T12:00:00');d.setDate(d.getDate()+7);return TP.dateKey(d.getFullYear(),d.getMonth(),d.getDate())}
  function saveSmartBlock(){if(!TP.currentDay||typeof window.__trainingPlannerSaveCurrentBlock!=='function')return;const n=prompt('Block name:',TP.currentDay?.focus||'New block');if(!n)return;$s('#block-name-input').value=n;window.__trainingPlannerSaveCurrentBlock();$s('#block-library-modal')?.classList.add('show');}
  function smartTemplate(){if(!TP.currentDay)return;const name=prompt('Template name:',TP.currentDay.focus||'Smart workout');if(!name)return;const vars=prompt('Variables (comma separated, e.g. distance, weight, reps):','');const arr=read(TEMPLATES,[]);arr.unshift({id:'st_'+Date.now(),name,data:TP.clone(TP.currentDay),variables:(vars||'').split(',').map(x=>x.trim()).filter(Boolean),tags:deriveTags(TP.currentDay)});write(TEMPLATES,arr);alert('Smart template saved locally.');}
  function smartNotesUI(){}
  function renderDashboardExtras(){const cal=$s('#calendar-page');if(!cal||$s('#smart-stats-card'))return;const card=document.createElement('div');card.id='smart-stats-card';card.className='smart-dashboard-card';cal.appendChild(card);const rows=getRows();const now=new Date(),key=d=>TP.dateKey(d.getFullYear(),d.getMonth(),d.getDate());const today=key(now),mon=new Date(now.getFullYear(),now.getMonth(),now.getDate());mon.setDate(mon.getDate()-((mon.getDay()+6)%7));const monK=key(mon);const monthK=today.slice(0,7);const week=rows.filter(r=>r.date>=monK&&r.date<=today),month=rows.filter(r=>r.date.startsWith(monthK));const stats=(a)=>({sessions:a.length,distance:a.reduce((s,r)=>s+(parseFloat(r.data.metrics?.distanceKm)||0),0),time:a.reduce((s,r)=>s+(parseFloat(r.data.metrics?.timeMin)||0),0),load:a.reduce((s,r)=>s+(parseFloat(r.data.metrics?.load)||0),0)});const w=stats(week),mm=stats(month);card.innerHTML='<div class="smart-dashboard-head"><div><div class="smart-dashboard-title">Week & Month</div><div class="smart-dashboard-kicker">Local training overview</div></div><button class="smart-pill" data-smart-open-search>Search</button></div><div class="smart-dashboard-stats"><div class="smart-dashboard-stat"><strong>'+w.sessions+'</strong><span>Week sessions</span></div><div class="smart-dashboard-stat"><strong>'+w.distance.toFixed(1)+' km</strong><span>Week distance</span></div><div class="smart-dashboard-stat"><strong>'+mm.sessions+'</strong><span>Month sessions</span></div><div class="smart-dashboard-stat"><strong>'+Math.round(mm.load)+'</strong><span>Month load</span></div></div>'}
  function bind(){
    document.addEventListener('click',e=>{
      const t=e.target.closest('[data-smart-tool]');if(t){const a=t.dataset.smartTool;if(a==='analyze')openAnalyzer();if(a==='duplicate')duplicateSmart();if(a==='repeat'&&typeof openRecurring==='function')openRecurring();if(a==='block'){e.preventDefault();e.stopPropagation();const modal=document.getElementById('block-library-modal');if(typeof window.__trainingPlannerOpenBlockLibrary==='function'){window.__trainingPlannerOpenBlockLibrary();}else if(modal){modal.classList.add('show');}return;}if(a==='saveblock')saveSmartBlock();if(a==='template')smartTemplate();if(a==='search')openSearch();}
      const nr=e.target.closest('[data-normalize-exercises]');if(nr&&TP.currentDay){TP.currentDay.exercises=TP.currentDay.exercises.map(e=>({...e,name:canonical(e.name)}));TP.renderDay();TP.scheduleSave();openAnalyzer()}
      const sr=e.target.closest('[data-smart-date]');if(sr){const d=sr.dataset.smartDate;if(typeof TP.openDay==='function')TP.openDay(d);$s('#smart-search-modal')?.classList.remove('show')}
      const nm=e.target.closest('[data-note-mood]');if(nm){write(NOTES+TP.selectedDateKey,{...read(NOTES+TP.selectedDateKey,{}),mood:nm.dataset.noteMood});smartNotesUI()}
      const ps=e.target.closest('[data-search-preset]');if(ps){const i=$s('#smart-search-input');if(i){i.value=ps.dataset.searchPreset;renderSearch(i.value)}}
      const cl=e.target.closest('[data-close-smart]');if(cl)cl.closest('.modal-backdrop')?.remove();
      const os=e.target.closest('[data-smart-open-search]');if(os)openSearch();const qo=e.target.closest('[data-quick-open]');if(qo){TP.openDay(qo.dataset.quickOpen)}
    });
    const si=$s('#smart-search-input');if(si)si.addEventListener('input',()=>renderSearch(si.value));
    const close=$s('#close-smart-search');if(close)close.addEventListener('click',()=>close.closest('.modal-backdrop').classList.remove('show'));
    const bl=$s('#block-library-search');if(bl)bl.addEventListener('input',()=>renderBlockLibrary());
    const closeB=$s('#close-block-library');if(closeB)closeB.addEventListener('click',()=>closeB.closest('.modal-backdrop').classList.remove('show'));
    const closeR=$s('#close-recurring');if(closeR)closeR.addEventListener('click',()=>closeR.closest('.modal-backdrop').classList.remove('show'));
    const applyR=$s('#apply-recurring');if(applyR)applyR.addEventListener('click',()=>typeof TP.applyRecurring==='function'&&TP.applyRecurring());
    $$s('[data-rec-preset]').forEach(b=>b.addEventListener('click',()=>{const n=Number(b.dataset.recPreset);const st=$s('#recurring-start')?.value||TP.todayKey();const d=new Date(st+'T12:00:00');d.setDate(d.getDate()+n*7-1);if($s('#recurring-end'))$s('#recurring-end').value=TP.dateKey(d.getFullYear(),d.getMonth(),d.getDate())}));
  }
  document.addEventListener('trainmei:day-rendered',()=>{ensureSuite();renderSuite();smartNotesUI();});
  document.addEventListener('trainmei:day-opened',()=>{ensureSuite();renderSuite();smartNotesUI();});
  document.addEventListener('trainmei:month-rendered',()=>{renderDashboardExtras();});
  bind();
  setTimeout(()=>{ensureSuite();renderDashboardExtras();},500);
})();

})();
