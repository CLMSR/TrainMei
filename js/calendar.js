/* TrainMei Phase 4 — Calendar domain */
(()=>{
  const TP=window.TrainMeiState||window.__tp;
  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  const WEEKDAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const pad=n=>String(n).padStart(2,'0');
  const dateKey=(y,m,d)=>`${y}-${pad(m+1)}-${pad(d)}`;
  const todayKey=()=>{const d=new Date();return dateKey(d.getFullYear(),d.getMonth(),d.getDate())};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function fetchMonth(year,month){
    const days=new Date(year,month+1,0).getDate(),from=dateKey(year,month,1),to=dateKey(year,month,days);
    const user=TP.currentUser;if(!user)return fetchMonthLocal(year,month);
    const {data,error}=await TP.supabaseClient().from('workouts').select('date,data').eq('user_id',user.id).gte('date',from).lte('date',to);
    if(error){console.warn(error);return fetchMonthLocal(year,month)}
    const out={};(data||[]).forEach(r=>out[r.date]=TP.normalizeDay(r.data));return out;
  }
  function fetchMonthLocal(year,month){
    const out={},prefix=`training-planner:workout:${year}-${pad(month+1)}`;
    Object.keys(localStorage).filter(k=>k.startsWith(prefix)).forEach(k=>{try{out[k.slice('training-planner:workout:'.length)]=TP.normalizeDay(JSON.parse(localStorage.getItem(k)))}catch{}});
    return out;
  }
  function renderCalendarQuickView(key){
    const box=$('#calendar-quick-view');if(!box)return;const d=TP.monthIndicators[key];
    if(!d){box.innerHTML='<div class="quick-view-empty"><div><strong>No workout planned</strong><br><span>Select another day to preview its session.</span></div></div>';return}
    const dt=new Date(key+'T12:00:00'),title=d.restDay?'Rest day':(d.focus||d.trainingCategory||'Workout');
    const blocks=(d.blocks||[]).filter(b=>(b.exercises||[]).some(e=>String(e.name||'').trim()));
    const sets=blocks.reduce((n,b)=>n+(b.exercises||[]).reduce((s,e)=>s+TP.totalExerciseSets(e),0),0);
    const dist=parseFloat(d.metrics?.distanceKm)||0,notes=String(d.notes||'').trim();
    box.innerHTML=`<div class="quick-view-kicker">Quick view · select a day to preview</div><div class="quick-view-date">${WEEKDAYS[(dt.getDay()+6)%7]} · ${MONTHS[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}</div><div class="quick-view-title">${esc(title)}</div><div class="quick-view-focus">${esc(d.restDay?'No training':(d.trainingCategory||'Training session'))}</div><div class="quick-view-stats"><div class="quick-view-stat"><strong>${blocks.length}</strong><span>Blocks</span></div><div class="quick-view-stat"><strong>${sets}</strong><span>Sets</span></div><div class="quick-view-stat"><strong>${dist?dist.toFixed(1)+' km':'—'}</strong><span>Distance</span></div></div>${blocks.slice(0,4).map(b=>`<div class="quick-view-block"><div class="quick-view-block-head"><strong>${esc(b.name||'Block')}</strong><span>${esc(b.category||'')}</span></div><div class="quick-view-exercises">${(b.exercises||[]).filter(e=>String(e.name||'').trim()).slice(0,5).map(e=>`<div class="quick-view-exercise"><strong>${esc(e.name)}</strong><span>${esc(TP.exerciseSetText(e)||'—')}</span></div>`).join('')}</div></div>`).join('')}${notes?`<div class="quick-view-notes">${esc(notes).slice(0,220)}</div>`:''}<div class="quick-view-actions"><button class="btn" data-quick-open="${key}">Open workout</button></div>`;
  }
  function initWeekMonthSummary(){
    const summary=document.getElementById('ios-week-month-summary'),toggle=document.getElementById('ios-week-month-toggle');
    if(!summary||!toggle||toggle.dataset.initialized==='true')return;
    toggle.dataset.initialized='true';
    let collapsed=true;
    try{const saved=localStorage.getItem('trainmei:calendar-summary-collapsed');if(saved!==null)collapsed=saved!=='false'}catch{}
    const apply=()=>{summary.classList.toggle('is-collapsed',collapsed);toggle.setAttribute('aria-expanded',String(!collapsed));};
    toggle.addEventListener('click',()=>{collapsed=!collapsed;try{localStorage.setItem('trainmei:calendar-summary-collapsed',String(collapsed))}catch{};apply()});
    apply();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initWeekMonthSummary,{once:true});else initWeekMonthSummary();

  async function renderMonth(){
    const cursor=TP.monthCursor();TP.showPage('calendar-page');const y=cursor.getFullYear(),m=cursor.getMonth();
    $('#month-title').innerHTML=`<span class="month-name">${MONTHS[m].toUpperCase()}</span><span class="month-year"> &nbsp;${y}</span>`;
    $('#cal-grid').innerHTML='<div style="padding:14px;font-size:12px;color:var(--muted)">Loading…</div>';
    const indicators=await fetchMonth(y,m);TP.monthIndicators=indicators;
    const first=new Date(y,m,1),start=(first.getDay()+6)%7,days=new Date(y,m+1,0).getDate();let h='';
    for(let i=0;i<start;i++)h+='<div class="cal-cell empty"></div>';
    for(let d=1;d<=days;d++){const k=dateKey(y,m,d),e=indicators[k],is=k===todayKey(),isRest=!!e?.restDay,title=isRest?'Rest day':(e?.focus||e?.trainingCategory||''),dist=e?.metrics?.distanceKm?e.metrics.distanceKm+' km':'';h+=`<div class="cal-cell${is?' today':''}${isRest?' rest-day':''}" data-key="${k}"><div class="cal-daynum">${d}</div><div class="cal-focus"><strong>${esc(title)}</strong></div>${isRest?'<span class="rest-day-badge">Rest</span>':(e?.color?`<span class="cal-color-dot c-${e.color}"></span>`:'')}<div class="cal-metric">${esc(isRest?'No training':dist)}</div></div>`}
    $('#cal-grid').innerHTML=h;
    const initial=TP.selectedDateKey&&indicators[TP.selectedDateKey]?TP.selectedDateKey:(indicators[todayKey()]?todayKey():Object.keys(indicators).find(k=>indicators[k])||dateKey(y,m,1));
    TP.selectedDateKey=initial;renderCalendarQuickView(initial);
    $$('#cal-grid .cal-cell[data-key]').forEach(c=>{
      if(c.dataset.key===initial)c.classList.add('selected');
      c.onclick=()=>{TP.selectedDateKey=c.dataset.key;$$('#cal-grid .cal-cell.selected').forEach(x=>x.classList.remove('selected'));c.classList.add('selected');const mobileLandscape=window.matchMedia('(min-width:561px) and (max-width:950px) and (orientation:landscape)').matches,mobilePortrait=window.matchMedia('(max-width:560px) and (orientation:portrait)').matches;if(mobileLandscape||mobilePortrait){TP.openDay(c.dataset.key);return}renderCalendarQuickView(c.dataset.key);TP.setStatus('')}});
    TP.setStatus('');document.dispatchEvent(new CustomEvent('trainmei:month-rendered',{detail:{monthCursor:new Date(cursor),selectedDateKey:initial}}));
  }
  window.TrainMeiCalendar={fetchMonth,renderCalendarQuickView,renderMonth};
})();
