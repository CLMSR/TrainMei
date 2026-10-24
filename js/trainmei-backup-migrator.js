/* TrainMei full local backup & migration utility v1.
 * API: TrainMeiBackupMigrator.exportBackup(), .inspect(payload), .dryRun(payload), .importBackup(payload,{dryRun:true|false})
 * Excludes likely auth/session/token keys. Import only touches app-data keys from the allowlist.
 */
(function(){'use strict';
  const VERSION=1, APP='TrainMei', KEY_RE=/^(training-planner:|trainmei[:._]|trainmei_|nutritrack_|nutrition_optimizer_feedback_v1$|cycle_tracker_records_v3$|fatsecret:)/i;
  const SENSITIVE_RE=/(auth|token|session|password|supabase|credential|secret)/i;
  const safeKey=k=>KEY_RE.test(k)&&!SENSITIVE_RE.test(k);
  function snapshot(){const data={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&safeKey(k)){const v=localStorage.getItem(k);if(v!==null)data[k]=v;}}return data;}
  function counts(data){const keys=Object.keys(data||{});const out={keys:keys.length,workouts:0,templates:0,exerciseLibrary:0,weightEntries:0,rmProfiles:0,cycleRecords:0,brainEvents:0};for(const [k,v] of Object.entries(data||{})){let x;try{x=JSON.parse(v)}catch{x=null}
    if(k.startsWith('training-planner:workout:'))out.workouts++;
    if(/template/i.test(k)&&Array.isArray(x))out.templates+=x.length;
    if(k==='trainmei.exercise-library.v1'&&Array.isArray(x))out.exerciseLibrary=x.length;
    if(k==='trainmei_weight_history_v1'&&Array.isArray(x))out.weightEntries=x.length;
    if(k==='trainmei_exercise_rms_v1'&&Array.isArray(x))out.rmProfiles=x.length;
    if(k==='cycle_tracker_records_v3'&&Array.isArray(x))out.cycleRecords=x.length;
    if(k==='training-planner:brain:v1'&&Array.isArray(x?.events))out.brainEvents=x.events.length;
  }return out;}
  function exportBackup(){const data=snapshot();const payload={app:APP,format:'trainmei-local-backup',version:VERSION,exportedAt:new Date().toISOString(),keyCount:Object.keys(data).length,counts:counts(data),data};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`trainmei-full-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return {version:VERSION,counts:payload.counts};}
  function inspect(payload){if(!payload||payload.app!==APP||payload.format!=='trainmei-local-backup'||!Number.isInteger(payload.version)||payload.version>VERSION||!payload.data||typeof payload.data!=='object'||Array.isArray(payload.data))throw new Error('Formato de backup no compatible o inválido.');const accepted={},rejected=[];for(const [k,v] of Object.entries(payload.data)){if(!safeKey(k)||typeof v!=='string'){rejected.push(k);continue}accepted[k]=v;}return {version:payload.version,exportedAt:payload.exportedAt||null,acceptedKeys:Object.keys(accepted).length,rejectedKeys:rejected,sourceCounts:payload.counts||counts(accepted),targetCounts:counts(snapshot()),incomingCounts:counts(accepted),accepted};}
  function dryRun(payload){const r=inspect(payload);const existing=snapshot();let add=0,replace=0,same=0;for(const [k,v] of Object.entries(r.accepted)){if(!(k in existing))add++;else if(existing[k]===v)same++;else replace++;}return {ok:true,dryRun:true,version:r.version,exportedAt:r.exportedAt,acceptedKeys:r.acceptedKeys,rejectedKeys:r.rejectedKeys,add,replace,same,sourceCounts:r.sourceCounts,targetCounts:r.targetCounts,incomingCounts:r.incomingCounts};}
  function importBackup(payload,options={}){const preview=dryRun(payload);if(options.dryRun!==false)return preview;const parsed=inspect(payload),before=snapshot(),touched=Object.keys(parsed.accepted);try{for(const [k,v] of Object.entries(parsed.accepted))localStorage.setItem(k,v);return {...preview,dryRun:false,imported:touched.length,rollbackAvailable:false};}catch(error){let rollbackErrors=[];for(const k of touched){try{if(Object.prototype.hasOwnProperty.call(before,k))localStorage.setItem(k,before[k]);else localStorage.removeItem(k);}catch(e){rollbackErrors.push({key:k,error:String(e)});}}throw new Error(`Importación fallida; rollback lógico ejecutado (${rollbackErrors.length} error(es)). Motivo: ${String(error)}${rollbackErrors.length?'; rollbackErrors='+JSON.stringify(rollbackErrors):''}`);}}
  async function readFile(file){if(!file)throw new Error('Selecciona un archivo JSON.');return JSON.parse(await file.text());}
  window.TrainMeiBackupMigrator={version:VERSION,exportBackup,inspect,dryRun,importBackup,readFile,counts};
})();
