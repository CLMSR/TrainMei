(function(){
  'use strict';
  const SB=window.supabaseClient;
const state={
  date:null,
  connection:null,
  summary:null,
  entries:[],
  loaded:false,
  error:null,
  lastRefreshAt:null
};

let resolveReady;
const readyPromise=new Promise(resolve=>{
  resolveReady=resolve;
});
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
    console.log('[NutritionData] LOAD', {date,connection: conn,summary,entriesCount: Array.isArray(entries) ? entries.length : null});
    state.connection=conn;state.entries=window.TrainMeiNutritionUtils.dedupeNutritionEntries(entries||[]);state.summary=mergeSummaryWithEntries(summary,state.entries,date);state.lastRefreshAt=new Date().toISOString();
    // Every date loaded from the FatSecret Data Layer also warms the shared Core cache.
    try{if(window.TrainingDataCore&&typeof window.TrainingDataCore._cacheNutritionRow==='function')window.TrainingDataCore._cacheNutritionRow(state.summary)}catch(e){}
    state.loaded=true;
state.error=null;

resolveReady(getSnapshot());

document.dispatchEvent(
  new CustomEvent('trainmei:nutrition-updated',{
    detail:getSnapshot()
  })
);

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

  function whenReady(){
  return state.loaded
    ? Promise.resolve(getSnapshot())
    : readyPromise;
}
  async function sync(date=today()){
    if(!SB)return null;
    const {data,error}=await SB.functions.invoke('fatsecret-sync',{body:{date}});
    if(error)throw error;if(data?.error)throw new Error(data.error);
    await load(date);document.dispatchEvent(new CustomEvent('trainmei:nutrition-sync-complete',{detail:{from:date,to:date,days:1,processed:Number(data?.synced||data?.upsertCount||0),failed:0,source:'TrainMeiNutritionData'}}));return data;
  }
  function openFatSecret(){document.querySelector('#main-nav [data-page="integrations-page"]')?.click();setTimeout(()=>document.querySelector('.smart-launch-card[data-page="fatsecret-page"]')?.click(),0)}
  document.addEventListener('DOMContentLoaded',()=>{
  load(today()).catch(e=>{
    state.error=e;
    state.loaded=true;

    resolveReady(null);

    try{
      window.TrainMeiNutrition?.render?.();
    }catch(_){}
  });
});
  document.addEventListener('trainmei:nutrition-sync-request',e=>{sync(e.detail?.date||today()).catch(console.error)});
  const HISTORY_PAGE_SIZE=1000,HISTORY_CACHE_TTL=120000;
  const historyCache=new Map(),historyInflight=new Map();
  async function fetchHistoryPages(table,columns,dateColumn,from,to){
    const rows=[];let offset=0;
    while(true){
      const {data,error}=await SB.from(table).select(columns)
        .gte(dateColumn,from).lte(dateColumn,to)
        .order(dateColumn,{ascending:true})
        .range(offset,offset+HISTORY_PAGE_SIZE-1);
      if(error)throw error;
      const page=data||[];rows.push(...page);
      if(page.length<HISTORY_PAGE_SIZE)break;
      offset+=HISTORY_PAGE_SIZE;
    }
    return rows;
  }
  async function loadHistory(from,to,{force=false}={}){
    if(!SB)return {summaries:[],entries:[],source:'fatsecret',from,to,loaded:true};
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(from||''))||!/^\d{4}-\d{2}-\d{2}$/.test(String(to||''))||from>to)throw new Error('Invalid nutrition history range');
    const key=from+'|'+to,now=Date.now(),cached=historyCache.get(key);
    if(!force&&cached&&cached.expiresAt>now)return cached.value;
    if(!force&&historyInflight.has(key))return historyInflight.get(key);
    const task=(async()=>{
      const [summaryRows,entryRows]=await Promise.all([
        fetchHistoryPages('nutrition_daily_summaries','summary_date,calories_kcal,protein_g,carbohydrate_g,fat_g,fiber_g','summary_date',from,to),
        fetchHistoryPages('nutrition_entries','id,entry_date,meal,fatsecret_food_entry_id,food_name,serving_description,quantity,calories_kcal,protein_g,carbohydrate_g,fat_g,fiber_g','entry_date',from,to)
      ]);
      const entries=window.TrainMeiNutritionUtils.dedupeNutritionEntries(entryRows);
      const byDate=Object.create(null);
      entries.forEach(e=>{const d=String(e.entry_date||e.date||'').slice(0,10);if(d)(byDate[d]||(byDate[d]=[])).push(e)});
      const dates=new Set(summaryRows.map(r=>String(r.summary_date||'').slice(0,10)).filter(Boolean));
      entries.forEach(e=>{const d=String(e.entry_date||e.date||'').slice(0,10);if(d)dates.add(d)});
      const rowByDate=Object.create(null);
      summaryRows.forEach(r=>{rowByDate[String(r.summary_date||'').slice(0,10)]=r});
      const summaries=[...dates].sort().map(date=>mergeSummaryWithEntries(rowByDate[date]||null,byDate[date]||[],date)).filter(Boolean);
      summaries.forEach(row=>window.TrainingDataCore?._cacheNutritionRow?.(row));
      return {summaries,entries,source:'fatsecret',from,to,loaded:true};
    })();
    historyInflight.set(key,task);
    try{
      const value=await task;
      historyCache.set(key,{value,expiresAt:Date.now()+HISTORY_CACHE_TTL});
      while(historyCache.size>8)historyCache.delete(historyCache.keys().next().value);
      return value;
    }finally{historyInflight.delete(key)}
  }

  const rangeState={
  preset:'custom',
  from:null,
  to:null
};

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
    try{await loadHistory(from,to,{force:true})}catch{}
    const activeBeforeSync=state.date;
    const activeDate=activeBeforeSync&&activeBeforeSync>=from&&activeBeforeSync<=to?activeBeforeSync:to;
    await load(activeDate);
    document.dispatchEvent(new CustomEvent('trainmei:nutrition-sync-complete',{detail:{from,to,days:count,processed,failed,source:'TrainMeiNutritionData'}}));
    return {from,to,days:count,processed,failed};
  }

window.TrainMeiNutritionData={
  getSnapshot,
  whenReady,
  load,
  loadHistory,
  sync,
  syncRange,
  openFatSecret,
  state,
  normalizeNutritionEntry:window.TrainMeiNutritionUtils.normalizeNutritionEntry,
  dedupeNutritionEntries:window.TrainMeiNutritionUtils.dedupeNutritionEntries,
  refreshActive:()=>load(state.date||today()),
  getActiveDate:()=>state.date||today()
};})();