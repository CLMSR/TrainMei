/* ===== Nutrition Optimizer ===== */
(function(){
'use strict';
const FEEDBACK_KEY='nutrition_optimizer_feedback_v1';let selectedMeal='pre';let timing=60,variant=0;
function initNutritionMealSelector(){

  const selector=document.getElementById('nutrition-meal-selector');

  if(!selector)return;

  if(selector.dataset.initialized==='true')return;

  selector.dataset.initialized='true';

  selector.addEventListener('click',event=>{

    const button=event.target.closest('[data-meal]');

    if(!button)return;

    const meal=button.dataset.meal;

    if(!MEAL_TARGETS[meal])return;

    selectedMeal=meal;

    selector
      .querySelectorAll('[data-meal]')
      .forEach(tab=>{
        tab.classList.toggle(
          'active',
          tab.dataset.meal===selectedMeal
        );
      });

    /*
      Ask the existing Nutrition Optimizer render flow to update
      the meal plan. No FatSecret write is performed here.
    */
    const rawNutri=nutri();
    const snapshot=
      window.TrainMeiNutritionData?.getSnapshot?.()||null;

    const n={
      ...rawNutri,
      ...(snapshot||{}),
      intake:{
        ...(rawNutri.intake||{}),
        ...(snapshot?.intake||{})
      },
      targets:{
        ...(rawNutri.targets||{}),
        ...(snapshot?.targets||{})
      }
    };

    renderMealPlan(n,null,null);
  });
}
initNutritionMealSelector();
const escN=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const todayKey=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const addDays=(k,n)=>{const d=new Date(k+'T12:00:00');d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const readWorkout=k=>{try{const r=localStorage.getItem('training-planner:workout:'+k);return r?JSON.parse(r):null}catch(e){return null}};
const readFeedback=()=>{try{const r=localStorage.getItem(FEEDBACK_KEY),v=r?JSON.parse(r):[];return Array.isArray(v)?v:[]}catch(e){return[]}};const saveFeedback=v=>{try{localStorage.setItem(FEEDBACK_KEY,JSON.stringify(v.slice(-30)))}catch(e){}};
function metrics(w){const ex=(w?.blocks||[]).flatMap(b=>Array.isArray(b.exercises)?b.exercises:[]).filter(e=>String(e?.name||'').trim()),sets=ex.reduce((n,e)=>n+(e.setGroups||[e]).reduce((s,g)=>s+(Number(g?.sets)||0),0),0),volume=ex.reduce((n,e)=>n+(e.setGroups||[e]).reduce((s,g)=>s+(Number(g?.sets)||0)*(Number(String(g?.reps||'').match(/\d+(?:\.\d+)?/)?.[0])||0)*(Number(g?.weight)||0),0),0),text=JSON.stringify(w||{}).toLowerCase(),distance=Number(w?.metrics?.distanceKm)||0,duration=Number(w?.metrics?.timeMin)||0,load=Number(w?.metrics?.load)||0,rpe=Number(w?.metrics?.rpe)||0,running=/run|running|row|cycling|bike/.test(text),strength=/strength|squat|deadlift|bench|press|pull|hypertrophy/.test(text),conditioning=/amrap|for time|emom|time cap|conditioning|hyrox/.test(text),score=Math.min(100,Math.round((running?Math.min(35,distance*2.5):0)+(duration?Math.min(25,duration/3):0)+(volume?Math.min(20,volume/450):0)+(load?Math.min(20,load/5):0)+(rpe?Math.min(12,rpe*1.5):0)+(conditioning?10:0)));return{sets,volume,distance,duration,load,rpe,running,strength,conditioning,type:running?'Running / endurance':conditioning?'Conditioning':strength?'Strength':'Mixed training',demand:score>=72?'High':score>=42?'Moderate':'Low'};}
function session(){const w=readWorkout(todayKey()),m=window.TrainingDataCore?.trainingDemand?.(todayKey(),w)||metrics(w);if(!w)return{workout:null,title:'Rest day',...m};return{workout:w,title:w.focus||w.trainingCategory||'Training session',...m};}
function nutri(){const calc=window.TrainMeiNutri?.getSnapshot?.()||{},remote=window.TrainMeiNutritionData?.getSnapshot?.()||{};return{...calc,...remote,targets:{...(calc.targets||{})},intake:{...(remote.intake||{})}}}
const meals={30:[['Banana + rice cakes',['1 banana','2 rice cakes','15 g skyr or whey']],['Apple + toast',['1 small apple','1 slice white toast','10 g honey']],['Pear + rice cakes',['1 small pear','2 rice cakes','15 g skyr or whey']],['Blueberries + yogurt',['100 g blueberries','120 g skyr','10 g honey']],['Toast + jam',['1–2 slices white toast','15 g jam','15 g skyr']],['Cereal + milk',['25 g corn flakes or rice cereal','120 ml low-fat milk']],['Banana + pretzels',['1 banana','20 g pretzels']],['Applesauce + rice cakes',['100 g unsweetened applesauce','2 rice cakes']]],60:[['Cream of Rice Bowl',['30 g cream of rice','150 g skyr 0%','½ banana','5 g honey']],['Toast + turkey + banana',['2 small slices white toast','50 g turkey breast','½ banana']],['Skyr + rice cereal + banana',['170 g skyr 0%','25 g rice cereal','½ banana']],['Oats + berries + yogurt',['35 g oats','100 g berries','150 g skyr']],['Toast + cottage cheese + fruit',['2 small slices toast','60 g cottage cheese','1 kiwi or small orange']],['Corn flakes + yogurt + banana',['30 g corn flakes','150 g yogurt','½ banana']],['Bagel + turkey + fruit',['½ plain bagel','40 g turkey breast','½ banana']],['Rice cakes + yogurt + mango',['3 rice cakes','120 g skyr','80 g mango']]],120:[['Oats + yogurt + banana',['40 g oats','170 g skyr','1 banana']],['Toast + eggs + fruit',['2 slices toast','1 egg + 100 g egg whites','1 small fruit']],['Oats + berries + honey',['45 g oats','150 g skyr','100 g berries','10 g honey']],['Bagel + turkey + banana',['1 plain bagel','60 g turkey breast','1 banana']],['Cereal + yogurt + berries',['45 g corn flakes or rice cereal','170 g yogurt','100 g berries']],['Rice cakes + peanut butter + banana',['4 rice cakes','10 g peanut butter','1 banana']],['Toast + cottage cheese + kiwi',['2 slices toast','100 g cottage cheese','1 kiwi']],['Cream of rice + mango + yogurt',['45 g cream of rice','100 g mango','150 g skyr']]],180:[['Rice + chicken + fruit',['120 g cooked rice','100 g chicken','1 piece of fruit']],['Oats + yogurt + fruit',['50 g oats','200 g skyr','1 banana']],['Rice + eggs + berries',['120 g cooked rice','2 eggs','100 g berries']],['Pasta + chicken + fruit',['120 g cooked pasta','100 g chicken','1 small orange']],['Potatoes + eggs + fruit',['200 g potatoes','2 eggs','1 kiwi or orange']],['Bagel + turkey + yogurt',['1 plain bagel','70 g turkey breast','150 g yogurt']],['Oats + banana + berries',['55 g oats','1 banana','100 g berries','150 g skyr']],['Toast + eggs + fruit bowl',['3 slices toast','2 eggs','150 g mixed fruit']] ]};
function target(d,n,coreCtx=null){
  const req=coreCtx?.fuel||window.TrainingDataCore?.fuelRequirement?.(todayKey(),d.workout)||null;
  let c=req?.preWorkoutCarbs!=null?Number(req.preWorkoutCarbs):40;
  let p={30:10,60:20,120:25,180:30}[timing]||20;
  if(d.running&&d.distance>8)c+=8;
  if(d.strength&&d.volume>5000)p+=4;
  if(d.rpe>=8)c+=5;
  if(timing===30){c*=.7;p*=.7}else if(timing===120)c*=1.08;else if(timing===180)c*=1.15;
  const b=coreCtx?.budget||window.TrainingDataCore?.nutritionBudget?.(todayKey())||null;
  const rk=b?.remaining?.kcal??(n.intake?.kcal!=null&&n.targets?.kcal?Math.max(0,n.targets.kcal-n.intake.kcal):null);
  const rc=b?.remaining?.carb??(n.intake?.carb!=null&&n.targets?.carb?Math.max(0,n.targets.carb-n.intake.carb):null);
  const rp=b?.remaining?.prot??(n.intake?.prot!=null&&n.targets?.prot?Math.max(0,n.targets.prot-n.intake.prot):null);
  if(rc!=null)c=Math.min(c,Math.max(15,Math.round(rc*.5)));
  if(rp!=null)p=Math.min(p,Math.max(8,Math.round(rp*.45)));
  return{k:Math.max(120,Math.round(c*4+p*4)),c:Math.max(15,Math.round(c)),p:Math.max(8,Math.round(p)),remaining:{kcal:rk,carb:rc,prot:rp},fuelRequirement:req};
}
function nextSession(){for(let i=1;i<=7;i++){const w=readWorkout(addDays(todayKey(),i));if(w)return{date:addDays(todayKey(),i),title:w.focus||w.trainingCategory||'Next session',m:metrics(w)}}return null}
function during(d,n){if(!d.workout)return'No session planned yet.';if(d.duration<45&&d.distance<5)return'Water is usually enough for this short session; use your own feedback to decide if carbohydrate helps.';let c=(d.duration>=60?20:0)+(d.duration>=90?15:0)+(d.distance>=8?20:0)+(d.rpe>=8?10:0)+(d.conditioning?10:0);return c?`Consider ~${c} g carbohydrate per hour, adjusted to tolerance and actual duration.`:'Use thirst and session feedback as the main guide.'}
function after(d,next,n){if(!d.workout)return'Complete a session first to generate recovery guidance.';const p=Math.max(20,Math.round((n.targets?.prot||100)*.25)),c=Math.max(25,Math.round((n.targets?.carb||150)*.25)+(next?.m.duration>=75||next?.m.distance>=8?15:0));return`Post-workout target: ~${c} g carbohydrate + ${p} g protein, adjusted to your calculated daily targets.${next?` Next session: ${next.title}.`:' No next session is planned in 7 days.'}`}
function learning(f){const prefs=window.TrainingDataCore?.quickFoodPreferences?.(timing)||[];if(!f.length)return'Log feedback after training. TrainingDataCore will use the response together with training demand, recovery and FatSecret intake.';if(!prefs.length)return`${f.length} feedback entr${f.length===1?'y':'ies'} are stored in the central learning model. No stable food preference is supported by enough repeated feedback yet.`;const top=prefs[0];return`${f.length} feedback entr${f.length===1?'y':'ies'} are stored in TrainingDataCore. A recurring food association is ${top.food} (${top.n} observations); keep logging timing, tolerance, energy and performance so the pattern can be tested against future sessions. Associations are descriptive, not proof of causation.`}
function pickMeal(set,timing){const prefs=window.TrainingDataCore?.quickFoodPreferences?.(timing)||[];if(!prefs.length)return set[variant%set.length];const ranked=set.map((meal,index)=>{const text=meal.join(' ').toLowerCase();const hits=prefs.reduce((n,p)=>n+(text.includes(p.food)?p.score:0),0);return{meal,index,hits}}).sort((a,b)=>b.hits-a.hits||a.index-(variant%set.length===a.index?1:0));return ranked[0]?.meal||set[variant%set.length]}
async function render(){
  const d=session();
  const rawNutri=nutri();
  const nutritionSnapshot=window.TrainMeiNutritionData?.getSnapshot?.()||null;
  const coreCtx=window.TrainingDataCore?.optimizerContext
    ? await window.TrainingDataCore.optimizerContext(todayKey(),d.workout)
    : null;

  const n={
    ...rawNutri,
    ...(nutritionSnapshot||{}),
    source:nutritionSnapshot?.source||coreCtx?.nutrition?.source||rawNutri.source,
    connected:nutritionSnapshot?.connected??coreCtx?.nutrition?.connected??rawNutri.connected,
    intake:{
      ...(rawNutri.intake||{}),
      ...(coreCtx?.nutrition?.intake||{}),
      ...(nutritionSnapshot?.intake||{})
    },
    targets:{
      ...(rawNutri.targets||{}),
      ...(coreCtx?.nutrition?.targets||{}),
      ...(nutritionSnapshot?.targets||{})
    }
  },t=target(d,n,coreCtx),set=meals[timing]||meals[60],m=pickMeal(set,timing),next=nextSession(),f=readFeedback();renderMealPlan(n,d,coreCtx);const title=document.getElementById('no-session-title'),meta=document.getElementById('no-session-meta');if(!title)return;title.textContent=d.title;meta.textContent=d.workout?`${d.type} · ${d.duration||0} min · ${d.distance?d.distance+' km · ':''}${Math.round(d.volume)} volume · RPE ${d.rpe||'—'}`:'Add today\'s workout to personalize the recommendation.';document.getElementById('no-demand-badge').textContent=d.workout?d.demand.toUpperCase():'NO SESSION';document.getElementById('no-session-tags').innerHTML=d.workout?[d.type,d.duration?`${d.duration} min`:null,d.distance?`${d.distance} km`:null,d.volume?`${Math.round(d.volume)} volume`:null,d.rpe?`RPE ${d.rpe}`:null].filter(Boolean).map(x=>`<span>${escN(x)}</span>`).join(''):'';document.getElementById('no-timing-label').textContent=timing===180?'3+ h':timing===120?'2 h':timing+' min';document.getElementById('no-kcal').textContent=t.k;document.getElementById('no-carbs').textContent=t.c;document.getElementById('no-protein').textContent=t.p;document.getElementById('no-meal-name').textContent=m[0];document.getElementById('no-meal-items').innerHTML=m[1].map(x=>`<div>• ${escN(x)}</div>`).join('');document.getElementById('no-meal-why').textContent=`Built from ${d.type.toLowerCase()}, duration, distance, volume, RPE, TrainingDataCore fuel demand and current FatSecret nutrition budget.${coreCtx?.timing?.sessionStartKnown?' Meal timing is compared with the logged session start.':' Consumption times are stored for learning, but this workout does not currently record a session start time.'}`;const i=n.intake||{};const intakeStatus=document.getElementById('no-intake-status');if(intakeStatus){const hasIntake=i.kcal!=null||i.carb!=null||i.prot!=null||i.fat!=null;intakeStatus.textContent=hasIntake?`Hoy: ${i.kcal!=null?Math.round(i.kcal):'—'} kcal · ${i.carb!=null?Math.round(i.carb):'—'}g C · ${i.prot!=null?Math.round(i.prot):'—'}g P · ${i.fat!=null?Math.round(i.fat):'—'}g F`:'Sin datos de FatSecret hoy';}document.getElementById('no-nutri-context').innerHTML=[['Target kcal',n.targets.kcal||'—','daily'],['Consumed kcal',i.kcal==null?'—':Math.round(i.kcal),'FatSecret'],['Target carbs',n.targets.carb?`${n.targets.carb} g`:'—','daily'],['Consumed carbs',i.carb==null?'—':`${i.carb} g`,'FatSecret daily intake']].map(x=>`<div><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></div>`).join('');const fuel=window.TrainingDataCore?.performanceFuel?.(todayKey(),d.workout);const fuelScore=document.getElementById('no-fuel-score'),fuelCopy=document.getElementById('no-fuel-copy');if(fuelScore)fuelScore.textContent=fuel?.score!=null?`${fuel.score}% · ${fuel.status}`:'—';if(fuelCopy)fuelCopy.textContent=fuel?.score!=null?`${fuel.demand.demand} demand · ${fuel.limitingFactor||'No limiting factor identified'}`:(fuel?.fuelTarget?.carbs?`Planned target ~${fuel.fuelTarget.carbs} g carbs · ~${fuel.fuelTarget.preWorkoutCarbs} g in the pre-workout window. Sync FatSecret to compare actual intake.`:'Sync FatSecret and log a session to calculate fuel.');document.getElementById('no-analysis-title').textContent=`${d.type} fueling`;document.getElementById('no-analysis-copy').textContent=d.workout?'The recommendation distinguishes short strength, long endurance and mixed sessions instead of relying on one High/Moderate/Low label.':'Add today\'s session to unlock session-specific fueling.';const b=coreCtx?.budget||null,tm=coreCtx?.timing||null;document.getElementById('no-analysis-list').innerHTML=[`${d.duration||0} min · ${d.distance||0} km · ${Math.round(d.volume)} volume · RPE ${d.rpe||'—'}`,n.targets.kcal?`Daily target: ${n.targets.kcal} kcal · ${n.targets.carb} g carbs · ${n.targets.prot} g protein`:'Calculate your daily target first',b?.remaining?.kcal!=null?`Remaining today: ${Math.round(b.remaining.kcal)} kcal · ${b.remaining.carb!=null?Math.round(b.remaining.carb):'—'} g carbs · ${b.remaining.prot!=null?Math.round(b.remaining.prot):'—'} g protein`:'Daily intake is incomplete; sync FatSecret before using remaining-macro budgeting.',tm?.timedEntries?`${tm.timedEntries} FatSecret meal${tm.timedEntries===1?'':'s'} include consumption time.`:'No timed FatSecret meal entries are available for this date.'].map(x=>`<div>${escN(x)}</div>`).join('');document.getElementById('no-next-session').textContent=next?`Next · ${next.date}`:'Next session —';document.getElementById('no-nutrition-loop').innerHTML=[['BEFORE',`${t.c} g carbs · ${t.p} g protein · ~${t.k} kcal`,`${timing===180?'3+ h':timing===120?'2 h':timing+' min'} before`],['DURING',during(d,n),'Based on duration, distance and intensity'],['AFTER',after(d,next,n),'Based on completed work + next plan']].map(x=>`<div class="nutrition-loop-step"><strong>${x[0]}</strong>${escN(x[1])}<br><small>${escN(x[2])}</small></div>`).join('');document.getElementById('no-learning-count').textContent=`${f.length} session${f.length===1?'':'s'} · central model`;document.getElementById('no-learning-insight').textContent=learning(f);document.querySelectorAll('[data-nutrition-time]').forEach(b=>b.classList.toggle('active',Number(b.dataset.nutritionTime)===timing));}
/* ============================================================ MEAL PLAN — macro-driven meal options.============================================================ */
const MEAL_TARGETS={
  pre:{
    label:'Pre-workout',
    short:'Pre',
    protein:15,
    carbs:35,
    fat:3,
    kcal:227
  },
  post:{
    label:'Breakfast / post-workout',
    short:'Post',
    protein:30,
    carbs:55,
    fat:8,
    kcal:412
  },
  lunch:{
    label:'Lunch',
    short:'Lunch',
    protein:30,
    carbs:55,
    fat:10,
    kcal:430
  },
  snack:{
    label:'Snack',
    short:'Snack',
    protein:20,
    carbs:25,
    fat:7,
    kcal:243
  },
  dinner:{
    label:'Dinner',
    short:'Dinner',
    protein:25,
    carbs:30,
    fat:8,
    kcal:292
  }
};
/*
  Nutrition values are per 100 g.

  These are deliberately kept in one local food database so that:
  - ingredient quantities can be calculated
  - macros can be recalculated from quantities
  - recipes do not contain fake fixed macro totals
*/

const MEAL_FOODS={
  banana:{
    name:'Banana',
    kcal:89,
    protein:1.1,
    carbs:22.8,
    fat:0.3
  },

  berries:{
    name:'Berries',
    kcal:50,
    protein:0.7,
    carbs:12,
    fat:0.3
  },

  mango:{
    name:'Mango',
    kcal:60,
    protein:0.8,
    carbs:15,
    fat:0.4
  },

  apple:{
    name:'Apple',
    kcal:52,
    protein:0.3,
    carbs:13.8,
    fat:0.2
  },

  whiteBread:{
    name:'White bread',
    kcal:265,
    protein:9,
    carbs:49,
    fat:3.2
  },

  riceCakes:{
    name:'Rice cakes',
    kcal:387,
    protein:8,
    carbs:81,
    fat:3
  },

  oats:{
    name:'Oats',
    kcal:389,
    protein:16.9,
    carbs:66.3,
    fat:6.9
  },

  creamRice:{
    name:'Cream of rice',
    kcal:360,
    protein:7,
    carbs:80,
    fat:1
  },

  cornFlakes:{
    name:'Corn flakes',
    kcal:357,
    protein:7.5,
    carbs:84,
    fat:0.4
  },

  cookedRice:{
    name:'Cooked rice',
    kcal:130,
    protein:2.7,
    carbs:28,
    fat:0.3
  },

  cookedPasta:{
    name:'Cooked pasta',
    kcal:158,
    protein:5.8,
    carbs:30.9,
    fat:0.9
  },

  potato:{
    name:'Potato',
    kcal:77,
    protein:2,
    carbs:17,
    fat:0.1
  },

  chicken:{
    name:'Chicken breast',
    kcal:165,
    protein:31,
    carbs:0,
    fat:3.6
  },

  turkey:{
    name:'Turkey breast',
    kcal:110,
    protein:24,
    carbs:1,
    fat:1.5
  },

  tuna:{
    name:'Tuna',
    kcal:116,
    protein:26,
    carbs:0,
    fat:1
  },

  whiteFish:{
    name:'White fish',
    kcal:100,
    protein:22,
    carbs:0,
    fat:1.5
  },

  egg:{
    name:'Egg',
    kcal:143,
    protein:12.6,
    carbs:0.7,
    fat:9.5
  },

  eggWhites:{
    name:'Egg whites',
    kcal:52,
    protein:10.9,
    carbs:0.7,
    fat:0.2
  },

  skyr:{
    name:'Skyr 0%',
    kcal:63,
    protein:11,
    carbs:4,
    fat:0.2
  },

  greekYogurt:{
    name:'Greek yogurt 0%',
    kcal:59,
    protein:10,
    carbs:3.6,
    fat:0.4
  },

  milk:{
    name:'Low-fat milk',
    kcal:47,
    protein:3.4,
    carbs:4.8,
    fat:1.5
  },

  cottageCheese:{
    name:'Cottage cheese',
    kcal:98,
    protein:11,
    carbs:3.4,
    fat:4.3
  },

  peanutButter:{
    name:'Peanut butter',
    kcal:588,
    protein:25,
    carbs:20,
    fat:50
  },

  honey:{
    name:'Honey',
    kcal:304,
    protein:0.3,
    carbs:82.4,
    fat:0
  },

  jam:{
    name:'Jam',
    kcal:250,
    protein:0.4,
    carbs:65,
    fat:0.1
  },

  oliveOil:{
    name:'Olive oil',
    kcal:884,
    protein:0,
    carbs:0,
    fat:100
  },

  lightCheese:{
    name:'Light cheese',
    kcal:250,
    protein:28,
    carbs:3,
    fat:13
  }
};

/*
  Recipe templates.
  Quantities are starting points.
  The optimizer will adjust the "variable" ingredients.
*/

const MEAL_TEMPLATES={
  pre:[
    {
      name:'Toast + turkey + banana',
      ingredients:[
        ['whiteBread',40],
        ['turkey',45],
        ['banana',100]
      ],
      variable:['whiteBread','banana','turkey']
    },
    {
      name:'Cream of rice + skyr + banana',
      ingredients:[
        ['creamRice',35],
        ['skyr',100],
        ['banana',100],
        ['honey',5]
      ],
      variable:['creamRice','banana','skyr']
    },
    {
      name:'Rice cakes + skyr + mango',
      ingredients:[
        ['riceCakes',25],
        ['skyr',100],
        ['mango',100]
      ],
      variable:['riceCakes','mango','skyr']
    }
  ],

  post:[
    {
      name:'Oats + skyr + banana',
      ingredients:[
        ['oats',45],
        ['skyr',180],
        ['banana',100]
      ],
      variable:['oats','banana','skyr']
    },
    {
      name:'Toast + turkey + fruit',
      ingredients:[
        ['whiteBread',70],
        ['turkey',80],
        ['banana',100]
      ],
      variable:['whiteBread','banana','turkey']
    },
    {
      name:'Cream of rice + skyr + berries',
      ingredients:[
        ['creamRice',55],
        ['skyr',180],
        ['berries',100]
      ],
      variable:['creamRice','berries','skyr']
    }
  ],

  lunch:[
    {
      name:'Rice + chicken + vegetables',
      ingredients:[
        ['cookedRice',170],
        ['chicken',90],
        ['oliveOil',5]
      ],
      variable:['cookedRice','chicken','oliveOil']
    },
    {
      name:'Pasta + tuna + olive oil',
      ingredients:[
        ['cookedPasta',170],
        ['tuna',90],
        ['oliveOil',6]
      ],
      variable:['cookedPasta','tuna','oliveOil']
    },
    {
      name:'Potato + chicken + olive oil',
      ingredients:[
        ['potato',250],
        ['chicken',85],
        ['oliveOil',7]
      ],
      variable:['potato','chicken','oliveOil']
    }
  ],

  snack:[
    {
      name:'Skyr + berries + oats',
      ingredients:[
        ['skyr',150],
        ['berries',100],
        ['oats',20]
      ],
      variable:['skyr','berries','oats']
    },
    {
      name:'Greek yogurt + banana + oats',
      ingredients:[
        ['greekYogurt',170],
        ['banana',80],
        ['oats',15]
      ],
      variable:['greekYogurt','banana','oats']
    },
    {
      name:'Toast + turkey + fruit',
      ingredients:[
        ['whiteBread',40],
        ['turkey',55],
        ['apple',100]
      ],
      variable:['whiteBread','turkey','apple']
    }
  ],

  dinner:[
    {
      name:'Chicken quesadilla',
      ingredients:[
        ['whiteBread',80],
        ['chicken',70],
        ['lightCheese',15]
      ],
      variable:['whiteBread','chicken','lightCheese']
    },
    {
      name:'Rice + white fish',
      ingredients:[
        ['cookedRice',120],
        ['whiteFish',90],
        ['oliveOil',5]
      ],
      variable:['cookedRice','whiteFish','oliveOil']
    },
    {
      name:'Potato + turkey + olive oil',
      ingredients:[
        ['potato',180],
        ['turkey',80],
        ['oliveOil',5]
      ],
      variable:['potato','turkey','oliveOil']
    }
  ]
};

function mealNutrition(ingredients){

  const result={
    protein:0,
    carbs:0,
    fat:0,
    kcal:0
  };

  if(!Array.isArray(ingredients)){
    return result;
  }

  ingredients.forEach(item=>{

    const foodKey=
      typeof item==='string'
        ?item
        :(
          item?.food||
          item?.key||
          item?.name||
          item?.id
        );

    const food=MEAL_FOODS[foodKey];

    if(!food)return;

    const grams=
      typeof item==='string'
        ?100
        :Math.max(
          0,
          Number(
            item?.grams??
            item?.amount??
            item?.quantity??
            item?.qty??
            0
          )||0
        );

    const factor=grams/100;

    result.protein+=Number(food.protein||0)*factor;
    result.carbs+=Number(food.carbs||0)*factor;
    result.fat+=Number(food.fat||0)*factor;
  });

  /*
   * Macro-derived calories keep the displayed kcal consistent
   * with the displayed P/C/F values.
   */
  result.kcal=
    result.protein*4+
    result.carbs*4+
    result.fat*9;

  result.protein=Number(result.protein.toFixed(1));
  result.carbs=Number(result.carbs.toFixed(1));
  result.fat=Number(result.fat.toFixed(1));
  result.kcal=Math.round(result.kcal);

  return result;
}

function mealScore(nutrition,target){
  if(!nutrition||!target)return Infinity;

  return (
    Math.abs(nutrition.protein-target.protein)*3+
    Math.abs(nutrition.carbs-target.carbs)*2+
    Math.abs(nutrition.fat-target.fat)*3
  );
}

/*
  Search small quantity combinations instead of pretending that a
  hand-written recipe already hits the target.

  Quantities are constrained to realistic increments.
*/

function optimizeMeal(template,target){

  if(
    !template ||
    !Array.isArray(template.ingredients) ||
    !template.ingredients.length
  ){
    return null;
  }

  const targetP=Number(target?.protein)||0;
  const targetC=Number(target?.carbs)||0;
  const targetF=Number(target?.fat)||0;

  /*
   * Convert the current template format:
   *
   * ['whiteBread',40]
   *
   * into:
   *
   * {food:'whiteBread',grams:40}
   */
  const baseIngredients=template.ingredients
    .map(item=>{

      if(Array.isArray(item)){

        return {
          food:item[0],
          grams:Number(item[1])||100
        };

      }

      if(item&&typeof item==='object'){

        return {
          food:
            item.food||
            item.key||
            item.name||
            item.id||
            null,

          grams:
            Number(
              item.grams??
              item.amount??
              item.quantity??
              item.qty??
              100
            )||100
        };

      }

      return null;

    })
    .filter(item=>
      item?.food &&
      MEAL_FOODS[item.food]
    );

  if(!baseIngredients.length){
    return null;
  }

  /*
   * Only ingredients explicitly listed in "variable"
   * are optimized.
   *
   * All other ingredients keep their original quantity.
   */
  const variableKeys=new Set(
    Array.isArray(template.variable)
      ?template.variable
      :[]
  );

  const ranges=baseIngredients.map(item=>{

    if(!variableKeys.has(item.food)){
      return [item.grams];
    }

    const base=Math.max(
      5,
      Number(item.grams)||100
    );

    const min=Math.max(
      5,
      Math.round((base*0.45)/5)*5
    );

    const max=Math.min(
      500,
      Math.round((base*1.80)/5)*5
    );

    const values=[];

    for(
      let grams=min;
      grams<=max;
      grams+=5
    ){
      values.push(grams);
    }

    return values;

  });

  let best=null;

  function evaluate(index,current){

    if(index===baseIngredients.length){

      const nutrition=mealNutrition(
        current.map(item=>({
          food:item.food,
          grams:item.grams
        }))
      );

      if(!nutrition)return;

      const pError=
        Math.abs(nutrition.protein-targetP);

      const cError=
        Math.abs(nutrition.carbs-targetC);

      const fError=
        Math.abs(nutrition.fat-targetF);

      const kcalTarget=
        targetP*4+
        targetC*4+
        targetF*9;

      const kcalError=
        Math.abs(
          nutrition.kcal-kcalTarget
        );

      /*
       * Macro accuracy has priority over calories.
       */
      const score=
        pError*4+
        cError*4+
        fError*5+
        kcalError*0.15;

      if(
        !best ||
        score<best.score
      ){

        best={

          name:
            template.name||
            template.title||
            'Meal option',

          score,

          nutrition,

          ingredients:
            current.map(item=>({

              food:item.food,

              name:
                MEAL_FOODS[item.food]?.name||
                item.food,

              grams:
                Math.round(item.grams)

            }))

        };

      }

      return;
    }

    const ingredient=
      baseIngredients[index];

    for(
      const grams of ranges[index]
    ){

      current.push({

        food:ingredient.food,

        grams

      });

      evaluate(
        index+1,
        current
      );

      current.pop();

    }

  }

  evaluate(0,[]);

  return best;
}

function getMealOptions(mealKey,target){
  const templates=MEAL_TEMPLATES[mealKey]||[];

  return templates
    .map(template=>{
      const optimized=optimizeMeal(template,target);

      if(!optimized)return null;

      return {
        ...optimized,

        /*
         * Keep the template identity after the optimizer sorts
         * the candidates by macro accuracy.
         */
        name:
          optimized.name||
          template.name||
          `${mealKeyLabel(mealKey)} option`,

        templateName:
          template.name||
          optimized.name||
          `${mealKeyLabel(mealKey)} option`
      };
    })
    .filter(Boolean)
    .sort((a,b)=>
      Number(a.score??Infinity)-Number(b.score??Infinity)
    );
}

function mealTargetFromDaily(targets,mealKey,coreCtx=null){
  const fallback=MEAL_TARGETS[mealKey];
  if(!fallback)return null;

  const daily={
    protein:Number(targets?.prot??targets?.protein),
    carbs:Number(targets?.carb??targets?.carbs),
    fat:Number(targets?.fat)
  };

  const hasDaily=Object.values(daily).every(Number.isFinite)&&Object.values(daily).every(v=>v>0);
  if(!hasDaily)return {...fallback};

  const baseTotals=Object.keys(MEAL_TARGETS).reduce((sum,key)=>{
    const t=MEAL_TARGETS[key];
    return{
      protein:sum.protein+t.protein,
      carbs:sum.carbs+t.carbs,
      fat:sum.fat+t.fat
    };
  },{protein:0,carbs:0,fat:0});

  const meals=Object.keys(MEAL_TARGETS);
  const carbWeights={};
  meals.forEach(key=>{carbWeights[key]=MEAL_TARGETS[key].carbs/baseTotals.carbs});

  /*
   * Training demand changes carbohydrate distribution, not the daily
   * carbohydrate target. Higher-demand sessions shift more of the
   * available carbohydrate budget toward pre/post-workout meals.
   */
  const demand=String(coreCtx?.demand?.demand||'').toLowerCase();
  const hasTraining=coreCtx?.demand?.hasWorkout||coreCtx?.demand?.planned||demand!=='rest day';
  const factor=demand==='high'?1.35:demand==='moderate'?1.18:hasTraining?1.08:0.9;

  if(hasTraining){
    carbWeights.pre*=factor;
    carbWeights.post*=factor;
  }else{
    carbWeights.pre*=0.85;
    carbWeights.post*=0.9;
  }

  const carbWeightTotal=Object.values(carbWeights).reduce((a,b)=>a+b,0);
  const carbShare=carbWeights[mealKey]/carbWeightTotal;

  const proteinShare=MEAL_TARGETS[mealKey].protein/baseTotals.protein;
  const fatShare=MEAL_TARGETS[mealKey].fat/baseTotals.fat;

  const protein=Math.round(daily.protein*proteinShare*10)/10;
  const carbs=Math.round(daily.carbs*carbShare*10)/10;
  const fat=Math.round(daily.fat*fatShare*10)/10;

  return{
    ...fallback,
    protein,
    carbs,
    fat,
    kcal:Math.round(protein*4+carbs*4+fat*9)
  };
}
function mealKeyFromTiming(value){
  const t=Number(value);

  if(t===30||t===60||t===120||t===180){
    return 'pre';
  }

  return 'pre';
}

function mealKeyLabel(key){
  return MEAL_TARGETS[key]?.label||key;
}

function mealTargetKcal(target){
  return Math.round(
    target.protein*4+
    target.carbs*4+
    target.fat*9
  );
}
 
function renderMealPlan(n,d,coreCtx=null){
  const host=document.getElementById('no-meal-plan');
  if(!host)return;

  const targets=n.targets||{};
  const intake=n.intake||{};

  /*
   * Remaining nutrition is derived from the real Nutrition Data Layer.
   * We intentionally do NOT call TrainingDataCore.nutritionBudget()
   * because that API is not guaranteed to exist.
   */
  const remaining={
    kcal:
      coreCtx?.budget?.remaining?.kcal ??
      (intake.kcal!=null&&targets.kcal
        ?Math.max(0,Number(targets.kcal)-Number(intake.kcal))
        :null),

    carbs:
      coreCtx?.budget?.remaining?.carb ??
      (intake.carb!=null&&targets.carb
        ?Math.max(0,Number(targets.carb)-Number(intake.carb))
        :null),

    protein:
      coreCtx?.budget?.remaining?.prot ??
      (intake.prot!=null&&targets.prot
        ?Math.max(0,Number(targets.prot)-Number(intake.prot))
        :null),

    fat:
      coreCtx?.budget?.remaining?.fat ??
      (intake.fat!=null&&targets.fat
        ?Math.max(0,Number(targets.fat)-Number(intake.fat))
        :null)
  };

  const mealKey=selectedMeal;
  const target=mealTargetFromDaily(targets,mealKey,coreCtx);
  const options=getMealOptions(mealKey,target).slice(0,3);
  const targetKcal=mealTargetKcal(target);

  const mealRemaining={
    kcal:remaining.kcal,
    carbs:remaining.carbs,
    protein:remaining.protein,
    fat:remaining.fat
  };

  const status=document.getElementById('no-plan-status');

  if(status){
    status.textContent=
      remaining.kcal!=null
        ?`${Math.round(remaining.kcal)} kcal remaining today`
        :'Daily intake pending';
  }

  const summary=document.getElementById('no-plan-summary');

  if(summary){
    summary.textContent=
      `Target for ${mealKeyLabel(mealKey)}: `+
      `${target.protein} g protein · `+
      `${target.carbs} g carbs · `+
      `${target.fat} g fat · `+
      `~${targetKcal} kcal.`;
  }

  host.innerHTML=`
    <div class="nutrition-meal-target">
      <div>
        <span class="nutrition-meal-target-label">Meal target</span>
        <strong>${mealKeyLabel(mealKey)}</strong>
      </div>

      <div class="nutrition-meal-target-macros">
        <span><b>${target.protein} g</b> P</span>
        <span><b>${target.carbs} g</b> C</span>
        <span><b>${target.fat} g</b> F</span>
        <span><b>~${targetKcal}</b> kcal</span>
      </div>
    </div>

    <div class="nutrition-meal-remaining">
      <span>Today remaining</span>
      <strong>
        ${
          mealRemaining.kcal!=null
            ?`${Math.round(mealRemaining.kcal)} kcal`
            :'—'
        }
      </strong>
      <small>
        ${
          mealRemaining.carbs!=null
            ?`${Math.round(mealRemaining.carbs)} C`
            :'— C'
        }
        ·
        ${
          mealRemaining.protein!=null
            ?`${Math.round(mealRemaining.protein)} P`
            :'— P'
        }
        ·
        ${
          mealRemaining.fat!=null
            ?`${Math.round(mealRemaining.fat)} F`
            :'— F'
        }
      </small>
    </div>

    <div class="nutrition-plan-options">
      ${
        options.length
          ?options.map((option,index)=>{

              const name=option.name||`Option ${index+1}`;
              const nutrition=option.nutrition||{
                protein:0,
                carbs:0,
                fat:0,
                kcal:0
              };

              const ingredients=Array.isArray(option.ingredients)
                ?option.ingredients
                :[];

              const pDiff=Number(nutrition.protein)-Number(target.protein);
              const cDiff=Number(nutrition.carbs)-Number(target.carbs);
              const fDiff=Number(nutrition.fat)-Number(target.fat);

              const diff=(value)=>{
                const n=Number(value)||0;
                return `${n>0?'+':''}${n.toFixed(1)} g`;
              };

              return `
                <details class="nutrition-plan-option">
                  <summary>
                    <div class="nutrition-plan-option-head">
                      <span class="nutrition-plan-option-index">
                        ${index+1}
                      </span>

                      <div class="nutrition-plan-option-title">
                        <strong>${escN(name)}</strong>
                        <span>
                          ${Math.round(nutrition.kcal)} kcal ·
                          ${Math.round(nutrition.protein)} P ·
                          ${Math.round(nutrition.carbs)} C ·
                          ${Math.round(nutrition.fat)} F
                        </span>
                      </div>
                    </div>

                    <span class="nutrition-plan-option-chevron">+</span>
                  </summary>

                  <div class="nutrition-plan-option-body">

                    <div class="nutrition-plan-macro-row">
                      <span>
                        <b>${nutrition.protein.toFixed(1)} g</b> P
                        <small>${diff(pDiff)}</small>
                      </span>

                      <span>
                        <b>${nutrition.carbs.toFixed(1)} g</b> C
                        <small>${diff(cDiff)}</small>
                      </span>

                      <span>
                        <b>${nutrition.fat.toFixed(1)} g</b> F
                        <small>${diff(fDiff)}</small>
                      </span>

                      <span>
                        <b>${Math.round(nutrition.kcal)}</b> kcal
                      </span>
                    </div>

                    <div class="nutrition-plan-ingredients">
                      <div class="nutrition-plan-ingredients-title">
                        Ingredients
                      </div>

                      ${
                        ingredients.length
                          ?ingredients.map(item=>`
                            <div class="nutrition-plan-ingredient">
                              <span>${escN(item.name||item.food||'Food')}</span>
                              <strong>${Math.round(Number(item.grams)||0)} g</strong>
                            </div>
                          `).join('')
                          :'<div class="nutrition-plan-empty">No ingredient data.</div>'
                      }
                    </div>

                    <button
                      type="button"
                      class="btn btn-small nutrition-plan-use"
                      data-meal-option="${index}">
                      Use this option
                    </button>

                  </div>
                </details>
              `;
            }).join('')
          :`
            <div class="nutrition-plan-empty">
              No meal options are available for this target yet.
            </div>
          `
      }
    </div>
  `;

  host.querySelectorAll('[data-meal-option]').forEach(button=>{
    button.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();

      const index=Number(button.dataset.mealOption);
      const selected=options[index];

      if(!selected)return;

      window.TrainMeiNutritionOptimizerSelection={
        date:todayKey(),
        meal:mealKey,
        target:{...target},
        remaining:{...remaining},
        option:JSON.parse(JSON.stringify(selected))
      };

      button.textContent='Selected';
      button.disabled=true;
      button.closest('.nutrition-plan-option')?.setAttribute('data-selected','true');
    });
  });
}

function home(){const title=document.getElementById('home-nutrition-title'),time=document.getElementById('home-nutrition-time'),body=document.getElementById('home-nutrition-body');if(!title||!body)return;const d=session(),n=nutri(),i=n.intake||{},t=n.targets||{},fuel=window.TrainingDataCore?.performanceFuel?.(todayKey(),d.workout)||null;title.textContent='Nutrition Optimizer';const hasIntake=
  i.kcal!=null||
  i.carb!=null||
  i.prot!=null||
  i.fat!=null;

time.textContent=
  d.workout
    ?d.type
    :(hasIntake
      ?'FatSecret synced'
      :(n.connected
        ?'FatSecret connected'
        :'—'));

if(!n.connected&&!hasIntake){
  body.innerHTML=
    "<div class='home-empty'>Connect and sync FatSecret to make today's nutrition available across TrainMei.</div>";
  return;
}
const kcal=i.kcal!=null?Math.round(i.kcal):null,carb=i.carb!=null?Math.round(i.carb):null,prot=i.prot!=null?Math.round(i.prot):null,remaining=kcal!=null&&t.kcal?Math.max(0,Math.round(t.kcal-kcal)):null;body.innerHTML=`<div class="home-nutrition-main"><strong>${remaining!=null?'~'+remaining+' kcal':'FatSecret'}</strong><span>${fuel?.score!=null?`Fuel ${fuel.score}% · ${fuel.status}`:'Live intake synced'}</span></div><div class="home-nutrition-meta"><span>${carb!=null?carb+' g carbs':'— carbs'}</span><span>${prot!=null?prot+' g protein':'— protein'}</span><span>${kcal!=null?kcal+' kcal logged':'No kcal total'}</span></div>`}
function open(){if(typeof showPage==='function'){showPage('nutrition-page');}else{document.querySelectorAll('.page').forEach(page=>{page.classList.remove('active');});const page=document.getElementById('nutrition-page');if(page){page.classList.add('active');}}window.scrollTo({top:0,behavior:'smooth'});setTimeout(()=>{render().catch?.(error=>{console.warn('[Nutrition Optimizer] Could not refresh after opening:',error);});},30);}
let feedbackSaveTimer=null;let feedbackSaveInFlight=false;
function feedbackComplete(){return ['no-feedback-tolerance','no-feedback-energy','no-feedback-hunger','no-feedback-performance'].every(id=>Number(document.getElementById(id)?.value||0)>0)}
function flashFeedbackSaved(){const b=document.getElementById('no-save-feedback');if(!b)return;const old=b.textContent;b.textContent='Guardado ✓';b.dataset.saved='true';setTimeout(()=>{b.textContent=old;b.dataset.saved='false'},1500)}
async function saveFB({auto=false}={}){const v={tolerance:+document.getElementById('no-feedback-tolerance')?.value||0,energy:+document.getElementById('no-feedback-energy')?.value||0,hunger:+document.getElementById('no-feedback-hunger')?.value||0,performance:+document.getElementById('no-feedback-performance')?.value||0};if(!Object.values(v).every(Boolean)||feedbackSaveInFlight)return false;feedbackSaveInFlight=true;try{const d=session(),n=nutri(),t=target(d,n),set=meals[timing]||meals[60],meal=set[variant%set.length],event={date:todayKey(),timing,mealName:meal[0],mealItems:meal[1],carbs:t.c,kcal:t.k,protein:t.p,...v,sessionType:d.type,duration:d.duration,distance:d.distance};const a=readFeedback();a.push(event);saveFeedback(a);if(window.TrainingDataCore?.recordNutritionFeedback){await window.TrainingDataCore.recordNutritionFeedback(event,d.workout||null)}else{document.dispatchEvent(new CustomEvent('trainmei:nutrition-feedback',{detail:event}))}['no-feedback-tolerance','no-feedback-energy','no-feedback-hunger','no-feedback-performance'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});render();if(auto)flashFeedbackSaved();return true}finally{feedbackSaveInFlight=false}}
function scheduleFeedbackAutoSave(){clearTimeout(feedbackSaveTimer);if(!feedbackComplete())return;feedbackSaveTimer=setTimeout(()=>saveFB({auto:true}),800)}

['no-feedback-tolerance','no-feedback-energy','no-feedback-hunger','no-feedback-performance'].forEach(id=>document.getElementById(id)?.addEventListener('change',scheduleFeedbackAutoSave));
document.addEventListener('trainmei:nutrition-updated',()=>{if(document.querySelector('#nutrition-page.active'))render().catch?.(()=>{});});
document.addEventListener('click',e=>{const t=e.target.closest('[data-nutrition-time]');if(t){
  timing=+t.dataset.nutritionTime;
  variant=0;
  render();
  return;
}

const mealTab=e.target.closest('[data-nutrition-meal]');

if(mealTab){
  selectedMeal=mealTab.dataset.nutritionMeal||'post';
  render();
  return;
}

if(e.target.closest('#no-change-meal')){variant++;render();return}if(e.target.closest('#no-open-nutri')){if(typeof showPage==='function'){showPage('nutri-page');}else{document.querySelectorAll('.page').forEach(page=>{page.classList.remove('active');});const page=document.getElementById('nutri-page');if(page){page.classList.add('active');}}window.scrollTo({top:0,behavior:'smooth'});return;}if(e.target.closest('#no-save-feedback')){saveFB();return}if(e.target.closest('[data-home-action="nutrition"]')){open();return}const p=e.target.closest('[data-page]');if(p?.dataset.page==='nutrition-page')setTimeout(render,30);if(p?.dataset.page==='home-page')setTimeout(home,80);});
document.addEventListener('DOMContentLoaded',async()=>{
  try{
    if(window.TrainMeiNutritionData?.whenReady){
      await window.TrainMeiNutritionData.whenReady();
    }

    await render();
    home();
  }catch(error){
    console.warn(
      '[Nutrition Optimizer] Initial render failed:',
      error
    );
  }
});

window.TrainMeiNutrition={render,home,open};
})();
