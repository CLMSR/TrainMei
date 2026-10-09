(()=> {
  'use strict';

  const SB = window.supabaseClient;
  if (!SB) return;

  const $f = (s) => document.querySelector(s);
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  function setMessage(text, isError=false){
    const el = $f('#fatsecret-message');
    if (!el) return;
    el.textContent = text || '';
    el.style.color = isError ? '#b91c1c' : '';
  }

  function setStatus(status, connected){
    const pill = $f('#fatsecret-status-pill');
    const launch = $f('#fatsecret-launch-status');
    const copy = $f('#fatsecret-connection-copy');
    const account = $f('#fatsecret-account-status');
    const connect = $f('#fatsecret-connect-btn');
    const sync = $f('#fatsecret-sync-btn');
    if (!pill) return;

    pill.className = 'fatsecret-status-pill ' + (connected ? 'connected' : 'disconnected');
    pill.textContent = connected ? 'Connected' : (status || 'Not connected');
    if (launch) launch.textContent = connected ? 'Connected · ready to sync' : 'Not connected';
    if (copy) copy.textContent = connected
      ? 'Your FatSecret food diary is connected to TrainMei.'
      : 'Connect your personal FatSecret account to import food diary data.';
    if (account) account.textContent = connected ? 'Connected' : 'Not connected';
    if (connect) {
      connect.disabled = false;
      connect.textContent = connected ? 'Reconnect FatSecret' : 'Connect FatSecret';
    }
    if (sync) sync.disabled = !connected;
  }

  function formatDateTime(value){
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined,{dateStyle:'short',timeStyle:'short'});
  }

  function setSummary(summary){
    const fields = [
      ['#fatsecret-kcal', summary?.calories_kcal],
      ['#fatsecret-carbs', summary?.carbohydrate_g],
      ['#fatsecret-protein', summary?.protein_g],
      ['#fatsecret-fat', summary?.fat_g]
    ];
    fields.forEach(([id,val])=>{
      const el=$f(id);
      if (el) el.textContent = val == null ? '—' : Math.round(Number(val));
    });
  }

  async function getConnection(){
    const {data,error}=await SB
      .from('fatsecret_connections')
      .select('status,last_sync_at,connected_at,fatsecret_user_id')
      .eq('provider','fatsecret')
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  function firstNumber(row, keys){
    for(const key of keys){
      const value=Number(row?.[key]);
      if(Number.isFinite(value)) return value;
    }
    return null;
  }

  function normalizeNutritionEntry(row){
    const r=row||{};
    return {
      ...r,
      entryDate:String(r.entry_date||r.date||'').slice(0,10)||null,
      meal:r.meal??r.meal_name??null,
      foodName:r.food_name??r.foodName??r.name??'Food',
      caloriesKcal:firstNumber(r,['calories_kcal','kcal','calories']),
      proteinG:firstNumber(r,['protein_g','protein']),
      carbsG:firstNumber(r,['carbohydrate_g','carbs_g','carb_g','carbohydrates_g']),
      fatG:firstNumber(r,['fat_g','fat']),
      fiberG:firstNumber(r,['fiber_g','fiber']),
      consumptionTime:r.consumption_time??r.meal_time??r.entry_time??r.consumed_at??r.time??null,
      source:r.source||'fatsecret'
    };
  }

  function dedupeNutritionEntries(rows){
    const seen=new Set();
    return (Array.isArray(rows)?rows:[]).filter(row=>{
      const r=normalizeNutritionEntry(row);
      const stableId=r.id??r.entry_id??r.food_entry_id??null;
      const time=r.consumptionTime||'';
      const key=stableId!=null
        ? `id:${stableId}`
        : [r.entryDate,r.meal,r.foodName,r.serving_description||'',time,r.caloriesKcal??'',r.proteinG??'',r.carbsG??'',r.fatG??''].join('|').toLowerCase();
      if(seen.has(key))return false;
      seen.add(key);
      return true;
    }).map(normalizeNutritionEntry);
  }
window.TrainMeiNutritionUtils={
  normalizeNutritionEntry,
  dedupeNutritionEntries
};
  async function loadDailyData(date){
    if (!date) return null;
    const [summaryResult, entriesResult] = await Promise.all([
      SB.from('nutrition_daily_summaries')
        .select('*')
        .eq('summary_date',date)
        .maybeSingle(),
      SB.from('nutrition_entries')
        .select('*')
        .eq('entry_date',date)
        .order('meal',{ascending:true})
        .order('food_name',{ascending:true})
    ]);

    if (summaryResult.error) throw summaryResult.error;
    if (entriesResult.error) throw entriesResult.error;

    const entries=(entriesResult.data||[]).map(window.TrainMeiNutritionUtils.normalizeNutritionEntry);
    const summary=summaryResult.data||null;
    setSummary(summary);
    const importedCount=$f('#fatsecret-imported-count');
    if(importedCount) importedCount.textContent=String(entries.length);

    return {
      date,
      summary,
      entries,
      rawEntryCount:(entriesResult.data||[]).length,
      uniqueEntryCount:entries.length,
      complete:!!summary && (entries.length>0 || [summary.calories_kcal,summary.kcal,summary.total_calories].some(v=>Number(v)===0)),
      source:'fatsecret'
    };
  }

  async function refresh(){
    const date=$f('#fatsecret-sync-date')?.value || today();
    try{
      const connection=await getConnection();
      const connected=connection?.status==='connected';
      setStatus(connection?.status,connected);

      const last=$f('#fatsecret-last-sync');
      if(last) last.textContent=formatDateTime(connection?.last_sync_at);

      await loadDailyData(date);

      setMessage(connected
        ? 'FatSecret is connected. Your nutrition data is ready to use across TrainMei.'
        : 'Connect FatSecret to start importing your food diary.');
    }catch(error){
      console.error('FatSecret UI error:',error);
      setStatus('Error',false);
      setMessage(error?.message || 'Could not load FatSecret connection status.',true);
    }
  }

  async function connect(){
    const button=$f('#fatsecret-connect-btn');
    if(button) button.disabled=true;
    setMessage('Opening FatSecret authorization…');

    try{
      const {data,error}=await SB.functions.invoke('fatsecret-oauth-start',{
        body:{}
      });

      if(error){
        let detail=error?.message || 'FatSecret authorization could not be started.';
        try{
          const response=error?.context;
          if(response && typeof response.json==='function'){
            const payload=await response.clone().json();
            if(payload?.error) detail=String(payload.error);
            else if(payload?.message) detail=String(payload.message);
          }
        }catch(_){}
        throw new Error(detail);
      }
      if(data?.error) throw new Error(String(data.error));
      if(!data?.authorize_url) throw new Error('FatSecret authorization URL was not returned by Supabase.');

      window.location.href=data.authorize_url;
    }catch(error){
      console.error('FatSecret connect error:',error);
      if(button) button.disabled=false;
      setMessage(error?.message || 'Could not start FatSecret authorization.',true);
    }
  }

  const rangeState={preset:'1d',from:null,to:null,running:false};

  function dateKey(d){
    const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
  }
  function addDays(key,days){const d=new Date(key+'T12:00:00');d.setDate(d.getDate()+days);return dateKey(d)}
  function daysBetween(from,to){const a=new Date(from+'T12:00:00'),b=new Date(to+'T12:00:00');return Math.max(1,Math.round((b-a)/86400000)+1)}
  function presetRange(preset){
    const to=today();let from=to;
    if(preset==='7d')from=addDays(to,-6);
    else if(preset==='4w')from=addDays(to,-27);
    else if(preset==='3m'){const d=new Date(to+'T12:00:00');d.setMonth(d.getMonth()-3);from=dateKey(d)}
    else if(preset==='1y'){const d=new Date(to+'T12:00:00');d.setFullYear(d.getFullYear()-1);from=dateKey(d)}
    else if(preset==='3y'){const d=new Date(to+'T12:00:00');d.setFullYear(d.getFullYear()-3);from=dateKey(d)}
    return {from,to};
  }
  function setRangeLabel(from,to,preset){
    const count=daysBetween(from,to),label=preset==='1d'?'Today':`${from} → ${to}`;
    const rangeLabel=$f('#fatsecret-range-label'),countEl=$f('#fatsecret-range-count'),progress=$f('#fatsecret-range-progress');
    if(rangeLabel)rangeLabel.textContent=label;
    if(countEl)countEl.textContent=`${count} day${count===1?'':'s'}`;
    if(progress&&!rangeState.running)progress.textContent='Ready';
    const day=$f('#fatsecret-sync-date');if(day)day.value=to;
  }
  function currentRange(){
    if(rangeState.preset==='custom'){
      const from=$f('#fatsecret-sync-from')?.value||today(),to=$f('#fatsecret-sync-to')?.value||today();
      return from<=to?{from,to}:{from:to,to:from};
    }
    return presetRange(rangeState.preset);
  }
  async function nutritionRangeStatus(from,to){
    try{
      const [summaryResult,entriesResult]=await Promise.all([
        SB.from('nutrition_daily_summaries').select('*').gte('summary_date',from).lte('summary_date',to),
        SB.from('nutrition_entries').select('entry_date').gte('entry_date',from).lte('entry_date',to)
      ]);
      if(summaryResult.error||entriesResult.error)return new Map();
      const map=new Map();
      (summaryResult.data||[]).forEach(row=>{
        const date=String(row.summary_date||'').slice(0,10);
        if(date)map.set(date,{summary:true,entries:0});
      });
      (entriesResult.data||[]).forEach(row=>{
        const date=String(row.entry_date||'').slice(0,10);
        if(!date)return;
        const item=map.get(date)||{summary:false,entries:0};
        item.entries+=1;map.set(date,item);
      });
      return map;
    }catch(_){return new Map()}
  }
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function invokeDaySync(date){
    let lastError=null;
    for(let attempt=0;attempt<3;attempt++){
      try{
        const {data,error}=await SB.functions.invoke('fatsecret-sync',{body:{date}});
        if(error)throw error;
        if(data?.error)throw new Error(String(data.error));
        return data||{};
      }catch(error){
        lastError=error;
        if(attempt<2)await wait(500*(attempt+1));
      }
    }
    throw lastError||new Error('FatSecret sync failed');
  }
  async function sync(dateOverride=null){
    const button=$f('#fatsecret-sync-btn');
    if(dateOverride){
      if(button)button.disabled=true;
      setMessage(`Syncing FatSecret food diary for ${dateOverride}…`);
      try{
        const data=await invokeDaySync(dateOverride);
        await refresh();
        if(window.TrainMeiNutritionData?.load)await window.TrainMeiNutritionData.load(dateOverride);
        setMessage(`Sync complete · ${Number(data?.synced||data?.upsertCount||0)} food entries processed.`);
        return data;
      }finally{
        const connected=$f('#fatsecret-status-pill')?.classList.contains('connected');
        if(button)button.disabled=!connected;
      }
    }
    if(rangeState.running)return;
    const {from,to}=currentRange(),count=daysBetween(from,to);
    rangeState.from=from;rangeState.to=to;rangeState.running=true;
    if(button)button.disabled=true;
    const progress=$f('#fatsecret-range-progress');
    const status=await nutritionRangeStatus(from,to);
    // Existing dates are deliberately refreshed. FatSecret is the source of truth,
    // so a later edit/deletion in FatSecret must be able to reach the Data Layer.
    const queue=[];
    for(let d=from;d<=to;d=addDays(d,1))queue.push(d);
    const existingCount=queue.filter(d=>status.has(d)).length;
    let done=0,processed=0,failed=0;
    if(progress)progress.textContent=`0 / ${queue.length} syncing`;
    setMessage(count===1?`Syncing FatSecret food diary for ${to}…`:`Refreshing ${count} days · ${existingCount} already present · all selected dates will be checked…`);
    try{
      const concurrency=4;
      for(let i=0;i<queue.length;i+=concurrency){
        const batch=queue.slice(i,i+concurrency);
        const results=await Promise.allSettled(batch.map(async date=>invokeDaySync(date)));
        results.forEach(r=>{if(r.status==='fulfilled')processed+=Number(r.value?.synced||r.value?.upsertCount||0);else failed++});
        done+=batch.length;
        if(progress)progress.textContent=`${done} / ${queue.length} synced${failed?` · ${failed} failed`:''}`;
        if(done<queue.length)await new Promise(resolve=>setTimeout(resolve,120));
      }
      const activeBeforeSync=window.TrainMeiNutritionData?.getActiveDate?.()||today();
      await refresh();
      if(window.TrainMeiNutritionData?.loadHistory)await window.TrainMeiNutritionData.loadHistory(from,to);
      const activeDate=activeBeforeSync>=from&&activeBeforeSync<=to?activeBeforeSync:to;
      if(window.TrainMeiNutritionData?.load)await window.TrainMeiNutritionData.load(activeDate);
      document.dispatchEvent(new CustomEvent('trainmei:nutrition-sync-complete',{detail:{from,to,days:count,existingBeforeSync:existingCount,processed,failed,source:'FatSecret'}}));
      const imported=processed?` · ${processed} food entries processed`:'';
      setMessage(failed?`Sync finished with ${failed} day${failed===1?'':'s'} failed${imported}. Successful days were refreshed.`:`Sync complete · ${count} days refreshed${imported}.`);
      if(progress)progress.textContent=failed?`Complete · ${failed} failed`:`Complete · ${count} refreshed`;
      return {from,to,days:count,existingBeforeSync:existingCount,processed,failed};
    }catch(error){
      console.error('FatSecret range sync error:',error);
      setMessage(error?.message||'Could not sync the selected FatSecret range.',true);
      if(progress)progress.textContent='Sync failed';
      throw error;
    }finally{
      rangeState.running=false;
      const connected=$f('#fatsecret-status-pill')?.classList.contains('connected');
      if(button)button.disabled=!connected;
    }
  }

  function bind(){
    const date=$f('#fatsecret-sync-date');
    const todayKey=today();
    if(date){
      date.value=todayKey;date.max=todayKey;
      date.addEventListener('change',()=>loadDailyData(date.value).catch(error=>{
        console.error(error);
        setMessage(error?.message || 'Could not load nutrition data.',true);
      }));
    }
    const from=$f('#fatsecret-sync-from'),to=$f('#fatsecret-sync-to');
    if(from){from.value=todayKey;from.max=todayKey;}
    if(to){to.value=todayKey;to.max=todayKey;}
    setRangeLabel(todayKey,todayKey,'1d');
    document.querySelectorAll('[data-fatsecret-range]').forEach(preset=>preset.addEventListener('click',()=>{
      const key=preset.dataset.fatsecretRange||'1d';rangeState.preset=key;
      document.querySelectorAll('[data-fatsecret-range]').forEach(x=>x.classList.toggle('active',x===preset));
      const custom=key==='custom',dates=$f('#fatsecret-range-dates');
      if(dates)dates.hidden=!custom;
      const r=custom?{from:from?.value||todayKey,to:to?.value||todayKey}:presetRange(key);
      setRangeLabel(r.from,r.to,key);
    }));
    [from,to].forEach(input=>input?.addEventListener('change',()=>{
      if(rangeState.preset!=='custom')return;
      const r=currentRange();setRangeLabel(r.from,r.to,'custom');
    }));
    $f('#fatsecret-connect-btn')?.addEventListener('click',connect);
    $f('#fatsecret-sync-btn')?.addEventListener('click',()=>sync());

    document.addEventListener('click',event=>{
      const card=event.target.closest('.smart-launch-card[data-page="fatsecret-page"]');
      if(card) setTimeout(refresh,50);
    });

    document.addEventListener('click',event=>{
      if(event.target.closest('[data-smart-back]')) return;
      const page=document.querySelector('#fatsecret-page');
      if(page?.classList.contains('active')) setTimeout(refresh,80);
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',bind,{once:true});
  }else{
    bind();
  }

  window.TrainMeiFatSecret={refresh,sync,connect,getRange:currentRange};
})();
