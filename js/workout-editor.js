/* TrainMei Phase 5 — Workout Editor / Training Block Library */
(()=>{
  const TP=window.TrainMeiState||window.__tp;
  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=x=>TP.clone(x);
  const clean=v=>String(v??'').toLowerCase().replace(/\s+/g,' ').trim();
  const currentDay=()=>TP.currentDay;
  const setDay=v=>{TP.currentDay=v};
  const renderDay=()=>TP.renderDay();
  const scheduleSave=()=>TP.scheduleSave();
  const setStatus=t=>TP.setStatus(t);
  const normalizeSetGroup=g=>({sets:g?.sets??'',reps:g?.reps??'',weight:g?.weight??'',type:g?.type??'Aprox'});
  const syncExerciseLegacyFields=e=>{const f=Array.isArray(e?.setGroups)?e.setGroups[0]:null;if(f&&e){e.sets=f.sets??'';e.reps=f.reps??'';e.weight=f.weight??''}return e};
  const exerciseSetText=e=>TP.exerciseSetText(e);
  const PREFIX='training-planner:';
function getBlockLibrary(){try{return JSON.parse(localStorage.getItem(PREFIX+'block-library')||'[]')}catch{return []}}
function saveBlockLibraryData(arr){localStorage.setItem(PREFIX+'block-library',JSON.stringify(arr))}
function normalizeTags(value){const raw=Array.isArray(value)?value:String(value||'').split(/[,;]+/);return [...new Set(raw.map(x=>String(x).trim().toLowerCase()).filter(Boolean))].slice(0,12)}
function deriveBlockTags(block){const text=clean([block?.name,block?.category,(block?.exercises||[]).map(e=>[e.name,exerciseSetText(e)].join(' ')).join(' ')].join(' '));const tags=new Set();if(/run|running|km/.test(text))tags.add('running');if(/strength|squat|deadlift|bench|press|pull/.test(text))tags.add('strength');if(/hyrox|wall ball|sled|ski erg|row/.test(text))tags.add('hyrox');if(/conditioning|for time|amrap|emom|time cap|burpee/.test(text))tags.add('conditioning');if(/upper|bench|pull|back|chest|shoulder/.test(text))tags.add('upper body');if(/lower|squat|lunge|hamstring|deadlift|glute/.test(text))tags.add('lower body');if(/mobility|stretch/.test(text))tags.add('mobility');if(/recovery/.test(text))tags.add('recovery');return [...tags].slice(0,8)}
function getBlockTags(block){return normalizeTags(block?.tags||deriveBlockTags(block))}
function renderBlockTagFilters(){const el=$('#block-tag-filters');if(!el)return;const tags=[...new Set(getBlockLibrary().flatMap(getBlockTags))].sort();const active=window._trainingPlannerBlockTag||'';el.innerHTML=`<button type="button" class="tag-filter${!active?' active':''}" data-block-tag-filter="">All</button>`+tags.map(t=>`<button type="button" class="tag-filter${active===t?' active':''}" data-block-tag-filter="${esc(t)}">${esc(t)}</button>`).join('')}
function saveBlockLibrary(block, name, tags){if(!block){setStatus('Select a block first');return false}try{const arr=getBlockLibrary();const saved={...clone(block),id:'b_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),name:(name||block.name||'Saved block').trim(),tags:normalizeTags(tags)};arr.unshift(saved);saveBlockLibraryData(arr);renderBlockLibrary();setStatus('Block saved to library');return true}catch(err){console.error(err);setStatus('Could not save block')}}
function saveBlockFromSession(i){const idx=Number.isInteger(i)?i:TP.activeBlockIndex;const block=currentDay()?.blocks?.[idx];if(!block){setStatus('Select a block first');return}TP.activeBlockIndex=idx;const name=($('#block-name-input')?.value||block.name||`Block ${idx+1}`).trim();const tags=$('#block-tags-input')?.value||getBlockTags(block);saveBlockLibrary(clone(block),name,tags);setStatus(`Block ${name} saved to library`)}
function renderBlockLibrary(){const el=$('#block-library-list');if(!el)return;const q=($('#block-library-search')?.value||'').trim().toLowerCase();const activeTag=window._trainingPlannerBlockTag||'';const all=getBlockLibrary();const arr=all.filter(b=>{const hay=(b.name+' '+(b.category||'')+' '+getBlockTags(b).join(' ')+' '+(b.exercises||[]).map(e=>[e.name,exerciseSetText(e)].join(' ')).join(' ')).toLowerCase();return (!q||hay.includes(q))&&(!activeTag||getBlockTags(b).includes(activeTag))});$('#block-library-count').textContent=`${arr.length} block${arr.length===1?'':'s'}`;el.innerHTML=arr.length?arr.map(b=>`<div class="library-card"><div><strong>${esc(b.name)}</strong><div class="library-card-meta">${b.exercises.length} exercises${b.category?' · '+esc(b.category):''}</div><div class="library-card-exercises">${esc(b.exercises.map(e=>e.name).filter(Boolean).slice(0,5).join(' · ')||'Empty block')}</div><div class="library-card-tags">${getBlockTags(b).map(t=>`<span class="library-card-tag">${esc(t)}</span>`).join('')}</div></div><div class="library-card-actions"><button class="btn" data-block-insert="${b.id}">Insert</button><button class="btn danger" data-block-delete="${b.id}">Delete</button></div></div>`).join(''):'<div class="empty-state">No saved blocks match the current search/filter.</div>';renderBlockTagFilters()}
function insertLibraryBlock(id){const b=getBlockLibrary().find(x=>x.id===id);if(!b||!currentDay())return;const copy=clone(b);copy.id='blk_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);copy.name=copy.name||`Block ${currentDay().blocks.length+1}`;currentDay().blocks.push(copy);TP.activeBlockIndex=currentDay().blocks.length-1;renderDay();scheduleSave();$('#block-library-modal').classList.remove('show');setStatus('Block inserted into Training')}
function deleteLibraryBlock(id){const item=getBlockLibrary().find(x=>String(x.id)===String(id));if(!item)return;if(!confirm(`Delete "${item.name||'this block'}" from the library?`))return;saveBlockLibraryData(getBlockLibrary().filter(x=>String(x.id)!==String(id)));renderBlockLibrary();setStatus('Block deleted from library')}
function pasteBlock(){
  if(!currentDay()){setStatus('Open a training day first');return}
  const source=window._trainingPlannerBlock;
  if(!source){setStatus('Copy a block first');return}
  const copy=clone(source);
  copy.id='blk_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
  copy.name=copy.name||`Block ${currentDay().blocks.length+1}`;
  currentDay().blocks.push(copy);
  TP.activeBlockIndex=currentDay().blocks.length-1;
  renderDay();
  scheduleSave();
  setStatus('Block pasted into Training')
}
function copyBlockToClipboard(i){
  if(!currentDay()?.blocks?.[i])return;
  window._trainingPlannerBlock=clone(currentDay().blocks[i]);
  TP.activeBlockIndex=i;
  setStatus('Block copied');
}
function blankExercise(){return {name:'',setGroups:[{sets:'',reps:'',weight:'',type:'Aprox'}],sets:'',reps:'',weight:''}}
function addBlock(){currentDay().blocks.push({id:'blk_'+Date.now(),name:`Block ${currentDay().blocks.length+1}`,category:'Strength',exercises:[blankExercise()]});TP.activeBlockIndex=currentDay().blocks.length-1;renderDay();scheduleSave()}
function addBlockExercise(i){TP.activeBlockIndex=i;currentDay().blocks[i].exercises.push(blankExercise());renderDay();scheduleSave()}
function addSetGroup(bi,ei){const e=currentDay().blocks[bi].exercises[ei];if(!Array.isArray(e.setGroups))e.setGroups=[normalizeSetGroup(e)];e.setGroups.push({sets:'',reps:'',weight:'',type:'Aprox'});syncExerciseLegacyFields(e);TP.activeBlockIndex=bi;window._expandedExercises=window._expandedExercises||{};window._expandedExercises[`${currentDay().blocks[bi].id}:${ei}`]=true;renderDay();scheduleSave()}
function duplicateBlock(i){if(!currentDay()?.blocks?.[i])return;const copy=clone(currentDay().blocks[i]);copy.id='blk_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);copy.name=(copy.name||`Block ${i+1}`)+' copy';currentDay().blocks.splice(i+1,0,copy);TP.activeBlockIndex=i+1;renderDay();scheduleSave()}
function addQuickSet(i){const b=currentDay()?.blocks?.[i];if(!b?.exercises?.length)return;let ei=b.exercises.findIndex(e=>String(e.name||'').trim());if(ei<0)ei=0;addSetGroup(i,ei)}
function removeSetGroup(bi,ei,gi){const e=currentDay().blocks[bi].exercises[ei];if(!Array.isArray(e.setGroups))e.setGroups=[normalizeSetGroup(e)];if(e.setGroups.length<=1){setStatus('Keep at least one set group');return}e.setGroups.splice(gi,1);syncExerciseLegacyFields(e);TP.activeBlockIndex=bi;renderDay();scheduleSave()}
function moveExerciseDrag(fb,fe,tb,te){const x=currentDay().blocks[fb].exercises.splice(fe,1)[0];if(fb===tb&&fe<te)te--;currentDay().blocks[tb].exercises.splice(Math.max(0,te),0,x);TP.activeBlockIndex=tb;renderDay();scheduleSave()}

  window.TrainMeiWorkoutEditor={getBlockLibrary,saveBlockLibraryData,normalizeTags,deriveBlockTags,getBlockTags,renderBlockTagFilters,saveBlockLibrary,saveBlockFromSession,renderBlockLibrary,insertLibraryBlock,deleteLibraryBlock,pasteBlock,copyBlockToClipboard,blankExercise,addBlock,addBlockExercise,addSetGroup,duplicateBlock,addQuickSet,removeSetGroup,moveExerciseDrag};
})();
