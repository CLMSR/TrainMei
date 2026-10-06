
(()=>{
  const TP=window.TrainMeiState||window.__tp;const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalizeTags=v=>Array.isArray(v)?[...new Set(v.map(x=>String(x).trim().toLowerCase()).filter(Boolean))].slice(0,12):[...new Set(String(v||'').split(/[,;]+/).map(x=>x.trim().toLowerCase()).filter(Boolean))].slice(0,12);

  /* cleanEditorDay: strips all "lived experience" fields so a template only
     carries the structural plan (title, focus, blocks, conditioning).
     Used by saveEditor() [already was], saveCurrent() [NEW], and duplicate(). */
  const cleanEditorDay=d=>{
    d.metrics={distanceKm:'',timeMin:'',pace:'',rpe:'',load:''};
    d.caffeine={taken:false,mg:''};
    d.carbohydratesGrams='';
    d.recovery={sleep:0,energy:0,soreness:0};
    d.completed=false;
    d.restDay=false;
    d.notes='';
    d.noteTags=[];
    d.color='';
    d.sessionFeedback={feelings:'',adjustNextTime:'',nextFocus:'',tags:[],performance:'',energyRating:'',technique:'',pain:'',adjustmentOutcome:''};
    d.previousFeedback=null;
    return d;
  };

  async function load(){const user=TP.currentUser;if(!user){TP.templatesCache=[];render();return []}const {data,error}=await TP.supabaseClient().from('workout_templates').select('*').eq('user_id',user.id).order('updated_at',{ascending:false});const list=error?[]:(data||[]);TP.templatesCache=list;render();return list}
  function tags(t){return normalizeTags(t?.data?._tags||t?.tags||[])}
  function render(){const c=$('#template-list');if(!c)return;const q=($('#template-search')?.value||'').trim().toLowerCase(),cache=TP.templatesCache;const filtered=cache.filter(t=>{const tg=tags(t);return !q||(t.name+' '+(t.category||'')+' '+tg.join(' ')).toLowerCase().includes(q)});const count=$('#template-library-count');if(count)count.textContent=`${filtered.length} template${filtered.length===1?'':'s'}`;if(!filtered.length){c.innerHTML='<div class="template-library-empty"><strong>No templates in this view</strong><span>Save a workout from the current day to start building your library.</span></div>';return}c.innerHTML=filtered.map((t,i)=>{const data=TP.normalizeDay(t.data||{}),blocks=(data.blocks||[]).filter(b=>(b.exercises||[]).some(e=>String(e.name||'').trim())),exerciseCount=blocks.reduce((n,b)=>n+(b.exercises||[]).filter(e=>String(e.name||'').trim()).length,0),preview=blocks.slice(0,2).map(b=>`${esc(b.name||'Block')} · ${(b.exercises||[]).filter(e=>String(e.name||'').trim()).slice(0,3).map(e=>esc(e.name)).join(' · ')}`).join('\n'),tg=tags(t),date=t.updated_at?new Date(t.updated_at).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'';return `<article class="template-card template-library-card"><div class="template-card-paper"><div class="template-card-brand"><span>TRAINING PLANNER</span><span>${String(i+1).padStart(2,'0')}</span></div><div class="template-card-kicker">${esc(t.category||'Training session')}</div><h3>${esc(t.name||'Untitled template')}</h3><div class="template-card-summary"><span>${blocks.length} block${blocks.length===1?'':'s'}</span><span>${exerciseCount} exercise${exerciseCount===1?'':'s'}</span></div><div class="template-card-preview">${preview?preview.replace(/\n/g,'<br>'):'No exercises saved yet.'}</div>${tg.length?`<div class="template-card-tags">${tg.slice(0,5).map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}</div><div class="template-card-footer"><span>${esc(date)}</span><div class="template-actions"><button class="btn" data-template-use="${t.id}">Use</button><button class="btn" data-template-edit="${t.id}">Edit</button><button class="btn" data-template-duplicate="${t.id}">Duplicate</button><button class="btn danger" data-template-delete="${t.id}">Delete</button></div></div></article>`}).join('')}

  async function saveCurrent(){
    const d=TP.currentDay;
    if(!d||!TP.currentUser){alert('Open a workout and log in first.');return}
    const name=prompt('Template name:',d.focus||'My workout');
    if(!name)return;
    // Clone first so we never mutate the live day the user is editing
    const data=cleanEditorDay(TP.normalizeDay(TP.clone(d)));
    data._tags=normalizeTags($('#template-tags-input')?.value||'');
    const {error}=await TP.supabaseClient().from('workout_templates').insert({user_id:TP.currentUser.id,name:name.trim(),category:data.trainingCategory||null,data,updated_at:new Date().toISOString()});
    if(error){alert(error.message);return}
    if($('#template-tags-input'))$('#template-tags-input').value='';
    await load();
    TP.setStatus('Template saved to library');
  }

  async function createEditor(){if(!TP.currentUser){alert('Log in first to create templates.');return}TP.clearSaveTimer();TP.templateEditorMode=true;TP.templateEditorId=null;TP.selectedDateKey=TP.todayKey();TP.currentDay=cleanEditorDay(TP.normalizeDay(TP.defaultDay()));$('#templates-modal').classList.remove('show');TP.showPage('day-page');TP.renderDay();TP.setStatus('Create template')}
  async function edit(id){const t=TP.templatesCache.find(x=>x.id===id);if(!t)return;TP.clearSaveTimer();TP.templateEditorMode=true;TP.templateEditorId=id;TP.selectedDateKey=TP.todayKey();TP.currentDay=cleanEditorDay(TP.normalizeDay(TP.clone(t.data||{})));$('#templates-modal').classList.remove('show');TP.showPage('day-page');TP.renderDay();TP.setStatus('Edit template')}
  async function saveEditor(){if(!TP.templateEditorMode||!TP.currentDay||!TP.currentUser)return;const existing=TP.templateEditorId?TP.templatesCache.find(x=>x.id===TP.templateEditorId):null,name=prompt('Template name:',existing?.name||TP.currentDay.focus||'My workout');if(name===null||!name.trim())return;const data=cleanEditorDay(TP.normalizeDay(TP.currentDay));const payload={name:name.trim(),category:data.trainingCategory||null,data,updated_at:new Date().toISOString()};const query=TP.templateEditorId?TP.supabaseClient().from('workout_templates').update(payload).eq('id',TP.templateEditorId).eq('user_id',TP.currentUser.id):TP.supabaseClient().from('workout_templates').insert({user_id:TP.currentUser.id,...payload});const {error}=await query;if(error){alert(error.message);return}TP.templateEditorMode=false;TP.templateEditorId=null;await load();TP.showPage('calendar-page');$('#templates-modal').classList.add('show');TP.setStatus('Template saved to library')}
  async function use(id){const t=TP.templatesCache.find(x=>x.id===id);if(!t)return;const date=prompt('Apply template to date (YYYY-MM-DD):',TP.selectedDateKey||TP.todayKey());if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;TP.templateEditorMode=false;TP.templateEditorId=null;TP.selectedDateKey=date;TP.currentDay=TP.normalizeDay(TP.clone(t.data));await TP.saveDay();await TP.openDay(date);$('#templates-modal').classList.remove('show')}

  function templateToast(message){
    const old=document.querySelector('.undo-toast.template-toast');if(old)old.remove();
    const el=document.createElement('div');el.className='undo-toast template-toast';el.textContent=message;document.body.appendChild(el);
    setTimeout(()=>el.remove(),1500);
  }

  async function duplicate(id){
    const t=TP.templatesCache.find(x=>String(x.id)===String(id));if(!t||!TP.currentUser)return;
    const payload={user_id:TP.currentUser.id,name:`${t.name||'Untitled template'} (copy)`,category:t.category||null,data:TP.clone(t.data||{}),updated_at:new Date().toISOString()};
    const {error}=await TP.supabaseClient().from('workout_templates').insert(payload);
    if(error){alert(error.message);return;}
    await load();templateToast('Template duplicado ✓');
  }

  async function remove(id){if(!confirm('Delete this template?'))return;const {error}=await TP.supabaseClient().from('workout_templates').delete().eq('id',id).eq('user_id',TP.currentUser.id);if(error)alert(error.message);else await load()}
  document.addEventListener('click',e=>{const b=e.target.closest('[data-template-duplicate]');if(b)duplicate(b.dataset.templateDuplicate)});

  window.TrainMeiTemplates={load,render,saveCurrent,createEditor,edit,saveEditor,use,remove,duplicate,tags};
})();
