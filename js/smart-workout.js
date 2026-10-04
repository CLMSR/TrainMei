/* ===== SMART WORKOUT GENERATOR / BUILDER / TIMER =====
   Local workout engine: no external database or service required.
   Generated workouts can be converted into native TrainMei blocks. */
(function(){
  const tp=window.TrainMeiState||window.__tp||{};
  const $=s=>document.querySelector(s);
  const $$=s=>Array.from(document.querySelectorAll(s));
  const escW=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const storageKey='training-planner:smart-workout-builder-v1';
  const exercisePool=[
    {n:'Air Squat',f:['full','lower'],e:['bodyweight'],d:'12 reps'},
    {n:'Reverse Lunge',f:['full','lower'],e:['bodyweight'],d:'10/side'},
    {n:'Walking Lunge',f:['full','lower'],e:['bodyweight'],d:'12/side'},
    {n:'Burpee',f:['full','engine','upper'],e:['bodyweight'],d:'8 reps'},
    {n:'Push-up',f:['full','upper'],e:['bodyweight'],d:'10 reps'},
    {n:'Hand-Release Push-up',f:['upper','full'],e:['bodyweight'],d:'8 reps'},
    {n:'Sit-up',f:['core','full'],e:['bodyweight'],d:'12 reps'},
    {n:'Plank',f:['core'],e:['bodyweight'],d:'30 sec'},
    {n:'Mountain Climber',f:['core','engine','full'],e:['bodyweight'],d:'20 reps'},
    {n:'Dumbbell Thruster',f:['full','upper','lower'],e:['dumbbell'],d:'10 reps'},
    {n:'Dumbbell Row',f:['upper'],e:['dumbbell'],d:'10/side'},
    {n:'Dumbbell Romanian Deadlift',f:['lower','full'],e:['dumbbell'],d:'10 reps'},
    {n:'Dumbbell Goblet Squat',f:['lower','full'],e:['dumbbell'],d:'12 reps'},
    {n:'Dumbbell Clean',f:['full','engine'],e:['dumbbell'],d:'8 reps'},
    {n:'Barbell Back Squat',f:['lower','strength'],e:['barbell'],d:'5 reps'},
    {n:'Barbell Deadlift',f:['lower','strength','full'],e:['barbell'],d:'5 reps'},
    {n:'Barbell Front Squat',f:['lower','strength'],e:['barbell'],d:'5 reps'},
    {n:'Barbell Push Press',f:['upper','full','strength'],e:['barbell'],d:'6 reps'},
    {n:'Kettlebell Swing',f:['lower','engine','full'],e:['kettlebell'],d:'15 reps'},
    {n:'Kettlebell Goblet Squat',f:['lower','full'],e:['kettlebell'],d:'12 reps'},
    {n:'Kettlebell Clean',f:['full','engine'],e:['kettlebell'],d:'8/side'},
    {n:'Pull-up',f:['upper','full'],e:['pullup'],d:'6 reps'},
    {n:'Hanging Knee Raise',f:['core','upper'],e:['pullup'],d:'10 reps'},
    {n:'Box Step-up',f:['lower','engine'],e:['box'],d:'10/side'},
    {n:'Box Jump',f:['lower','engine','full'],e:['box'],d:'8 reps'},
    {n:'Row',f:['engine','full'],e:['rower'],d:'250 m'},
    {n:'Run',f:['engine','full'],e:['run'],d:'400 m'},
    {n:'Run',f:['engine','full'],e:['run'],d:'800 m'}
  ];
  let generated=null;
  let selectedDuration=20;
  let builderParts=[];
  let timer={type:'amrap',total:1200,remaining:1200,round:1,interval:60,rounds:1,phase:'work',running:false,last:0,id:null};
  function shuffle(arr){return arr.slice().sort(()=>Math.random()-.5)}
  function equipment(){const a=$$('#swg-equipment input:checked').map(x=>x.value);return a.length?a:['bodyweight']}
  function movementOf(n){
    const s=String(n||'').toLowerCase();
    if(/run|row|burpee|mountain|box jump|swing/.test(s))return 'engine';
    if(/squat|lunge|step-up|thruster/.test(s))return 'squat';
    if(/deadlift|romanian|swing|clean/.test(s))return 'hinge';
    if(/push|press|thruster/.test(s))return 'push';
    if(/pull|row|knee raise/.test(s))return 'pull';
    if(/sit-up|plank|mountain/.test(s))return 'core';
    return 'all';
  }
  const benchmarkPool=[
    {name:'Cindy',format:'AMRAP',duration:20,items:[['Pull-up','5 reps'],['Push-up','10 reps'],['Air Squat','15 reps']],equipment:['bodyweight','pullup']},
    {name:'Helen',format:'FOR TIME',duration:12,items:[['Run','400 m'],['Kettlebell Swing','21 reps'],['Pull-up','12 reps']],equipment:['run','kettlebell','pullup']},
    {name:'Fran',format:'FOR TIME',duration:10,items:[['Barbell Thruster','21-15-9'],['Pull-up','21-15-9']],equipment:['barbell','pullup']},
    {name:'Grace',format:'FOR TIME',duration:8,items:[['Barbell Clean & Jerk','30 reps']],equipment:['barbell']},
    {name:'Annie',format:'FOR TIME',duration:10,items:[['Double Under','50-40-30-20-10'],['Sit-up','50-40-30-20-10']],equipment:['bodyweight']},
    {name:'Baseline',format:'FOR TIME',duration:10,items:[['Run','500 m'],['Row','500 m'],['Air Squat','40 reps'],['Sit-up','30 reps'],['Push-up','20 reps']],equipment:['run','rower','bodyweight']}
  ];
  function candidates(focus,eq,movement='all'){
    return exercisePool.filter(x=>x.e.some(v=>eq.includes(v)) &&
      (focus==='full'||x.f.includes(focus)||x.f.includes('full')) &&
      (movement==='all'||movementOf(x.n)===movement));
  }
  function pick(pool,n){return shuffle(pool).slice(0,n)}
  function formatLabel(f){return ({amrap:'AMRAP',fortime:'FOR TIME',emom:'EMOM',tabata:'TABATA',strength:'STRENGTH',mixed:'SMART MIX'})[f]||f}
  function makePart(name,format,items){
    return {name,format,exercises:items}
  }
  function generateWorkout(){
    const focus=$('#swg-focus').value,mode=$('#swg-mode').value,format=$('#swg-format').value,level=$('#swg-level').value;
    const movement=$('#swg-movement').value;
    let eq=equipment();
    if(mode==='travel')eq=['bodyweight','run'];
    const mins=selectedDuration;
    if(mode==='benchmark'){
      const available=benchmarkPool.filter(w=>w.equipment.some(v=>eq.includes(v))||w.equipment.every(v=>v==='bodyweight'));
      const b=(available.length?shuffle(available):benchmarkPool)[0];
      generated={
        title:b.name+' · Benchmark',
        focus:'benchmark',format:b.format.toLowerCase().replace(' ','')==='fortime'?'fortime':'amrap',
        duration:b.duration,equipment:b.equipment,
        parts:[makePart('Benchmark',b.format,b.items.map(([n,d])=>({n,d})))]
      };
      renderGenerated();return;
    }
    let pool=candidates(focus,eq,movement);
    if(pool.length<3)pool=candidates(focus,eq,'all');
    if(pool.length<3)pool=candidates('full',eq,'all');
    if(pool.length<3)pool=exercisePool.filter(x=>x.e.includes('bodyweight'));
    const n=level==='hard'?5:level==='moderate'?4:3;
    const main=pick(pool,n);
    let actualFormat=format;
    if(format==='mixed')actualFormat=['amrap','fortime','emom'][Math.floor(Math.random()*3)];
    const parts=[];
    const warmPool=candidates('full',eq,'all').length?candidates('full',eq,'all'):exercisePool.filter(x=>x.e.includes('bodyweight'));
    parts.push(makePart('Warm-up','Prep',pick(warmPool,3)));
    if(mode==='partner'){
      actualFormat=actualFormat==='mixed'?'amrap':actualFormat;
      parts.push(makePart('Partner Main',actualFormat==='fortime'?'FOR TIME':'AMRAP',
        main.map((x,i)=>({...x,d:i%2===0?x.d:'You go / I go'}))));
    }else if(actualFormat==='emom'){
      parts.push(makePart('Main','EMOM',main));
    }else if(actualFormat==='fortime'){
      parts.push(makePart('Main','FOR TIME',main));
    }else if(actualFormat==='tabata'){
      parts.push(makePart('Main','TABATA',main.slice(0,2)));
    }else{
      parts.push(makePart('Main','AMRAP',main));
    }
    if(mins>=20){
      const finPool=candidates('core',eq,'all').concat(candidates('engine',eq,'all'))
        .filter((x,i,a)=>a.findIndex(y=>y.n===x.n)===i);
      parts.push(makePart('Finisher','Finisher',pick(finPool.length?finPool:exercisePool.filter(x=>x.e.includes('bodyweight')),2)));
    }
    generated={
      title:(mode==='partner'?'Partner · ':'')+(focus==='full'?'Full Body':focus.replace(/^./,x=>x.toUpperCase()))+' '+formatLabel(actualFormat),
      focus,format:actualFormat,duration:mins,equipment:eq,mode,parts
    };
    renderGenerated();
  }
  function renderGenerated(){
    if(!generated)return;
    $('#swg-result-title').textContent=generated.title;
    $('#swg-result-meta').innerHTML=[
      `<span>${formatLabel(generated.format)}</span>`,
      `<span>${generated.duration} min</span>`,
      `<span>${generated.mode==='partner'?'Partner':generated.mode==='benchmark'?'Benchmark WOD':generated.mode==='travel'?'Travel':'Custom'}</span>`,
      `<span>${generated.equipment.map(escW).join(' · ')}</span>`
    ].join('');
    $('#swg-result').innerHTML=generated.parts.map(p=>`
      <div class="smart-wod-part-result">
        <div class="smart-wod-part-result-head"><strong>${escW(p.name)}</strong><span>${escW(p.format)}</span></div>
        <div class="smart-wod-part-result-ex">${p.exercises.map(x=>`<div class="smart-wod-exercise-line"><span>${escW(x.n)}</span><span>${escW(x.d)}</span></div>`).join('')}</div>
      </div>`).join('');
  }
  function generatedToBlocks(){
    if(!generated)return[];
    return generated.parts.map((p,i)=>({
      id:'blk_swg_'+Date.now()+'_'+i,
      name:p.name,
      coachNote:'',
      category:['AMRAP','FOR TIME','EMOM','TABATA'].includes(p.format)?p.format:(i===0?'Warm-up':i===generated.parts.length-1?'Accessory':'Conditioning'),
      exercises:p.exercises.map(x=>({name:x.n,setGroups:[{sets:'',reps:x.d.replace(/[^0-9./-]/g,''),weight:'',type:'Aprox'}],sets:'',reps:x.d,weight:''}))
    }));
  }
  function addGeneratedToDay(){
    if(!generated){$('#swg-status').textContent='Generate a workout first.';return}
    if(!tp.currentDay){$('#swg-status').textContent='Open a training day first, then add the workout.';return}
    generatedToBlocks().forEach(b=>tp.currentDay.blocks.push(b));
    tp.currentDay.focus=generated.title;
    tp.currentDay.trainingCategory='Conditioning';
    if(typeof tp.renderDay==='function')tp.renderDay();
    if(typeof tp.scheduleSave==='function')tp.scheduleSave();
    $('#swg-status').textContent='Workout added to the current training day ✓';
  }
  function initBuilder(){
    try{builderParts=JSON.parse(localStorage.getItem(storageKey)||'[]');}catch{builderParts=[]}
    if(!Array.isArray(builderParts))builderParts=[];
    renderBuilder();
  }
  function saveBuilder(){try{localStorage.setItem(storageKey,JSON.stringify(builderParts))}catch{}}
  function addBuilderPart(name){
    builderParts.push({name,format:$('#swb-format').value,exercises:[{name:'',dose:''}]});
    saveBuilder();renderBuilder();
  }
  function renderBuilder(){
    const el=$('#swb-parts'),empty=$('#swb-empty');if(!el)return;
    empty.style.display=builderParts.length?'none':'block';
    el.innerHTML=builderParts.map((p,pi)=>`
      <div class="smart-wod-part">
        <div class="smart-wod-part-head"><strong>${escW(p.name)}</strong><button type="button" data-builder-remove="${pi}" aria-label="Remove part">×</button></div>
        <div class="smart-wod-part-grid">
          <input data-builder-name="${pi}" value="${escW(p.name)}" aria-label="Part name">
          <select data-builder-format="${pi}">
            ${['AMRAP','FOR TIME','EMOM','TABATA','STRENGTH','FINISHER'].map(f=>`<option ${String(p.format).toUpperCase()===f?'selected':''}>${f}</option>`).join('')}
          </select>
        </div>
        <div class="smart-wod-exercises-builder">
          ${p.exercises.map((x,ei)=>`<div class="smart-wod-ex-row">
            <input data-builder-ex="${pi}:${ei}" value="${escW(x.name)}" placeholder="Exercise">
            <input data-builder-dose="${pi}:${ei}" value="${escW(x.dose)}" placeholder="Reps / load">
            <button type="button" data-builder-ex-remove="${pi}:${ei}" aria-label="Remove exercise">×</button>
          </div>`).join('')}
          <button type="button" class="smart-wod-add-ex" data-builder-ex-add="${pi}">+ Add exercise</button>
        </div>
      </div>`).join('');
  }
  function builderToBlocks(){
    return builderParts.filter(p=>p.exercises.some(x=>x.name.trim())).map((p,i)=>({
      id:'blk_swb_'+Date.now()+'_'+i,name:p.name||`Block ${i+1}`,coachNote:'',
      category:['AMRAP','FOR TIME','EMOM','TABATA'].includes(String(p.format).toUpperCase())?String(p.format).toUpperCase():(i===0?'Warm-up':'Conditioning'),
      exercises:p.exercises.filter(x=>x.name.trim()).map(x=>({name:x.name.trim(),setGroups:[{sets:'',reps:x.dose||'',weight:'',type:'Aprox'}],sets:x.dose||'',reps:x.dose||'',weight:''}))
    }));
  }
  function addBuilderToDay(){
    const blocks=builderToBlocks();
    if(!blocks.length){$('#swb-status').textContent='Add at least one exercise to your workout.';return}
    if(!tp.currentDay){$('#swb-status').textContent='Open a training day first, then add the workout.';return}
    blocks.forEach(b=>tp.currentDay.blocks.push(b));
    tp.currentDay.focus=$('#swb-name').value.trim()||'Custom Smart Workout';
    tp.currentDay.trainingCategory='Conditioning';
    if(typeof tp.renderDay==='function')tp.renderDay();
    if(typeof tp.scheduleSave==='function')tp.scheduleSave();
    $('#swb-status').textContent='Built workout added to the current training day ✓';
  }
  function fmt(sec){sec=Math.max(0,Math.round(sec));return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0')}
  function updateTimerDisplay(){
    const display=$('#swt-display'),round=$('#swt-round'),prog=$('#swt-progress');if(!display)return;
    display.textContent=fmt(timer.type==='fortime'?timer.elapsed||0:timer.remaining);
    round.textContent=timer.type==='tabata'?`${timer.phase==='work'?'Work':'Rest'} · Round ${timer.round}/${timer.rounds}`:
      timer.type==='emom'?`Minute ${timer.round}/${timer.rounds}`:`Round ${timer.round}`;
    const base=timer.type==='fortime'?Math.max(1,timer.total):Math.max(1,timer.total);
    const done=timer.type==='fortime'?(timer.elapsed||0):timer.total-timer.remaining;
    prog.style.width=Math.min(100,Math.max(0,done/base*100))+'%';
    $('#swt-format-label').textContent=(timer.type==='fortime'?'FOR TIME':timer.type==='emom'?'EMOM TIMER':timer.type==='tabata'?'TABATA TIMER':timer.type==='rest'?'REST TIMER':'AMRAP TIMER');
  }
  function stopTimer(){timer.running=false;if(timer.id)cancelAnimationFrame(timer.id);timer.id=null}
  function finishTimer(){stopTimer();updateTimerDisplay()}
  function tick(now){
    if(!timer.running)return;
    if(!timer.last)timer.last=now;
    const delta=Math.min(.25,(now-timer.last)/1000);timer.last=now;
    if(timer.type==='fortime'){
      timer.elapsed=(timer.elapsed||0)+delta;
      if(timer.elapsed>=timer.total&&timer.total>0)finishTimer();
    }else if(timer.type==='tabata'){
      timer.remaining-=delta;
      if(timer.remaining<=0){
        if(timer.phase==='work'){timer.phase='rest';timer.remaining=10}
        else{timer.phase='work';timer.round++;if(timer.round>timer.rounds){finishTimer();return}timer.remaining=20}
      }
    }else if(timer.type==='emom'){
      timer.remaining-=delta;
      if(timer.remaining<=0){timer.round++;if(timer.round>timer.rounds){finishTimer();return}timer.remaining=60}
    }else{
      timer.remaining-=delta;
      if(timer.remaining<=0)finishTimer();
    }
    updateTimerDisplay();
    timer.id=requestAnimationFrame(tick);
  }
  function applyTimer(){
    stopTimer();
    const type=$('#swt-type').value,mins=Math.max(0,+$('#swt-min').value||0),secs=Math.min(59,Math.max(0,+$('#swt-sec').value||0));
    const rounds=Math.max(1,Math.min(99,+$('#swt-rounds').value||1));
    timer={type,total:Math.max(1,mins*60+secs),remaining:Math.max(1,mins*60+secs),elapsed:0,round:1,rounds,phase:'work',running:false,last:0,id:null};
    if(type==='emom'){timer.total=rounds*60;timer.remaining=60}
    if(type==='tabata'){timer.total=rounds*30;timer.remaining=20}
    updateTimerDisplay();
  }
  function startTimer(){if(timer.running)return;timer.running=true;timer.last=0;timer.id=requestAnimationFrame(tick)}
  function pauseTimer(){stopTimer()}
  function resetTimer(){applyTimer()}
  function startGeneratedTimer(){
    if(!generated)return;
    $('#swt-type').value=generated.format==='fortime'?'fortime':generated.format==='emom'?'emom':generated.format==='tabata'?'tabata':'amrap';
    $('#swt-min').value=generated.duration;$('#swt-sec').value=0;
    $('#swt-rounds').value=generated.format==='emom'?Math.max(1,generated.duration):generated.format==='tabata'?8:1;
    applyTimer();
    $$('.smart-wod-tab').forEach(b=>b.classList.toggle('active',b.dataset.wodTab==='timer'));
    $$('.smart-wod-view').forEach(v=>v.classList.toggle('active',v.dataset.wodView==='timer'));
    startTimer();
  }
  function init(){
    $$('.smart-wod-tab').forEach(tab=>tab.addEventListener('click',()=>{
      $$('.smart-wod-tab').forEach(x=>x.classList.toggle('active',x===tab));
      $$('.smart-wod-view').forEach(v=>v.classList.toggle('active',v.dataset.wodView===tab.dataset.wodTab));
    }));
    $$('#swg-duration button').forEach(b=>b.addEventListener('click',()=>{
      $$('#swg-duration button').forEach(x=>x.classList.toggle('active',x===b));selectedDuration=+b.dataset.duration||20;
    }));
    $('#swg-generate')?.addEventListener('click',generateWorkout);
    $('#swg-shuffle')?.addEventListener('click',generateWorkout);
    $('#swg-add-day')?.addEventListener('click',addGeneratedToDay);
    $('#swg-start')?.addEventListener('click',startGeneratedTimer);
    $$('#swg-equipment input').forEach(x=>x.addEventListener('change',()=>{}));
    $$('#smart-wod-panel [data-builder-add]').forEach(b=>b.addEventListener('click',()=>addBuilderPart(b.dataset.builderAdd)));
    $('#swb-format')?.addEventListener('change',()=>builderParts.forEach(p=>p.format=$('#swb-format').value));
    $('#swb-add-day')?.addEventListener('click',addBuilderToDay);
    $('#swb-parts')?.addEventListener('input',e=>{
      const t=e.target;
      if(t.dataset.builderName!==undefined)builderParts[+t.dataset.builderName].name=t.value;
      if(t.dataset.builderFormat!==undefined)builderParts[+t.dataset.builderFormat].format=t.value;
      if(t.dataset.builderEx!==undefined){const [pi,ei]=t.dataset.builderEx.split(':').map(Number);builderParts[pi].exercises[ei].name=t.value}
      if(t.dataset.builderDose!==undefined){const [pi,ei]=t.dataset.builderDose.split(':').map(Number);builderParts[pi].exercises[ei].dose=t.value}
      saveBuilder();
    });
    $('#swb-parts')?.addEventListener('click',e=>{
      const r=e.target.closest('[data-builder-remove]');if(r){builderParts.splice(+r.dataset.builderRemove,1);saveBuilder();renderBuilder();return}
      const a=e.target.closest('[data-builder-ex-add]');if(a){builderParts[+a.dataset.builderExAdd].exercises.push({name:'',dose:''});saveBuilder();renderBuilder();return}
      const d=e.target.closest('[data-builder-ex-remove]');if(d){const [pi,ei]=d.dataset.builderExRemove.split(':').map(Number);builderParts[pi].exercises.splice(ei,1);if(!builderParts[pi].exercises.length)builderParts[pi].exercises=[{name:'',dose:''}];saveBuilder();renderBuilder()}
    });
    $('#swt-apply')?.addEventListener('click',applyTimer);
    $('#swt-start')?.addEventListener('click',startTimer);
    $('#swt-pause')?.addEventListener('click',pauseTimer);
    $('#swt-reset')?.addEventListener('click',resetTimer);
    initBuilder();applyTimer();generateWorkout();
  }
  document.addEventListener('DOMContentLoaded',init);
})();
