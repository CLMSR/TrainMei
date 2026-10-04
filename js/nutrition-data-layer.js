/* ===== CENTRAL NUTRITION DATA LAYER =====
   FatSecret is the source. NutritionDataLayer normalizes it. Downstream
   modules consume this snapshot / TrainingDataCore context instead of maintaining
   their own intake copy. Nutri Tracker is calculator-only.
*/
(function(){
  'use strict';
  const SB=window.supabaseClient;
  const state={date:null,connection:null,summary:null,entries:[],loaded:false,error:null,lastRefreshAt:null};
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const num=v=>v==null||v===''||!Number.isFinite(Number(v))?null:Number(v);
  const firstNum=(o,keys)=>{for(const k of keys){const v=num(o?.[k]);if(v!=null)return v}return null};
  const firstText=(o,keys)=>{for(const k of keys){if(o?.[k]!=null&&String(o[k]).trim()!=='')return String(o[k])}return null};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const el=id=>document.getElementById(id);

  async function maybe(table,build){
    try{const q=build(SB.from(table));const r=await q;return r.error?null:r.data}catch(e){return null}
  }
  async function load(date=today()){
    if(!SB)return null;
    state.date=date;
    const [conn,summary,entries]=await Promise.all([
      maybe('fatsecret_connections',q=>q.select('status,last_sync_at,connected_at,fatsecret_user_id').eq('provider','fatsecret').maybeSingle()),
      maybe('nutrition_daily_summaries',q=>q.select('*').eq('summary_date',date).maybeSingle()),
      maybe('nutrition_entries',q=>q.select('*').eq('entry_date',date).order('meal',{ascending:true}).order('food_name',{ascending:true}))
    ]);
    console.log('[NutritionData] LOAD', {date,connection: conn,summary,entriesCount: Array.isArray(entries) ? entries.length : null,entries});
    state.connection=conn;state.entries=window.TrainMeiNutritionUtils.dedupeNutritionEntries(entries||[]);state.summary=mergeSummaryWithEntries(summary,state.entries,date);state.lastRefreshAt=new Date().toISOString();
    // Every date loaded from the FatSecret Data Layer also warms the shared Core cache.
    try{if(window.TrainingDataCore&&typeof window.TrainingDataCore._cacheNutritionRow==='function')window.TrainingDataCore._cacheNutritionRow(state.summary)}catch(e){}
    state.loaded=true;state.error=null;
    document.dispatchEvent(new CustomEvent('trainmei:nutrition-updated',{detail:getSnapshot()}));
    return getSnapshot();
  }
  function snapshot(){
    const s=state.summary||{};
    return {
      date:state.date||today(),
      source:'fatsecret',
      connected:state.connection?.status==='connected',
      lastSyncAt:state.connection?.last_sync_at||null,
      summary:state.summary,
      entries:state.entries,
      lastRefreshAt:state.lastRefreshAt,
      intake:{
        date:state.date||today(),
        kcal:firstNum(s,['calories_kcal','kcal','total_calories','energy_kcal','calories']),
        carb:firstNum(s,['carbohydrate_g','carbs_g','carb_g','carbohydrates_g','total_carbs','total_carbohydrates','carbsG','carbs']),
        prot:firstNum(s,['protein_g','protein','total_protein','total_protein_g','proteinG']),
        fat:firstNum(s,['fat_g','fat','total_fat','total_fat_g','fatG']),
        fiber:firstNum(s,['fiber_g','fiber','total_fiber','total_fiber_g','fiberG']),
        source:'fatsecret'
      }
    };
  }
  function totalsFromEntries(entries){
    const rows=Array.isArray(entries)?entries:[];
    if(!rows.length)return null;
    const sum=(keys)=>{let total=0,found=false;for(const row of rows){for(const k of keys){const v=num(row?.[k]);if(v!=null){total+=v;found=true;break}}}return found?total:null};
    return {
      kcal:sum(['calories_kcal','kcal','calories','total_calories','energy_kcal','caloriesKcal']),
      carb:sum(['carbohydrate_g','carbs_g','carb_g','carbohydrates_g','carbohydrate','carbs','total_carbs','total_carbohydrates']),
      prot:sum(['protein_g','protein','protein_grams','total_protein','total_protein_g']),
      fat:sum(['fat_g','fat','fat_grams','total_fat','total_fat_g']),
      fiber:sum(['fiber_g','fiber','fiber_grams','total_fiber','total_fiber_g'])
    };
  }
  function summaryValue(row,keys){return firstNum(row,keys)}
  function mergeSummaryWithEntries(summary,entries,date){
    const base=summary&&typeof summary==='object'?{...summary}:{};
    if(!base.summary_date)base.summary_date=date;
    const totals=totalsFromEntries(entries);
    if(totals){
      if(summaryValue(base,['calories_kcal','kcal','total_calories','energy_kcal'])==null&&totals.kcal!=null)base.calories_kcal=totals.kcal;
      if(summaryValue(base,['carbohydrate_g','carbs_g','carb_g','carbohydrates_g','total_carbs','total_carbohydrates','carbsG'])==null&&totals.carb!=null)base.carbohydrate_g=totals.carb;
      if(summaryValue(base,['protein_g','protein','total_protein','total_protein_g','proteinG'])==null&&totals.prot!=null)base.protein_g=totals.prot;
      if(summaryValue(base,['fat_g','fat','total_fat','total_fat_g','fatG'])==null&&totals.fat!=null)base.fat_g=totals.fat;
      if(summaryValue(base,['fiber_g','fiber','total_fiber','total_fiber_g','fiberG'])==null&&totals.fiber!=null)base.fiber_g=totals.fiber;
    }
    return Object.keys(base).length>1?base:null;
  }
  function getSnapshot(){return snapshot()}

  async function sync(date=today()){
    if(!SB)return null;
    const {data,error}=await SB.functions.invoke('fatsecret-sync',{body:{date}});
    if(error)throw error;if(data?.error)throw new Error(data.error);
    await load(date);document.dispatchEvent(new CustomEvent('trainmei:nutrition-sync-complete',{detail:{from:date,to:date,days:1,processed:Number(data?.synced||data?.upsertCount||0),failed:0,source:'TrainMeiNutritionData'}}));return data;
  }
  function openFatSecret(){document.querySelector('#main-nav [data-page="integrations-page"]')?.click();setTimeout(()=>document.querySelector('.smart-launch-card[data-page="fatsecret-page"]')?.click(),0)}
  document.addEventListener('DOMContentLoaded',()=>{setTimeout(()=>load(today()).catch(e=>{state.error=e;try{window.TrainMeiNutrition?.render?.()}catch(_){}}),120)});
  document.addEventListener('trainmei:nutrition-sync-request',e=>{sync(e.detail?.date||today()).catch(console.error)});
  async function loadHistory(from,to){
    if(!SB)return {summaries:[],entries:[]};
    const [summaryResult,entriesResult]=await Promise.all([
      SB.from('nutrition_daily_summaries').select('*').gte('summary_date',from).lte('summary_date',to).order('summary_date',{ascending:true}),
      SB.from('nutrition_entries').select('*').gte('entry_date',from).lte('entry_date',to).order('entry_date',{ascending:true})
    ]);
    if(summaryResult.error)throw summaryResult.error;
    if(entriesResult.error)throw entriesResult.error;
    const entries=window.TrainMeiNutritionUtils.dedupeNutritionEntries(entriesResult.data||[]);
    const byDate=Object.create(null);
    entries.forEach(e=>{const d=String(e.entry_date||e.date||'').slice(0,10);if(d)(byDate[d]||(byDate[d]=[])).push(e)});
    const summaryRows=summaryResult.data||[];
    const dates=new Set(summaryRows.map(r=>String(r.summary_date||'').slice(0,10)).filter(Boolean));
    entries.forEach(e=>{const d=String(e.entry_date||e.date||'').slice(0,10);if(d)dates.add(d)});
    const rowByDate=Object.create(null);
    summaryRows.forEach(r=>{rowByDate[String(r.summary_date||'').slice(0,10)]=r});
    const summaries=[...dates].sort().map(date=>mergeSummaryWithEntries(rowByDate[date]||null,byDate[date]||[],date)).filter(Boolean);
    summaries.forEach(row=>window.TrainingDataCore?._cacheNutritionRow?.(row));
    return {summaries,entries,source:'fatsecret',from,to};
  }

  async function syncRange(from,to){
    rangeState.preset='custom';
    rangeState.from=from;rangeState.to=to;
    const dateDiff=(a,b)=>Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000);const nextDate=d=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+1);return x.toISOString().slice(0,10)};
const count=dateDiff(from,to)+1;
const queue=[];
for(let d=from;d<=to;d=nextDate(d))queue.push(d);
const daySync=date=>window.TrainMeiFatSecret?.sync?.(date);
    if(typeof daySync!=='function')throw new Error('FatSecret sync is not available');
    const results=await Promise.allSettled(queue.map(date=>daySync(date)));
    const failed=results.filter(r=>r.status==='rejected').length;
    const processed=results.filter(r=>r.status==='fulfilled').reduce((n,r)=>n+Number(r.value?.synced||r.value?.upsertCount||0),0);
    try{await loadHistory(from,to)}catch{}
    const activeBeforeSync=state.date;
    const activeDate=activeBeforeSync&&activeBeforeSync>=from&&activeBeforeSync<=to?activeBeforeSync:to;
    await load(activeDate);
    document.dispatchEvent(new CustomEvent('trainmei:nutrition-sync-complete',{detail:{from,to,days:count,processed,failed,source:'TrainMeiNutritionData'}}));
    return {from,to,days:count,processed,failed};
  }

  window.TrainMeiNutritionData={getSnapshot,load,loadHistory,sync,syncRange,openFatSecret,state,normalizeNutritionEntry:window.TrainMeiNutritionUtils.normalizeNutritionEntry,dedupeNutritionEntries:window.TrainMeiNutritionUtils.dedupeNutritionEntries,
  refreshActive:()=>load(state.date||today()),
  getActiveDate:()=>state.date||today()};})();
