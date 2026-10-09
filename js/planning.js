/* TrainMei Plan 2.0 — strategic planning domain */
(()=>{
  const TP=window.TrainMeiState||window.__tp;
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=x=>TP.clone(x);
  const setVal=(sel,v)=>{const el=$(sel);if(el)el.value=v??''};
  const WEEKDAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const todayKey=TP.todayKey;
  const dateKey=TP.dateKey;
  let planWeekKey=planMondayKey();

  const getPlan=()=>TP.planData;
  const templates=()=>Array.isArray(TP.templatesCache)?TP.templatesCache:[];
  const loadDayLocal=TP.loadDayLocal;

  function planMondayKey(date=new Date()){
    const d=new Date(date);
    d.setHours(12,0,0,0);
    const day=(d.getDay()+6)%7;
    d.setDate(d.getDate()-day);
    return dateKey(d.getFullYear(),d.getMonth(),d.getDate());
  }

  function planWeekDates(mondayKey){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(mondayKey||'')))return [];
    const [y,m,d]=mondayKey.split('-').map(Number);
    const base=new Date(y,m-1,d,12);
    return Array.from({length:7},(_,i)=>{
      const x=new Date(base);
      x.setDate(base.getDate()+i);
      return dateKey(x.getFullYear(),x.getMonth(),x.getDate());
    });
  }

  function weekData(key){
    const plan=getPlan();
    if(!plan.weeks[key])plan.weeks[key]={focus:'',notes:'',days:{}};
    if(!plan.weeks[key].days)plan.weeks[key].days={};
    return plan.weeks[key];
  }

  function planDayInfo(key){
    const w=weekData(planWeekKey);
    if(!w.days[key])w.days[key]={templateId:'',title:'',status:'Planned'};
    return w.days[key];
  }

  function templateForId(id){
    return templates().find(t=>String(t.id)===String(id))||null;
  }

  function weekTemplateForId(id){
    return getPlan().weekTemplates.find(t=>String(t.id)===String(id))||null;
  }
  function getPlannedWorkout(date){
  try{
    const key=String(date||'');
    if(!key)return null;

    const weekKey=planMondayKey(new Date(key+'T12:00:00'));
    const plan=getPlan();
    const info=plan.weeks?.[weekKey]?.days?.[key];

    if(!info?.templateId)return null;

    const template=templateForId(info.templateId);
    if(!template)return null;

    return template.data||template.workout||template||null;
  }catch(e){
    console.warn('TrainMei Planning: getPlannedWorkout failed',e);
    return null;
  }
}
  function planWeekLabel(key){
    const ds=planWeekDates(key);
    if(ds.length!==7)return '';
    const a=new Date(ds[0]+'T12:00:00');
    const b=new Date(ds[6]+'T12:00:00');
    return `${MONTHS[a.getMonth()]} ${a.getDate()} — ${MONTHS[b.getMonth()]} ${b.getDate()}, ${b.getFullYear()}`;
  }

  function getWeekNumber(d){
    const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
    const day=x.getUTCDay()||7;
    x.setUTCDate(x.getUTCDate()+4-day);
    const y=new Date(Date.UTC(x.getUTCFullYear(),0,1));
    return Math.ceil((((x-y)/86400000)+1)/7);
  }

  function phaseDateRange(phase){
    const dates=phaseDates(phase);
    if(!dates)return '';
    return `${dates.start} → ${dates.end}`;
  }

  function phaseDates(phase){
    if(!phase?.startDate)return null;
    const start=new Date(phase.startDate+'T12:00:00');
    if(Number.isNaN(start.getTime()))return null;
    const weeks=Math.max(1,Number(phase.durationWeeks)||1);
    const end=new Date(start);
    end.setDate(end.getDate()+weeks*7-1);
    return {
      start:dateKey(start.getFullYear(),start.getMonth(),start.getDate()),
      end:dateKey(end.getFullYear(),end.getMonth(),end.getDate())
    };
  }

  function phaseWeekDates(phase,weekNumber){
  if(!phase?.startDate)return null;

  const start=new Date(String(phase.startDate)+'T12:00:00');

  const monday=new Date(start);
  monday.setDate(
    monday.getDate()-((monday.getDay()+6)%7)
  );

  monday.setDate(
    monday.getDate()+(Number(weekNumber)-1)*7
  );

  const sunday=new Date(monday);
  sunday.setDate(sunday.getDate()+6);

  return {
    start:dateKey(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate()
    ),
    end:dateKey(
      sunday.getFullYear(),
      sunday.getMonth(),
      sunday.getDate()
    )
  };
}

  function formatPhaseWeekDates(phase,weekNumber){
    const dates=phaseWeekDates(phase,weekNumber);
    if(!dates)return 'Set a phase start date';
    const start=new Date(dates.start+'T12:00:00');
    const end=new Date(dates.end+'T12:00:00');
    return `${start.getDate()} ${MONTHS[start.getMonth()].slice(0,3)} — ${end.getDate()} ${MONTHS[end.getMonth()].slice(0,3)}`;
  }

  function phaseTypeLabel(type){
    return {
      deficit:'Deficit',
      maintenance:'Maintenance / Regulation',
      recomposition:'Recomposition',
      build:'Build',
      deload:'Deload',
      recovery:'Recovery',
      custom:'Custom'
    }[type]||'Custom';
  }

  function phaseStatus(phase){
    const dates=phaseDates(phase);
    if(!dates)return 'planned';
    const today=todayKey();
    if(today<dates.start)return 'planned';
    if(today>dates.end)return 'completed';
    return 'active';
  }

  function phaseStatusLabel(status){
    return {planned:'PLANNED',active:'CURRENT',completed:'COMPLETED'}[status]||'PLANNED';
  }

  function phaseProgress(phase){
    const dates=phaseDates(phase);
    if(!dates)return 0;
    const start=new Date(dates.start+'T12:00:00');
    const end=new Date(dates.end+'T12:00:00');
    const today=new Date(todayKey()+'T12:00:00');
    if(today<=start)return 0;
    if(today>=end)return 100;
    return Math.round(((today-start)/(end-start))*100);
  }

  function getPhases(){
    const plan=getPlan();
    if(!Array.isArray(plan.phases))plan.phases=[];
    return plan.phases;
  }
function getActivePhase(){
  const phases=getPhases();
  const activeId=TP.activePhaseId;

  if(activeId){
    const found=phases.find(p=>String(p.id)===String(activeId));
    if(found)return found;
  }

  return phases.find(p=>phaseStatus(p)==='active')||phases[0]||null;
}
function getPhaseForDate(date){
  const key=String(date||'');
  if(!key)return null;

  return getPhases().find(phase=>{
    const range=phaseDates(phase);
    return range && key>=range.start && key<=range.end;
  })||null;
}
function getPhaseWeekForDate(date){
  const phase=getPhaseForDate(date);
  if(!phase)return null;

  const start=new Date(String(phase.startDate)+'T12:00:00');
  const target=new Date(String(date)+'T12:00:00');

  if(isNaN(start.getTime())||isNaN(target.getTime()))return null;

  const week=Math.floor((target-start)/604800000)+1;
  const totalWeeks=Math.max(1,Number(phase.durationWeeks)||1);

  return {
    phase,
    week:Math.min(Math.max(week,1),totalWeeks)
  };
}
  function currentPhaseIndex(){
    const phases=getPhases();
    const active=phases.findIndex(p=>phaseStatus(p)==='active');
    if(active>=0)return active;
    const planned=phases.findIndex(p=>phaseStatus(p)==='planned');
    return planned>=0?planned:(phases.length?phases.length-1:-1);
  }

  function normalizeWeekOverride(data={}){
    return {
      type:data.type||'training',
      goal:data.goal||'',
      focus:data.focus||'',
      weeklyTemplateId:data.weeklyTemplateId||data.templateId||'',
      notes:data.notes||''
    };
  }

  function ensurePhaseWeek(phase,weekNumber){
    if(!phase.weekOverrides)phase.weekOverrides={};
    if(!phase.weekOverrides[weekNumber])phase.weekOverrides[weekNumber]=normalizeWeekOverride();
    else phase.weekOverrides[weekNumber]=normalizeWeekOverride(phase.weekOverrides[weekNumber]);
    return phase.weekOverrides[weekNumber];
  }

  function renderPhaseWeeks(phase,phaseIndex){
    const duration=Math.max(1,Number(phase.durationWeeks)||1);
    const overrides=phase.weekOverrides||{};
    const weekTemplates=getPlan().weekTemplates||[];

    const rows=Array.from({length:duration},(_,index)=>{
      const weekNumber=index+1;
      const data=normalizeWeekOverride(overrides[weekNumber]||{});
      const eventCount=(phase.events||[]).filter(e=>Number(e.weekNumber)===weekNumber).length;
      return `
        <div class="plan-phase-week-row" data-phase-week="${weekNumber}">
          <div class="plan-phase-week-number">
            <span class="eyebrow">WEEK</span>
            <strong>${weekNumber}</strong>
            <small>${esc(formatPhaseWeekDates(phase,weekNumber))}</small>
          </div>
          <label>
            <span class="eyebrow">Type</span>
            <select data-phase-week-field="type" data-phase-index="${phaseIndex}" data-phase-week="${weekNumber}">
              ${[['training','Training'],['deload','Deload'],['recovery','Recovery'],['custom','Custom']].map(([v,l])=>`<option value="${v}" ${data.type===v?'selected':''}>${l}</option>`).join('')}
            </select>
          </label>
          <label>
            <span class="eyebrow">Goal</span>
            <input data-phase-week-field="goal" data-phase-index="${phaseIndex}" data-phase-week="${weekNumber}" value="${esc(data.goal)}" placeholder="What should this week achieve?">
          </label>
          <label>
            <span class="eyebrow">Focus</span>
            <input data-phase-week-field="focus" data-phase-index="${phaseIndex}" data-phase-week="${weekNumber}" value="${esc(data.focus)}" placeholder="Training focus">
          </label>
          <label>
            <span class="eyebrow">Week template</span>
            <select data-phase-week-field="weeklyTemplateId" data-phase-index="${phaseIndex}" data-phase-week="${weekNumber}">
              <option value="">No weekly template</option>
              ${weekTemplates.map(t=>`<option value="${esc(t.id)}" ${String(data.weeklyTemplateId)===String(t.id)?'selected':''}>${esc(t.name||'Week template')}</option>`).join('')}
            </select>
          </label>
          <label class="plan-phase-week-notes">
            <span class="eyebrow">Notes</span>
            <input data-phase-week-field="notes" data-phase-index="${phaseIndex}" data-phase-week="${weekNumber}" value="${esc(data.notes)}" placeholder="Notes">
          </label>
          <div class="plan-phase-week-actions">
            <span class="hint">${eventCount ? `${eventCount} event${eventCount===1?'':'s'}` : 'No events'}</span>
            <button class="btn" data-phase-week-apply="${phaseIndex}" data-phase-week="${weekNumber}">Apply to Calendar →</button>
          </div>
        </div>`;
    }).join('');

        return `
      <div class="plan-phase-weeks">
        <div class="plan-phase-weeks-head">
          <div>
            <div class="eyebrow">Semanas de la fase</div>
            <strong>${duration} ${duration === 1 ? 'semana' : 'semanas'}</strong>
          </div>
          <div class="hint">Planifica por semana. Aplica al calendario sólo cuando quieras escribirla.</div>
        </div>
        <div class="plan-phase-week-list">${rows}</div>
        ${!weekTemplates.length ? '<div class="empty-state">Aún no hay week templates. Guarda la semana actual desde “Recursos”.</div>' : ''}
      </div>`;
  }

  function renderGoals(phase,phaseIndex){
    const goals=Array.isArray(phase.goals)?phase.goals:[];
    return `
      <div class="plan-subsection">
        <div class="plan-subsection-head"><div><div class="eyebrow">Goals</div><strong>Phase outcomes</strong></div><button class="btn" data-plan-goal-add="${phaseIndex}">+ Add goal</button></div>
        ${goals.length?goals.map((g,i)=>`<div class="plan-goal-row"><input type="checkbox" data-plan-goal-done="${phaseIndex}:${i}" ${g.done?'checked':''}><input data-plan-goal-field="text" data-phase-index="${phaseIndex}" data-goal-index="${i}" value="${esc(g.text||'')}" placeholder="Goal"><button class="btn danger" data-plan-goal-remove="${phaseIndex}:${i}">×</button></div>`).join(''):'<div class="hint">Optional. Add measurable outcomes for this phase.</div>'}
      </div>`;
  }

  function renderNutrition(phase,phaseIndex){
    const n=phase.nutrition||{};
    return `
      <div class="plan-subsection">
        <div class="eyebrow">Nutrition</div>
        <div class="plan-phase-grid">
          <label><span class="eyebrow">Calories</span><input type="number" min="0" step="1" data-plan-phase-field="nutrition.kcalTarget" data-plan-phase-index="${phaseIndex}" value="${n.kcalTarget??''}" placeholder="1600"></label>
          <label><span class="eyebrow">Protein %</span><input type="number" min="0" max="100" step="1" data-plan-phase-field="nutrition.proteinPct" data-plan-phase-index="${phaseIndex}" value="${n.proteinPct??''}"></label>
          <label><span class="eyebrow">Carbs %</span><input type="number" min="0" max="100" step="1" data-plan-phase-field="nutrition.carbsPct" data-plan-phase-index="${phaseIndex}" value="${n.carbsPct??''}"></label>
          <label><span class="eyebrow">Fat %</span><input type="number" min="0" max="100" step="1" data-plan-phase-field="nutrition.fatPct" data-plan-phase-index="${phaseIndex}" value="${n.fatPct??''}"></label>
        </div>
        <label><span class="eyebrow">Strategy</span><input data-plan-phase-field="nutrition.strategy" data-plan-phase-index="${phaseIndex}" value="${esc(n.strategy||'')}" placeholder="Deficit, maintenance, diet break…"></label>
        <label><span class="eyebrow">Notes</span><textarea data-plan-phase-field="nutrition.notes" data-plan-phase-index="${phaseIndex}" placeholder="Nutrition notes">${esc(n.notes||'')}</textarea></label>
      </div>`;
  }

  function renderEvents(phase,phaseIndex){
    const events=Array.isArray(phase.events)?phase.events:[];
    return `
      <div class="plan-subsection">
        <div class="plan-subsection-head"><div><div class="eyebrow">Events</div><strong>Phase events</strong></div><button class="btn" data-plan-event-add="${phaseIndex}">+ Add event</button></div>
        ${events.length?events.map((ev,i)=>`<div class="plan-event-row">
          <select data-plan-event-field="type" data-phase-index="${phaseIndex}" data-event-index="${i}">${[['deload','Deload'],['recovery','Recovery'],['diet_break','Diet break'],['refeed','Refeed'],['check_in','Check-in'],['assessment','Assessment'],['routine_change','Routine change'],['custom','Custom']].map(([v,l])=>`<option value="${v}" ${ev.type===v?'selected':''}>${l}</option>`).join('')}</select>
          <input type="number" min="1" max="${Math.max(1,Number(phase.durationWeeks)||1)}" data-plan-event-field="weekNumber" data-phase-index="${phaseIndex}" data-event-index="${i}" value="${Number(ev.weekNumber)||1}" title="Week number">
          <input data-plan-event-field="title" data-phase-index="${phaseIndex}" data-event-index="${i}" value="${esc(ev.title||'')}" placeholder="Event title">
          <input data-plan-event-field="description" data-phase-index="${phaseIndex}" data-event-index="${i}" value="${esc(ev.description||'')}" placeholder="Description">
          <button class="btn danger" data-plan-event-remove="${phaseIndex}:${i}">×</button>
        </div>`).join(''):'<div class="hint">No events. Add deloads, diet breaks, check-ins or custom milestones.</div>'}
      </div>`;
  }

  function renderPlanPhases(){
    const el=$('#plan-phase-list');
    if(!el)return;
    const phases=getPhases();
    if(!phases.length){
      el.innerHTML=`<div class="plan-empty-state"><div class="eyebrow">No phases yet</div><strong>Build your long-term plan</strong><div class="hint">Add your first phase to structure training and nutrition across multiple weeks.</div></div>`;
      return;
    }

    const current=currentPhaseIndex();
    const currentPhase=current>=0?phases[current]:null;
    const currentCard = currentPhase ? `
      <div class="plan-current-phase">
        <div>
          <div class="eyebrow">Fase actual</div>
          <h2>${esc(currentPhase.name || 'Phase')}</h2>
          <div class="hint">${esc(phaseTypeLabel(currentPhase.type))} · Semana ${currentWeekNumberInPhase(currentPhase)}/${Math.max(1, Number(currentPhase.durationWeeks) || 1)}</div>
        </div>
        <div class="plan-current-phase-targets">
          ${currentPhase.nutrition?.kcalTarget ? `<strong>${esc(currentPhase.nutrition.kcalTarget)} kcal</strong>` : ''}
          <span>${phaseStatusLabel(phaseStatus(currentPhase))}</span>
        </div>
        <div class="plan-progress"><span style="width:${phaseProgress(currentPhase)}%"></span></div>
      </div>` : '';

    el.innerHTML=currentCard+`<div class="plan-phase-timeline">${phases.map((phase,i)=>{
      const status=phaseStatus(phase);
      const duration=Math.max(1,Number(phase.durationWeeks)||1);
      return `<article class="plan-phase-card ${status==='active'?'is-current':''}" data-phase-index="${i}">
        <div class="plan-phase-card-head"><div><div class="eyebrow">${esc(phaseTypeLabel(phase.type))} · ${phaseStatusLabel(status)}</div><h3>${esc(phase.name||`Phase ${i+1}`)}</h3></div><button class="btn danger" data-plan-phase-remove="${i}">Remove</button></div>
        <div class="plan-phase-meta"><span>${duration} weeks</span><span>${phase.startDate?esc(phaseDateRange(phase)):'No start date'}</span><span>${phaseProgress(phase)}%</span></div>
        <div class="plan-phase-grid">
          <label><span class="eyebrow">Name</span><input data-plan-phase-index="${i}" data-plan-phase-field="name" value="${esc(phase.name||'')}" placeholder="Phase name"></label>
          <label><span class="eyebrow">Type</span><select data-plan-phase-index="${i}" data-plan-phase-field="type">${[['deficit','Deficit'],['maintenance','Maintenance / Regulation'],['recomposition','Recomposition'],['build','Build'],['deload','Deload'],['recovery','Recovery'],['custom','Custom']].map(([v,l])=>`<option value="${v}" ${phase.type===v?'selected':''}>${l}</option>`).join('')}</select></label>
          <label><span class="eyebrow">Start</span><input type="date" data-plan-phase-index="${i}" data-plan-phase-field="startDate" value="${esc(phase.startDate||'')}"></label>
          <label><span class="eyebrow">Duration</span><input type="number" min="1" step="1" data-plan-phase-index="${i}" data-plan-phase-field="durationWeeks" value="${duration}"></label>
        </div>
        <div class="plan-phase-grid">
          <label><span class="eyebrow">Phase goal</span><textarea data-plan-phase-index="${i}" data-plan-phase-field="goal" placeholder="What should this phase achieve?">${esc(phase.goal||'')}</textarea></label>
          <label><span class="eyebrow">Training focus</span><textarea data-plan-phase-index="${i}" data-plan-phase-field="training.focus" placeholder="Volume, intensity, strength, conditioning…">${esc(phase.training?.focus||'')}</textarea></label>
        </div>
        ${renderNutrition(phase,i)}
        ${renderGoals(phase,i)}
        ${renderEvents(phase,i)}
        <div class="plan-phase-actions"><button class="btn" data-plan-phase-open="${i}">${String(TP.activePhaseId)===String(phase.id)?'Close weekly plan ↑':'Open weekly plan →'}</button></div>${String(TP.activePhaseId)===String(phase.id)?renderPhaseWeeks(phase,i):''}</article>`;
    }).join('')}</div>`;
  }

  function currentWeekNumberInPhase(phase){
    const dates=phaseDates(phase);
    if(!dates)return 1;
    const today=new Date(todayKey()+'T12:00:00');
    const start=new Date(dates.start+'T12:00:00');
    const n=Math.floor((today-start)/604800000)+1;
    return Math.min(Math.max(1,n),Math.max(1,Number(phase.durationWeeks)||1));
  }

  function renderPlanWeek(){
    const w=weekData(planWeekKey);
    const dates=planWeekDates(planWeekKey);
    const a=new Date(dates[0]+'T12:00:00');
    const number=getWeekNumber(a);
    const numberEl=$('#plan-week-number');
    const titleEl=$('#plan-week-title');
    if(numberEl)numberEl.textContent=`WEEK ${number}`;
    if(titleEl)titleEl.textContent=planWeekLabel(planWeekKey);
    setVal('#plan-week-focus',w.focus||'');
    setVal('#plan-week-notes',w.notes||'');
    const grid=$('#plan-week-grid');
    if(!grid)return;
    grid.innerHTML=dates.map((key,i)=>{
      const dt=new Date(key+'T12:00:00');
      const info=planDayInfo(key);
      const actual=loadDayLocal(key);
      const title=info.title||actual.focus||actual.trainingCategory||'';
      const t=templateForId(info.templateId);
      return `<article class="plan-day-card${key===todayKey()?' plan-day-today':''}>
        <div class="plan-day-head"><strong>${WEEKDAYS[i]}</strong><span class="plan-day-date">${MONTHS[dt.getMonth()].slice(0,3)} ${dt.getDate()}</span></div>
        <div class="plan-day-body">
          <input class="plan-day-title" data-plan-day-title="${key}" value="${esc(title)}" placeholder="Session title">
          <div class="plan-day-template">${t?`Template · ${esc(t.name||'Workout template')}`:'Choose a workout template or open the day'}</div>
          <select class="plan-day-select" data-plan-day-template="${key}"><option value="">No template</option>${templates().map(t=>`<option value="${esc(t.id)}" ${String(info.templateId)===String(t.id)?'selected':''}>${esc(t.name||'Template')}</option>`).join('')}</select>
          <select class="plan-day-select" data-plan-day-status="${key}"><option value="Planned" ${info.status==='Planned'||!info.status?'selected':''}>Planned</option><option value="Completed" ${info.status==='Completed'?'selected':''}>Completed</option><option value="Skipped" ${info.status==='Skipped'?'selected':''}>Skipped</option></select>
          <div class="plan-day-buttons"><button class="btn" data-plan-open-day="${key}">Open</button><button class="btn" data-plan-apply-template="${key}">Apply</button></div>
        </div>
      </article>`;
    }).join('');
  }

  function renderPlan(){
    renderPlanPhases();
    renderPlanWeek();
    renderWeekTemplates();
    renderPlanBlocks();
    renderSeasonBlocks();
  }

  function renderPlanBlocks(){
    const el=$('#blocks-list');
    if(!el)return;
    if(!getPlan().blocks.length){el.innerHTML='<div class="empty-state">Legacy training blocks are kept for compatibility. New planning should live in phases and weeks.</div>';return;}
    el.innerHTML=getPlan().blocks.map((b,i)=>`<div class="plan-row"><input data-plan-block-index="${i}" data-field="name" value="${esc(b.name||'')}" placeholder="Block name"><input data-plan-block-index="${i}" data-field="focus" value="${esc(b.focus||'')}" placeholder="Focus"><button data-plan-block-remove="${i}">×</button></div>`).join('');
  }

  function renderWeekTemplates(){
    const el=$('#week-template-list');
    if(!el)return;
    const list=getPlan().weekTemplates||[];
    if(!list.length){el.innerHTML='<div class="empty-state">No weekly templates yet. Build the current week, then save it here for reuse across phases.</div>';return;}
    el.innerHTML=list.map((t,i)=>`<div class="week-template-card"><div><strong>${esc(t.name||'Week template')}</strong><div class="week-template-meta">${(t.days||[]).filter(d=>d.templateId||d.title).length} planned days${t.focus?' · '+esc(t.focus):''}</div></div><div class="week-template-actions"><button class="btn" data-week-template-apply="${i}">Use</button><button class="btn danger" data-week-template-delete="${i}">×</button></div></div>`).join('');
  }

  function renderSeasonBlocks(){
    const el=$('#season-block-list');
    if(!el)return;
    if(!getPlan().blocks.length){el.innerHTML='<div class="empty-state">Blocks remain available for legacy plans. Use phases → weeks → events for Plan 2.0.</div>';return;}
    el.innerHTML=getPlan().blocks.map((b,i)=>`<div class="season-block-card"><strong>${esc(b.name||'Training block')}</strong><input data-season-index="${i}" data-season-field="name" value="${esc(b.name||'')}" placeholder="Block name"><input data-season-index="${i}" data-season-field="start" value="${esc(b.start||'')}" type="date"><input data-season-index="${i}" data-season-field="end" value="${esc(b.end||'')}" type="date"><textarea data-season-index="${i}" data-season-field="focus" placeholder="Block focus">${esc(b.focus||'')}</textarea><div class="season-block-actions"><button class="btn danger" data-season-remove="${i}">Remove</button></div></div>`).join('');
  }

  async function saveWeekTemplate(){
    const w=weekData(planWeekKey);
    const defaultName=`Week ${getWeekNumber(new Date(planWeekKey+'T12:00:00'))}`;
    const rawName=window.prompt('Week template name:',defaultName);
    if(rawName===null)return null;
    const name=String(rawName).trim();
    if(!name){TP.setStatus('Template name required');return null;}
    const template={
      id:`week_template_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      name,
      focus:w.focus||'',
      notes:w.notes||'',
      days:planWeekDates(planWeekKey).map(k=>{
        const info=planDayInfo(k);
        return {templateId:info.templateId||'',title:info.title||'',status:info.status||'Planned'};
      })
    };
    getPlan().weekTemplates.push(template);
    renderPlan();
    await TP.savePlanCloud();
    TP.setStatus(`Weekly template saved · ${name}`);
    return template;
  }

  function applyWeekTemplate(i){
    const t=getPlan().weekTemplates[i];
    if(!t)return;
    const dates=planWeekDates(planWeekKey);
    const w=weekData(planWeekKey);
    dates.forEach((k,idx)=>{w.days[k]=clone((t.days||[])[idx]||{templateId:'',title:'',status:'Planned'});});
    w.focus=t.focus||'';
    w.notes=t.notes||'';
    renderPlan();
    TP.savePlanCloud();
    TP.setStatus('Weekly template applied');
  }

  async function applyPlanTemplate(key,infoOverride=null){
    const info=infoOverride||planDayInfo(key);
    const id=info?.templateId;
    if(!id){TP.setStatus('Choose a workout template first');return false;}
    const t=templateForId(id);
    if(!t?.data){TP.setStatus('Workout template unavailable');return false;}
    TP.selectedDateKey=key;
    TP.currentDay=TP.normalizeDay(clone(t.data));
    await TP.saveDay();
    TP.monthIndicators[key]=TP.currentDay;
    info.title=TP.currentDay.focus||t.name||'';
    info.status='Planned';
    if(!infoOverride)weekData(planWeekKey).days[key]=info;
    await TP.savePlanCloud();
    renderPlanWeek();
    return true;
  }

  async function applyPhaseWeekToCalendar(phaseIndex,weekNumber){
    const phase=getPhases()[phaseIndex];
    if(!phase){TP.setStatus('Phase unavailable');return false;}
    const weeklyTemplateId=phase.weekOverrides?.[weekNumber]?.weeklyTemplateId||'';
    if(!weeklyTemplateId){TP.setStatus('Choose a weekly template first');return false;}
    const weeklyTemplate=weekTemplateForId(weeklyTemplateId);
    if(!weeklyTemplate){TP.setStatus('Weekly template unavailable');return false;}
    const dates=phaseWeekDates(phase,weekNumber);
    if(!dates){TP.setStatus('Set a phase start date first');return false;}
    const targetDates=planWeekDates(dates.start);
    const plannedDays=weeklyTemplate.days||[];
    const hasExistingCalendarDays=targetDates.some(key=>{
      const day=loadDayLocal?.(key);
      return day&&((day.focus||'')||(day.trainingCategory||'')||day.exercises?.length||day.blocks?.length);
    });
    if(hasExistingCalendarDays&&!window.confirm('Some Calendar days already contain workouts. Apply this week and overwrite those days?'))return false;

    const monday=dates.start;
    const targetWeek=weekData(monday);
    targetWeek.days={};
    targetWeek.focus=weeklyTemplate.focus||phase.training?.focus||'';
    targetWeek.notes=weeklyTemplate.notes||phase.weekOverrides?.[weekNumber]?.notes||'';

    for(let i=0;i<7;i++){
      const key=targetDates[i];
      const info=clone(plannedDays[i]||{templateId:'',title:'',status:'Planned'});
      targetWeek.days[key]=info;
      if(!info.templateId)continue;
      const template=templateForId(info.templateId);
      if(!template?.data){console.warn('[Plan 2.0] Workout template unavailable:',info.templateId);continue;}
      TP.selectedDateKey=key;
      TP.currentDay=TP.normalizeDay(clone(template.data));
      await TP.saveDay();
      TP.monthIndicators[key]=TP.currentDay;
      info.title=TP.currentDay.focus||template.name||info.title||'';
      info.status='Planned';
      targetWeek.days[key]=info;
    }

    await TP.savePlanCloud();
    renderPlan();
    TP.setStatus(`Week ${weekNumber} applied · ${dates.start} → ${dates.end}`);
    return true;
  }

  function addPhase(){
  const plan=getPlan();
  if(!Array.isArray(plan.phases))plan.phases=[];

  const index=plan.phases.length+1;

  const phase={
    id:`phase_${Date.now()}_${index}`,
    name:`Phase ${index}`,
    type:'custom',
    startDate:'',
    durationWeeks:4,
    goal:'',
    nutrition:{
      strategy:'',
      kcalTarget:null,
      proteinPct:null,
      carbsPct:null,
      fatPct:null,
      notes:''
    },
    training:{
      focus:'',
      notes:''
    },
    goals:[],
    events:[],
    weekOverrides:{}
  };

  plan.phases.push(phase);
  TP.activePhaseId=phase.id;

  renderPlan();
  TP.savePlanCloud();
}

function removePhase(index){
  const phases=getPhases();
  const phase=phases[index];

  if(!phase)return;

  if(!window.confirm(`Remove "${phase.name||'this phase'}"?`))return;

  const removedId=phase.id;

  phases.splice(index,1);

  if(String(TP.activePhaseId)===String(removedId)){
    TP.activePhaseId=phases[0]?.id||'';
  }

  renderPlan();
  TP.savePlanCloud();
}

  function movePlanWeek(){
    const source=weekData(planWeekKey);
    const d=new Date(planWeekKey+'T12:00:00');
    d.setDate(d.getDate()+7);
    const target=dateKey(d.getFullYear(),d.getMonth(),d.getDate());
    if(!window.confirm('Move this plan to the next week? The current Plan week will be cleared; Calendar workouts are not deleted.'))return;
    getPlan().weeks[target]=clone(source);
    delete getPlan().weeks[planWeekKey];
    planWeekKey=target;
    renderPlan();
    TP.savePlanCloud();
    TP.setStatus('Plan moved to next week');
  }

  function clearPlannedWeek(){
    if(!window.confirm('Clear the Plan entries for this week? Existing Calendar workouts will not be deleted.'))return;
    const w=weekData(planWeekKey);
    w.focus='';w.notes='';w.days={};
    renderPlan();
    TP.savePlanCloud();
    TP.setStatus('Planned week cleared');
  }

  async function duplicatePlanWeek(){
    const source=weekData(planWeekKey);
    const d=new Date(planWeekKey+'T12:00:00');
    d.setDate(d.getDate()+7);
    const target=dateKey(d.getFullYear(),d.getMonth(),d.getDate());
    getPlan().weeks[target]=clone(source);
    planWeekKey=target;
    renderPlan();
    await TP.savePlanCloud();
    TP.setStatus('Week duplicated');
  }

  function addSeasonBlock(){getPlan().blocks.push({name:'',start:'',end:'',focus:''});renderPlan();TP.savePlanCloud()}
  function addPlanBlock(){addSeasonBlock()}
  function setPlanWeekFrom(delta){const d=new Date(planWeekKey+'T12:00:00');d.setDate(d.getDate()+delta*7);planWeekKey=dateKey(d.getFullYear(),d.getMonth(),d.getDate());renderPlan()}
  function openPlanDay(key){TP.selectedDateKey=key;TP.openDay(key)}

  function handlePhaseField(field){
    const phase=getPhases()[Number(field.dataset.planPhaseIndex)];
    if(!phase)return;
    const name=field.dataset.planPhaseField;
    phase.nutrition=phase.nutrition||{};
    phase.training=phase.training||{};
    if(name==='name')phase.name=field.value;
    else if(name==='type')phase.type=field.value;
    else if(name==='startDate')phase.startDate=field.value;
    else if(name==='durationWeeks')phase.durationWeeks=Math.max(1,Number(field.value)||1);
    else if(name==='goal')phase.goal=field.value;
    else if(name==='training.focus')phase.training.focus=field.value;
    else if(name.startsWith('nutrition.')){
      const n=name.slice('nutrition.'.length);
      phase.nutrition[n]=n==='kcalTarget'||n.endsWith('Pct')?(field.value===''?null:Number(field.value)):field.value;
    }
    TP.savePlanCloud();
    if(name==='durationWeeks'||name==='startDate'||name==='type')renderPlanPhases();
  }

  function handleWeekField(field){
    const phase=getPhases()[Number(field.dataset.phaseIndex)];
    if(!phase)return;
    const weekNumber=Number(field.dataset.phaseWeek);
    const data=ensurePhaseWeek(phase,weekNumber);
    data[field.dataset.phaseWeekField]=field.value;
    TP.savePlanCloud();
  }

  function handleGoalField(field){
    const phase=getPhases()[Number(field.dataset.phaseIndex)];
    const i=Number(field.dataset.goalIndex);
    if(!phase?.goals?.[i])return;
    phase.goals[i].text=field.value;
    TP.savePlanCloud();
  }

  function handleEventField(field){
    const phase=getPhases()[Number(field.dataset.phaseIndex)];
    const i=Number(field.dataset.eventIndex);
    if(!phase?.events?.[i])return;
    const key=field.dataset.planEventField;
    phase.events[i][key]=key==='weekNumber'?Math.max(1,Number(field.value)||1):field.value;
    TP.savePlanCloud();
  }

  document.addEventListener('change',e=>{
    const phaseField=e.target.closest?.('[data-plan-phase-field]');
    if(phaseField){handlePhaseField(phaseField);return;}
    const weekField=e.target.closest?.('[data-phase-week-field]');
    if(weekField){handleWeekField(weekField);return;}
    const goalDone=e.target.closest?.('[data-plan-goal-done]');
    if(goalDone){
      const [pi,gi]=goalDone.dataset.planGoalDone.split(':').map(Number);
      const goal=getPhases()[pi]?.goals?.[gi];
      if(goal){goal.done=!!goalDone.checked;TP.savePlanCloud();}
      return;
    }
    const goalField=e.target.closest?.('[data-plan-goal-field]');
    if(goalField){handleGoalField(goalField);return;}
    const eventField=e.target.closest?.('[data-plan-event-field]');
    if(eventField){handleEventField(eventField);return;}
    if(e.target.dataset.planDayTemplate){const info=planDayInfo(e.target.dataset.planDayTemplate);if(info){info.templateId=e.target.value;renderPlanWeek();TP.savePlanCloud();}return;}
    if(e.target.dataset.planDayStatus){const info=planDayInfo(e.target.dataset.planDayStatus);if(info){info.status=e.target.value;TP.savePlanCloud();}return;}
    if(e.target.dataset.planDayTitle){const info=planDayInfo(e.target.dataset.planDayTitle);if(info){info.title=e.target.value;TP.savePlanCloud();}return;}
  });

  document.addEventListener('input',e=>{
    const dayTitle=e.target.closest?.('[data-plan-day-title]');
    if(dayTitle){
      const info=planDayInfo(dayTitle.dataset.planDayTitle);
      if(info){info.title=dayTitle.value;clearTimeout(window._planSaveTimer);window._planSaveTimer=setTimeout(TP.savePlanCloud,350);}
      return;
    }
    const field=e.target.closest?.('[data-plan-phase-field],[data-phase-week-field],[data-plan-goal-field],[data-plan-event-field]');
    if(!field)return;
    clearTimeout(window._planSaveTimer);
    window._planSaveTimer=setTimeout(()=>{
      if(field.matches('[data-plan-phase-field]'))handlePhaseField(field);
      else if(field.matches('[data-phase-week-field]'))handleWeekField(field);
      else if(field.matches('[data-plan-goal-field]'))handleGoalField(field);
      else if(field.matches('[data-plan-event-field]'))handleEventField(field);
    },350);
  });

  document.addEventListener('click',async e=>{
    const b=e.target.closest?.('button');
    if(!b)return;
    if(b.dataset.planGoalAdd!==undefined){
      const phase=getPhases()[Number(b.dataset.planGoalAdd)];
      if(!phase)return;
      phase.goals=Array.isArray(phase.goals)?phase.goals:[];
      phase.goals.push({id:`goal_${Date.now()}_${phase.goals.length}`,text:'',done:false});
      renderPlanPhases();
      TP.savePlanCloud();
      return;
    }
    if(b.dataset.planGoalRemove!==undefined){
      const [pi,gi]=b.dataset.planGoalRemove.split(':').map(Number);
      const phase=getPhases()[pi];
      if(!phase?.goals?.[gi])return;
      phase.goals.splice(gi,1);renderPlanPhases();TP.savePlanCloud();return;
    }
    if(b.dataset.planEventAdd!==undefined){
      const phase=getPhases()[Number(b.dataset.planEventAdd)];
      if(!phase)return;
      phase.events=Array.isArray(phase.events)?phase.events:[];
      phase.events.push({id:`event_${Date.now()}_${phase.events.length}`,type:'custom',weekNumber:1,title:'',description:''});
      renderPlanPhases();TP.savePlanCloud();return;
    }
    if(b.dataset.planEventRemove!==undefined){
      const [pi,ei]=b.dataset.planEventRemove.split(':').map(Number);
      const phase=getPhases()[pi];
      if(!phase?.events?.[ei])return;
      phase.events.splice(ei,1);renderPlanPhases();TP.savePlanCloud();return;
    }
    if(b.dataset.planPhaseOpen!==undefined){
  const i=Number(b.dataset.planPhaseOpen);
  const phase=getPhases()[i];

  if(!phase)return;

  TP.activePhaseId=
    String(TP.activePhaseId)===String(phase.id)
      ? ''
      : phase.id;

  renderPlanPhases();

  TP.setStatus(
    TP.activePhaseId
      ? `Planning ${phase.name||'phase'}`
      : 'Phase closed'
  );
}
  });

  window.TrainMeiPlanning={
    planMondayKey,planWeekDates,getPlannedWorkout,getPhaseForDate,getActivePhase,weekData,planDayInfo,planWeekLabel,
    renderPlan,renderPlanBlocks,renderWeekTemplates,renderSeasonBlocks,renderPhaseWeeks,
    getPhases,phaseTypeLabel,phaseDateRange,phaseWeekDates,formatPhaseWeekDates,
    applyPhaseWeekToCalendar,addPhase,removePhase,saveWeekTemplate,applyWeekTemplate,
    applyPlanTemplate,movePlanWeek,clearPlannedWeek,duplicatePlanWeek,addSeasonBlock,
    addPlanBlock,setPlanWeekFrom,openPlanDay,getWeekNumber,getPlanWeekKey:()=>planWeekKey,
    setPlanWeekKey:v=>{if(/^\d{4}-\d{2}-\d{2}$/.test(v))planWeekKey=v;},
    savePlanCloud:async()=>{
      const plan=getPlan();
      localStorage.setItem('training-planner:plan',JSON.stringify(plan));
      const user=TP.currentUser;
      if(!user){TP.setStatus('Plan saved locally');return true;}
      const client=TP.supabaseClient();
      if(!client){TP.setStatus('Plan saved locally');return false;}
      const {error}=await client.from('training_plans').upsert({user_id:user.id,data:plan,updated_at:new Date().toISOString()},{onConflict:'user_id'});
      TP.setStatus(error?'Plan saved locally — cloud table missing or unavailable':'Plan saved');
      return !error;
    }
  };
})();
