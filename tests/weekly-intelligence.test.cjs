const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const listeners = {};
const local = new Map();
const document = { addEventListener:(name, fn)=>{(listeners[name] ||= []).push(fn)}, dispatchEvent:()=>true };
const context = {
  console, Date, Math, Number, String, Object, Array, Map, Set, Promise, RegExp, JSON,
  CustomEvent: class { constructor(type, init={}) { this.type=type; this.detail=init.detail; } },
  document,
  localStorage: { getItem:k=>local.has(k)?local.get(k):null, setItem:(k,v)=>local.set(k,String(v)), removeItem:k=>local.delete(k) },
  setTimeout:()=>0,
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'js/data-core.js'),'utf8'), context, {filename:'data-core.js'});
const core = context.TrainingDataCore;

const run = async()=>{
  const weights=[];
  // Period end 2026-10-17: previous week average 55 kg, recent week average 54.5 kg.
  for (const [date,weight] of [
    ['2026-10-04',55],['2026-10-05',55],['2026-10-06',55],
    ['2026-10-11',54.5],['2026-10-12',54.5],['2026-10-13',54.5],
  ]) weights.push({date,weight});
  context.TrainMeiProgressTools={getWeightHistory:()=>weights};
  context.TrainMeiNutri={getSnapshot:()=>({targets:{kcal:1600},profile:{goal:'deficit'}})};
  context.TrainMeiNutritionData={getSnapshot:()=>({targets:{},intake:{}})};
  const trainingRows=[
    {date:'2026-10-11',data:{completed:true,blocks:[],recovery:{sleep:4,energy:4,soreness:2}}},
    {date:'2026-10-12',data:{completed:true,blocks:[],recovery:{sleep:4,energy:4,soreness:2}}},
    {date:'2026-10-04',data:{completed:true,blocks:[],recovery:{sleep:4,energy:4,soreness:2}}},
  ];
  core.training=async(from,to)=>trainingRows.filter(r=>r.date>=from&&r.date<=to);
  core.nutritionHistory=async(from,to)=>{
    const rows=[
      {date:'2026-10-11',kcal:1500,carb:180,prot:100,fat:45},
      {date:'2026-10-11',kcal:1500,carb:180,prot:100,fat:45}, // duplicate must not inflate sample
      {date:'2026-10-12',kcal:1700,carb:200,prot:110,fat:50},
      {date:'2026-10-13',kcal:null,carb:190,prot:105,fat:48},
    ];
    return rows.filter(r=>r.date>=from&&r.date<=to);
  };
  core.exerciseProgression=async()=>[];
  core.recoveryPercent=d=>d?.recovery?80:null;
  core.plannedWorkout=()=>null;
  core.bodyProgress=()=>({phase:'deficit'});
  core.nutrition=()=>({targets:{kcal:1600}});
  const report=await core.weeklyIntelligence('2026-10-11','2026-10-17');
  assert.equal(report.schemaVersion,2);
  assert.equal(report.period.from,'2026-10-11');
  assert.equal(report.weight.recentCount,3);
  assert.equal(report.weight.previousCount,3);
  assert.equal(report.weight.trend,'down');
  assert.equal(report.weight.deltaKg,-0.5);
  assert.equal(report.nutrition.daysLogged,3,'duplicate nutrition date is deduplicated');
  assert.equal(report.nutrition.averages.kcal.n,2,'missing kcal is not zero');
  assert.equal(report.nutrition.averages.kcal.value,1600);
  assert.equal(report.training.completedSessions,2,'only completed non-rest workouts in period count');
  assert.equal(report.training.adherence.rate,null,'adherence remains unavailable without explicit plan');
  assert.equal(report.recovery.average,80);
  assert.ok(report.quality.flags.some(x=>x.includes('adherence cannot be calculated')));
  await assert.rejects(()=>core.weeklyIntelligence('2026-10-18','2026-10-17'),/valid ISO dates/);
  await assert.rejects(()=>core.weeklyIntelligence('bad','2026-10-17'),/valid ISO dates/);
  assert.throws(()=>core.recordRecommendationResponse({recommendationId:'x',recommendation:'test',response:'maybe'}),/accepted\/modified\/rejected/);
  core.recordRecommendationResponse({recommendationId:'2026-10-17:test',recommendation:'Keep the planned load stable',response:'accepted',date:'2026-10-17'});
  core.recordRecommendationOutcome({recommendationId:'2026-10-17:test',outcome:'partly_expected',note:'Energy improved, soreness stayed high',observedAt:'2026-10-17'});
  const learning=await core.recommendationLearningSummary('2026-10-17','2026-10-17');
  assert.equal(learning.accepted,1);
  assert.equal(learning.linkedOutcomes,1);
  assert.equal(learning.recommendations[0].outcomes[0].outcome,'partly_expected');
  console.log('PASS weekly-intelligence and recommendation-learning tests');
};
run().catch(e=>{console.error(e);process.exitCode=1});
