/* TrainMei Phase 4 — Templates domain */
(()=>{
  const TP=window.TrainMeiState||window.__tp;const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalizeTags=v=>Array.isArray(v)?[...new Set(v.map(x=>String(x).trim().toLowerCase()).filter(Boolean))].slice(0,12):[...new Set(String(v||'').split(/[,;]+/).map(x=>x.trim().toLowerCase()).filter(Boolean))].slice(0,12);

  /* cleanEditorDay: strips all "lived experience" fields so a template only
     carries the structural plan (title, focus, blocks, conditioning).
     Used by: saveEditor() [was], saveCurrent() [FIX #2], use() [FIX #2]. */
  const cleanEditorDay=d=>{
    d.metrics={distanceKm:'',timeMin:'',pace:'',rpe:'',load:''};
    d.caffeine={taken:false,mg:''};
    d.carbohydratesGrams='';
    d.recovery={sleep:0,energy:0,soreness:0};
    d.completed=false;
    d.restDay=false;
    d.color='';
    d.notes='';
    d.noteTags=[];
    d.sessionFeedback={feelings:'',adjustNextTime:'',nextFocus:'',tags:[],performance:'',energyRating:'',technique:'',pain:'',adjustmentOutcome:''};
    d.previousFeedback=null;
    return d;
  };

  /* FIX #3: validate that the date string is not just a valid format but an
     actual calendar date (e.g. 2025-13-45 passes the regex but is not real). */
  const isRealDate=s=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
    const d=new Date(s+'T12:00:00');
    return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===s;
  };

  async function load(){const user=TP.currentUser;if(!user){TP.templatesCache=[];render();return []}const {data,error}=await TP.supabaseClient().from('workout_templates').select('*').eq('user_id',user.id).order('updated_at',{ascending:false});const list=error?[]:(data||[]);TP.templatesCache=list;render();return list}
  function tags(t){return normalizeTags(t?.data?._tags||t?.tags||[])}
    function render(){
    const c=$('#template-list');
    if(!c)return;
    const q=($('#template-search')?.value||'').trim().toLowerCase();
    const cache=TP.templatesCache;
    const filtered=cache.filter(t=>{
      const tg=tags(t);
      return !q||(t.name+' '+(t.category||'')+' '+tg.join(' ')).toLowerCase().includes(q);
    });
    const count=$('#template-library-count');
    if(count)count.textContent=`${filtered.length} template${filtered.length===1?'':'s'}`;
    if(!filtered.length){
      c.innerHTML='<div class="template-library-empty"><strong>No templates in this view</strong><span>Save a workout from the current day to start building your library.</span></div>';
      return;
    }
    c.innerHTML=filtered.map((t,i)=>{
      const data=TP.normalizeDay(t.data||{});
      const blocks=(data.blocks||[]).filter(b=>(b.exercises||[]).some(e=>String(e.name||'').trim()));
      const exerciseCount=blocks.reduce((n,b)=>n+(b.exercises||[]).filter(e=>String(e.name||'').trim()).length,0);
      const tg=tags(t);
      const date=t.updated_at?new Date(t.updated_at).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'';
      const category=t.category||data.trainingCategory||'Training session';

      /* Preview estructurada por bloque — no texto plano */
      const previewHTML=blocks.slice(0,2).map(block=>{
        const exNames=(block.exercises||[])
          .filter(e=>String(e.name||'').trim())
          .slice(0,4)
          .map(e=>esc(e.name))
          .join(' · ');
        const more=(block.exercises||[]).filter(e=>String(e.name||'').trim()).length-4;
        return `<div class="template-card-block">
          <div class="template-card-block-head">
            <span class="template-card-block-dot"></span>
            <strong>${esc(block.name||'Block')}</strong>
          </div>
          <div class="template-card-block-body">${exNames||'—'}${more>0?` <em>+${more}</em>`:''}</div>
        </div>`;
      }).join('');

      return `<article class="template-card template-library-card" data-template-id="${t.id}">
        <div class="template-card-paper">
          <div class="template-card-top">
            <span class="template-card-dot" aria-hidden="true"></span>
            <span class="template-card-category">${esc(category)}</span>
            <button type="button" class="template-card-menu" data-template-menu="${t.id}" aria-label="Template actions">⋯</button>
          </div>
          <h3>${esc(t.name||'Untitled template')}</h3>
          <div class="template-card-summary">
            <span>${blocks.length} block${blocks.length===1?'':'s'}</span>
            <span>${exerciseCount} exercise${exerciseCount===1?'':'s'}</span>
          </div>
          <div class="template-card-preview">${previewHTML||'<div class="template-card-preview-empty">No exercises saved yet.</div>'}</div>
          ${tg.length?`<div class="template-card-tags">${tg.slice(0,4).map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}
        </div>
        <div class="template-card-footer">
          <button type="button" class="btn template-use-btn" data-template-use="${t.id}">Use template</button>
          <span class="template-card-date">${esc(date)}</span>
          <div class="template-card-actions-popover" data-template-actions="${t.id}" hidden>
            <button type="button" class="btn" data-template-edit="${t.id}">Edit</button>
            <button type="button" class="btn" data-template-duplicate="${t.id}">Duplicate</button>
            <button type="button" class="btn danger" data-template-delete="${t.id}">Delete</button>
          </div>
        </div>
      </article>`;
    }).join('');
  }

  /* FIX #2a: saveCurrent — clone first, then clean so TP.currentDay is untouched. */
  async function saveCurrent(){
    const d=TP.currentDay;
    if(!d||!TP.currentUser){alert('Open a workout and log in first.');return}
    const name=prompt('Template name:',d.focus||'My workout');
    if(!name)return;
    const data=cleanEditorDay(TP.normalizeDay(TP.clone(d)));
    data._tags=normalizeTags($('#template-tags-input')?.value||'');
    const {error}=await TP.supabaseClient().from('workout_templates').insert({user_id:TP.currentUser.id,name:name.trim(),category:data.trainingCategory||null,data,updated_at:new Date().toISOString()});
    if(error){alert(error.message);return}
    if($('#template-tags-input'))$('#template-tags-input').value='';
    await load();TP.setStatus('Template saved to library');
  }

  async function createEditor(){if(!TP.currentUser){alert('Log in first to create templates.');return}TP.clearSaveTimer();TP.templateEditorMode=true;TP.templateEditorId=null;TP.selectedDateKey=TP.todayKey();TP.currentDay=cleanEditorDay(TP.normalizeDay(TP.defaultDay()));$('#templates-modal').classList.remove('show');TP.showPage('day-page');TP.renderDay();TP.setStatus('Create template')}
  async function edit(id){const t=TP.templatesCache.find(x=>x.id===id);if(!t)return;TP.clearSaveTimer();TP.templateEditorMode=true;TP.templateEditorId=id;TP.selectedDateKey=TP.todayKey();TP.currentDay=cleanEditorDay(TP.normalizeDay(TP.clone(t.data||{})));$('#templates-modal').classList.remove('show');TP.showPage('day-page');TP.renderDay();TP.setStatus('Edit template')}
  async function saveEditor(){if(!TP.templateEditorMode||!TP.currentDay||!TP.currentUser)return;const existing=TP.templateEditorId?TP.templatesCache.find(x=>x.id===TP.templateEditorId):null,name=prompt('Template name:',existing?.name||TP.currentDay.focus||'My workout');if(name===null||!name.trim())return;const data=cleanEditorDay(TP.normalizeDay(TP.currentDay));const payload={name:name.trim(),category:data.trainingCategory||null,data,updated_at:new Date().toISOString()};const query=TP.templateEditorId?TP.supabaseClient().from('workout_templates').update(payload).eq('id',TP.templateEditorId).eq('user_id',TP.currentUser.id):TP.supabaseClient().from('workout_templates').insert({user_id:TP.currentUser.id,...payload});const {error}=await query;if(error){alert(error.message);return}TP.templateEditorMode=false;TP.templateEditorId=null;await load();TP.showPage('calendar-page');$('#templates-modal').classList.add('show');TP.setStatus('Template saved to library')}

  /* FIX #2b + #3: use() — apply cleanEditorDay so old templates with stale feedback
     don't contaminate new days; also validate the date is a real calendar date. */
  async function use(id){
    const t=TP.templatesCache.find(x=>x.id===id);if(!t)return;
    const date=prompt('Apply template to date (YYYY-MM-DD):',TP.selectedDateKey||TP.todayKey());
    if(!isRealDate(date))return;
    TP.templateEditorMode=false;TP.templateEditorId=null;TP.selectedDateKey=date;
    TP.currentDay=cleanEditorDay(TP.normalizeDay(TP.clone(t.data)));
    await TP.saveDay();await TP.openDay(date);$('#templates-modal').classList.remove('show');
  }

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
  
    /* Toggle del menú ⋯ de cada template (revela Edit / Duplicate / Delete) */
  document.addEventListener('click',e=>{
    const menuBtn=e.target.closest('[data-template-menu]');
    if(menuBtn){
      e.preventDefault();
      e.stopPropagation();
      const id=menuBtn.dataset.templateMenu;
      const pop=document.querySelector(`[data-template-actions="${id}"]`);
      if(!pop)return;
      /* Cierra cualquier otro menú abierto */
      document.querySelectorAll('[data-template-actions]').forEach(el=>{ if(el!==pop) el.hidden=true; });
      pop.hidden=!pop.hidden;
      return;
    }
    /* Click fuera → cierra todos los menús */
    if(!e.target.closest('[data-template-actions]')){
      document.querySelectorAll('[data-template-actions]').forEach(el=>{ el.hidden=true; });
    }
  });
  
    /* ============================================================
     Cierre automático del modal de Templates al navegar.
     Cubre:
       - Botones de la topbar con [data-page] (Home, Calendar, Plan, Integrations…)
       - Botones del menú iOS [data-ios-page]
       - Botones "Templates" que abren el modal desde otra parte
       - Botones "Add" del tabbar iOS (id="ios-add-tab")
     No interfiere con la navegación normal: se ejecuta en fase de captura
     y sólo actúa si el modal está abierto.
     ============================================================ */
  (function bindTemplatesAutoClose(){
    if(window.__tpTemplatesAutoCloseBound)return;
    window.__tpTemplatesAutoCloseBound=true;

    const MODAL_ID='templates-modal';
    const closeTemplatesModal=()=>{
      const m=document.getElementById(MODAL_ID);
      if(m&&m.classList.contains('show'))m.classList.remove('show');
    };

    document.addEventListener('click',(e)=>{
      const modal=document.getElementById(MODAL_ID);
      if(!modal||!modal.classList.contains('show'))return;

      /* 1) Cualquier botón de la topbar con data-page (excepto nada especial) */
      const navTopbar=e.target.closest('#main-nav .btn[data-page]');
      if(navTopbar){ closeTemplatesModal(); return; }

      /* 2) Botones del ios-tabbar */
      const iosTab=e.target.closest('.ios-tab[data-ios-page]');
      if(iosTab){ closeTemplatesModal(); return; }

      /* 3) Tab "Add" del iOS tabbar */
      if(e.target.closest('#ios-add-tab')){ closeTemplatesModal(); return; }

      /* 4) Botones "Templates" que están dentro del modal — ignorar
            (esos son los que abren/usan el propio modal) */
      if(e.target.closest('#templates-modal'))return;

      /* 5) Botones con data-home-page que llevan a otra página
            (por ejemplo "Templates" dentro de home-next-card apunta
            a "templates-modal", ese caso no debe cerrar) */
      const hp=e.target.closest('[data-home-page]');
      if(hp){
        const target=hp.dataset.homePage;
        if(target&&target!=='templates-modal'){ closeTemplatesModal(); }
        return;
      }

      /* 6) Botones con data-home-action (por ejemplo "scan", "quick-add")
            que navegan fuera de la home */
      const ha=e.target.closest('[data-home-action]');
      if(ha){
        const act=ha.dataset.homeAction;
        /* Sólo cerramos si la acción NO es la que abre templates */
        if(act&&act!=='templates'){ closeTemplatesModal(); }
        return;
      }

      /* 7) Botones con data-smart-back (volver a Smart Integrations) */
      if(e.target.closest('[data-smart-back]')){ closeTemplatesModal(); return; }
    },true /* useCapture: se dispara antes que los handlers normales */);

    /* Cerrar también si cambia el hash o se pulsa Escape */
    document.addEventListener('keydown',(e)=>{
      if(e.key!=='Escape')return;
      closeTemplatesModal();
    });
  })();
  window.TrainMeiTemplates={load,render,saveCurrent,createEditor,edit,saveEditor,use,remove,duplicate,tags};
})();
