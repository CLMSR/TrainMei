/* TrainMei Exercise Library + conservative workout-name resolver.
   Reads existing history and custom catalogue; never rewrites historical names or workout rows. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const STORE = 'trainmei.exercise-library.v1';
  const MUSCLES = ['Chest','Back','Shoulders','Biceps','Triceps','Quadriceps','Hamstrings','Glutes','Calves','Core','Forearms','Full body'];
  const SEED = [
    ['Bench press',['bench','barbell bench press','bb bench','flat bench press'],'Chest'],
    ['Incline bench press',['incline bench','incline barbell press'],'Chest'],
    ['Dumbbell bench press',['db bench','dumbbell press'],'Chest'],
    ['Push-up',['push up','pushup','press up'],'Chest'],
    ['Cable fly',['cable crossover','cable flyes'],'Chest'],
    ['Back squat',['squat','barbell squat','bb squat','high bar squat'],'Quadriceps'],
    ['Front squat',['front barbell squat'],'Quadriceps'],
    ['Leg press',['45 degree leg press','machine leg press'],'Quadriceps'],
    ['Leg extension',['leg extensions','quad extension'],'Quadriceps'],
    ['Romanian deadlift',['rdl','romanian dl','stiff leg deadlift'],'Hamstrings'],
    ['Deadlift',['conventional deadlift','barbell deadlift','dead lift'],'Back'],
    ['Hip thrust',['barbell hip thrust','glute thrust'],'Glutes'],
    ['Bulgarian split squat',['bulgarian squat','rear foot elevated split squat','rfess'],'Quadriceps'],
    ['Leg curl',['hamstring curl','lying leg curl','seated leg curl'],'Hamstrings'],
    ['Lat pulldown',['lat pull down','pulldown','wide grip pulldown'],'Back'],
    ['Pull-up',['pull up','pullup','chin up'],'Back'],
    ['Seated cable row',['cable row','seated row'],'Back'],
    ['Barbell row',['bent over row','bent-over row','bb row'],'Back'],
    ['Dumbbell row',['db row','one arm row','single arm dumbbell row'],'Back'],
    ['Overhead press',['shoulder press','military press','ohp','barbell shoulder press'],'Shoulders'],
    ['Lateral raise',['side raise','dumbbell lateral raise','lat raise'],'Shoulders'],
    ['Face pull',['facepull','cable face pull'],'Shoulders'],
    ['Biceps curl',['bicep curl','barbell curl','db curl','dumbbell curl'],'Biceps'],
    ['Hammer curl',['neutral grip curl'],'Biceps'],
    ['Triceps pushdown',['triceps pressdown','cable pushdown','rope pushdown'],'Triceps'],
    ['Skull crusher',['lying triceps extension','ez bar skullcrusher'],'Triceps'],
    ['Calf raise',['standing calf raise','seated calf raise','calf raises'],'Calves'],
    ['Plank',['front plank','forearm plank'],'Core'],
    ['Crunch',['ab crunch','cable crunch'],'Core'],
    ['Running',['run','treadmill run','outdoor run'],'Full body'],
    ['Rowing',['row erg','erg row','rowing machine'],'Full body'],
    ['Burpee',['burpees'],'Full body'],
    ['Wall ball',['wall balls','wallball','wall-ball shot'],'Full body'],
    ['Ski erg',['ski ergometer','skiing erg'],'Full body']
  ];
  const norm = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/\b(db|dumbbells?)\b/g,'dumbbell').replace(/\b(bb|barbells?)\b/g,'barbell')
    .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const readCustom = () => { try { const v=JSON.parse(localStorage.getItem(STORE)||'[]'); return Array.isArray(v)?v:[]; } catch { return []; } };
  const writeCustom = v => { try { localStorage.setItem(STORE,JSON.stringify(v)); } catch(e) { console.warn('Exercise catalogue not saved locally',e); } };
  function rawRows() {
    try {
      const core=window.TrainingDataCore;
      const p=core?.training?.();
      if (p && typeof p.then==='function') return p.then(rows=>Array.isArray(rows)?rows:[]);
      if(Array.isArray(p)) return Promise.resolve(p);
    } catch(e) { console.warn('Exercise history unavailable',e); }
    try {
      const tp=window.TrainMeiState||window.__tp;
      const rows=tp?.getRawAnalyticsRows?.()||tp?.getAnalyticsRows?.()||[];
      return Promise.resolve(Array.isArray(rows)?rows:[]);
    } catch { return Promise.resolve([]); }
  }
  function muscleForName(name) {
    try {
      const core=window.TrainingDataCore;
      const m=core?.muscleGroupsForExercise?.({name})||core?.classifyMuscleGroups?.(name)||[];
      if(Array.isArray(m)&&m.length) return m[0];
    } catch {}
    const n=norm(name);
    if(/bench|push up|pushup|chest|fly/.test(n)) return 'Chest';
    if(/squat|leg press|leg extension|lunge|split squat/.test(n)) return 'Quadriceps';
    if(/romanian deadlift|\brdl\b|leg curl|hamstring/.test(n)) return 'Hamstrings';
    if(/hip thrust|glute|kickback/.test(n)) return 'Glutes';
    if(/pulldown|pull up|pullup|row|deadlift|back extension/.test(n)) return 'Back';
    if(/overhead press|shoulder|lateral raise|face pull/.test(n)) return 'Shoulders';
    if(/curl/.test(n)) return 'Biceps';
    if(/triceps|pushdown|skull crusher/.test(n)) return 'Triceps';
    if(/calf|calves/.test(n)) return 'Calves';
    if(/plank|crunch|sit up|ab /.test(n)) return 'Core';
    return '';
  }
  let entries=[], ready=false;
  function addEntry(map, e) {
    const name=String(e?.name||e?.canonicalName||'').trim(); if(!name) return;
    const key=norm(name); if(!key) return;
    const old=map.get(key);
    const aliases=[...(e.aliases||[]),name].map(String).filter(Boolean);
    if(old) { old.count+=Number(e.count)||0; old.sources.add(e.source||'history'); aliases.forEach(a=>old.aliases.add(a)); if(!old.muscle)old.muscle=e.muscle||muscleForName(name); return; }
    map.set(key,{id:e.id||'ex_'+key.replace(/\s/g,'-'),name,muscle:e.muscle||muscleForName(name),aliases:new Set(aliases),count:Number(e.count)||0,sources:new Set([e.source||'history']),custom:!!e.custom});
  }
  async function build() {
    const map=new Map();
    SEED.forEach(([name,aliases,muscle])=>addEntry(map,{name,aliases,muscle,source:'catalog'}));
    readCustom().forEach(e=>addEntry(map,{...e,source:'custom',custom:true}));
    const rows=await rawRows();
    rows.forEach(row=>{
      const d=row?.data||row;
      (d?.blocks||[]).forEach(block=>(block?.exercises||[]).forEach(ex=>{
        const name=String(ex?.name||'').trim(); if(!name)return;
        const n=norm(name);
        // Merge historical spelling variants into a known canonical exercise when an
        // exact alias match exists. Never fuzzy-merge ambiguous history automatically.
        let target=[...map.values()].find(e=>[e.name,...(e.aliases||[])].some(a=>norm(a)===n));
        if(target){
          target.count=(Number(target.count)||0)+1;
          target.aliases=new Set([...(target.aliases||[]),name]);
          target.sources=new Set([...(target.sources||[]),'history']);
          if(!target.muscle)target.muscle=Array.isArray(ex.muscleGroups)&&ex.muscleGroups.length?ex.muscleGroups[0]:muscleForName(name);
        } else {
          const muscle=Array.isArray(ex.muscleGroups)&&ex.muscleGroups.length?ex.muscleGroups[0]:muscleForName(name);
          addEntry(map,{name,muscle,count:1,source:'history'});
        }
      }));
    });
    entries=[...map.values()].map(e=>({...e,aliases:[...e.aliases],sources:[...e.sources]})).sort((a,b)=>a.name.localeCompare(b.name));
    ready=true; render(); updateDatalist();
    document.dispatchEvent(new CustomEvent('trainmei:exercise-library-ready',{detail:{count:entries.length}}));
  }
  function scoreMatch(query,e) {
    const q=norm(query); if(!q)return 0;
    const aliases=[e.name,...e.aliases];
    let best=0;
    aliases.forEach(a=>{
      const n=norm(a); if(!n)return;
      if(n===q)best=Math.max(best,1);
      else if(n.startsWith(q)||q.startsWith(n))best=Math.max(best,.88*Math.min(n.length,q.length)/Math.max(n.length,q.length));
      else if(n.includes(q)||q.includes(n))best=Math.max(best,.72*Math.min(n.length,q.length)/Math.max(n.length,q.length));
      else {
        const qw=q.split(' '), nw=n.split(' ');
        const overlap=qw.filter(w=>nw.includes(w)).length/Math.max(qw.length,nw.length);
        if(overlap>.5)best=Math.max(best,.58*overlap);
      }
    });
    return best;
  }
  function resolve(name) {
    const q=norm(name); if(!q)return null;
    const ranked=entries.map(e=>({e,score:scoreMatch(name,e)})).sort((a,b)=>b.score-a.score);
    const top=ranked[0], next=ranked[1];
    if(!top || top.score<.84 || (next && top.score-next.score<.08 && top.score<.98))return null;
    return {...top.e,matchScore:top.score};
  }
  function updateDatalist() {
    const list=$('#tm-exercise-name-suggestions'); if(!list)return;
    list.innerHTML=entries.map(e=>`<option value="${esc(e.name)}"></option>`).join('');
    document.querySelectorAll('.exercise-name-input').forEach(input=>input.setAttribute('list','tm-exercise-name-suggestions'));
  }
  function exerciseThumb(muscle,name){
    const color=({'Chest':'#d7a28c','Back':'#8fa7b7','Shoulders':'#b7a3d3','Biceps':'#d9bd7c','Triceps':'#92b7a4','Quadriceps':'#c99a8a','Hamstrings':'#a5a9d2','Glutes':'#d69ab2','Calves':'#9dbbb6','Core':'#d2b27d','Forearms':'#a9b9c8','Full body':'#a6b69b'})[muscle]||'#a6b69b';
    return `<div class="exercise-catalog-thumb" aria-label="Illustration for ${esc(name)}"><svg viewBox="0 0 140 78" aria-hidden="true"><rect width="140" height="78" rx="10" fill="${color}" fill-opacity=".22"/><circle cx="70" cy="17" r="6" fill="#8a8e8b"/><path d="M65 26 Q70 23 75 26 L80 45 L73 49 L71 36 L68 36 L66 49 L60 46 Z" fill="${color}" stroke="#6f7772" stroke-width="1.5"/><path d="M64 28 L49 39 L44 35 M76 28 L90 38 L95 34 M64 48 L57 65 M74 48 L82 65" fill="none" stroke="#747b77" stroke-width="5" stroke-linecap="round"/><path d="M24 66 H116" stroke="#9ba39d" stroke-width="2"/></svg></div>`;
  }
  function render() {
    const grid=$('#tm-exlib-results'); if(!grid)return;
    const q=norm($('#tm-exlib-search')?.value), muscle=$('#tm-exlib-muscle')?.value||'', kind=$('#tm-exlib-kind')?.value||'';
    const filtered=entries.filter(e=>{
      const hay=norm([e.name,e.muscle,...e.aliases].join(' '));
      return (!q||hay.includes(q))&&(!muscle||e.muscle===muscle)&&(!kind||e.sources.includes(kind)||(kind==='custom'&&e.custom));
    });
    const summary=$('#tm-exlib-summary'); if(summary)summary.textContent=`${filtered.length} exercises · ${entries.length} total · ${entries.filter(e=>e.sources.includes('history')).length} found in your workout history`;
    grid.innerHTML=filtered.map(e=>`<article class="exercise-catalog-item" data-exlib-id="${esc(e.id)}">${exerciseThumb(e.muscle,e.name)}<div class="exercise-catalog-item-top"><strong>${esc(e.name)}</strong><span class="exercise-catalog-muscle">${esc(e.muscle||'Muscle not classified')}</span></div><small>${e.sources.includes('catalog')?'Catalogue':e.sources.includes('custom')?'Your exercise':'Workout history'}${e.count?` · ${e.count} logged occurrence(s)`:''}</small><div class="exercise-catalog-aliases">${e.aliases.filter(a=>norm(a)!==norm(e.name)).map(esc).join(' · ')||'No aliases'}</div><div class="exercise-catalog-actions"><button type="button" class="btn" data-exlib-edit="${esc(e.id)}">Edit / merge names</button></div></article>`).join('')||'<p class="stats-muted">No exercises match these filters.</p>';
  }

  function editEntry(id) {
    const e=entries.find(x=>String(x.id)===String(id)); if(!e)return;
    const card=document.querySelector(`[data-exlib-id="${CSS.escape(String(id))}"]`); if(!card)return;
    card.querySelector('.exercise-catalog-editor')?.remove();
    const form=document.createElement('form'); form.className='exercise-catalog-editor';
    form.innerHTML=`<label>Canonical name<input name="name" required maxlength="100" value="${esc(e.name)}"></label><label>Aliases / other names<textarea name="aliases" rows="3" maxlength="1200">${esc([...new Set([...(e.aliases||[]).filter(a=>norm(a)!==norm(e.name))])].join(', '))}</textarea><small>Put every alternate name you have used here, separated by commas. This lets TrainMei recognise them as one exercise.</small></label><label>Primary muscle<select name="muscle">${MUSCLES.map(m=>`<option value="${esc(m)}" ${m===e.muscle?'selected':''}>${esc(m)}</option>`).join('')}<option value="" ${!e.muscle?'selected':''}>Unclassified</option></select></label><div class="exercise-catalog-actions"><button class="btn" type="submit">Save changes</button><button class="btn" type="button" data-exlib-cancel>Cancel</button></div>`;
    card.appendChild(form);
    form.addEventListener('submit',ev=>{
      ev.preventDefault();
      const name=form.elements.name.value.trim(); if(!name)return;
      const aliases=form.elements.aliases.value.split(/[,\n;]+/).map(x=>x.trim()).filter(Boolean);
      if(norm(name)!==norm(e.name))aliases.push(e.name);
      const custom=readCustom();
      const idx=custom.findIndex(x=>String(x.id)===String(e.id)||norm(x.name)===norm(e.name));
      const record={id:e.id,name,aliases:[...new Set(aliases.filter(a=>norm(a)!==norm(name)))],muscle:form.elements.muscle.value,custom:true};
      if(idx>=0)custom[idx]=record;else custom.push(record);
      writeCustom(custom);
      build();
    });
    form.querySelector('[data-exlib-cancel]').addEventListener('click',()=>form.remove());
  }
  document.addEventListener('click',e=>{
    const edit=e.target.closest('[data-exlib-edit]'); if(edit){editEntry(edit.dataset.exlibEdit);return;}
    if(e.target.closest('[data-exlib-cancel]'))return;
  });
  function addCustom(ev) {
    ev.preventDefault();
    const name=$('#tm-exlib-new-name')?.value.trim(); if(!name)return;
    const aliases=String($('#tm-exlib-new-aliases')?.value||'').split(',').map(s=>s.trim()).filter(Boolean);
    const muscle=$('#tm-exlib-new-muscle')?.value||'';
    const custom=readCustom();
    const existing=custom.find(e=>norm(e.name)===norm(name));
    if(existing){existing.aliases=[...new Set([...(existing.aliases||[]),...aliases])];existing.muscle=muscle;}
    else custom.push({id:'custom_'+norm(name).replace(/\s/g,'-'),name,aliases,muscle});
    writeCustom(custom);
    $('#tm-exlib-add-form').reset();
    build();
  }
  function attachResolvedMetadata(input) {
    const match=resolve(input.value);
    const bi=Number(input.dataset.parentBlock),ei=Number(input.dataset.exIndex);
    const tp=window.TrainMeiState||window.__tp, day=tp?.currentDay;
    const ex=day?.blocks?.[bi]?.exercises?.[ei];
    if(!match) {
      input.removeAttribute('data-exercise-match');
      input.title='No confident library match yet. Add an alias or classify this exercise in Exercise Library.';
      return;
    }
    input.dataset.exerciseMatch=match.id;
    input.title=`Matched: ${match.name} · ${match.muscle||'muscle unclassified'}`;
    // Keep the typed label and only enrich metadata when the row has no manual muscle override.
    if(ex) {
      ex.exerciseLibraryId=match.id;
      ex.canonicalExerciseName=match.name;
      if(!ex.muscleGroupsManual && (!Array.isArray(ex.muscleGroups)||!ex.muscleGroups.length) && match.muscle) {
        ex.muscleGroups=[match.muscle]; ex.muscleGroupsAuto=true;
      }
      try { window.TrainMeiState?.scheduleSave?.(); window.__tp?.scheduleSave?.(); } catch {}
      try { document.dispatchEvent(new CustomEvent('trainmei:exercise-matched',{detail:{name:input.value,canonicalName:match.name,id:match.id,muscle:match.muscle}})); } catch {}
    }
  }
  document.addEventListener('input',e=>{
    const input=e.target.closest('.exercise-name-input'); if(!input)return;
    if(ready)input.setAttribute('list','tm-exercise-name-suggestions');
  });
  document.addEventListener('change',e=>{const input=e.target.closest('.exercise-name-input');if(input&&ready)attachResolvedMetadata(input);});
  document.addEventListener('focusout',e=>{const input=e.target.closest('.exercise-name-input');if(input&&ready)attachResolvedMetadata(input);});
  document.addEventListener('input',e=>{if(e.target.matches('#tm-exlib-search'))render();});
  document.addEventListener('change',e=>{if(e.target.matches('#tm-exlib-muscle,#tm-exlib-kind'))render();});
  $('#tm-exlib-add-form')?.addEventListener('submit',addCustom);
  build();
  document.addEventListener('trainmei:exercise-library-refresh',build);
  window.TrainMeiExerciseLibrary={list:()=>entries.map(e=>({...e})),resolve,refresh:build};
})();