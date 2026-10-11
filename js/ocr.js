/* ===== SMART INTEGRATIONS OCR — structure-aware workout import ===== */
(function () {
  'use strict';
  const OCRKEY = 'training-planner:smart-imports';
  let reviewWorkout = null, reviewSourceText = '', reviewConfidence = [], smartFileName = '';
  const $i = s => document.querySelector(s);
  const escI = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cleanI = s => String(s ?? '').replace(/[\u00a0\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  const readImports = () => { try { return JSON.parse(localStorage.getItem(OCRKEY) || '[]'); } catch { return []; } };
  const saveImports = a => localStorage.setItem(OCRKEY, JSON.stringify(a.slice(0, 12)));

  function canonicalOCR(name) {
    const n = cleanI(name).replace(/[|¦]/g, 'I');
    const c = n.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const map = {
      'rdl':'RDL','romanian deadlift':'RDL','romanian dl':'RDL','peso muerto rumano':'RDL',
      'back squat':'Back Squat','squat':'Back Squat','sentadilla':'Back Squat',
      'bench press':'Bench Press','press banca':'Bench Press','wall ball':'Wall Balls','wall balls':'Wall Balls',
      'kb swing':'KB Swings','kb swings':'KB Swings','kettlebell swing':'KB Swings','devil press':'Devil Press',
      'burpee':'Burpee','row':'Row','rowing':'Row','overhead lunge':'Overhead Lunges','walking lunge':'Walking Lunges',
      'plank pull through':'Plank Pull Through','weighted sit up':'Weighted Sit Up','weighted sit ups':'Weighted Sit Up',
      'around the world lunge':'Around the World Lunge','plate thruster':'Plate Thruster','run':'Run','running':'Run',
      'lying leg curl':'Lying Leg Curl','seated leg curl':'Seated Leg Curl','leg press':'Leg Press',
      'incline dumbbell press':'Incline Dumbbell Press','incline db press':'Incline Dumbbell Press'
    };
    return map[c] || n.replace(/\s{2,}/g, ' ');
  }
  function normalizeOCRSet(g) {
    return { sets:String(g?.sets ?? ''), reps:String(g?.reps ?? ''), weight:String(g?.weight ?? ''), type:g?.type || 'Aprox' };
  }
  function makeExercise(name, groups) {
    const gs = (groups && groups.length ? groups : [{}]).map(normalizeOCRSet);
    return { name:canonicalOCR(name), originalName:cleanI(name), setGroups:gs, sets:gs[0].sets, reps:gs[0].reps, weight:gs[0].weight };
  }
  function blankWorkout() {
    return {focus:'Imported workout',trainingCategory:'Garmin Import',blocks:[],isRunDay:false,
      runningRowing:{type:'Run',warmUp:{duration:'',details:''},mainSet:'',coolDown:{duration:'',details:''},blocks:[]},
      metrics:{distanceKm:'',timeMin:''},caffeine:{taken:false,mg:''},recovery:{sleep:0,energy:0,soreness:0},
      completed:false,notes:'',noteTags:[],importMeta:{source:'Garmin OCR'}};
  }
  function parseType(s) {
    const c = cleanI(s).toLowerCase();
    if (/\bds\b|drop/.test(c)) return 'DS';
    if (/\bts\b|top\s*set/.test(c)) return 'TS';
    if (/\bapprox?\b|\baprox\b|\baprx\b/.test(c)) return 'Aprox';
    return '';
  }
  function normNum(s) { return String(s ?? '').replace(',', '.').trim(); }
  function parseSetLine(line) {
    const s = cleanI(line).replace(/[|¦]/g, '1');
    let m = s.match(/^(\d{1,2})\s*[x×]\s*(\d{1,3}(?:[.,]\d+)?)\s*(?:(?:@|at|x|×)\s*)?(\d{1,3}(?:[.,]\d+)?)?\s*(kg|kgs|lb|lbs)?\s*(Aprox|Approx|TS|DS|Drop\s*set|Top\s*set)?$/i);
    if (m) return {sets:normNum(m[1]),reps:normNum(m[2]),weight:normNum(m[3] || ''),type:parseType(m[5]) || 'Aprox'};
    m = s.match(/^(\d{1,3}(?:[.,]\d+)?)\s*(?:reps?|repetitions?)\s*(?:x|×|@|at|\/|[-–])\s*(\d{1,3}(?:[.,]\d+)?)\s*(kg|kgs|lb|lbs)?\s*(Aprox|Approx|TS|DS)?$/i);
    if (m) return {sets:'1',reps:normNum(m[1]),weight:normNum(m[2]),type:parseType(m[4]) || 'Aprox'};
    m = s.match(/^(\d{1,2})\s+(\d{1,3}(?:[.,]\d+)?)\s+(\d{1,3}(?:[.,]\d+)?)\s*(kg|kgs|lb|lbs)?\s*(Aprox|Approx|TS|DS|Drop\s*set|Top\s*set)?$/i);
    if (m) return {sets:normNum(m[1]),reps:normNum(m[2]),weight:normNum(m[3]),type:parseType(m[5]) || 'Aprox'};
    m = s.match(/^(\d{1,3}(?:[.,]\d+)?)\s*(kg|kgs|lb|lbs)\s*(?:x|×)?\s*(\d{1,3}(?:[.,]\d+)?)?\s*(?:reps?)?\s*(Aprox|Approx|TS|DS)?$/i);
    if (m) return {sets:'1',reps:normNum(m[3] || ''),weight:normNum(m[1]),type:parseType(m[4]) || 'Aprox'};
    return null;
  }
  function looksLikeHeading(line) {
    const s = cleanI(line).toLowerCase();
    return /^(?:exercise|workout|training|strength|conditioning|hyrox|running|run|lower body|upper body|warm[ -]?up|cool[ -]?down|notes?|sets?|reps?|weight|load|rest|rounds?)\s*:?(?:\s*\d+)?$/i.test(s);
  }
  function looksLikeExerciseName(line) {
    const s = cleanI(line).replace(/^[•·*\-–—]+\s*/, '').replace(/^\d+[.)]\s*/, '');
    if (s.length < 3 || s.length > 72 || !/[A-Za-zÀ-ÿ]/.test(s)) return false;
    if (looksLikeHeading(s)) return false;
    if (/^(?:block|bloc|superset|giant set|circuit|round|rounds|emom|amrap|for time|rest|recovery|distance|pace|ritmo|time cap)\b/i.test(s)) return false;
    if (/^(?:\d{1,2}:\d{2}|\d+(?:[.,]\d+)?\s*(?:km|mi|miles?))\b/i.test(s)) return false;
    return true;
  }
  function exerciseFromInline(line) {
    const s = cleanI(line).replace(/^[•·*\-–—]+\s*/, '').replace(/^\d+[.)]\s*/, '');
    const re = /^(.{2,72}?)\s+(\d{1,2})\s*[x×]\s*(\d{1,3}(?:[.,]\d+)?)\s*(?:(?:@|at|x|×)\s*)?(\d{1,3}(?:[.,]\d+)?)?\s*(kg|kgs|lb|lbs)?\s*(.*)$/i;
    const m = s.match(re);
    if (m && /[A-Za-zÀ-ÿ]/.test(m[1])) {
      const name=cleanI(m[1]).replace(/[:|]+$/,'');
      if(name && !looksLikeHeading(name)) return {name,group:{sets:normNum(m[2]),reps:normNum(m[3]),weight:normNum(m[4] || ''),type:parseType(m[6]) || 'Aprox'}};
    }
    // Some OCR layouts split a table into columns; after coordinate-merging the row looks like "Bench Press 3 10 40 kg".
    const table=s.match(/^(.{2,64}?)\s+(\d{1,2})\s+(\d{1,3}(?:[.,]\d+)?)\s+(\d{1,3}(?:[.,]\d+)?)\s*(kg|kgs|lb|lbs)?$/i);
    if(table && /[A-Za-zÀ-ÿ]/.test(table[1]) && !looksLikeHeading(table[1])) return {name:cleanI(table[1]),group:{sets:normNum(table[2]),reps:normNum(table[3]),weight:normNum(table[4]),type:'Aprox'}};
    return null;
  }
  function sameExercise(a,b) { return cleanI(a).toLowerCase().replace(/[^a-z0-9]+/g,'') === cleanI(b).toLowerCase().replace(/[^a-z0-9]+/g,''); }
  function parseOCRText(text, structuredLines) {
    let rawLines = Array.isArray(structuredLines) && structuredLines.length
      ? structuredLines.map((x,i)=>({text:cleanI(typeof x === 'string' ? x : x.text),bbox:x.bbox || {y0:i*20,y1:i*20+18,x0:0,x1:1000},confidence:Number(x.confidence ?? 0)})).filter(x=>x.text)
      : String(text || '').split(/\n+/).map((s,i)=>({text:cleanI(s),bbox:{y0:i*20,y1:i*20+18,x0:0,x1:1000},confidence:0})).filter(x=>x.text);
    rawLines.sort((a,b)=>(Number(a.bbox?.y0)||0)-(Number(b.bbox?.y0)||0) || (Number(a.bbox?.x0)||0)-(Number(b.bbox?.x0)||0));
    if (Array.isArray(structuredLines) && structuredLines.length) {
      const merged=[];
      for (const item of rawLines) {
        const box=item.bbox||{}, y0=Number(box.y0)||0, y1=Number(box.y1)||y0+12, center=(y0+y1)/2, height=Math.max(8,y1-y0);
        const prev=merged[merged.length-1], pb=prev?.bbox||{}, py0=Number(pb.y0)||0, py1=Number(pb.y1)||py0+12, pc=(py0+py1)/2, ph=Math.max(8,py1-py0);
        if (prev && Math.abs(center-pc)<=Math.max(5,Math.min(height,ph)*0.55)) {
          prev.text=cleanI(`${prev.text} ${item.text}`); prev.bbox={x0:Math.min(Number(pb.x0)||0,Number(box.x0)||0),x1:Math.max(Number(pb.x1)||0,Number(box.x1)||0),y0:Math.min(y0,py0),y1:Math.max(y1,py1)}; prev.confidence=(prev.confidence+item.confidence)/2;
        } else merged.push({...item});
      }
      rawLines=merged;
    }
    const w = blankWorkout(), warnings = [], blocks = [];
    let block = {name:'Block 1',category:'Strength',exercises:[]}, pendingName = '', lastExercise = null, runBlock = null;
    const ensureBlock = () => { if (!block) block={name:`Block ${blocks.length+1}`,category:'Strength',exercises:[]}; };
    const flushBlock = () => { if (block && block.exercises.length) blocks.push(block); block=null; lastExercise=null; pendingName=''; };
    const addExercise = (name, group) => {
      ensureBlock(); const canonical = canonicalOCR(name); const last = block.exercises[block.exercises.length-1];
      if (last && sameExercise(last.name, canonical)) { last.setGroups.push(normalizeOCRSet(group)); lastExercise=last; }
      else { const ex=makeExercise(name,[group || {}]); block.exercises.push(ex); lastExercise=ex; }
      pendingName='';
    };
    const addHeaderBlock = (name, category) => { flushBlock(); block={name:name || `Block ${blocks.length+1}`,category:category || 'Strength',exercises:[]}; };
    for (let i=0;i<rawLines.length;i++) {
      const line = rawLines[i].text;
      const low = line.toLowerCase();
      if (!line) continue;
      const blockHeader = line.match(/^(?:(?:block|bloc)\s*(?:[a-z0-9]+)?|superset\s*(?:[a-z0-9]+)?|giant\s*set\s*(?:[a-z0-9]+)?|circuit\s*(?:[a-z0-9]+)?|round\s*\d+)\s*[:\-–]?$/i);
      if (blockHeader) { addHeaderBlock(cleanI(line.replace(/[:\-–]+$/,'')), /superset|giant set/i.test(line)?'Superset':/circuit|round/i.test(line)?'Conditioning':'Strength'); continue; }
      const category = line.match(/^(strength|conditioning|hyrox|running|run|lower body|upper body|warm[ -]?up|cool[ -]?down)\s*:?[ ]*$/i);
      if (category) {
        const cat = category[1];
        if (block && block.exercises.length) addHeaderBlock(cat, /run|running/i.test(cat)?'Running':/conditioning|hyrox/i.test(cat)?'Conditioning':'Strength');
        else { ensureBlock(); block.name=cat; block.category=/run|running/i.test(cat)?'Running':/conditioning|hyrox/i.test(cat)?'Conditioning':'Strength'; }
        continue;
      }
      const run = line.match(/(\d+(?:[.,]\d+)?)\s*km\s*(?:run)?\s*(?:@|at|pace)?\s*(\d{1,2}[:.]\d{2})\s*(?:min\s*\/\s*km|\/\s*km|km)?/i);
      if (run) {
        flushBlock(); runBlock={name:'Run',category:'Running',exercises:[makeExercise('Run',[{sets:'1',reps:normNum(run[1])+' km',weight:run[2].replace('.',':'),type:'Aprox'}])]};
        blocks.push(runBlock); runBlock=null; w.isRunDay=true; w.metrics.distanceKm=normNum(run[1]); lastExercise=null; continue;
      }
      const dist = low.match(/(?:distance|dist(?:ance)?)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*km/);
      if (dist) { w.metrics.distanceKm=normNum(dist[1]); continue; }
      const pace = low.match(/(?:pace|ritmo)\s*[:\-]?\s*(\d{1,2}[:.]\d{2})/);
      if (pace) { const runEx=blocks.flatMap(b=>b.exercises||[]).find(e=>/^run$/i.test(e.name)); if(runEx?.setGroups?.[0])runEx.setGroups[0].weight=pace[1].replace('.',':'); continue; }
      const inline = exerciseFromInline(line);
      if (inline) { addExercise(inline.name,inline.group); continue; }
      const set = parseSetLine(line);
      if (set && pendingName) { addExercise(pendingName,set); continue; }
      if (set && lastExercise) { lastExercise.setGroups.push(normalizeOCRSet(set)); continue; }
      if (set) { warnings.push(`Set row without a confidently identified exercise: “${line.slice(0,70)}”.`); continue; }
      if (/^(?:rest|recovery|warm[ -]?up|cool[ -]?down|notes?)\b/i.test(line)) { pendingName=''; continue; }
      if (looksLikeExerciseName(line)) {
        if (pendingName) {
          // The previous name had no readable metrics; preserve it as an editable exercise rather than merging names.
          addExercise(pendingName,{});
          warnings.push(`No set details were confidently detected for “${pendingName}”.`);
        }
        pendingName=line.replace(/^[•·*\-–—]+\s*/,'').replace(/^\d+[.)]\s*/,'').replace(/[:|]+$/,'');
        lastExercise=null;
        continue;
      }
      // Keep OCR uncertainty visible, but don't turn arbitrary numeric text into a fake exercise.
      if (/\d/.test(line) && !set && !inline && !/^(?:page|total|duration|time|date)\b/i.test(line)) {
        warnings.push(`Could not confidently assign this line: “${line.slice(0,70)}”.`);
      }
    }
    if (pendingName) { addExercise(pendingName,{}); warnings.push(`No set details were confidently detected for “${pendingName}”.`); }
    flushBlock();
    w.blocks = blocks;
    if (!w.blocks.length) {
      warnings.push('No structured exercise rows were confidently detected. Add or correct the exercises manually before importing.');
      w.blocks=[{name:'Block 1',category:'Imported',exercises:[makeExercise('Check exercise',[{sets:'',reps:'',weight:'',type:'Aprox'}])]}];
    }
    w.focus = w.blocks.length===1 && w.blocks[0].category==='Running' ? 'Run' : 'Imported workout';
    reviewConfidence = rawLines.map(x=>({line:x.text,ok:/\d/.test(x.text)&&(/[x×]/.test(x.text)||/km/i.test(x.text)),confidence:x.confidence}));
    return {workout:w,warnings:[...new Set(warnings)],lines:rawLines};
  }
  async function loadTesseract() {
    if (window.Tesseract) return window.Tesseract;
    return new Promise((resolve,reject)=>{const sc=document.createElement('script');sc.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';sc.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(new Error('OCR engine unavailable'));sc.onerror=()=>reject(new Error('Could not load the OCR engine. Check your connection and try again.'));document.head.appendChild(sc);});
  }
  async function preprocess(file) {
    return new Promise((resolve,reject)=>{
      const r=new FileReader(); r.onerror=()=>reject(new Error('Could not read the screenshot.'));
      r.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error('Could not decode the screenshot.'));img.onload=()=>{
        const max=2600, minSide=1400, naturalMax=Math.max(img.naturalWidth,img.naturalHeight);
        const scale=Math.min(max/naturalMax, naturalMax<minSide?2:1);
        const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));
        const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.filter='grayscale(1) contrast(1.22)';x.drawImage(img,0,0,c.width,c.height);x.filter='none';
        // A mild sharpening pass helps small UI text without thresholding away thin characters.
        try { const d=x.getImageData(0,0,c.width,c.height), src=d.data, copy=new Uint8ClampedArray(src); const w=c.width,h=c.height;
          for(let y=1;y<h-1;y++)for(let xx=1;xx<w-1;xx++){const p=(y*w+xx)*4;for(let ch=0;ch<3;ch++){const v=copy[p+ch]*1.12-(copy[p-4+ch]+copy[p+4+ch]+copy[p-w*4+ch]+copy[p+w*4+ch])*0.03;src[p+ch]=Math.max(0,Math.min(255,v));}}
          x.putImageData(d,0,0);
        } catch (_) { /* ImageData may be unavailable on constrained browsers; grayscale image remains valid. */ }
        resolve(c.toDataURL('image/png'));
      };img.src=r.result;};r.readAsDataURL(file);
    });
  }
  function lineRecords(data) {
    const lines=Array.isArray(data?.lines)?data.lines:[];
    return lines.map(l=>({text:cleanI(l.text),bbox:l.bbox||{},confidence:Number(l.confidence||0)})).filter(l=>l.text);
  }
  async function analyzeSmartScreenshot() {
    const f=$i('#smart-screenshot-file')?.files?.[0]; if(!f)return;
    smartFileName=f.name; const status=$i('#smart-status'); if(status)status.textContent='Preparing screenshot…';
    if($i('#smart-preview-wrap'))$i('#smart-preview-wrap').hidden=false;
    const reader=new FileReader();reader.onload=()=>{if($i('#smart-preview'))$i('#smart-preview').src=reader.result;};reader.readAsDataURL(f);
    let worker=null;
    try {
      const image=await preprocess(f); if(status)status.textContent='Loading OCR engine…';
      const T=await loadTesseract(); if(status)status.textContent='Reading screenshot…';
      worker=await T.createWorker('eng');
      try { await worker.setParameters({preserve_interword_spaces:'1'}); } catch (_) {}
      const res=await worker.recognize(image); const text=res.data?.text||''; const structured=lineRecords(res.data);
      const parsed=parseOCRText(text,structured); reviewSourceText=text; reviewWorkout=parsed.workout;
      reviewWorkout.importMeta={source:'Garmin OCR',fileName:f.name,importedAt:new Date().toISOString()};
      reviewWorkout._ocrWarnings=parsed.warnings; reviewWorkout._ocrConfidence=res.data?.confidence||0; reviewWorkout._ocrSourceText=text;
      renderSmartReview(); saveRecentImport(reviewWorkout,f.name);
      if(status)status.textContent=`Detected ${countExercises(reviewWorkout)} exercises · ${countSets(reviewWorkout)} set rows · review before import`;
    } catch(err) { console.error(err); if(status)status.textContent=err.message||'OCR failed'; }
    finally { if(worker)try{await worker.terminate();}catch(_){} }
  }
  function countExercises(w){return (w.blocks||[]).reduce((n,b)=>n+(b.exercises||[]).filter(e=>e.name).length,0);}
  function countSets(w){return (w.blocks||[]).reduce((n,b)=>n+(b.exercises||[]).reduce((s,e)=>s+(e.setGroups||[]).length,0),0);}
  function syncLegacy(e){const g=e?.setGroups?.[0]||{};e.sets=g.sets??'';e.reps=g.reps??'';e.weight=g.weight??'';}
  function renderSmartReview(){
    const w=reviewWorkout;if(!w)return;const summary=$i('#smart-review-summary'),content=$i('#smart-review-content');if(!summary||!content)return;
    const ex=countExercises(w),sets=countSets(w),conf=Math.round(w._ocrConfidence||0);
    summary.innerHTML=`<span>${w.blocks.length} blocks</span><span>${ex} exercises</span><span>${sets} set rows</span><span>${conf>=80?'High confidence':'Check values'}</span>`;
    const warn=w._ocrWarnings||[],box=$i('#smart-review-warning');if(box){box.hidden=!warn.length;box.textContent=warn.length?`Review before importing: ${warn.join(' ')}`:'';}
    content.innerHTML=(w.blocks||[]).map((b,bi)=>`<section class="smart-review-block" data-rblock="${bi}">
      <div class="smart-review-block-head"><div class="smart-review-block-title"><input data-rblock-name value="${escI(b.name||`Block ${bi+1}`)}" aria-label="Block name"><small>${escI(b.category||'Strength')}</small></div><div class="smart-review-block-tools"><button type="button" class="btn" data-rblock-merge-next ${bi===w.blocks.length-1?'disabled':''}>Merge next</button><button type="button" class="btn" data-rblock-remove>Remove block</button></div></div>
      ${(b.exercises||[]).map((e,ei)=>`<article class="smart-review-exercise-card" data-ex-card data-ei="${ei}">
        <div class="smart-review-exercise-head"><label>Exercise <input class="ex-name" data-rex-name value="${escI(e.name)}" title="Original OCR: ${escI(e.originalName||e.name)}"></label>
          <div class="smart-review-exercise-tools"><button type="button" class="btn" data-ex-up aria-label="Move exercise up" ${ei===0?'disabled':''}>↑</button><button type="button" class="btn" data-ex-down aria-label="Move exercise down" ${ei===(b.exercises.length-1)?'disabled':''}>↓</button><button type="button" class="btn" data-ex-remove>Remove</button><button type="button" class="btn" data-ex-split ${ei===b.exercises.length-1?'disabled':''}>Split here</button></div></div>
        <div class="smart-review-labels"><span>Set group</span><span>Sets</span><span>Reps</span><span>Weight</span><span>Type</span><span></span></div>
        ${(e.setGroups||[]).map((g,gi)=>`<div class="smart-review-ex smart-review-set-row" data-rex="${bi}:${ei}:${gi}"><span class="smart-review-set-index">${gi+1}</span><input data-rex-sets aria-label="Sets" value="${escI(g.sets)}"><input data-rex-reps aria-label="Reps" value="${escI(g.reps)}"><input data-rex-weight aria-label="Weight" value="${escI(g.weight)}"><select data-rex-type aria-label="Set type"><option ${g.type==='Aprox'?'selected':''}>Aprox</option><option ${g.type==='TS'?'selected':''}>TS</option><option ${g.type==='DS'?'selected':''}>DS</option></select><button type="button" class="btn" data-rex-remove aria-label="Remove set group">×</button></div>`).join('')}
        <div class="smart-review-add smart-review-ex-tools"><button type="button" class="btn" data-rex-add>Add set group</button><select data-ex-move-target aria-label="Destination block">${w.blocks.map((target,ti)=>`<option value="${ti}" ${ti===bi?'selected':''} ${ti===bi?'disabled':''}>${escI(target.name||`Block ${ti+1}`)}</option>`).join('')}</select><button type="button" class="btn" data-ex-move ${w.blocks.length<2?'disabled':''}>Move to block</button></div>
      </article>`).join('')}
      <div class="smart-review-add smart-review-block-add"><button type="button" class="btn" data-ex-add>+ Add exercise</button></div></section>`).join('')+`<div class="smart-review-add"><button type="button" class="btn" data-block-add>+ Add block</button></div>`;
    $i('#smart-review-modal')?.classList.add('show');
  }
  function syncReview(){
    if(!reviewWorkout)return;
    document.querySelectorAll('#smart-review-content [data-rblock]').forEach(el=>{
      const bi=Number(el.dataset.rblock),b=reviewWorkout.blocks[bi];if(!b)return;
      b.name=el.querySelector('[data-rblock-name]')?.value||b.name;
      el.querySelectorAll('[data-ex-card]').forEach(card=>{
        const ei=Number(card.dataset.ei),e=b.exercises[ei];if(!e)return;
        e.name=cleanI(card.querySelector('[data-rex-name]')?.value)||e.name;
        card.querySelectorAll('[data-rex]').forEach(row=>{
          const parts=row.dataset.rex.split(':').map(Number),gi=parts[2],g=e.setGroups[gi];if(!g)return;
          g.sets=row.querySelector('[data-rex-sets]')?.value??'';g.reps=row.querySelector('[data-rex-reps]')?.value??'';g.weight=row.querySelector('[data-rex-weight]')?.value??'';g.type=row.querySelector('[data-rex-type]')?.value||'Aprox';
        });syncLegacy(e);
      });
    });
  }
  function smartDayData(){const w=clone(reviewWorkout||{});delete w._ocrWarnings;delete w._ocrConfidence;delete w._ocrSourceText;w.blocks=(w.blocks||[]).map(b=>({...b,exercises:(b.exercises||[]).map(e=>({...e,originalName:undefined}))}));return typeof normalizeDay==='function'?normalizeDay(w):w;}
  function clone(x){return JSON.parse(JSON.stringify(x));}
  function saveRecentImport(w,name){const a=readImports().filter(x=>x.id!==w.importMeta?.id);a.unshift({id:'ocr_'+Date.now(),name:name||w.importMeta?.fileName||'Garmin import',date:new Date().toISOString(),workout:clone(w),confidence:w._ocrConfidence||0});w.importMeta.id=a[0].id;saveImports(a);renderRecentImports();}
  function renderRecentImports(){const el=$i('#smart-recent-imports');if(!el)return;const a=readImports();el.innerHTML=a.length?a.map(x=>`<div class="smart-int-import"><div><strong>${escI(x.name)}</strong><small>${new Date(x.date).toLocaleDateString()} · ${Math.round(x.confidence||0)}% OCR confidence · ${countExercises(x.workout)} exercises</small></div><button type="button" class="btn" data-recent-id="${escI(x.id)}">Review</button></div>`).join(''):'<div class="smart-int-note">No imports yet. Your reviewed screenshots will appear here.</div>';}
  function openRecent(id){const x=readImports().find(i=>i.id===id);if(!x)return;reviewWorkout=clone(x.workout);reviewWorkout._ocrWarnings=reviewWorkout._ocrWarnings||[];renderSmartReview();}
  function persistReview(){syncReview();if(reviewWorkout?.importMeta?.id){const a=readImports(),i=a.findIndex(x=>x.id===reviewWorkout.importMeta.id);if(i>=0){a[i].workout=clone(reviewWorkout);a[i].confidence=reviewWorkout._ocrConfidence||0;a[i].date=new Date().toISOString();saveImports(a);}}}
  async function addDay(){persistReview();const tp=window.TrainMeiState||window.__tp;if(!tp){alert('Training Planner is not ready yet.');return;}tp.smartWorkout=smartDayData();if(!tp.currentUser){alert('Log in to add an imported workout to a synced day. You can still review it or save the import locally.');return;}if(typeof window.__tpApplySmartToDay==='function')await window.__tpApplySmartToDay();}
  async function saveTemplate(){persistReview();const tp=window.TrainMeiState||window.__tp;if(!tp){alert('Training Planner is not ready yet.');return;}tp.smartWorkout=smartDayData();if(!tp.currentUser){alert('Log in to save the imported workout as a synced template. The OCR review remains stored locally.');return;}if(typeof window.__tpCreateSmartTemplate==='function')await window.__tpCreateSmartTemplate();}

  document.addEventListener('click',e=>{
    const recent=e.target.closest('[data-recent-id]');if(recent){openRecent(recent.dataset.recentId);return;}
    if(e.target.closest('#close-smart-review')||e.target.closest('#smart-review-close')){persistReview();$i('#smart-review-modal')?.classList.remove('show');return;}
    if(e.target.closest('#smart-review-add-day')){addDay();return;}if(e.target.closest('#smart-review-template')){saveTemplate();return;}
    const remBlock=e.target.closest('[data-rblock-remove]');if(remBlock){persistReview();const b=remBlock.closest('[data-rblock]');reviewWorkout.blocks.splice(Number(b.dataset.rblock),1);if(!reviewWorkout.blocks.length)reviewWorkout.blocks.push({name:'Block 1',category:'Strength',exercises:[makeExercise('New exercise',[{}])]});renderSmartReview();return;}
    const blockEl=e.target.closest('[data-rblock]');
    const addSet=e.target.closest('[data-rex-add]');if(addSet&&blockEl){persistReview();const b=reviewWorkout.blocks[Number(blockEl.dataset.rblock)],card=addSet.closest('[data-ex-card]'),ei=Number(card.dataset.ei);if(b.exercises[ei])b.exercises[ei].setGroups.push(normalizeOCRSet({}));renderSmartReview();return;}
    const addEx=e.target.closest('[data-ex-add]');if(addEx&&blockEl){persistReview();const b=reviewWorkout.blocks[Number(blockEl.dataset.rblock)];b.exercises.push(makeExercise('New exercise',[{}]));renderSmartReview();return;}
    const addBlock=e.target.closest('[data-block-add]');if(addBlock){persistReview();reviewWorkout.blocks.push({name:`Block ${reviewWorkout.blocks.length+1}`,category:'Strength',exercises:[makeExercise('New exercise',[{}])]});renderSmartReview();return;}
    const mergeNext=e.target.closest('[data-rblock-merge-next]');if(mergeNext){persistReview();const bi=Number(blockEl.dataset.rblock),b=reviewWorkout.blocks[bi],next=reviewWorkout.blocks[bi+1];if(next){b.exercises.push(...next.exercises);b.name=`${b.name} + ${next.name}`;reviewWorkout.blocks.splice(bi+1,1);}renderSmartReview();return;}
    const split=e.target.closest('[data-ex-split]');if(split&&blockEl){persistReview();const bi=Number(blockEl.dataset.rblock),ei=Number(split.closest('[data-ex-card]').dataset.ei),b=reviewWorkout.blocks[bi],tail=b.exercises.splice(ei+1);if(tail.length){reviewWorkout.blocks.splice(bi+1,0,{name:`Block ${bi+2}`,category:b.category||'Strength',exercises:tail});}renderSmartReview();return;}
    const move=e.target.closest('[data-ex-move]');if(move&&blockEl){const select=move.closest('[data-ex-card]').querySelector('[data-ex-move-target]');const target=Number(select?.value),bi=Number(blockEl.dataset.rblock),ei=Number(move.closest('[data-ex-card]').dataset.ei);if(Number.isInteger(target)&&target!==bi&&reviewWorkout.blocks[target]){persistReview();const [ex]=reviewWorkout.blocks[bi].exercises.splice(ei,1);reviewWorkout.blocks[target].exercises.push(ex);if(!reviewWorkout.blocks[bi].exercises.length)reviewWorkout.blocks[bi].exercises.push(makeExercise('New exercise',[{}]));renderSmartReview();}return;}
    const removeEx=e.target.closest('[data-ex-remove]');if(removeEx&&blockEl){persistReview();const b=reviewWorkout.blocks[Number(blockEl.dataset.rblock)],ei=Number(removeEx.closest('[data-ex-card]').dataset.ei);b.exercises.splice(ei,1);renderSmartReview();return;}
    const moveUp=e.target.closest('[data-ex-up]'),moveDown=e.target.closest('[data-ex-down]');if((moveUp||moveDown)&&blockEl){persistReview();const b=reviewWorkout.blocks[Number(blockEl.dataset.rblock)],ei=Number((moveUp||moveDown).closest('[data-ex-card]').dataset.ei),to=ei+(moveUp?-1:1);if(to>=0&&to<b.exercises.length)[b.exercises[ei],b.exercises[to]]=[b.exercises[to],b.exercises[ei]];renderSmartReview();return;}
    const removeSet=e.target.closest('[data-rex-remove]');if(removeSet&&blockEl){persistReview();const row=removeSet.closest('[data-rex]'),[bi,ei,gi]=row.dataset.rex.split(':').map(Number),b=reviewWorkout.blocks[bi],ex=b.exercises[ei];ex.setGroups.splice(gi,1);if(!ex.setGroups.length)ex.setGroups.push(normalizeOCRSet({}));syncLegacy(ex);renderSmartReview();return;}
  });
  const file=$i('#smart-screenshot-file');if(file)file.addEventListener('change',analyzeSmartScreenshot);
  const drop=$i('#smart-select-btn');if(drop){['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('dragover');}));['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('dragover');}));drop.addEventListener('drop',e=>{const f=e.dataTransfer.files?.[0];if(!f)return;const dt=new DataTransfer();dt.items.add(f);file.files=dt.files;analyzeSmartScreenshot();});}
  renderRecentImports();
  window.analyzeSmartScreenshot=analyzeSmartScreenshot;window.smartDayData=smartDayData;
  window.TrainMeiOCR={parseOCRText,parseSetLine,exerciseFromInline,canonicalOCR};
})();
