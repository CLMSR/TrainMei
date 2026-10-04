/* Training Planner — main runtime (unchanged apart from Cycle Tracker additions) */
(()=>{
const SUPABASE_URL='https://vjgsezfjslevjbiotfoq.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_IzFrnMtQjVxTHQ3_BVmbLg_Ww2zzi2F';
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
window.supabaseClient=supabaseClient;
const WEEKDAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const PREFIX='training-planner:';
let currentUser=null, view='month', monthCursor=new Date(new Date().getFullYear(),new Date().getMonth(),1), selectedDateKey=null, currentDay=null, monthIndicators={}, templatesCache=[], planData=defaultPlan(), saveTimer=null, smartWorkout=null, smartFileName='', activeBlockIndex=0;
let templateEditorMode=false, templateEditorId=null;
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
function setStatus(t){$('#status-row').textContent=t||''} function pad(n){return String(n).padStart(2,'0')} function dateKey(y,m,d){return `${y}-${pad(m+1)}-${pad(d)}`} function todayKey(){const d=new Date();return dateKey(d.getFullYear(),d.getMonth(),d.getDate())}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function clone(x){return JSON.parse(JSON.stringify(x))}
function defaultDay(){return {tagline:'',strap:'',focus:'',trainingCategory:'',color:'',blocks:[{id:'blk_'+Date.now(),name:'Block 1',coachNote:'',category:'Strength',exercises:[{name:'',setGroups:[{sets:'',reps:'',weight:'',type:'Aprox'}],sets:'',reps:'',weight:''}]}],isRunDay:false,runningRowing:{type:'Run',warmUp:{duration:'',details:''},mainSet:'',coolDown:{duration:'',details:''},blocks:[{id:'run_'+Date.now(),name:'Main',kind:'interval',reps:'',distance:'',duration:'',pace:'',target:'',recovery:'',effort:'',surface:'',details:''}]},metrics:{distanceKm:'',timeMin:'',pace:'',rpe:'',load:''},restDay:false,caffeine:{taken:false,mg:''},carbohydratesGrams:'',recovery:{sleep:0,energy:0,soreness:0},completed:false,notes:'',noteTags:[],sessionFeedback:{feelings:'',adjustNextTime:'',nextFocus:'',tags:[],performance:'',energyRating:'',technique:'',pain:'',adjustmentOutcome:''},previousFeedback:null}} 
function normalizeSetGroup(g){return {sets:g?.sets??'',reps:g?.reps??'',weight:g?.weight??'',type:g?.type??'Aprox'}}
function normalizeExercise(e){const raw=e&&typeof e==='object'?e:{};let groups=Array.isArray(raw.setGroups)?raw.setGroups.map(normalizeSetGroup):[];if(!groups.length)groups=[normalizeSetGroup({sets:raw.sets??'',reps:raw.reps??'',weight:raw.weight??''})];const first=groups[0]||normalizeSetGroup({});return {name:raw.name??'',setGroups:groups,sets:first.sets??'',reps:first.reps??'',weight:first.weight??''}}
function syncExerciseLegacyFields(e){const first=Array.isArray(e?.setGroups)?e.setGroups[0]:null;if(first&&e){e.sets=first.sets??'';e.reps=first.reps??'';e.weight=first.weight??''}return e}
function exerciseSetGroups(e){return Array.isArray(e?.setGroups)&&e.setGroups.length?e.setGroups:[normalizeSetGroup(e)]}
function exerciseSetText(e){return exerciseSetGroups(e).map(g=>[g.sets,g.reps,g.weight].filter(Boolean).join(' ')).filter(Boolean).join(' · ')}
function totalExerciseSets(e){return exerciseSetGroups(e).reduce((n,g)=>n+(parseFloat(g.sets)||0),0)}
function totalExerciseReps(e){return exerciseSetGroups(e).reduce((n,g)=>n+(parseFloat(g.reps)||0),0)}
function normalizeDay(src){const base=defaultDay();src=src&&typeof src==='object'?src:{};const out={...base,...src};let blocks=Array.isArray(src.blocks)?src.blocks:[];if(!blocks.length&&Array.isArray(src.exercises))blocks=[{id:'blk_legacy',name:'Block 1',category:'Strength',exercises:src.exercises}];if(!blocks.length)blocks=clone(base.blocks);out.blocks=blocks.map((b,i)=>({id:b?.id||'blk_'+Date.now()+'_'+i,name:b?.name||`Block ${i+1}`,coachNote:b?.coachNote??'',category:b?.category==='Metcon'?'Conditioning':(b?.category||'Strength'),exercises:Array.isArray(b?.exercises)?b.exercises.map(normalizeExercise):[]}));out.exercises=out.blocks.flatMap(b=>b.exercises);
const rr=src.runningRowing||{};const phase=x=>typeof x==='object'&&x!==null?{duration:x.duration??'',details:x.details??''}:{duration:'',details:x??''};const runBlock=(b,i)=>({id:b?.id||'run_'+Date.now()+'_'+i,name:b?.name||`Block ${i+1}`,kind:b?.kind||'interval',reps:b?.reps??'',distance:b?.distance??b?.duration??'',duration:b?.duration??'',pace:b?.pace??b?.target??'',target:b?.target??'',recovery:b?.recovery??'',effort:b?.effort??'',surface:b?.surface??'',details:b?.details??''});
out.runningRowing={type:rr.type||'Run',warmUp:phase(rr.warmUp),mainSet:rr.mainSet??'',coolDown:phase(rr.coolDown),blocks:Array.isArray(rr.blocks)&&rr.blocks.length?rr.blocks.map(runBlock):[runBlock({name:'Main'},0)]};
out.metrics={distanceKm:src.metrics?.distanceKm??'',timeMin:src.metrics?.timeMin??'',pace:src.metrics?.pace??'',rpe:src.metrics?.rpe??'',load:src.metrics?.load??''};
out.restDay=!!src.restDay;
out.caffeine={taken:!!src.caffeine?.taken,mg:src.caffeine?.mg??''};out.carbohydratesGrams=src.carbohydratesGrams??src.carbsGrams??'';
out.recovery={sleep:Math.min(5,Math.max(0,Number(src.recovery?.sleep)||0)),energy:Math.min(5,Math.max(0,Number(src.recovery?.energy)||0)),soreness:Math.min(5,Math.max(0,Number(src.recovery?.soreness)||0))};
out.completed=!!src.completed;out.color=src.color||'';out.noteTags=Array.isArray(src.noteTags)?src.noteTags:[];const sf=src.sessionFeedback||{};out.sessionFeedback={feelings:sf.feelings??'',adjustNextTime:sf.adjustNextTime??'',nextFocus:sf.nextFocus??'',tags:Array.isArray(sf.tags)?sf.tags:[],performance:sf.performance??'',energyRating:sf.energyRating??'',technique:sf.technique??'',pain:sf.pain??'',adjustmentOutcome:sf.adjustmentOutcome??''};out.previousFeedback=src.previousFeedback&&typeof src.previousFeedback==='object'?src.previousFeedback:null;return out}
function defaultPlan(){return {goals:[],blocks:[],mesocycles:[],microcycles:[],periodization:[],weeks:{},weekTemplates:[]}}
function normalizePlan(p){const x={...defaultPlan(),...(p||{})};x.weeks=x.weeks&&typeof x.weeks==='object'?x.weeks:{};x.weekTemplates=Array.isArray(x.weekTemplates)?x.weekTemplates:[];x.blocks=Array.isArray(x.blocks)?x.blocks:[];return x}
const localApi={get(k){const v=localStorage.getItem(PREFIX+k);return v===null?null:{value:v}},set(k,v){localStorage.setItem(PREFIX+k,v);return true},list(prefix){return {keys:Object.keys(localStorage).filter(k=>k.startsWith(PREFIX+prefix)).map(k=>k.slice(PREFIX.length))}}};
function loadDayLocal(key){try{const r=localApi.get('workout:'+key);if(r)return normalizeDay(JSON.parse(r.value))}catch{}return defaultDay()}
async function loadDay(key){if(currentUser){const {data,error}=await supabaseClient.from('workouts').select('data').eq('user_id',currentUser.id).eq('date',key).maybeSingle();if(!error&&data?.data)return normalizeDay(data.data)}return loadDayLocal(key)}
function persistCurrentDayLocal(){if(!selectedDateKey||!currentDay)return;try{currentDay=normalizeDay(currentDay);localApi.set('workout:'+selectedDateKey,JSON.stringify(currentDay));monthIndicators[selectedDateKey]=currentDay}catch{}}
function scheduleSave(){if(templateEditorMode){setStatus('Template editing');return}setStatus('Saving…');clearTimeout(saveTimer);saveTimer=setTimeout(saveDay,450)}
async function saveDay(){if(templateEditorMode||!selectedDateKey||!currentDay)return;const saveKey=selectedDateKey;const normalized=normalizeDay(clone(currentDay));currentDay=normalized;localApi.set('workout:'+saveKey,JSON.stringify(normalized));if(currentUser){const {error}=await supabaseClient.from('workouts').upsert({user_id:currentUser.id,date:saveKey,data:normalized,updated_at:new Date().toISOString()},{onConflict:'user_id,date'});if(error){console.error(error);setStatus('Saved locally — cloud error');return}}if(selectedDateKey===saveKey)monthIndicators[saveKey]=normalized;setStatus(currentUser?'Autosaved · Synced':'Autosaved · Local');window.TrainMeiBrain?.refresh?.();document.dispatchEvent(new CustomEvent('trainmei:day-saved',{detail:{date:saveKey,day:normalized}}))}
async function syncLocal(){if(!currentUser)return;const rows=[];for(const k of localApi.list('workout:').keys){try{const date=k.replace('workout:','');rows.push({user_id:currentUser.id,date,data:normalizeDay(JSON.parse(localApi.get(k).value)),updated_at:new Date().toISOString()})}catch{}}if(!rows.length){setStatus('Nothing to sync');return}const {error}=await supabaseClient.from('workouts').upsert(rows,{onConflict:'user_id,date'});setStatus(error?'Sync failed':'Synced')}
function exportData(){const data={};for(const k of localApi.list('workout:').keys)data[k]=localStorage.getItem(PREFIX+k);const payload={app:'Training Planner',version:4,exportedAt:new Date().toISOString(),data,plan:planData,templates:templatesCache};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));a.download=`training-planner-backup-${todayKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);setStatus('Backup exported')}
function importData(file){if(!file)return;const r=new FileReader();r.onload=()=>{try{const p=JSON.parse(r.result);Object.entries(p.data||{}).forEach(([k,v])=>localStorage.setItem(PREFIX+k,v));if(p.plan)planData=normalizePlan(p.plan);renderMonth();renderPlan();setStatus('Backup restored')}catch{setStatus('Invalid backup')}};r.readAsText(file)}
async function renderMonth(){return window.TrainMeiCalendar?.renderMonth?.()||undefined}
const undoStack=[];
let undoToastTimer=null;
function hideUndoToast(){const el=document.querySelector('.undo-toast');if(el)el.remove();if(undoToastTimer){clearTimeout(undoToastTimer);undoToastTimer=null}}
function showUndoToast(){
  hideUndoToast();
  const entry=undoStack[undoStack.length-1];if(!entry)return;
  const el=document.createElement('div');el.className='undo-toast';el.innerHTML='<span>Acción eliminada</span><button type="button" data-undo-action>Deshacer</button>';
  el.querySelector('[data-undo-action]').onclick=()=>{const latest=undoStack.pop();if(!latest)return;clearTimeout(latest.timer);currentDay=clone(latest.snapshot);renderDay();scheduleSave();hideUndoToast();setStatus('Deshecho · Autosaving…')};
  document.body.appendChild(el);
  entry.timer=setTimeout(()=>{const wasTop=undoStack[undoStack.length-1]===entry;const i=undoStack.indexOf(entry);if(i>=0)undoStack.splice(i,1);if(wasTop){if(undoStack.length)showUndoToast();else hideUndoToast()}},5000);
}
function pushUndo(label='Acción eliminada'){
  if(!currentDay)return;
  const snapshot=clone(currentDay);
  if(undoStack.length>=10){const old=undoStack.shift();clearTimeout(old.timer)}
  undoStack.push({label,snapshot,timer:null});
  showUndoToast();
}
function clearUndoStack(){undoStack.splice(0).forEach(x=>clearTimeout(x.timer));hideUndoToast()}
function clearCurrentDay(){
  if(!currentDay)return;
  pushUndo('Día borrado');
  clearTimeout(saveTimer);
  currentDay=normalizeDay(defaultDay());
  renderDay();
  scheduleSave();
  setStatus('Día limpiado · Puedes deshacer durante 5 s');
}

async function openDay(k){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(k))return;
  if(!templateEditorMode&&selectedDateKey&&currentDay){clearTimeout(saveTimer);persistCurrentDayLocal();}
  templateEditorMode=false; templateEditorId=null;
  const requestedKey=k;
  clearUndoStack();
  selectedDateKey=requestedKey;
  currentDay=loadDayLocal(requestedKey);
  showPage('day-page');
  renderDay();
  setStatus('');
  const cloudDay=await loadDay(requestedKey);
  if(selectedDateKey===requestedKey){
    currentDay=normalizeDay(clone(cloudDay));
    renderDay();
    setStatus('');
  }
  document.dispatchEvent(new CustomEvent('trainmei:day-opened',{detail:{date:selectedDateKey}}));
}
function setVal(sel,v){const el=$(sel);if(el)el.value=v??''}
function cleanTagline(v){return String(v??'').replace(/\.\/\s*/g,'').replace(/\/(?:N|n)/g,'\n').replace(/\\n/g,'\n').replace(/[ \t]{2,}/g,' ').trim()}
function renderDay(){return window.TrainMeiDayView?.renderDay?.()||undefined}
function renderRecoveryInputs(){return window.TrainMeiDayView?.renderRecoveryInputs?.()}
function renderTrainingBlocks(){return window.TrainMeiDayView?.renderTrainingBlocks?.()}
function conditioningFields(type){return window.TrainMeiDayView?.conditioningFields?.(type)||['Distance','Pace','Recovery']}
function renderConditioningBlocks(){return window.TrainMeiDayView?.renderConditioningBlocks?.()}
function addConditioningBlock(){return window.TrainMeiDayView?.addConditioningBlock?.()}
function showPage(id){$$('.page').forEach(p=>p.classList.remove('active'));const target=$('#'+id);if(!target)return;target.classList.add('active');$$('#main-nav .btn[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===id));if(id==='plan-page')renderPlan();if(id==='home-page')renderHome();if(id==='nutri-page'&&typeof ntMacroChart!=='undefined'&&ntMacroChart)requestAnimationFrame(()=>ntMacroChart.resize());window.scrollTo({top:0,behavior:'smooth'})}
function addToArray(arr,blank){arr.push(blank);renderDay()}
function moveExercise(i,dir){const j=dir==='up'?i-1:i+1;if(j<0||j>=currentDay.exercises.length)return;[currentDay.exercises[i],currentDay.exercises[j]]=[currentDay.exercises[j],currentDay.exercises[i]];renderDay();scheduleSave()}
function numeric(v){const n=Number(v);return Number.isFinite(n)?n:0}
function allWorkoutRows(){const rows=[];Object.keys(localStorage).filter(k=>k.startsWith(PREFIX+'workout:')).forEach(k=>{try{const date=k.slice((PREFIX+'workout:').length);rows.push({date,data:normalizeDay(JSON.parse(localStorage.getItem(k)))})}catch{}});Object.entries(monthIndicators||{}).forEach(([date,data])=>{const idx=rows.findIndex(r=>r.date===date);if(idx>=0)rows[idx]={date,data:normalizeDay(data)};else rows.push({date,data:normalizeDay(data)})});return rows.sort((a,b)=>a.date.localeCompare(b.date))}
async function getAnalyticsRows(from,to){if(currentUser){const {data,error}=await supabaseClient.from('workouts').select('date,data').eq('user_id',currentUser.id).gte('date',from).lte('date',to);if(!error)return (data||[]).map(r=>({date:r.date,data:normalizeDay(r.data)}))}return allWorkoutRows().filter(r=>r.date>=from&&r.date<=to)}
function rangeDates(){const range=$('#analytics-range').value;let to=new Date(),from=new Date(to);if(range!=='all')from.setDate(from.getDate()-Number(range));else from=new Date(2000,0,1);if($('#analytics-from').value)from=new Date($('#analytics-from').value+'T00:00:00');if($('#analytics-to').value)to=new Date($('#analytics-to').value+'T00:00:00');return {from:dateKey(to.getFullYear(),to.getMonth(),to.getDate()),to:dateKey(from.getFullYear(),from.getMonth(),from.getDate())}}
async function renderAnalytics(){const range=$('#analytics-range').value;let to=new Date(),from=new Date(to);if(range==='all')from=new Date(2000,0,1);else from.setDate(from.getDate()-Number(range));if($('#analytics-from').value)from=new Date($('#analytics-from').value+'T00:00:00');if($('#analytics-to').value)to=new Date($('#analytics-to').value+'T00:00:00');const rows=await getAnalyticsRows(dateKey(from.getFullYear(),from.getMonth(),from.getDate()),dateKey(to.getFullYear(),to.getMonth(),to.getDate()));const stats={sessions:rows.length,distance:rows.reduce((s,r)=>s+numeric(r.data.metrics.distanceKm),0),time:rows.reduce((s,r)=>s+numeric(r.data.metrics.timeMin),0),volume:rows.reduce((s,r)=>s+numeric(r.data.metrics.volume),0),load:rows.reduce((s,r)=>s+numeric(r.data.metrics.load),0),prs:rows.filter(r=>String(r.data.metrics.pr||'').trim()).length};$('#stat-grid').innerHTML=[['Sessions',stats.sessions,''],['Distance',stats.distance.toFixed(1),'km'],['Time',Math.round(stats.time),'min'],['Volume',Math.round(stats.volume), ''],['Total time',Math.round(stats.time), 'min'],['PRs',stats.prs,'']].map(x=>`<div class="stat-card"><div class="stat-label">${x[0]}</div><div class="stat-value">${x[1]}</div><div class="stat-unit">${x[2]}</div></div>`).join('');const series=(key)=>rows.map(r=>({label:r.date,value:numeric(r.data.metrics[key])}));drawChart($('#distance-chart'),series('distanceKm'),'km');drawChart($('#time-chart'),series('timeMin'),'min');drawChart($('#volume-chart'),series('volume'),'');drawChart($('#load-chart'),series('timeMin'),'min');const prs=rows.filter(r=>String(r.data.metrics.pr||'').trim()).sort((a,b)=>b.date.localeCompare(a.date));$('#prs-area').innerHTML=prs.length?`<table class="pr-table"><thead><tr><th>Date</th><th>PR</th><th>Session</th></tr></thead><tbody>${prs.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.data.metrics.pr)}</td><td>${esc(r.data.focus||r.data.trainingCategory||'')}</td></tr>`).join('')}</tbody></table>`:'<div class="empty-state">No PRs recorded in this period yet.</div>'}
function drawChart(canvas,data,unit){const w=canvas.clientWidth||500,h=220,dpr=window.devicePixelRatio||1;canvas.width=w*dpr;canvas.height=h*dpr;const c=canvas.getContext('2d');c.scale(dpr,dpr);c.clearRect(0,0,w,h);const css=getComputedStyle(document.body),line=css.getPropertyValue('--line').trim()||'rgba(22,22,22,.18)',ink=css.getPropertyValue('--ink').trim()||'#161616',muted=css.getPropertyValue('--muted').trim()||'#6b6b63';const vals=data.map(x=>x.value);const max=Math.max(1,...vals);const padX=28,padY=22,plotW=w-padX*2,plotH=h-padY*2;c.strokeStyle=line;c.lineWidth=1;for(let i=0;i<4;i++){const y=padY+i*plotH/3;c.beginPath();c.moveTo(padX,y);c.lineTo(w-padX,y);c.stroke()}if(!data.length)return;c.strokeStyle=ink;c.lineWidth=2;c.beginPath();data.forEach((p,i)=>{const x=padX+(data.length===1?plotW/2:i*(plotW/(data.length-1)));const y=padY+plotH-(p.value/max)*plotH;if(i===0)c.moveTo(x,y);else c.lineTo(x,y)});c.stroke();c.fillStyle=ink;data.forEach((p,i)=>{const x=padX+(data.length===1?plotW/2:i*(plotW/(data.length-1)));const y=padY+plotH-(p.value/max)*plotH;c.beginPath();c.arc(x,y,2.5,0,Math.PI*2);c.fill()});c.fillStyle=muted;c.font='10px sans-serif';c.fillText(`${max.toFixed(max%1?1:0)} ${unit}`.trim(),padX,12);if(data.length){c.fillText(data[0].label,padX,h-5);c.textAlign='right';c.fillText(data[data.length-1].label,w-padX,h-5);c.textAlign='left'}}
function renderList(containerId,arr,fields,labels){const c=$('#'+containerId);c.innerHTML=arr.map((obj,i)=>`<div class="plan-row">${fields.map((f,j)=>`<input data-plan-array="${containerId}" data-index="${i}" data-field="${f}" value="${esc(obj[f]??'')}" placeholder="${esc(labels[j]||'')}">`).join('')}<button data-plan-remove="${containerId}" data-index="${i}">×</button></div>`).join('')}
function homeWeekRange(){const now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate());const day=(today.getDay()+6)%7;const monday=new Date(today);monday.setDate(today.getDate()-day);const sunday=new Date(monday);sunday.setDate(monday.getDate()+6);return {today,monday,sunday,dates:Array.from({length:7},(_,i)=>{const d=new Date(monday);d.setDate(monday.getDate()+i);return dateKey(d.getFullYear(),d.getMonth(),d.getDate())})}}
async function renderHome(){const range=homeWeekRange();const from=dateKey(range.monday.getFullYear(),range.monday.getMonth(),range.monday.getDate()),to=dateKey(range.sunday.getFullYear(),range.sunday.getMonth(),range.sunday.getDate());const monthStart=new Date(range.today.getFullYear(),range.today.getMonth(),1),monthEnd=new Date(range.today.getFullYear(),range.today.getMonth()+1,0);const rows=await TrainingDataCore.training(from,to);const monthRows=await TrainingDataCore.training(dateKey(monthStart.getFullYear(),monthStart.getMonth(),monthStart.getDate()),dateKey(monthEnd.getFullYear(),monthEnd.getMonth(),monthEnd.getDate()));const byDate={};rows.forEach(r=>byDate[r.date]=normalizeDay(r.data));const monthByDate={};monthRows.forEach(r=>monthByDate[r.date]=normalizeDay(r.data));const todayK=todayKey();const todayData=byDate[todayK]||loadDayLocal(todayK);const title=todayData?.focus||todayData?.trainingCategory||'';$('#home-greeting').textContent=((()=>{const h=new Date().getHours();return h<6?'Good night':h<12?'Good morning':h<18?'Good afternoon':h<22?'Good evening':'Good night'})());$('#home-date-label').textContent=`${WEEKDAYS[(range.today.getDay()+6)%7]} · ${MONTHS[range.today.getMonth()]} ${range.today.getDate()}, ${range.today.getFullYear()}`;$('#home-today-title').textContent=todayData?.restDay?'Rest day':(title||'No workout planned');$('#home-today-status').textContent=todayData?.restDay?'Rest day':(todayData?.completed?'Completed':'Not completed');const blocks=(todayData?.blocks||[]).filter(b=>(b.exercises||[]).some(e=>String(e.name||'').trim()));const sets=blocks.reduce((n,b)=>n+(b.exercises||[]).reduce((s,e)=>s+totalExerciseSets(e),0),0);$('#home-today-body').innerHTML=todayData?.restDay?'<div class="home-session-title">Rest day</div><div class="home-session-sub">No training scheduled. Recovery inputs can still be logged.</div>':(title?`<div class="home-session-title">${esc(todayData.trainingCategory||'Training session')}</div><div class="home-session-sub">${blocks.length} block${blocks.length===1?'':'s'} · ${sets} planned sets</div><div class="home-session-meta">${blocks.slice(0,4).map(b=>`<span class="home-pill">${esc(b.name||'Block')}</span>`).join('')}</div>`:'<div class="home-empty">Nothing is scheduled for today. You can add a workout or use a template.</div>');const completed=range.dates.filter(k=>!!byDate[k]?.completed).length;const planned=range.dates.filter(k=>!!byDate[k]).length;$('#home-week-title').textContent=`Week ${getWeekNumber(range.monday)}`;$('#home-week-progress-text').textContent=`${completed} completed`;$('#home-week-progress-bar').style.width=(planned?100:0)+'%';$('#home-week-days').innerHTML=range.dates.map((k,i)=>{const d=new Date(k+'T12:00:00'),data=byDate[k],has=!!data;return `<button type="button" class="home-week-day${k===todayK?' today':''}${data?.completed?' completed':''}${!has?' empty':''}" data-home-open-day="${k}"><div class="dow">${WEEKDAYS[i].slice(0,3)}</div><div class="daynum">${d.getDate()}</div><div class="dot"></div></button>`}).join('');$('#home-month-title').textContent=`${MONTHS[range.today.getMonth()]} ${range.today.getFullYear()}`;const firstDow=(monthStart.getDay()+6)%7;const daysInMonth=monthEnd.getDate();let heat='';for(let i=0;i<firstDow;i++)heat+='<span class="home-heat-day empty"></span>';for(let day=1;day<=daysInMonth;day++){const k=dateKey(range.today.getFullYear(),range.today.getMonth(),day),data=monthByDate[k]||loadDayLocal(k);heat+=`<button type="button" class="home-heat-day${data?.completed?' completed':''}${k===todayK?' today':''}" data-home-open-day="${k}" aria-label="${k}${data?.completed?' completed':''}">${day}</button>`}$('#home-month-heatmap').innerHTML=heat;const dist=monthRows.reduce((n,r)=>n+numeric(r.data.metrics?.distanceKm),0);const mins=monthRows.reduce((n,r)=>n+numeric(r.data.metrics?.timeMin),0);$('#home-stats').innerHTML=`<div class="home-stat"><strong>${completed}</strong><span>Completed this week</span></div><div class="home-stat"><strong>${dist.toFixed(1)}</strong><span>km this month</span></div><div class="home-stat"><strong>${Math.round(mins)}</strong><span>minutes</span></div>`;const nextDate=new Date(range.today);nextDate.setDate(nextDate.getDate()+1);const nextKey=dateKey(nextDate.getFullYear(),nextDate.getMonth(),nextDate.getDate()),nextData=monthByDate[nextKey]||loadDayLocal(nextKey);$('#home-next-title').textContent=nextData?.focus||nextData?.trainingCategory||'Open tomorrow’s session';$('#home-next-date').textContent=`${WEEKDAYS[(nextDate.getDay()+6)%7]} · ${nextDate.getDate()}`;$('#home-next-body').innerHTML=`<div class="home-session-sub">${nextData?.completed?'Completed already':'Ready to write'} · ${esc(nextKey)}</div>`;window._homeNextKey=nextKey;renderHomeReadinessAndLoad(todayData)}
window.renderHome=renderHome;
function homeWeekLoadDays(offsetWeeks){const now=new Date();const dow=(now.getDay()+6)%7;const monday=new Date(now);monday.setDate(now.getDate()-dow-offsetWeeks*7);const map={};allWorkoutRows().forEach(r=>map[r.date]=r.data);const days=[];for(let i=0;i<7;i++){const d=new Date(monday);d.setDate(monday.getDate()+i);const k=dateKey(d.getFullYear(),d.getMonth(),d.getDate());const data=map[k]||null;days.push({k,data,time:TrainingDataCore.totalTime?TrainingDataCore.totalTime(data):Number(data?.metrics?.timeMin)||0,load:TrainingDataCore.trainingLoad(data)})}return days}
function renderHomeReadinessAndLoad(todayData){
  const days=homeWeekLoadDays(0),max=Math.max(1,...days.map(x=>x.time));
  const loadBars=$('#home-load-bars');if(loadBars)loadBars.innerHTML=days.map((x,i)=>`<div class="home-load-col"><i style="height:${Math.max(x.time?6:2,Math.round(x.time/max*100))}%"></i><span>${WEEKDAYS[i].slice(0,1)}</span></div>`).join('');
  const total=days.reduce((s,x)=>s+x.time,0);let prevTotal=0,prevWeeks=0;
  for(let w=1;w<=3;w++){const t=homeWeekLoadDays(w).reduce((s,x)=>s+x.time,0);if(t>0){prevTotal+=t;prevWeeks++}}
  const avgPrev=prevWeeks?prevTotal/prevWeeks:total,ratio=avgPrev?total/avgPrev:1;
  const loadStatus=$('#home-load-status');if(loadStatus)loadStatus.textContent=total===0?'—':`${Math.round(total)} MIN`;
  const recVals=days.map(x=>TrainingDataCore.recoveryScore(x.data)).filter(v=>v!==null);
  const recPct=$('#home-load-recovery-pct');if(recPct)recPct.textContent=recVals.length?Math.round(recVals.reduce((a,b)=>a+b,0)/recVals.length/5*100)+'%':'—';
  const cyclePhase=TrainingDataCore.cycle()?.phase||null;
  const readiness=TrainingDataCore.readiness(todayData,{loadRatio:total?ratio:null,cyclePhase});
  const scoreEl=$('#home-readiness-score'),statusEl=$('#home-readiness-status'),barsEl=$('#home-readiness-bars');
  if(readiness.score!==null){
    scoreEl.textContent=readiness.score;
    statusEl.textContent=`${readiness.status} · ${readiness.confidence}`;
    barsEl.innerHTML=readiness.factors.map(f=>`<div class="home-readiness-row"><span>${f.label}</span><div class="home-readiness-track"><i style="width:${f.value}%"></i></div><b>${Math.round(f.value)}</b></div>`).join('');
  }else{
    scoreEl.textContent='—';statusEl.textContent='No data yet';
    barsEl.innerHTML='<div class="home-empty">Rate sleep, energy and soreness today to see your readiness.</div>';
  }
}
async function createSmartTemplate(){
  if(!smartWorkout) return;
  if(!currentUser){
    setStatus('Log in to save templates');
    alert('Log in to save templates.');
    return;
  }
  const defaultName = smartWorkout.templateName || smartWorkout.focus || 'Imported workout';
  const name = prompt('Template name:', defaultName);
  if(name === null) return;      // canceló
  if(!name.trim()) return;       // vacío

  const data = smartDayData();

  // deriveTags puede no existir en este scope → fallback seguro
  let tags = [];
  try {
    tags = (typeof deriveTags === 'function') ? deriveTags(data) : [];
  } catch(e) {
    tags = [];
  }
  data._tags = tags;
  data.importMeta = {
    source: 'SMART AI',
    fileName: smartFileName,
    activityId: '',
    importedAt: new Date().toISOString()
  };

  console.log('[OCR] Inserting template:', name.trim(), data);

  const { data: created, error } = await supabaseClient
    .from('workout_templates')
    .insert({
      user_id: currentUser.id,
      name: name.trim(),
      category: data.trainingCategory || null,
      data,
      updated_at: new Date().toISOString()
    })
    .select('*')
    .single();

  if(error){
    console.error('[OCR] Template insert failed:', error);
    alert('Could not save template: ' + error.message);
    return;
  }

  console.log('[OCR] Template created:', created);

  try {
    await loadTemplates();      // recarga la caché y llama renderTemplates()
  } catch(e) {
    console.error('[OCR] loadTemplates failed:', e);
  }
  setStatus('Smart template created');

  // Cerrar ambos modales para que se vea el resultado
  document.querySelector('#smart-result-modal')?.classList.remove('show');
  document.querySelector('#smart-review-modal')?.classList.remove('show');
}
async function createSmartTemplateSilently(){if(!smartWorkout||!currentUser)return null;const defaultName=smartWorkout.templateName||smartWorkout.focus||'Imported workout';const data=smartDayData();data.importMeta={source:'SMART AI',fileName:smartFileName,activityId:'',importedAt:new Date().toISOString()};data._tags=deriveTags(data);const {data:created,error}=await supabaseClient.from('workout_templates').insert({user_id:currentUser.id,name:defaultName.trim(),category:data.trainingCategory||null,data,updated_at:new Date().toISOString()}).select('*').single();if(error)throw error;await loadTemplates();return created}
async function applySmartToDay(){
  if(!smartWorkout||!currentUser)return;
  const date=prompt('Add this workout to date (YYYY-MM-DD):',selectedDateKey||todayKey());
  if(date===null)return;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){
    alert('Fecha inválida. Usa el formato YYYY-MM-DD.');
    return;
  }
  try{
    selectedDateKey=date;
    currentDay=smartDayData();
    await saveDay();
    monthCursor=new Date(Number(date.slice(0,4)),Number(date.slice(5,7))-1,1);
    await openDay(date);
    document.querySelector('#smart-result-modal')?.classList.remove('show');
    document.querySelector('#smart-review-modal')?.classList.remove('show');
    setStatus('Workout added to '+date);
  }catch(e){
    console.error('[OCR] applySmartToDay error:', e);
    setStatus('Error saving workout');
    alert('Could not save workout: '+e.message);
  }
}
async function smartCreateAndApply(){try{if(!smartWorkout||!currentUser)return;await createSmartTemplateSilently();await applySmartToDay()}catch(err){alert(err.message||'Could not create the smart template.')}}
function smartSearch(q){q=String(q||'').trim().toLowerCase();const rows=allWorkoutRows();if(!q)return rows.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30);return rows.filter(r=>{const d=r.data||{},ex=(d.exercises||[]).flatMap(e=>[e.name,exerciseSetText(e)]);const hay=[r.date,d.focus,d.trainingCategory,d.notes,d.status,...ex].join(' ').toLowerCase();if(q==='completed')return String(d.status||'').toLowerCase()==='completed';if(q==='lower body')return /leg|lower|squat|deadlift|hamstring|quad|glute|lunge|adductor/i.test(hay);return hay.includes(q)})}
function renderSearchResults(){const el=$('#smart-search-results');if(!el)return;const q=$('#smart-search-input')?.value||'';const rows=smartSearch(q);el.innerHTML=rows.length?`<div class="search-result-count">${rows.length} result${rows.length===1?'':'s'}</div>`+rows.slice(0,40).map(r=>{const d=r.data||{};const names=(d.exercises||[]).map(e=>e.name).filter(Boolean).slice(0,4).join(' · ');return `<div class="search-result" data-search-date="${r.date}"><div><div class="search-result-title">${esc(d.focus||d.trainingCategory||'Workout')}</div><div class="search-result-meta">${esc(r.date)}${names?' · '+esc(names):''}</div></div><div class="search-result-status">${esc(d.status||'planned')}</div></div>`}).join(''):'<div class="empty-state">No workouts match your search.</div>'}
function openRecurring(){const d=selectedDateKey||todayKey();$('#recurring-start').value=d;const end=new Date(d+'T12:00:00');end.setDate(end.getDate()+27);$('#recurring-end').value=dateKey(end.getFullYear(),end.getMonth(),end.getDate());$('#recurring-source').textContent=currentDay?.focus||currentDay?.trainingCategory||'Current workout';$('#recurring-source-date').textContent=d;$$('[data-rec-day]').forEach(x=>x.checked=true);$('#recurring-modal').classList.add('show')}
async function applyRecurring(){const start=$('#recurring-start').value,end=$('#recurring-end').value,step=Number($('#recurring-frequency').value)||1,days=$$('[data-rec-day]').filter(x=>x.checked).map(x=>Number(x.dataset.recDay));if(!start||!end||start>end||!currentDay)return;const source=clone(currentDay);for(let dt=new Date(start+'T12:00:00');dateKey(dt.getFullYear(),dt.getMonth(),dt.getDate())<=end;dt.setDate(dt.getDate()+1)){const dow=(dt.getDay()+6)%7,weeks=Math.floor((dt-new Date(start+'T12:00:00'))/(7*86400000));if(days.includes(dow)&&weeks%step===0){const k=dateKey(dt.getFullYear(),dt.getMonth(),dt.getDate());selectedDateKey=k;currentDay=clone(source);await saveDay()}}$('#recurring-modal').classList.remove('show');await renderMonth();setStatus('Recurring workouts created')}
/* Phase 5 domain bridges: Workout Editor / Block Library */
function getBlockLibrary(){return window.TrainMeiWorkoutEditor?.getBlockLibrary?.()||[]}
function saveBlockLibraryData(arr){return window.TrainMeiWorkoutEditor?.saveBlockLibraryData?.(arr)}
function normalizeTags(value){return window.TrainMeiWorkoutEditor?.normalizeTags?.(value)||[]}
function deriveBlockTags(block){return window.TrainMeiWorkoutEditor?.deriveBlockTags?.(block)||[]}
function getBlockTags(block){return window.TrainMeiWorkoutEditor?.getBlockTags?.(block)||[]}
function renderBlockTagFilters(){return window.TrainMeiWorkoutEditor?.renderBlockTagFilters?.()}
function saveBlockLibrary(block,name,tags){return window.TrainMeiWorkoutEditor?.saveBlockLibrary?.(block,name,tags)}
function saveBlockFromSession(i){return window.TrainMeiWorkoutEditor?.saveBlockFromSession?.(i)}
function renderBlockLibrary(){return window.TrainMeiWorkoutEditor?.renderBlockLibrary?.()}
function insertLibraryBlock(id){return window.TrainMeiWorkoutEditor?.insertLibraryBlock?.(id)}
function deleteLibraryBlock(id){return window.TrainMeiWorkoutEditor?.deleteLibraryBlock?.(id)}
function pasteBlock(){return window.TrainMeiWorkoutEditor?.pasteBlock?.()}
function copyBlockToClipboard(i){return window.TrainMeiWorkoutEditor?.copyBlockToClipboard?.(i)}
function blankExercise(){return window.TrainMeiWorkoutEditor?.blankExercise?.()||{name:'',setGroups:[{sets:'',reps:'',weight:'',type:'Aprox'}],sets:'',reps:'',weight:''}}
function addBlock(){return window.TrainMeiWorkoutEditor?.addBlock?.()}
function addBlockExercise(i){return window.TrainMeiWorkoutEditor?.addBlockExercise?.(i)}
function addSetGroup(bi,ei){return window.TrainMeiWorkoutEditor?.addSetGroup?.(bi,ei)}
function duplicateBlock(i){return window.TrainMeiWorkoutEditor?.duplicateBlock?.(i)}
function addQuickSet(i){return window.TrainMeiWorkoutEditor?.addQuickSet?.(i)}
function removeSetGroup(bi,ei,gi){return window.TrainMeiWorkoutEditor?.removeSetGroup?.(bi,ei,gi)}
function moveExerciseDrag(fb,fe,tb,te){return window.TrainMeiWorkoutEditor?.moveExerciseDrag?.(fb,fe,tb,te)}

async function loadTemplates(){if(window.TrainMeiTemplates){templatesCache=await window.TrainMeiTemplates.load();return templatesCache}return templatesCache}
function renderTemplates(){return window.TrainMeiTemplates?.render?.()}
async function saveCurrentAsTemplate(){return window.TrainMeiTemplates?.saveCurrent?.()}
async function createTemplateEditor(){return window.TrainMeiTemplates?.createEditor?.()}
async function editTemplate(id){return window.TrainMeiTemplates?.edit?.(id)}
async function saveTemplateFromEditor(){return window.TrainMeiTemplates?.saveEditor?.()}
async function useTemplate(id){return window.TrainMeiTemplates?.use?.(id)}
async function deleteTemplate(id){return window.TrainMeiTemplates?.remove?.(id)}
/* Phase 5 domain bridges: Planning */
function planMondayKey(){return window.TrainMeiPlanning?.planMondayKey?.()||''}
function planWeekDates(k){return window.TrainMeiPlanning?.planWeekDates?.(k)||[]}
function weekData(k){return window.TrainMeiPlanning?.weekData?.(k)}
function planDayInfo(k){return window.TrainMeiPlanning?.planDayInfo?.(k)}
function planWeekLabel(k){return window.TrainMeiPlanning?.planWeekLabel?.(k)||''}
function renderPlan(){return window.TrainMeiPlanning?.renderPlan?.()}
function renderPlanBlocks(){return window.TrainMeiPlanning?.renderPlanBlocks?.()}
function renderWeekTemplates(){return window.TrainMeiPlanning?.renderWeekTemplates?.()}
function renderSeasonBlocks(){return window.TrainMeiPlanning?.renderSeasonBlocks?.()}
function saveWeekTemplate(){return window.TrainMeiPlanning?.saveWeekTemplate?.()}
function applyWeekTemplate(i){return window.TrainMeiPlanning?.applyWeekTemplate?.(i)}
function applyPlanTemplate(k){return window.TrainMeiPlanning?.applyPlanTemplate?.(k)}
function movePlanWeek(){return window.TrainMeiPlanning?.movePlanWeek?.()}
function clearPlannedWeek(){return window.TrainMeiPlanning?.clearPlannedWeek?.()}
function duplicatePlanWeek(){return window.TrainMeiPlanning?.duplicatePlanWeek?.()}
function addSeasonBlock(){return window.TrainMeiPlanning?.addSeasonBlock?.()}
function addPlanBlock(){return window.TrainMeiPlanning?.addPlanBlock?.()}
function setPlanWeekFrom(d){return window.TrainMeiPlanning?.setPlanWeekFrom?.(d)}
function openPlanDay(k){return window.TrainMeiPlanning?.openPlanDay?.(k)}
function getWeekNumber(d){return window.TrainMeiPlanning?.getWeekNumber?.(d)||0}

async function savePlanCloud(){localStorage.setItem(PREFIX+'plan',JSON.stringify(planData));if(!currentUser){setStatus('Plan saved locally');return}const {error}=await supabaseClient.from('training_plans').upsert({user_id:currentUser.id,data:planData,updated_at:new Date().toISOString()},{onConflict:'user_id'});setStatus(error?'Plan saved locally — cloud table missing or unavailable':'Plan saved')}
async function loadPlanCloud(){planData=normalizePlan(JSON.parse(localStorage.getItem(PREFIX+'plan')||'null'));if(currentUser){const {data,error}=await supabaseClient.from('training_plans').select('data').eq('user_id',currentUser.id).maybeSingle();if(!error&&data?.data)planData=normalizePlan(data.data)}renderPlan()}
function showAuth(msg=''){if(msg)$('#auth-msg').textContent=msg;$('#auth-overlay').style.display='flex'}
let appStartPromise=null;
async function startApp(){if(!window.__tpModulesReady)return; if(appStartPromise)return appStartPromise;appStartPromise=(async()=>{const {data}=await supabaseClient.auth.getSession();currentUser=data.session?.user||null;if(!currentUser){showAuth();return}$('#auth-overlay').style.display='none';await Promise.all([loadTemplates(),loadPlanCloud(),renderMonth()]);showPage('home-page')})();try{return await appStartPromise}finally{appStartPromise=null}}
$('#login-btn').onclick=async()=>{const {error}=await supabaseClient.auth.signInWithPassword({email:$('#auth-email').value.trim(),password:$('#auth-password').value});if(error)showAuth(error.message);else startApp()};$('#signup-btn').onclick=async()=>{const {error}=await supabaseClient.auth.signUp({email:$('#auth-email').value.trim(),password:$('#auth-password').value});if(error)showAuth(error.message);else showAuth('Account created. Check your email if confirmation is enabled.');};$('#logout-btn').onclick=()=>supabaseClient.auth.signOut();supabaseClient.auth.onAuthStateChange(()=>startApp());
document.addEventListener('click',e=>{const b=e.target.closest('[data-home-page]');if(b){const id=b.dataset.homePage;if(id==='templates-modal'){loadTemplates().then(()=>$('#templates-modal').classList.add('show'));}else showPage(id);return}const d=e.target.closest('[data-home-open-day]');if(d){openDay(d.dataset.homeOpenDay);return}const a=e.target.closest('[data-home-action]');if(!a)return;const act=a.dataset.homeAction;if(act==='open-today')openDay(todayKey());else if(act==='quick-add')openDay(todayKey());else if(act==='scan')showPage('integrations-page');else if(act==='templates'){loadTemplates().then(()=>$('#templates-modal').classList.add('show'));}else if(act==='open-next'){const d=new Date();d.setDate(d.getDate()+1);openDay(dateKey(d.getFullYear(),d.getMonth(),d.getDate()))}});
$('#main-nav').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b)showPage(b.dataset.page)});$('#prev-month').onclick=()=>{monthCursor.setMonth(monthCursor.getMonth()-1);renderMonth()};$('#next-month').onclick=()=>{monthCursor.setMonth(monthCursor.getMonth()+1);renderMonth()};$('#today-btn').onclick=()=>{const d=new Date();monthCursor=new Date(d.getFullYear(),d.getMonth(),1);openDay(todayKey())};$('#back-btn').onclick=()=>{if(templateEditorMode){templateEditorMode=false;templateEditorId=null;clearTimeout(saveTimer);loadTemplates().then(()=>{$('#templates-modal').classList.add('show')});return}renderMonth()};$('#prev-day').onclick=()=>navigateDay(-1);$('#next-day').onclick=()=>navigateDay(1);function navigateDay(delta){const [y,m,d]=selectedDateKey.split('-').map(Number),dt=new Date(y,m-1,d+delta);openDay(dateKey(dt.getFullYear(),dt.getMonth(),dt.getDate()))}
$('#day-page').addEventListener('input',e=>{if(!currentDay)return;const t=e.target;if(t.dataset.field)currentDay[t.dataset.field]=t.value;else if(t.dataset.blockKey!==undefined){activeBlockIndex=+t.dataset.blockIndex;currentDay.blocks[+t.dataset.blockIndex][t.dataset.blockKey]=t.value}else if(t.dataset.setKey!==undefined){const bi=+t.dataset.parentBlock,ei=+t.dataset.exIndex,gi=+t.dataset.setIndex;activeBlockIndex=bi;const ex=currentDay.blocks[bi].exercises[ei];if(!Array.isArray(ex.setGroups))ex.setGroups=[normalizeSetGroup(ex)];ex.setGroups[gi][t.dataset.setKey]=t.value;syncExerciseLegacyFields(ex)}else if(t.dataset.parentBlock!==undefined){activeBlockIndex=+t.dataset.parentBlock;if(t.dataset.exKey==='name'){t.value=t.value.toUpperCase()}currentDay.blocks[+t.dataset.parentBlock].exercises[+t.dataset.exIndex][t.dataset.exKey]=t.value}else if(t.dataset.conditioningPhase!==undefined){currentDay.runningRowing[t.dataset.conditioningPhase][t.dataset.conditioningKey]=t.value}else if(t.dataset.conditioningKey!==undefined){const i=+t.dataset.conditioningIndex;currentDay.runningRowing.blocks[i][t.dataset.conditioningKey]=t.value}else if(t.dataset.metric)currentDay.metrics[t.dataset.metric]=t.value;else if(t.dataset.caffeineMg!==undefined)currentDay.caffeine.mg=t.value;else if(t.dataset.carbohydratesG!==undefined)currentDay.carbohydratesGrams=t.value;scheduleSave()});$('#day-page').addEventListener('change',e=>{const t=e.target;if(t.id==='conditioning-type'){currentDay.runningRowing.type=t.value;renderConditioningBlocks();scheduleSave()}});$('#add-conditioning-block').onclick=addConditioningBlock;$('#conditioning-blocks').addEventListener('click',e=>{
  const collapse=e.target.closest('[data-conditioning-collapse]');
  if(collapse){
    window._collapsedConditioningBlocks=window._collapsedConditioningBlocks||{};
    const i=+collapse.dataset.conditioningCollapse;
    const block=currentDay.runningRowing?.blocks?.[i];
    if(!block)return;
    const key=String(block.id||i);
    window._collapsedConditioningBlocks[key]=!window._collapsedConditioningBlocks[key];
    renderConditioningBlocks();
    return;
  }
  const remove=e.target.closest('[data-conditioning-remove]');
  if(!remove)return;
  const i=+remove.dataset.conditioningRemove;
  pushUndo('Conditioning block eliminado');
  currentDay.runningRowing.blocks.splice(i,1);
  renderConditioningBlocks();
  scheduleSave();
});
$('#caffeine-toggle').onchange=()=>{currentDay.caffeine.taken=$('#caffeine-toggle').checked;scheduleSave()};$('#day-page').addEventListener('click',e=>{const b=e.target.closest('[data-recovery-key]');if(b&&currentDay){const key=b.dataset.recoveryKey;currentDay.recovery=currentDay.recovery||{sleep:0,energy:0,soreness:0};currentDay.recovery[key]=Number(b.dataset.recoveryValue)||0;renderRecoveryInputs();if(typeof renderDayContext==='function')renderDayContext();scheduleSave()}const dc=e.target.closest('[data-day-color]');if(dc&&currentDay){currentDay.color=dc.dataset.dayColor||'';$$('[data-day-color]').forEach(x=>x.classList.toggle('active',x===dc));scheduleSave()}});$('#day-page').addEventListener('change',e=>{const t=e.target;if(t.dataset.setKey==='type'){const bi=+t.dataset.parentBlock,ei=+t.dataset.exIndex,gi=+t.dataset.setIndex;activeBlockIndex=bi;const ex=currentDay.blocks[bi].exercises[ei];if(!Array.isArray(ex.setGroups))ex.setGroups=[normalizeSetGroup(ex)];ex.setGroups[gi].type=t.value;syncExerciseLegacyFields(ex);scheduleSave()}});;function openBlockLibrary(i=null){if(i!==null)activeBlockIndex=i;else if(!Number.isInteger(activeBlockIndex)||!currentDay?.blocks?.[activeBlockIndex])activeBlockIndex=0;const block=currentDay?.blocks?.[activeBlockIndex];if(block){setVal('#block-name-input',block.name||'');setVal('#block-tags-input',getBlockTags(block).join(', '))}$('#block-library-modal').classList.add('show');renderBlockLibrary()}
$('#day-page').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.exCollapse!==undefined){window._collapsedTrainingExercises=window._collapsedTrainingExercises||{};const bi=+b.dataset.exCollapse,ei=+b.dataset.exIndex,block=currentDay.blocks[bi];if(block){const key=block.id+':'+ei;window._collapsedTrainingExercises[key]=!window._collapsedTrainingExercises[key];renderTrainingBlocks()}return;}if(b.id==='conditioning-collapse'){const section=document.querySelector('.conditioning-section');if(section){section.classList.toggle('is-collapsed');b.textContent=section.classList.contains('is-collapsed')?'⌄':'⌃';b.setAttribute('aria-label',section.classList.contains('is-collapsed')?'Expand conditioning':'Collapse conditioning')}return;}if(b.dataset.action==='add-block-ex')addBlockExercise(+b.dataset.block);if(b.dataset.action==='add-set-group')addSetGroup(+b.dataset.block,+b.dataset.index);if(b.dataset.action==='remove-set-group'){const bi=+b.dataset.block,ei=+b.dataset.index,gi=+b.dataset.set;if(currentDay.blocks?.[bi]?.exercises?.[ei]?.setGroups?.length>1)pushUndo('Set eliminado');removeSetGroup(bi,ei,gi)}if(b.dataset.action==='remove-block-ex'){const bi=+b.dataset.block,ei=+b.dataset.index;if(currentDay.blocks?.[bi]?.exercises?.[ei]){pushUndo('Ejercicio eliminado');activeBlockIndex=bi;currentDay.blocks[bi].exercises.splice(ei,1);if(!currentDay.blocks[bi].exercises.length)currentDay.blocks[bi].exercises.push(blankExercise());renderDay();scheduleSave()}}if(b.dataset.blockRemove!==undefined&&currentDay.blocks.length>1){const bi=+b.dataset.blockRemove;pushUndo('Bloque de entrenamiento eliminado');currentDay.blocks.splice(bi,1);activeBlockIndex=Math.max(0,Math.min(activeBlockIndex,currentDay.blocks.length-1));renderDay();scheduleSave()}if(b.dataset.blockCopy!==undefined)copyBlockToClipboard(+b.dataset.blockCopy);if(b.dataset.blockSave!==undefined){saveBlockFromSession(+b.dataset.blockSave)}if(b.dataset.blockQuick!==undefined){const blockEl=b.closest('.training-block');if(blockEl)blockEl.classList.toggle('quick-open');}if(b.dataset.blockQuickAddSet!==undefined){addQuickSet(+b.dataset.blockQuickAddSet)}if(b.dataset.blockQuickAddEx!==undefined){addBlockExercise(+b.dataset.blockQuickAddEx)}if(b.dataset.blockQuickDuplicate!==undefined){duplicateBlock(+b.dataset.blockQuickDuplicate)}if(b.dataset.blockQuickCollapse!==undefined){window._collapsedTrainingBlocks=window._collapsedTrainingBlocks||{};const bi=+b.dataset.blockQuickCollapse,block=currentDay.blocks[bi];if(block){window._collapsedTrainingBlocks[block.id]=true;renderTrainingBlocks()}}if(b.dataset.blockCollapse!==undefined){window._collapsedTrainingBlocks=window._collapsedTrainingBlocks||{};const bi=+b.dataset.blockCollapse,block=currentDay.blocks[bi];if(block){window._collapsedTrainingBlocks[block.id]=!window._collapsedTrainingBlocks[block.id];renderTrainingBlocks()}}if(b.dataset.noteTag){const t=b.dataset.noteTag;currentDay.noteTags=currentDay.noteTags.includes(t)?currentDay.noteTags.filter(x=>x!==t):[...currentDay.noteTags,t];renderDay();scheduleSave()}});$('#clear-day').onclick=clearCurrentDay;$('#add-block-inline').onclick=addBlock;$('#close-block-library').onclick=()=>$('#block-library-modal').classList.remove('show');$('#save-block-btn').onclick=()=>saveBlockFromSession(activeBlockIndex);$('#paste-block-btn').onclick=pasteBlock;$('#block-library-search').oninput=renderBlockLibrary;$('#block-tags-input').oninput=()=>{};$('#block-tag-filters').addEventListener('click',e=>{const b=e.target.closest('[data-block-tag-filter]');if(!b)return;window._trainingPlannerBlockTag=b.dataset.blockTagFilter||'';renderBlockLibrary()});$('#block-library-list').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const b=e.target.closest('button');if(!b||!b.closest('#block-library-list'))return;if(b.dataset.blockInsert!==undefined){insertLibraryBlock(String(b.dataset.blockInsert));return}if(b.dataset.blockDelete!==undefined){deleteLibraryBlock(String(b.dataset.blockDelete));return}});let dragExercise=null,dragBlock=null;$('#training-blocks').addEventListener('dragstart',e=>{const r=e.target.closest('.exercise-row'),b=e.target.closest('.training-block');if(r)dragExercise={b:+r.dataset.blockIndex,e:+r.dataset.exIndex};else if(b)dragBlock=+b.dataset.blockIndex});$('#training-blocks').addEventListener('dragover',e=>{if(e.target.closest('.training-block'))e.preventDefault()});$('#training-blocks').addEventListener('drop',e=>{e.preventDefault();const r=e.target.closest('.exercise-row'),b=e.target.closest('.training-block');if(dragExercise&&r)moveExerciseDrag(dragExercise.b,dragExercise.e,+r.dataset.blockIndex,+r.dataset.exIndex);else if(dragExercise&&b)moveExerciseDrag(dragExercise.b,dragExercise.e,+b.dataset.blockIndex,currentDay.blocks[+b.dataset.blockIndex].exercises.length);else if(dragBlock!==null&&b&&dragBlock!==+b.dataset.blockIndex){const x=currentDay.blocks.splice(dragBlock,1)[0];let t=+b.dataset.blockIndex;if(dragBlock<t)t--;currentDay.blocks.splice(t,0,x);activeBlockIndex=t;renderDay();scheduleSave()}dragExercise=null;dragBlock=null});
$('#sync-btn').onclick=syncLocal;$('#export-btn').onclick=exportData;$('#import-btn').onclick=()=>$('#import-file').click();$('#import-file').onchange=e=>{importData(e.target.files[0]);e.target.value=''};
$('#templates-btn').onclick=async()=>{$('#templates-modal').classList.add('show');await loadTemplates()};$('#template-search').oninput=renderTemplates;$('#close-templates').onclick=()=>$('#templates-modal').classList.remove('show');$('#create-template-btn').onclick=createTemplateEditor;$('#save-template-btn').onclick=saveCurrentAsTemplate;$('#save-template-from-editor').onclick=saveTemplateFromEditor;$('#apply-template-date-btn').onclick=()=>{selectedDateKey=$('#template-date').value||selectedDateKey};$('#template-list').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.templateUse)useTemplate(b.dataset.templateUse);if(b.dataset.templateEdit)editTemplate(b.dataset.templateEdit);if(b.dataset.templateDelete)deleteTemplate(b.dataset.templateDelete)});
function TPPlanWeek(){return window.__tp?.planWeekKey||''} function TPPlanSetWeek(v){if(window.__tp)window.__tp.planWeekKey=v} function TPPlanData(){return window.__tp?.planData||{blocks:[],weekTemplates:[]}}
$('#save-plan-btn').onclick=savePlanCloud;$('#plan-prev-week').onclick=()=>setPlanWeekFrom(-1);$('#plan-next-week').onclick=()=>setPlanWeekFrom(1);$('#plan-this-week').onclick=()=>{TPPlanSetWeek(planMondayKey());renderPlan()};$('#plan-duplicate-week').onclick=duplicatePlanWeek;$('#plan-move-week').onclick=movePlanWeek;$('#plan-clear-week').onclick=clearPlannedWeek;$('#add-plan-block').onclick=addPlanBlock;$('#add-season-block').onclick=addSeasonBlock;$('#add-week-template').onclick=saveWeekTemplate;$('#plan-week-focus').addEventListener('input',e=>{weekData(TPPlanWeek()).focus=e.target.value;clearTimeout(window._planSaveTimer);window._planSaveTimer=setTimeout(savePlanCloud,500)});$('#plan-week-notes').addEventListener('input',e=>{weekData(TPPlanWeek()).notes=e.target.value;clearTimeout(window._planSaveTimer);window._planSaveTimer=setTimeout(savePlanCloud,500)});$('#plan-page').addEventListener('change',async e=>{const t=e.target;if(t.dataset.planDayTemplate){planDayInfo(t.dataset.planDayTemplate).templateId=t.value;renderPlan()}if(t.dataset.planDayStatus){planDayInfo(t.dataset.planDayStatus).status=t.value;savePlanCloud()}if(t.dataset.planDayTitle){planDayInfo(t.dataset.planDayTitle).title=t.value;clearTimeout(window._planSaveTimer);window._planSaveTimer=setTimeout(savePlanCloud,400)}if(t.dataset.planBlockIndex!==undefined){TPPlanData().blocks[+t.dataset.planBlockIndex][t.dataset.field]=t.value;renderPlan()}if(t.dataset.seasonIndex!==undefined){TPPlanData().blocks[+t.dataset.seasonIndex][t.dataset.seasonField]=t.value;renderSeasonBlocks()}});$('#plan-page').addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.planOpenDay){openPlanDay(b.dataset.planOpenDay);return}if(b.dataset.planApplyTemplate){await applyPlanTemplate(b.dataset.planApplyTemplate);return}if(b.dataset.planBlockRemove!==undefined){TPPlanData().blocks.splice(+b.dataset.planBlockRemove,1);renderPlan();return}if(b.dataset.seasonRemove!==undefined){TPPlanData().blocks.splice(+b.dataset.seasonRemove,1);renderPlan();return}if(b.dataset.weekTemplateApply!==undefined){applyWeekTemplate(+b.dataset.weekTemplateApply);return}if(b.dataset.weekTemplateDelete!==undefined){TPPlanData().weekTemplates.splice(+b.dataset.weekTemplateDelete,1);renderPlan();savePlanCloud();return}});
$('#smart-select-btn').onclick=()=>$('#smart-screenshot-file').click();$('#close-smart-result').onclick=()=>$('#smart-result-modal').classList.remove('show');$('#smart-apply-date-btn').onclick=applySmartToDay;$('#smart-keep-btn').onclick=()=>$('#smart-result-modal').classList.remove('show');
/* Bridge selected first-layer actions to Smart Training navigation */
window.__trainingPlannerOpenBlockLibrary = (i=null) => openBlockLibrary(i);
window.__trainingPlannerSaveCurrentBlock = (i=null) => saveBlockFromSession(i);
window.__tpApplySmartToDay = applySmartToDay;
window.__tpCreateSmartTemplate = createSmartTemplate;
/* Expose training-planner internals for the OCR IIFE (separate scope). */
window.__tp = {
  get currentUser(){ return currentUser; },
  get currentDay(){ return currentDay; },
  set currentDay(v){ currentDay=v; },
  get selectedDateKey(){ return selectedDateKey; },
  set selectedDateKey(v){ selectedDateKey=v; },
  get smartWorkout(){ return smartWorkout; },
  set smartWorkout(v){ smartWorkout=v; },
  todayKey, dateKey, openDay, saveDay, normalizeDay, defaultDay, clone,
  monthCursor: () => monthCursor,
  setMonthCursor: (d) => { monthCursor = d; },
  setStatus, loadTemplates, renderTemplates,
  get templatesCache(){ return templatesCache; }, set templatesCache(v){ templatesCache=Array.isArray(v)?v:[]; },
  get templateEditorMode(){ return templateEditorMode; }, set templateEditorMode(v){ templateEditorMode=!!v; },
  get templateEditorId(){ return templateEditorId; }, set templateEditorId(v){ templateEditorId=v; },
  clearSaveTimer:()=>clearTimeout(saveTimer),
  get planData(){ return planData; }, set planData(v){ planData=normalizePlan(v); },
  getAnalyticsRows, allWorkoutRows, totalExerciseSets, totalExerciseReps, exerciseSetText, exerciseSetGroups,
  renderDay, renderMonth, scheduleSave, applyRecurring, showPage,
  get monthIndicators(){ return monthIndicators; }, set monthIndicators(v){ monthIndicators=v||{}; },
  loadDayLocal, loadDay, persistCurrentDayLocal,
  supabaseClient:()=>supabaseClient,
  TrainingDataCore: () => window.TrainingDataCore || null,
  setVal,
  get activeBlockIndex(){ return activeBlockIndex; }, set activeBlockIndex(v){ activeBlockIndex=Number.isInteger(v)?v:0; },
  savePlanCloud: (...args)=>window.TrainMeiPlanning?.savePlanCloud?.(...args),
  get planWeekKey(){ return window.TrainMeiPlanning?.getPlanWeekKey?.()||''; },
  set planWeekKey(v){ window.TrainMeiPlanning?.setPlanWeekKey?.(v); }
};
/* ==========================================================================
   TRAINING PLANNER V5 — WEEK LOAD / RUN STRUCTURE / RECOVERY LOOP
   ========================================================================== */
(function(){
  const V5 = {
    weekPanelId:'tp-week-load-panel',
    recoveryPanelId:'tp-recovery-panel',
    loopPanelId:'tp-session-loop',
    weekOffset:0
  };
  const q=s=>document.querySelector(s);
  const qa=s=>Array.from(document.querySelectorAll(s));
  const num=v=>{const n=parseFloat(v);return Number.isFinite(n)?n:0};
  const escV=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cloneV=o=>JSON.parse(JSON.stringify(o));
  const dayLabel=k=>{const d=new Date(k+'T12:00:00');return d.toLocaleDateString(undefined,{weekday:'short',day:'numeric'});};
  const weekStart=k=>{const d=new Date((k||todayKey())+'T12:00:00');const dow=(d.getDay()+6)%7;d.setDate(d.getDate()-dow);return d;};
  const keyOf=d=>dateKey(d.getFullYear(),d.getMonth(),d.getDate());
  const rows=()=>typeof allWorkoutRows==='function'?allWorkoutRows():[];
  const rowMap=()=>Object.fromEntries(rows().map(r=>[r.date,r.data]));
  const workoutLoad=d=>{
    if(!d)return 0;
    const explicit=num(d.metrics?.load); if(explicit>0)return explicit;
    const sets=(d.blocks||[]).reduce((s,b)=>(b.exercises||[]).reduce((x,e)=>x+totalExerciseSets(e),s),0);
    const reps=(d.blocks||[]).reduce((s,b)=>(b.exercises||[]).reduce((x,e)=>x+totalExerciseReps(e),s),0);
    const mins=num(d.metrics?.timeMin), rpe=num(d.metrics?.rpe);
    const distance=num(d.metrics?.distanceKm);
    return Math.round(sets*1.8+reps*.08+mins*(rpe||5)*.55+distance*1.5);
  };
  const loadLabel=v=>v>0?Math.round(v):'—';
  function ensureCalendarPanels(){
    const main=q('#calendar-page .calendar-main');
    const sidebar=q('#calendar-page .calendar-sidebar');
    if(!main)return;
    if(!q('#'+V5.weekPanelId)){
      const panel=document.createElement('section');
      panel.id=V5.weekPanelId;
      panel.className='tp-v5-panel';
      main.appendChild(panel);
    }
    if(sidebar&&!q('#'+V5.recoveryPanelId)){
      const panel=document.createElement('section');
      panel.id=V5.recoveryPanelId;
      panel.className='tp-v5-panel tp-v5-recovery';
      sidebar.appendChild(panel);
    }
  }
  function renderWeekLoad(){
    ensureCalendarPanels();
    const el=q('#'+V5.weekPanelId); if(!el)return;
    const base=weekStart(todayKey());
    base.setDate(base.getDate()+V5.weekOffset*7);
    const map=rowMap(), days=[];
    for(let i=0;i<7;i++){const d=new Date(base);d.setDate(base.getDate()+i);const k=keyOf(d), data=map[k]||null;days.push({k,data,load:TrainingDataCore.trainingLoad(data)});}
    const max=Math.max(1,...days.map(x=>x.load));
    const total=days.reduce((s,x)=>s+x.load,0);
    const sessions=days.filter(x=>x.data).length;
    const completed=days.filter(x=>x.data?.completed).length;
    const distance=days.reduce((s,x)=>s+num(x.data?.metrics?.distanceKm),0);
    const start=keyOf(base), end=keyOf(new Date(base.getFullYear(),base.getMonth(),base.getDate()+6));
    el.innerHTML=`<div class="tp-v5-head"><div><div class="tp-v5-kicker">Weekly training load</div><strong>${escV(dayLabel(start))} — ${escV(dayLabel(end))}</strong></div><div class="tp-v5-week-nav"><button type="button" class="tp-v5-week-arrow" data-tp-week-prev aria-label="Previous week">‹</button><div class="tp-v5-summary"><span>${sessions} sessions</span><span>${completed} done</span><span>${distance.toFixed(1)} km</span><b>${loadLabel(total)} load</b></div><button type="button" class="tp-v5-week-arrow" data-tp-week-next aria-label="Next week">›</button></div></div>
      <div class="tp-v5-week-grid">${days.map(x=>{
        const title=x.data?.focus||x.data?.trainingCategory||'Rest';
        const pct=Math.round(x.load/max*100);
        const state=x.data?.completed?'done':x.data?'planned':'empty';
        const isToday=x.k===todayKey();
        return `<button type="button" class="tp-v5-day ${state}${isToday?' today':''}" data-tp-open-day="${x.k}">
          <span class="tp-v5-day-top"><b>${escV(dayLabel(x.k).split(' ')[0])}</b><small>${escV(dayLabel(x.k).replace(/^[^ ]+ /,'').toUpperCase())}</small></span>
          <span class="tp-v5-load-track"><i style="height:${Math.max(x.load?8:2,pct)}%"></i></span>
          <strong>${escV(title)}</strong>
          <small>${x.load?loadLabel(x.load)+' load':'Rest / no session'}</small>
        </button>`;
      }).join('')}</div>
      <div class="tp-v5-legend"><span><i class="tp-dot done"></i> completed</span><span><i class="tp-dot planned"></i> planned</span><span><i class="tp-dot empty"></i> no session</span><span class="tp-v5-note">Load uses your saved load; if absent, a lightweight session estimate is used.</span></div>`;
    qa('[data-tp-open-day]').forEach(b=>b.onclick=()=>openDay(b.dataset.tpOpenDay));
    const prev=q('[data-tp-week-prev]');
    const next=q('[data-tp-week-next]');
    if(prev)prev.onclick=()=>{V5.weekOffset-=1;renderWeekLoad()};
    if(next)next.onclick=()=>{V5.weekOffset+=1;renderWeekLoad()};
  }
  function recoveryValues(d){
    const r=d?.recovery||{};
    const sleep=Math.max(0,Math.min(5,num(r.sleep)));
    const energy=Math.max(0,Math.min(5,num(r.energy)));
    const soreness=Math.max(0,Math.min(5,num(r.soreness)));
    return {sleep,energy,soreness,hasData:sleep>0||energy>0||soreness>0,complete:sleep>0&&energy>0&&soreness>0};
  }
  function recoveryScore(d){
    const {sleep,energy,soreness,complete}=recoveryValues(d);
    if(!complete)return null;
    return (sleep+energy+(6-soreness))/3;
  }
  async function renderRecoveryTrend(){
    ensureCalendarPanels();
    const el=q('#'+V5.recoveryPanelId); if(!el)return;
    const all=rows().filter(r=>TrainingDataCore.recovery(r.data).complete).sort((a,b)=>a.date.localeCompare(b.date)).slice(-28);
    const last=all.slice(-14);
    if(!last.length){el.innerHTML=`<div class="tp-v5-head"><div><div class="tp-v5-kicker">Recovery trend</div><strong>No recovery history yet</strong></div></div><p class="tp-v5-empty">Rate Sleep, Energy and Soreness after sessions to build the radial trend.</p>`;return;}
    const vals=last.map(x=>TrainingDataCore.recoveryScore(x.data)).filter(v=>v!==null);
    const avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;
    const latestRow=last[last.length-1];
    const latest=TrainingDataCore.recoveryScore(latestRow.data)||0;
    const latestRecovery=TrainingDataCore.recovery(latestRow.data);
    const sleep=latestRecovery.sleep,energy=latestRecovery.energy,soreness=Math.max(0,6-latestRecovery.soreness);
    const fuel=TrainingDataCore.performanceFuel(latestRow.date,latestRow.data);
    const rings=[{label:'Sleep',value:sleep,radius:62},{label:'Energy',value:energy,radius:48},{label:'Soreness',value:soreness,radius:34}];
    const circumference=r=>2*Math.PI*r;
    const ringSvg=rings.map((x,i)=>{const c=circumference(x.radius),dash=(x.value/5)*c;return `<circle class="recovery-ring recovery-ring-bg" cx="92" cy="92" r="${x.radius}"/><circle class="recovery-ring recovery-ring-value ring-${i}" cx="92" cy="92" r="${x.radius}" stroke-dasharray="${dash.toFixed(2)} ${(c-dash).toFixed(2)}"/>`}).join('');
    let fuelHistory=[];
    try{
      const nh=await TrainingDataCore.nutritionHistory(last[0].date,last[last.length-1].date);
      const byDate=new Map(nh.map(x=>[x.date,x]));
      fuelHistory=last.map(r=>{const n=byDate.get(r.date)||null;return TrainingDataCore.performanceFuel(r.date,r.data,n)}).filter(x=>x.score!=null);
      fuelHistory=fuelHistory.map(x=>({...x,nutrition:byDate.get(x.date)||null}));
    }catch(e){}
    const avgFuel=fuelHistory.length?Math.round(fuelHistory.reduce((s,x)=>s+x.score,0)/fuelHistory.length):null;
    el.innerHTML=`<div class="tp-v5-head recovery-radial-head"><div><div class="tp-v5-kicker">Recovery trend · last ${last.length}</div><strong>Readiness ${latest.toFixed(1)} / 5</strong></div><div class="tp-v5-summary"><span>Average ${avg.toFixed(1)}</span><span>${avgFuel==null?'Fuel data pending':`Fuel ${avgFuel}%`}</span></div></div>
      <div class="recovery-radial-wrap">
        <div class="recovery-radial-chart"><svg viewBox="0 0 184 184" role="img" aria-label="Radial recovery trend">${ringSvg}<text x="92" y="87" text-anchor="middle" class="recovery-radial-score">${latest.toFixed(1)}</text><text x="92" y="103" text-anchor="middle" class="recovery-radial-unit">READINESS</text></svg></div>
        <div class="recovery-radial-legend">${rings.map(x=>`<div><span class="recovery-legend-dot"></span><span>${x.label}</span><strong>${x.value.toFixed(1)}</strong></div>`).join('')}</div>
      </div>
      <div class="recovery-radial-footer"><span>${escV(latestRow.date)}</span><span>${fuel.score==null?'Nutrition will appear after FatSecret sync.':`Performance fuel ${fuel.score}% · ${fuel.status}`}</span></div>`;
  }
  function runKindOptions(v){
    return [['easy','Easy'],['interval','Intervals'],['tempo','Tempo'],['threshold','Threshold'],['hill','Hills'],['long','Long run'],['recovery','Recovery run'],['race','Race / test']].map(x=>`<option value="${x[0]}" ${v===x[0]?'selected':''}>${x[1]}</option>`).join('');
  }
  function renderRunningStructure(){
    if(!currentDay || !q('#conditioning-blocks'))return;
    if((currentDay.runningRowing?.type||'Run')!=='Run'){
      if(typeof renderConditioningBlocks==='function')renderConditioningBlocks();
      return;
    }
    const c=q('#conditioning-blocks');
    const blocks=currentDay.runningRowing.blocks?.length?currentDay.runningRowing.blocks:[{id:'run_'+Date.now(),name:'Main',kind:'interval',reps:'',distance:'',duration:'',pace:'',recovery:'',effort:'',surface:'',details:''}];
    currentDay.runningRowing.blocks=blocks;
    c.innerHTML=blocks.map((b,i)=>`<div class="tp-run-block" data-conditioning-index="${i}">
      <div class="tp-run-block-head"><span class="tp-run-num">${i+1}</span><input data-conditioning-key="name" data-conditioning-index="${i}" value="${escV(b.name||`Block ${i+1}`)}" placeholder="Main block"><select data-conditioning-key="kind" data-conditioning-index="${i}">${runKindOptions(b.kind||'interval')}</select><button type="button" class="rm-btn" data-conditioning-remove="${i}" aria-label="Remove run block">×</button></div>
      <div class="tp-run-grid">
        <label>Reps<input data-conditioning-key="reps" data-conditioning-index="${i}" value="${escV(b.reps)}" placeholder="4"></label>
        <label>Distance<input data-conditioning-key="distance" data-conditioning-index="${i}" value="${escV(b.distance)}" placeholder="800 m"></label>
        <label>Pace / Zone<input data-conditioning-key="pace" data-conditioning-index="${i}" value="${escV(b.pace||b.target)}" placeholder="4:30 / km"></label>
        <label>Recovery<input data-conditioning-key="recovery" data-conditioning-index="${i}" value="${escV(b.recovery)}" placeholder="90 s"></label>
        <label>Effort<input data-conditioning-key="effort" data-conditioning-index="${i}" value="${escV(b.effort)}" placeholder="RPE 7"></label>
        <label>Surface<input data-conditioning-key="surface" data-conditioning-index="${i}" value="${escV(b.surface)}" placeholder="Track / road"></label>
      </div>
      <label class="tp-run-details">Details<textarea data-conditioning-key="details" data-conditioning-index="${i}" placeholder="e.g. 4 × 800 m @ 4:30/km, 90 s easy jog">${escV(b.details)}</textarea></label>
    </div>`).join('');
  }
  function ensureLoopPanel(){
    const host=q('#day-page .notes-under-caffeine'); if(!host)return;
    let el=q('#'+V5.loopPanelId);
    if(!el){el=document.createElement('section');el.id=V5.loopPanelId;el.className='tp-loop-panel';host.after(el);}
    return el;
  }
  function findPreviousFeedback(){
    if(!selectedDateKey||!currentDay)return null;
    const title=String(currentDay.focus||'').trim().toLowerCase();
    if(!title)return null;
    const prior=rows().filter(r=>r.date<selectedDateKey && String(r.data?.focus||'').trim().toLowerCase()===title)
      .sort((a,b)=>b.date.localeCompare(a.date));
    const p=prior.find(r=>r.data?.sessionFeedback?.adjustNextTime||r.data?.sessionFeedback?.feelings);
    return p?{date:p.date,...p.data.sessionFeedback}:null;
  }
  function sessionNumber(){
    if(!selectedDateKey)return 1;
    return rows().filter(r=>r.date<=selectedDateKey && (r.data?.blocks||[]).some(b=>(b.exercises||[]).some(e=>String(e.name||'').trim())||r.data?.completed)).length||1;
  }
  function renderLoopPanel(){
    const el=ensureLoopPanel(); if(!el||!currentDay)return;
    const sf=currentDay.sessionFeedback||{feelings:'',adjustNextTime:'',nextFocus:'',tags:[],performance:'',energyRating:'',technique:'',pain:'',adjustmentOutcome:''};
    const prev=currentDay.previousFeedback||findPreviousFeedback();
    if(prev && !currentDay.previousFeedback){currentDay.previousFeedback=cloneV(prev);}
    el.innerHTML=`<div class="tp-loop-head"><div><div class="tp-v5-kicker">Session Journal</div><strong>SESSION ${sessionNumber()}</strong></div><span class="tp-loop-badge">${prev?'Previous feedback available':'Build feedback history'}</span></div>
      <div class="tp-journal-grid">
        <label>Performance<input type="number" min="0" max="10" data-feedback-key="performance" value="${escV(sf.performance)}" placeholder="0-10"></label>
        <label>Energy<input type="number" min="0" max="10" data-feedback-key="energyRating" value="${escV(sf.energyRating)}" placeholder="0-10"></label>
        <label>Technique<input type="number" min="0" max="10" data-feedback-key="technique" value="${escV(sf.technique)}" placeholder="0-10"></label>
        <label>Pain / discomfort<input data-feedback-key="pain" value="${escV(sf.pain)}" placeholder="None"></label>
        <label>Previous adjustment result<select data-feedback-key="adjustmentOutcome"><option value="" ${!sf.adjustmentOutcome?'selected':''}>Not rated</option><option value="worked" ${sf.adjustmentOutcome==='worked'?'selected':''}>Worked</option><option value="partial" ${sf.adjustmentOutcome==='partial'?'selected':''}>Partly worked</option><option value="did_not_work" ${sf.adjustmentOutcome==='did_not_work'?'selected':''}>Did not work</option></select></label>
      </div>
      ${prev?`<div class="tp-previous-feedback"><div><b>Previous session · ${escV(prev.date)}</b><span>What you wanted to carry forward</span></div><p>${escV(prev.adjustNextTime||'No adjustment recorded.')}</p>${prev.nextFocus?`<small>Next focus: ${escV(prev.nextFocus)}</small>`:''}</div>`:''}
      <div class="tp-loop-grid">
        <label>Feelings<textarea data-feedback-key="feelings" placeholder="How did the session actually feel?">${escV(sf.feelings)}</textarea></label>
        <label>Ajustar la próxima vez<textarea data-feedback-key="adjustNextTime" placeholder="What should change next time?">${escV(sf.adjustNextTime)}</textarea></label>
        <label>Next focus<input data-feedback-key="nextFocus" value="${escV(sf.nextFocus)}" placeholder="e.g. Keep pace controlled"></label>
      </div>
      <div class="tp-loop-tags">${['Keep','Increase','Reduce','Technique','Pacing','Recovery'].map(t=>`<button type="button" class="tp-loop-tag ${sf.tags?.includes(t)?'active':''}" data-feedback-tag="${t}">${t}</button>`).join('')}</div>`;
  }
  function attachHandlers(){
    const day=q('#day-page');
    if(day&&!day.dataset.v5Bound){
      day.dataset.v5Bound='1';
      day.addEventListener('input',e=>{
        const t=e.target;
        if(!currentDay)return;
        if(t.dataset.feedbackKey){
          currentDay.sessionFeedback=currentDay.sessionFeedback||{feelings:'',adjustNextTime:'',nextFocus:'',tags:[]};
          currentDay.sessionFeedback[t.dataset.feedbackKey]=t.value;
          scheduleSave();
        }
        if(t.dataset.conditioningKey && currentDay.runningRowing?.blocks?.[+t.dataset.conditioningIndex]){
          const b=currentDay.runningRowing.blocks[+t.dataset.conditioningIndex];
          b[t.dataset.conditioningKey]=t.value;
          if(t.dataset.conditioningKey==='pace')b.target=t.value;
          scheduleSave();
        }
      });
      day.addEventListener('change',e=>{
        const t=e.target;
        if(!currentDay)return;
        if(t.dataset.feedbackKey){
          currentDay.sessionFeedback=currentDay.sessionFeedback||{feelings:'',adjustNextTime:'',nextFocus:'',tags:[]};
          currentDay.sessionFeedback[t.dataset.feedbackKey]=t.value;scheduleSave();
        }
        if(t.dataset.conditioningKey && currentDay.runningRowing?.blocks?.[+t.dataset.conditioningIndex]){
          currentDay.runningRowing.blocks[+t.dataset.conditioningIndex][t.dataset.conditioningKey]=t.value;scheduleSave();
        }
      });
      day.addEventListener('click',e=>{
        const tag=e.target.closest('[data-feedback-tag]');
        if(tag&&currentDay){
          currentDay.sessionFeedback=currentDay.sessionFeedback||{feelings:'',adjustNextTime:'',nextFocus:'',tags:[]};
          const a=currentDay.sessionFeedback.tags||[],v=tag.dataset.feedbackTag;
          currentDay.sessionFeedback.tags=a.includes(v)?a.filter(x=>x!==v):[...a,v];
          renderLoopPanel();scheduleSave();
        }
      });
    }
  }
  document.addEventListener('trainmei:day-rendered',()=>{
    attachHandlers();
    renderRunningStructure();
    renderLoopPanel();
    if(typeof renderDayContext==='function')renderDayContext();
  });
  document.addEventListener('trainmei:month-rendered',()=>{
    ensureCalendarPanels();
    renderWeekLoad();
    renderRecoveryTrend();
  });
  async function recordSessionLearning(){
    if(!currentDay||!selectedDateKey||!window.TrainingDataCore)return;
    const sf=currentDay.sessionFeedback||{},cycleSnapshot=window.tpCycleSnapshot?window.tpCycleSnapshot():null;
    const cycleContext=cycleSnapshot?{
      phase:cycleSnapshot.phase||null,
      cycleDay:cycleSnapshot.cycleDay||null,
      energy:Number(cycleSnapshot.energy)||null,
      pain:Number(cycleSnapshot.pain)||null,
      mood:Number(cycleSnapshot.mood)||null,
      symptoms:cycleSnapshot.symptoms||null,
      bleeding:cycleSnapshot.bleeding||null,
      observed:cycleSnapshot.observed||false
    }:{};
    const payload={date:selectedDateKey,completed:!!currentDay.completed,rpe:Number(currentDay.metrics?.rpe)||0,load:Number(currentDay.metrics?.load)||0,distance:Number(currentDay.metrics?.distanceKm)||0,duration:Number(currentDay.metrics?.timeMin)||0,recovery:cloneV(currentDay.recovery||{}),performance:Number(sf.performance)||null,energy:Number(sf.energyRating)||null,technique:Number(sf.technique)||null,adjustNextTime:sf.adjustNextTime||'',adjustmentOutcome:sf.adjustmentOutcome||'',feelings:sf.feelings||'',cyclePhase:cycleContext.phase||null,cycleContext,trainingCategory:currentDay.trainingCategory||'',focus:currentDay.focus||''};
    try{payload.sessionContext=await window.TrainingDataCore.sessionContext(selectedDateKey,currentDay);payload.fuelScore=payload.sessionContext?.fuel?.score??null;payload.fuelStatus=payload.sessionContext?.fuel?.status??null;payload.preWorkoutCarbs=payload.sessionContext?.fuel?.preWorkoutCarbs??null;payload.remainingKcal=payload.sessionContext?.budget?.remaining?.kcal??null;payload.remainingCarbs=payload.sessionContext?.budget?.remaining?.carb??null;payload.remainingProtein=payload.sessionContext?.budget?.remaining?.prot??null;payload.sessionStartKnown=!!payload.sessionContext?.timing?.sessionStartKnown;payload.preSessionMeals=payload.sessionContext?.timing?.preSessionMeals?.length??0}catch{}
    const signature=JSON.stringify(payload);let previous='';try{previous=localStorage.getItem('training-planner:brain:session-signature:'+selectedDateKey)||''}catch{}
    if(previous===signature)return;
    try{localStorage.setItem('training-planner:brain:session-signature:'+selectedDateKey,signature)}catch{}
    if(currentDay.completed)window.TrainingDataCore.recordEvent({type:'session_feedback',status:'Completed session learned by TrainingDataCore',payload,rpe:payload.rpe,performance:payload.performance,cyclePhase:payload.cyclePhase,cycleContext});
    if(payload.adjustNextTime)window.TrainingDataCore.recordEvent({type:'session_adjustment',status:'Next-session adjustment learned by TrainingDataCore',payload});
  }
  document.addEventListener('trainmei:day-saved',async()=>{
    await recordSessionLearning();
    if(q('#calendar-page')?.classList.contains('active')){renderWeekLoad();renderRecoveryTrend();}
  });
  const addRunButton=q('#add-conditioning-block');
  if(addRunButton){
    addRunButton.onclick=()=>{
      if((currentDay?.runningRowing?.type||'Run')!=='Run'){
        addConditioningBlock();
        return;
      }
      currentDay.runningRowing.blocks=currentDay.runningRowing.blocks||[];
      currentDay.runningRowing.blocks.push({id:'run_'+Date.now(),name:`Main ${currentDay.runningRowing.blocks.length+1}`,kind:'interval',reps:'',distance:'',duration:'',pace:'',target:'',recovery:'',effort:'',surface:'',details:''});
      renderRunningStructure();scheduleSave();
    };
  }
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-tp-open-day]'))return;
    if(e.target.closest('#prev-month,#next-month,#today-btn'))setTimeout(()=>{renderWeekLoad();renderRecoveryTrend();},30);
  });
  attachHandlers();
  setTimeout(()=>{if(q('#calendar-page')){ensureCalendarPanels();renderWeekLoad();renderRecoveryTrend();}if(q('#day-page')){attachHandlers();}},50);
  window.tpWorkoutLoad=workoutLoad;window.tpRecoveryValues=recoveryValues;window.tpRecoveryScore=recoveryScore;window.tpWeekStart=weekStart;window.tpKeyOf=keyOf;window.tpAllWorkoutRows=allWorkoutRows;window.tpRefreshWeekLoad=()=>{try{return renderWeekLoad()}catch(e){console.warn('Week load refresh:',e)}};window.tpRefreshRecoveryTrend=()=>{try{return renderRecoveryTrend()}catch(e){console.warn('Recovery trend refresh:',e)}};
})();

document.addEventListener('trainmei:nutrition-updated',e=>{const s=e.detail?.summary;if(s)TrainingDataCore._cacheNutritionRow(s)});

async function renderDayContext(){return window.TrainMeiDayView?.renderDayContext?.()}

window.__tpStartApp=()=>startApp();
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();

