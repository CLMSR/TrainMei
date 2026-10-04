/* ============================================================
   CYCLE TRACKER — fully isolated module.
   Renders into #cycle-tool-slot; uses its own storage key and IDs.
   ============================================================ */
(function(){
  "use strict";
  const SLOT = document.getElementById('cycle-tool-slot');
  if(!SLOT) return;

  // 1. Inject Cycle Tracker HTML into the slot (marked with .cycle-app namespace)
  SLOT.innerHTML = `
  <div class="cycle-app">
    <div class="header">
      <div class="logo">🌸 Cycle <small>tracker</small></div>
      <div class="today-pill" id="ct-todayPill">—<b>—</b></div>
    </div>
    <div class="tabs" id="ct-tabs">
      <button class="tab active" data-tab="today">🏠 Today</button>
      <button class="tab" data-tab="log">📝 Log</button>
      <button class="tab" data-tab="cal">📅 Calendar</button>
      <button class="tab" data-tab="hist">📋 History</button>
    </div>

    <div class="panel active" id="ct-panel-today">
      <div class="phase-hero" id="ct-phaseHero">
        <div class="phase-top">
          <div class="phase-emoji" id="ct-phaseEmoji">🌱</div>
          <div>
            <div class="phase-name" id="ct-phaseName">Welcome to Cycle</div>
            <div class="phase-day" id="ct-phaseDay">Log your first period to begin</div>
          </div>
        </div>
        <div class="phase-desc" id="ct-phaseDesc">
          Track your 28-day rhythm — phases, fertility, hormonal curve and self-care guidance through every cycle.
        </div>
        <div class="phase-tags" id="ct-phaseTags"></div>
      </div>
      <div class="summary" id="ct-summaryGrid"></div>
      <div class="fert-box" id="ct-fertBox">
        <div class="fert-head">
          <div class="fert-emoji" id="ct-fertEmoji">🌱</div>
          <div style="flex:1;min-width:0">
            <div class="fert-title" id="ct-fertTitle">Fertility status</div>
            <div class="fert-sub" id="ct-fertSub">Log your period to see predictions</div>
          </div>
        </div>
        <div class="fert-prob">
          <div class="fert-prob-label">Fertility estimate</div>
          <div class="fert-prob-bar"><div class="fert-prob-fill" id="ct-fertProbFill" style="width:0%"></div></div>
          <div class="fert-prob-val" id="ct-fertProbVal">—</div>
        </div>
        <div class="fert-factors" id="ct-fertFactors"></div>
      </div>
      <div class="hormone-card">
        <div class="hormone-head"><h3>📈 Hormone levels</h3></div>
        <div class="chart-wrap" id="ct-chartWrap">
          <div class="chart-empty" id="ct-chartEmpty">Log at least one period to see your hormone curve</div>
          <svg id="ct-chartSvg" style="display:none" viewBox="0 0 700 130" preserveAspectRatio="none"></svg>
          <div class="chart-today" id="ct-chartToday" style="display:none"></div>
          <div class="chart-today-lbl" id="ct-chartTodayLbl" style="display:none">Today</div>
        </div>
        <div class="chart-axis">
          <span>Day 1</span><span id="ct-axisMid">Day 14</span><span id="ct-axisEnd">Day 28</span>
        </div>
        <div class="hormone-legend">
          <span><i style="background:var(--ct-period)"></i>Estrogen</span>
          <span><i style="background:var(--ct-primary)"></i>Progesterone</span>
          <span><i style="background:#c8a878"></i>LH</span>
          <span><i style="background:#a89070"></i>FSH</span>
        </div>
      </div>
      <div class="cycle-training-card" id="ct-trainingCard">
        <div class="cycle-training-head"><div><div class="cycle-kicker">TRAINING CONTEXT</div><h3>Cycle-informed readiness</h3></div><span id="ct-trainingDemand" class="cycle-training-badge">—</span></div>
        <div class="cycle-training-grid">
          <div class="cycle-training-stat"><span>Readiness score</span><div class="cycle-readiness-wrap"><div class="cycle-readiness-ring" id="ct-readinessRing"><strong id="ct-readinessScore">—</strong></div><div class="cycle-readiness-copy"><strong id="ct-trainingReadiness">—</strong><small id="ct-trainingReadinessNote">Log Sleep, Energy and Soreness in your workout.</small></div></div></div>
          <div class="cycle-training-stat"><span>Performance context</span><strong id="ct-performanceContext">—</strong><small id="ct-performanceNote">—</small></div>
          <div class="cycle-training-stat"><span>Hormonal context</span><strong id="ct-hormonalContext">—</strong><small id="ct-hormonalNote">—</small></div>
        </div>
        <div class="cycle-driver-list" id="ct-readinessDrivers"></div>
        <div class="cycle-training-insight" id="ct-trainingInsight">Your cycle phase is one context signal; observed recovery and actual training response remain primary.</div>
      </div>
      <div class="cycle-performance-card" id="ct-performanceCard">
        <div class="cycle-training-head"><div><div class="cycle-kicker">CYCLE ↔ PERFORMANCE</div><h3>Observed training by phase</h3></div><span id="ct-performanceSample" class="cycle-training-badge">0 sessions</span></div>
        <div id="ct-performanceTable" class="cycle-performance-table"></div>
        <div id="ct-performanceCorrelation" class="cycle-performance-note">Complete more sessions with real training metrics to build a personal comparison.</div>
      </div>
      <div class="card">
        <h3>⚡ Quick action</h3>
        <button class="btn block" id="ct-quickToday">🩸 Log period today</button>
      </div>
    </div>

    <div class="panel" id="ct-panel-log">
      <div class="card">
        <h3>🩸 New entry</h3>
        <div class="form-row">
          <div class="field"><label>Start date</label><input type="date" id="ct-regDate"></div>
          <div class="field"><label>Duration (days)</label><input type="number" id="ct-regDuration" value="5" min="1" max="15"></div>
        </div>
        <label style="font-size:.78rem;color:#a08268;font-weight:600;display:block;margin-bottom:4px">Flow</label>
        <div class="chip-group" id="ct-flowChips">
          <button class="chip selected" data-flow="medium">💧 Medium</button>
          <button class="chip" data-flow="light">💧 Light</button>
          <button class="chip" data-flow="heavy">💧 Heavy</button>
          <button class="chip" data-flow="spotting">• Spotting</button>
        </div>
        <label style="font-size:.78rem;color:#a08268;font-weight:600;display:block;margin:14px 0 4px">Symptoms</label>
        <div class="chip-group" id="ct-symChips">
          <button class="chip sym" data-sym="Cramps">Cramps</button>
          <button class="chip sym" data-sym="Headache">Headache</button>
          <button class="chip sym" data-sym="Bloating">Bloating</button>
          <button class="chip sym" data-sym="Fatigue">Fatigue</button>
          <button class="chip sym" data-sym="Acne">Acne</button>
          <button class="chip sym" data-sym="Cravings">Cravings</button>
          <button class="chip sym" data-sym="Back pain">Back pain</button>
          <button class="chip sym" data-sym="Insomnia">Insomnia</button>
        </div>
        <div class="form-row" style="margin-top:14px">
          <div class="field"><label>Mood</label>
            <select id="ct-regMood">
              <option value="">—</option>
              <option>😊 Good</option><option>😐 Neutral</option><option>😢 Sad</option>
              <option>😠 Irritable</option><option>😰 Anxious</option><option>😴 Tired</option>
            </select>
          </div>
          <div class="field"><label>Basal temp (°C)</label><input type="number" id="ct-regTemp" step="0.01" placeholder="36.5" min="34" max="42"></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Notes</label><textarea id="ct-regNotes" placeholder="Anything you want to remember?"></textarea></div>
        </div>
        <button class="btn block" id="ct-saveReg">✓ Save entry</button>
      </div>
    </div>

    <div class="panel" id="ct-panel-cal">
      <div class="card cal-card">
        <div class="cal-head">
          <h3 id="ct-calTitle">—</h3>
          <div class="cal-nav">
            <button id="ct-calPrev" aria-label="Previous month">‹</button>
            <button id="ct-calNext" aria-label="Next month">›</button>
          </div>
        </div>
        <div class="cal-wrap"><div class="cal-grid" id="ct-calGrid"></div></div>
        <div class="legend">
          <span><i style="background:var(--ct-period)"></i>Period</span>
          <span><i style="background:var(--ct-fertile)"></i>Fertile</span>
          <span><i style="background:var(--ct-primary)"></i>Ovulation</span>
          <span><i style="background:var(--ct-predicted);border:1px dashed var(--ct-period)"></i>Predicted</span>
        </div>
      </div>
    </div>

    <div class="panel" id="ct-panel-hist">
      <div class="card">
        <h3>📋 Entries (<span id="ct-histCount">0</span>)</h3>
        <div class="log-list" id="ct-logList"></div>
      </div>
      <button class="btn ghost block" id="ct-clearAll" style="color:#c98a7a;border-color:#f0d8cc">🗑️ Clear all data</button>
    </div>

    <div class="modal-backdrop" id="ct-editModal" style="position:fixed;inset:0;background:rgba(90,70,55,.45);backdrop-filter:blur(3px);display:none;align-items:center;justify-content:center;padding:18px;z-index:120">
      <div style="background:#fffefb;border-radius:26px;padding:22px;max-width:440px;width:100%;max-height:90vh;overflow-y:auto;border:1px solid #f3e8d8">
        <h3 style="color:#8a6f5c;margin-bottom:16px;font-size:1.1rem">✏️ Edit entry</h3>
        <input type="hidden" id="ct-editId">
        <div class="form-row">
          <div class="field"><label>Date</label><input type="date" id="ct-editDate"></div>
          <div class="field"><label>Duration</label><input type="number" id="ct-editDuration" min="1" max="15"></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Flow</label>
            <select id="ct-editFlow">
              <option value="light">Light</option><option value="medium">Medium</option>
              <option value="heavy">Heavy</option><option value="spotting">Spotting</option>
            </select>
          </div>
          <div class="field"><label>Mood</label><input type="text" id="ct-editMood" placeholder="—"></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Symptoms (comma separated)</label><input type="text" id="ct-editSym" placeholder="Cramps, Fatigue"></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Notes</label><textarea id="ct-editNotes"></textarea></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn ghost" style="flex:1" id="ct-cancelEdit">Cancel</button>
          <button class="btn" style="flex:1" id="ct-saveEdit">Save</button>
        </div>
      </div>
    </div>

    <div class="ct-toast" id="ct-toast"></div>
  </div>`;

  // 2. Cycle Tracker logic — isolated, scoped to the .cycle-app container
  const root = SLOT.querySelector('.cycle-app');
  const $  = s => root.querySelector(s);
  const $$ = s => Array.from(root.querySelectorAll(s));

  const KEY = "cycle_tracker_records_v3";
  let records = [];
  let editingId = null;

  function todayMid(){ const n=new Date(); return new Date(n.getFullYear(),n.getMonth(),n.getDate()); }
  function toISO(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function parseISO(s){ const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
  function addDays(d,n){ const r=new Date(d); r.setDate(r.getDate()+n); return r; }
  function daysBetween(a,b){
    const ua=Date.UTC(a.getFullYear(),a.getMonth(),a.getDate());
    const ub=Date.UTC(b.getFullYear(),b.getMonth(),b.getDate());
    return Math.round((ub-ua)/86400000);
  }
  function fmtLong(d){ return d.toLocaleDateString('en-US',{weekday:'long',day:'numeric',month:'long'}); }
  function fmtShort(d){ return d.toLocaleDateString('en-US',{day:'numeric',month:'short'}); }
  function fmtISOtoLong(iso){ return fmtLong(parseISO(iso)); }
  function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }

  function toast(msg){
    const t=$("#ct-toast"); if(!t) return;
    t.textContent=msg; t.classList.add("show");
    clearTimeout(t._tm); t._tm=setTimeout(()=>t.classList.remove("show"),2200);
  }

  function load(){
    try{
      let raw = localStorage.getItem(KEY);
      if(!raw) raw = localStorage.getItem("cycle_tracker_records_v2");
      records = raw ? JSON.parse(raw) : [];
      if(!Array.isArray(records)) records=[];
      const byDate=new Map();
      records.forEach(r=>{if(r&&/^\d{4}-\d{2}-\d{2}$/.test(String(r.date||'')))byDate.set(String(r.date),{...r,date:String(r.date),duration:Math.max(1,Math.min(15,Number(r.duration)||5)),symptoms:Array.isArray(r.symptoms)?[...new Set(r.symptoms.map(String))]:[]});});
      records=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
      localStorage.setItem(KEY,JSON.stringify(records));
    }catch(e){ records=[]; }
  }
  function save(){ try{localStorage.setItem(KEY, JSON.stringify(records));}catch(e){ toast("Cycle log could not be saved"); } }

  function analyze(){
    const today = todayMid();
    const n = records.length;
    let lastStart=null, cycleDay=null, avgCycle=28, avgPeriodLen=5, cyclesCount=0;
    let cycleVariability = 0;
    let nextPeriod=null, ovulation=null, fertileStart=null, fertileEnd=null;
    let cycleLengths = [];

    if(n > 0){
      const sorted = [...records].sort((a,b)=> a.date.localeCompare(b.date));
      const lastRec = sorted[sorted.length-1];
      lastStart = parseISO(lastRec.date);

      const durs = records.map(r=>Number(r.duration)||5).filter(x=>x>0);
      if(durs.length) avgPeriodLen = Math.round(durs.reduce((a,b)=>a+b,0)/durs.length);

      if(sorted.length >= 2){
        let total=0, count=0;
        for(let i=1;i<sorted.length;i++){
          const d = daysBetween(parseISO(sorted[i-1].date), parseISO(sorted[i].date));
          if(d>=15 && d<=60){ total+=d; count++; cycleLengths.push(d); }
        }
        if(count>0){
          avgCycle = Math.round(total/count);
          cyclesCount = count;
          const mean = total/count;
          const dev = cycleLengths.reduce((a,b)=> a + Math.abs(b-mean), 0) / count;
          cycleVariability = Math.round(dev * 10) / 10;
        }
      }
      avgCycle = Math.min(45, Math.max(19, avgCycle));

      if(lastStart <= today) cycleDay = daysBetween(lastStart, today)+1;

      nextPeriod = addDays(lastStart, avgCycle);
      while(nextPeriod < today) nextPeriod = addDays(nextPeriod, avgCycle);

      ovulation = addDays(nextPeriod, -14);
      fertileStart = addDays(ovulation, -5);
      fertileEnd = addDays(ovulation, 1);
    }

    return { today, n, lastStart, cycleDay, avgCycle, avgPeriodLen, cyclesCount,
             cycleVariability, nextPeriod, ovulation, fertileStart, fertileEnd };
  }

  function getPhase(a){
    if(a.n === 0 || a.cycleDay === null){
      return { key:"welcome", emoji:"🌸", name:"Welcome to Cycle",
        dayLabel:"Log your first period to begin",
        desc:"Track your 28-day rhythm — phases, fertility, hormonal curve and self-care guidance through every cycle.",
        tags:["Phases","Fertility","Hormones"] };
    }
    const cd = a.cycleDay;
    if(cd <= a.avgPeriodLen){
      return { key:"menstrual", emoji:"🩸", name:"Menstrual",
        dayLabel:`Day ${cd} · ${a.avgPeriodLen - cd + 1} day${a.avgPeriodLen-cd+1!==1?'s':''} left`,
        desc:"Time to shed the uterine lining and start anew. Focus on rest, self-care and light movement.",
        tags:["Rest","Iron-rich food","Gentle yoga","Warmth"] };
    }
    if(a.fertileStart && a.today < a.fertileStart){
      return { key:"follicular", emoji:"🌱", name:"Follicular",
        dayLabel:`Day ${cd} · energy rising`,
        desc:"Feel the energy and creativity boost. A great time to set goals, plan and enjoy nourishing foods.",
        tags:["Goal setting","Creative work","Strength training","Fresh veggies"] };
    }
    if(a.fertileStart && a.fertileEnd && a.today >= a.fertileStart && a.today <= a.fertileEnd){
      return { key:"ovulatory", emoji:"🥚", name:"Ovulatory",
        dayLabel:`Day ${cd} · peak fertility`,
        desc:"Embrace your peak fertility and energy. The perfect time for socializing, working out and a balanced diet.",
        tags:["Socializing","HIIT","Balanced meals","Confidence"] };
    }
    return { key:"luteal", emoji:"🌙", name:"Luteal",
      dayLabel:`Day ${cd} · winding down`,
      desc:"Time to unwind and reflect. Indulge in nurturing activities and satisfy cravings with healthy alternatives.",
      tags:["Reflection","Walking","Magnesium","Dark chocolate"] };
  }

  function getFertility(a){
    if(a.n === 0 || a.cycleDay === null){
      return { score:0, label:"No data", emoji:"🌱", phase:"unknown", factors:[],
               color:"#e8c9a8", desc:"Log your period to see your fertility status." };
    }
    const today = a.today, ovulation = a.ovulation, cycleDay = a.cycleDay;
    if(!ovulation){
      return { score:0, label:"Unknown", emoji:"🌱", phase:"unknown", factors:[],
               color:"#e8c9a8", desc:"Not enough data yet." };
    }
    const dToOv = daysBetween(today, ovulation);
    let score, label, emoji, phase, desc, color;
    const factors = [];

    if(cycleDay <= a.avgPeriodLen && dToOv < -10){ phase="menstrual"; emoji="🩸"; desc="Menstrual phase — fertility is very low."; color="#d99a8a"; }
    else if(dToOv < -5){ phase="follicular"; emoji="🌱"; desc="Follicular phase — fertility is low but building up."; color="#c8ddb8"; }
    else if(dToOv >= -5 && dToOv < -1){ phase="pre-ovulatory"; emoji="🌿"; desc="Sperm can survive up to 5 days. Fertility is rising."; color="#a8d0a0"; }
    else if(dToOv >= -1 && dToOv <= 1){ phase="ovulation"; emoji="🥚"; desc="Peak fertility — ovulation is estimated around now."; color="#8a6f5c"; }
    else if(dToOv > 1 && dToOv <= 3){ phase="post-ovulatory"; emoji="🌙"; desc="Ovulation has passed. Fertility is dropping fast."; color="#c9b096"; }
    else { phase="luteal"; emoji="🌙"; desc="Luteal phase — fertility is low until your next period."; color="#d9c4a8"; }

    const sigmaBefore = 3.2, sigmaAfter = 1.4;
    const baseScore = dToOv <= 0
      ? 100 * Math.exp(-(dToOv*dToOv)/(2*sigmaBefore*sigmaBefore))
      : 100 * Math.exp(-(dToOv*dToOv)/(2*sigmaAfter*sigmaAfter));

    const variability = a.cycleVariability || 0;
    const regularityFactor = Math.max(0.7, 1 - variability/20);

    let tempFactor = 1, tempConfirmed = false;
    if(records.length >= 3){
      const temps = records.filter(r=>r.temp).map(r=>Number(r.temp));
      if(temps.length >= 3){
        const recent = temps.slice(-5);
        const avgTemp = recent.reduce((a,b)=>a+b,0)/recent.length;
        const todayTemp = records.find(r=>r.date === toISO(today))?.temp;
        if(todayTemp && (Number(todayTemp) - avgTemp) >= 0.25 && dToOv >= 0){
          tempFactor = 1.15; tempConfirmed = true;
        }
      }
    }
    score = Math.round(Math.min(100, Math.max(0, baseScore * regularityFactor * tempFactor)));

    factors.push({ text:`Cycle day ${cycleDay}`, cls:"" });
    if(dToOv === 0) factors.push({ text:"Estimated ovulation day", cls:"pos" });
    else if(dToOv < 0) factors.push({ text:`${Math.abs(dToOv)} day${Math.abs(dToOv)>1?'s':''} before ovulation`, cls: dToOv >= -5 ? "pos" : "" });
    else factors.push({ text:`${dToOv} day${dToOv>1?'s':''} after ovulation`, cls: dToOv <= 1 ? "pos" : "neg" });

    if(regularityFactor < 0.9 && a.cyclesCount >= 2) factors.push({ text:`Irregular (±${variability}d)`, cls:"neg" });
    else if(a.cyclesCount >= 2) factors.push({ text:"Regular cycle", cls:"pos" });
    if(tempConfirmed) factors.push({ text:"Temp rise confirmed", cls:"pos" });

    if(score >= 75){ label="Peak fertility"; emoji="🔥"; }
    else if(score >= 45){ label="High fertility"; emoji="🥚"; }
    else if(score >= 20){ label="Moderate fertility"; emoji="🌿"; }
    else if(score >= 5){ label="Low fertility"; emoji="🌱"; }
    else { label = "Very low fertility"; emoji = phase==="menstrual" ? "🩸" : "🌙"; }

    return { score, label, emoji, phase, factors, color, desc };
  }

  function getHormoneCurve(avgCycle, ovulationDay){
    const ovDay = ovulationDay || Math.round(avgCycle - 14);
    const curve = [];
    for(let d = 1; d <= avgCycle; d++){
      const preOvPeak = Math.exp(-Math.pow(d - (ovDay - 1), 2) / (2 * Math.pow(3.5, 2)));
      const lutealPeak = 0.45 * Math.exp(-Math.pow(d - (ovDay + 7), 2) / (2 * Math.pow(4, 2)));
      const earlyRise = 0.35 * Math.min(1, d / 7);
      const estrogen = Math.min(1, earlyRise + 0.9 * preOvPeak + lutealPeak);
      const progPost = Math.exp(-Math.pow(d - (ovDay + 7), 2) / (2 * Math.pow(4.5, 2)));
      const progesterone = d > ovDay ? Math.min(1, 0.15 + 0.85 * progPost) : 0.08;
      const lhSurge = Math.exp(-Math.pow(d - (ovDay - 1), 2) / (2 * Math.pow(0.9, 2)));
      const lh = Math.min(1, 0.12 + 1.0 * lhSurge);
      const fshEarly = 0.4 * Math.exp(-Math.pow(d - 5, 2) / (2 * Math.pow(4, 2)));
      const fshOv = 0.55 * Math.exp(-Math.pow(d - ovDay, 2) / (2 * Math.pow(1.5, 2)));
      const fsh = Math.min(1, 0.15 + fshEarly + fshOv);
      curve.push({ day:d, estrogen, progesterone, lh, fsh });
    }
    return curve;
  }

  function renderHormoneChart(a){
    const svg = $("#ct-chartSvg"), empty = $("#ct-chartEmpty");
    const todayLine = $("#ct-chartToday"), todayLbl = $("#ct-chartTodayLbl");
    if(!svg) return;

    if(a.n === 0 || !a.lastStart || !a.cycleDay){
      svg.style.display="none"; empty.style.display="block";
      todayLine.style.display="none"; todayLbl.style.display="none";
      return;
    }
    empty.style.display="none"; svg.style.display="block";

    const W=700, H=130, padX=6, padY=10;
    const chartW = W - padX*2, chartH = H - padY*2;
    const totalDays = a.avgCycle;
    const ovDay = Math.round(totalDays - 14);
    const curve = getHormoneCurve(totalDays, ovDay);

    const makePath = (key) => curve.map((p,i)=>{
      const x = padX + (i/(curve.length-1))*chartW;
      const y = padY + chartH - p[key]*chartH;
      return `${i===0?'M':'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

    const estPath = makePath("estrogen");
    const progPath = makePath("progesterone");
    const lhPath = makePath("lh");
    const fshPath = makePath("fsh");
    const css = getComputedStyle(root);
    const ctAccent = css.getPropertyValue("--ct-accent").trim();
    const ctPrimary = css.getPropertyValue("--ct-primary").trim();
    const ctSecondary = css.getPropertyValue("--ct-secondary").trim();
    const ctLine = css.getPropertyValue("--ct-line-soft").trim();
    const ctCard = css.getPropertyValue("--ct-card").trim();
    const estArea = estPath + ` L${padX+chartW},${padY+chartH} L${padX},${padY+chartH} Z`;
    const ovX = padX + ((ovDay-1)/(totalDays-1))*chartW;

    svg.innerHTML = `
      <defs>
        <linearGradient id="ct-estGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${ctAccent}" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="${ctAccent}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <line x1="${padX}" y1="${padY+chartH}" x2="${padX+chartW}" y2="${padY+chartH}" stroke="${ctLine}" stroke-width="1"/>
      <line x1="${padX}" y1="${padY+chartH/2}" x2="${padX+chartW}" y2="${padY+chartH/2}" stroke="${ctLine}" stroke-width="1" stroke-dasharray="3,4"/>
      <line x1="${padX}" y1="${padY}" x2="${padX+chartW}" y2="${padY}" stroke="${ctLine}" stroke-width="1" stroke-dasharray="3,4"/>
      <path d="${estArea}" fill="url(#ct-estGrad)"/>
      <line x1="${ovX}" y1="${padY-2}" x2="${ovX}" y2="${padY+chartH+2}" stroke="${ctPrimary}" stroke-width="1" stroke-dasharray="4,3" opacity="0.5"/>
      <text x="${ovX}" y="${padY-4}" text-anchor="middle" font-size="9" fill="${ctPrimary}" font-weight="700">OV</text>
      <path d="${fshPath}"  fill="none" stroke="${ctSecondary}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
      <path d="${lhPath}"   fill="none" stroke="${ctAccent}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>
      <path d="${progPath}" fill="none" stroke="${ctPrimary}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${estPath}"  fill="none" stroke="${ctAccent}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    `;

    let todayDay = daysBetween(a.lastStart, a.today)+1;
    if(todayDay < 1) todayDay = 1;
    if(todayDay > totalDays) todayDay = totalDays;
    const todayX = padX + ((todayDay-1)/(totalDays-1))*chartW;
    const todayPct = (todayX/W)*100;

    todayLine.style.display="block"; todayLine.style.left = todayPct+"%";
    todayLbl.style.display="block"; todayLbl.style.left = todayPct+"%";
    todayLbl.textContent = `Day ${a.cycleDay}`;

    $("#ct-axisMid").textContent = `Day ${Math.round(totalDays/2)}`;
    $("#ct-axisEnd").textContent = `Day ${totalDays}`;
  }

  async function renderTrainingContext(a){
    const demandEl=$("#ct-trainingDemand"), readinessEl=$("#ct-trainingReadiness"), readinessScoreEl=$("#ct-readinessScore"), readinessRing=$("#ct-readinessRing"), readinessNote=$("#ct-trainingReadinessNote"), perfEl=$("#ct-performanceContext"), perfNote=$("#ct-performanceNote"), hormoneEl=$("#ct-hormonalContext"), hormoneNote=$("#ct-hormonalNote"), insight=$("#ct-trainingInsight"), driversEl=$("#ct-readinessDrivers"), tableEl=$("#ct-performanceTable"), sampleEl=$("#ct-performanceSample"), corrEl=$("#ct-performanceCorrelation");
    if(!demandEl) return;
    const key=toISO(a.today);let workout=null;try{const raw=localStorage.getItem('training-planner:workout:'+key);workout=raw?JSON.parse(raw):null}catch(e){workout=null}
    const blocks=Array.isArray(workout?.blocks)?workout.blocks:[],exercises=blocks.flatMap(b=>Array.isArray(b.exercises)?b.exercises:[]).filter(e=>String(e?.name||'').trim());
    const sets=exercises.reduce((n,e)=>n+(Array.isArray(e.setGroups)?e.setGroups.reduce((s,g)=>s+(Number(g?.sets)||0),0):(Number(e?.sets)||0)),0);
    const volume=estimateVolumeCycle(workout),text=JSON.stringify(workout||{}).toLowerCase(),load=Number(workout?.metrics?.load)||0,duration=Number(workout?.metrics?.timeMin)||0,distance=Number(workout?.metrics?.distanceKm)||0,rpe=Number(workout?.metrics?.rpe)||0;
    const demandScore=Math.min(100,Math.round((load?Math.min(55,load/2):0)+(duration?Math.min(20,duration/4):0)+(distance?Math.min(25,distance*2):0)+(volume?Math.min(20,volume/500):0)+(rpe?Math.min(15,rpe*1.5):0)+(/amrap|for time|emom|time cap|conditioning|running/.test(text)?10:0)));const demand=demandScore>=70?'High':demandScore>=40?'Moderate':'Low';demandEl.textContent=workout?demand.toUpperCase():'NO SESSION';
    const r=workout?.recovery||{},sleep=Number(r.sleep)||0,energy=Number(r.energy)||0,soreness=Number(r.soreness)||0,ph=getPhase(a);
    const recentRows=await getCycleWorkoutRows(a.today,7),recentLoad=recentRows.reduce((n,row)=>n+estimateCycleLoad(row.data),0),recentSessions=recentRows.length;
    const nextRows=await getCycleWorkoutRows(a.today,7,true),nextLoad=nextRows.reduce((n,row)=>n+estimateCycleLoad(row.data),0);
    const loadInfo=window.TrainingDataCore?await window.TrainingDataCore.recentLoadRatio(key):{ratio:null,hasData:false};
    const nutritionCtx=window.TrainingDataCore?.nutritionContext?.(key)||null;
    const fuelCtx=window.TrainingDataCore?.performanceFuel?.(key,workout)||null;
    const rr=window.TrainingDataCore?window.TrainingDataCore.readiness(workout,{loadRatio:loadInfo.hasData?loadInfo.ratio:null,cyclePhase:ph.key,fuelScore:fuelCtx?.score??null}):{score:null,factors:[],status:null,confidence:null};
    const readiness=rr.score??60;
    readinessEl.textContent=readiness+'%';readinessScoreEl.textContent=readiness;readinessRing.style.setProperty('--readiness',readiness);readinessNote.textContent=rr.score!==null?`${rr.status} · ${rr.confidence}`:'Add Sleep, Energy and Soreness for a more personal score.';
    const nutritionLine=nutritionCtx?.intake?.kcal!=null||nutritionCtx?.intake?.carb!=null||nutritionCtx?.intake?.prot!=null?`FatSecret: ${nutritionCtx.intake.kcal!=null?Math.round(nutritionCtx.intake.kcal)+' kcal':'—'} · ${nutritionCtx.intake.carb!=null?Math.round(nutritionCtx.intake.carb)+' g carbs':'—'} · fuel ${fuelCtx?.score!=null?fuelCtx.score+'%':'—'}`:'FatSecret nutrition: no synced intake for this date';
    driversEl.innerHTML=(rr.factors.length?rr.factors.map(f=>`${f.label}: ${Math.round(f.value)}%`):['Recovery input: not logged']).concat([`Recent training: ${recentSessions} session${recentSessions===1?'':'s'} · estimated load ${Math.round(recentLoad)}`,`Upcoming plan: ${nextRows.length} session${nextRows.length===1?'':'s'} · estimated load ${Math.round(nextLoad)}`,nutritionLine]).map(x=>`<div class="cycle-driver">${x}</div>`).join('');
    const curve=a.cycleDay?getHormoneCurve(a.avgCycle,Math.round(a.avgCycle-14)).find(x=>x.day===Math.min(a.avgCycle,a.cycleDay)):null;const hormoneLabel=ph.key==='menstrual'?'Lower estrogen / progesterone':ph.key==='follicular'?'Estrogen rising':ph.key==='ovulatory'?'Estrogen peak context':ph.key==='luteal'?'Progesterone higher context':'Cycle context pending';
    hormoneEl.textContent=hormoneLabel;hormoneNote.textContent=curve?`Est ${Math.round(curve.estrogen*100)} · Prog ${Math.round(curve.progesterone*100)}`:'Estimated from cycle timing';perfEl.textContent=fuelCtx?.status||'Compare against your own data';perfNote.textContent=workout?`${sets} sets · ${Math.round(volume)} volume · ${duration||0} min · RPE ${rpe||'—'} · Fuel ${fuelCtx?.score!=null?fuelCtx.score+'%':'—'}`:'Add a workout to contextualize performance.';insight.textContent=`Readiness is ${readiness}%. Cycle phase is contextual; observed recovery, nutrition and actual training response are fed through TrainingDataCore rather than treated as fixed cycle rules.`;
    const comparison=buildPhaseComparison(await getCycleWorkoutRows(a.today,90));sampleEl.textContent=`${comparison.total} sessions`;tableEl.innerHTML=`<div class="head">Phase</div><div class="head">Sessions</div><div class="head">Total time</div><div class="head">Volume</div><div class="head">Load</div><div class="head">RPE</div>`+comparison.rows.map(x=>`<div>${x.phase}</div><div>${x.n||0}</div><div>${x.duration||'—'} min</div><div>${x.volume||'—'}</div><div>${x.load||'—'}</div><div>${x.rpe||'—'}</div>`).join('');corrEl.textContent=comparison.note;
  }
  function estimateCycleLoad(d){const m=d?.metrics||{},explicit=Number(m.load)||0;if(explicit>0)return explicit;const ex=(d?.blocks||[]).flatMap(b=>Array.isArray(b.exercises)?b.exercises:[]),sets=ex.reduce((n,e)=>n+exerciseSetsCycle(e),0),reps=ex.reduce((n,e)=>n+exerciseRepsCycle(e),0),mins=Number(m.timeMin)||0,rpe=Number(m.rpe)||5,dist=Number(m.distanceKm)||0;return Math.round(sets*1.8+reps*.08+mins*rpe*.55+dist*1.5)}
  function exerciseSetsCycle(e){const gs=Array.isArray(e?.setGroups)&&e.setGroups.length?e.setGroups:[e];return gs.reduce((n,g)=>n+(Number(g?.sets)||0),0)}
  function exerciseRepsCycle(e){const gs=Array.isArray(e?.setGroups)&&e.setGroups.length?e.setGroups:[e];return gs.reduce((n,g)=>n+(Number(String(g?.reps||'').match(/\d+(?:\.\d+)?/)?.[0])||0)*(Number(g?.sets)||0),0)}
  async function getCycleWorkoutRows(today,days,forward=false){const center=new Date(toISO(today)+'T12:00:00'),from=new Date(center),to=new Date(center);if(forward){from.setDate(from.getDate()+1);to.setDate(to.getDate()+days)}else{from.setDate(from.getDate()-days);to.setDate(to.getDate()-1)}const fromK=toISO(from),toK=toISO(to);try{if(typeof getAnalyticsRows==='function'){const rows=await getAnalyticsRows(fromK,toK);return(rows||[]).filter(r=>r?.data&&!r.data?.skipped&&(forward||r.data?.completed||Number(r.data?.metrics?.load)||Number(r.data?.metrics?.rpe)||Number(r.data?.metrics?.timeMin)||Number(r.data?.metrics?.distanceKm)))}}catch(e){}const rows=[];for(let dt=new Date(from);dt<=to;dt.setDate(dt.getDate()+1)){const k=toISO(dt);try{const raw=localStorage.getItem('training-planner:workout:'+k);if(raw)rows.push({date:k,data:JSON.parse(raw)})}catch(e){}}return rows}
  function analyzeCycleForDate(date){const sorted=[...records].sort((x,y)=>x.date.localeCompare(y.date));if(!sorted.length)return null;const starts=sorted.map(r=>parseISO(r.date)).filter(d=>d<=date);if(!starts.length)return null;const last=starts[starts.length-1],cycleDay=daysBetween(last,date)+1;let avg=28;if(sorted.length>=2){const diffs=[];for(let i=1;i<sorted.length;i++){const d=daysBetween(parseISO(sorted[i-1].date),parseISO(sorted[i].date));if(d>=15&&d<=60)diffs.push(d)}if(diffs.length)avg=Math.round(diffs.reduce((a,b)=>a+b,0)/diffs.length)}avg=Math.min(45,Math.max(19,avg));const periodLen=Number(sorted[sorted.length-1].duration)||5,ov=Math.max(1,avg-14),fertStart=ov-5,fertEnd=ov+1;let phase;if(cycleDay<=periodLen)phase='menstrual';else if(cycleDay<fertStart)phase='follicular';else if(cycleDay<=fertEnd)phase='ovulatory';else phase='luteal';return{phase,cycleDay,avg}}
  function estimateVolumeCycle(d){return(d?.blocks||[]).flatMap(b=>Array.isArray(b.exercises)?b.exercises:[]).reduce((n,e)=>{const gs=Array.isArray(e?.setGroups)&&e.setGroups.length?e.setGroups:[e];return n+gs.reduce((s,g)=>s+(Number(g?.sets)||0)*(Number(String(g?.reps||'').match(/\d+(?:\.\d+)?/)?.[0])||0)*(Number(g?.weight)||0),0)},0)}
  function buildPhaseComparison(rows){const buckets={menstrual:[],follicular:[],ovulatory:[],luteal:[]};rows.forEach(row=>{const phase=analyzeCycleForDate(parseISO(row.date));if(phase&&buckets[phase.phase])buckets[phase.phase].push(row.data)});const labels={menstrual:'Menstrual',follicular:'Follicular',ovulatory:'Ovulatory',luteal:'Luteal'};const stats=Object.entries(buckets).map(([phase,list])=>{const loads=list.map(estimateCycleLoad),vols=list.map(estimateVolumeCycle),mins=list.map(d=>Number(d?.metrics?.timeMin)||0),rpes=list.map(d=>Number(d?.metrics?.rpe)||0).filter(Boolean);return{phase:labels[phase],n:list.length,load:list.length?Math.round(loads.reduce((a,b)=>a+b,0)/list.length):0,volume:list.length?Math.round(vols.reduce((a,b)=>a+b,0)/list.length):0,duration:list.length?Math.round(mins.reduce((a,b)=>a+b,0)/list.length):0,rpe:rpes.length?(rpes.reduce((a,b)=>a+b,0)/rpes.length).toFixed(1):'—'}});const populated=stats.filter(x=>x.n);let note=populated.length<2?'Add completed sessions with load, volume, duration and RPE across more than one phase to build a meaningful personal comparison.':`Personal comparison from ${rows.length} recent workouts: phase averages are descriptive, not evidence of causation.`;if(populated.length>=2){const lr=Math.max(...populated.map(x=>x.load))-Math.min(...populated.map(x=>x.load)),rr=Math.max(...populated.map(x=>Number(x.rpe)||0))-Math.min(...populated.map(x=>Number(x.rpe)||0));note+=` Observed phase spread: load ${Math.round(lr)}, RPE ${rr.toFixed(1)}.`}return{rows:stats,total:rows.length,note}}

  function renderToday(){
    const a = analyze();
    $("#ct-todayPill").innerHTML = a.today.toLocaleDateString('en-US',{weekday:'short',day:'numeric',month:'short'})
      + `<b>${a.cycleDay ? 'Day '+a.cycleDay : 'No data'}</b>`;

    const ph = getPhase(a);
    $("#ct-phaseEmoji").textContent = ph.emoji;
    $("#ct-phaseName").textContent = ph.name;
    $("#ct-phaseDay").textContent = ph.dayLabel;
    $("#ct-phaseDesc").textContent = ph.desc;
    $("#ct-phaseTags").innerHTML = ph.tags.map(t=>`<span>${t}</span>`).join('');

    const grid = $("#ct-summaryGrid");
    if(a.n === 0){
      grid.innerHTML = `
        <div class="stat light" style="grid-column:span 2">
          <div class="lbl">Start here</div>
          <div class="val" style="font-size:1rem;color:#8a6f5c">Log your first period 🌸</div>
        </div>`;
    } else {
      const nextTxt = a.nextPeriod ? fmtShort(a.nextPeriod) : "—";
      const daysToNext = a.nextPeriod ? daysBetween(a.today, a.nextPeriod) : null;
      const fertileTxt = (a.fertileStart && a.fertileEnd) ? `${fmtShort(a.fertileStart)} – ${fmtShort(a.fertileEnd)}` : "—";
      grid.innerHTML = `
        <div class="stat">
          <div class="lbl">Next period</div>
          <div class="val">${nextTxt}</div>
          <div class="sub">${daysToNext!==null ? (daysToNext===0?'Today!': 'in '+daysToNext+' days') : ''}</div>
        </div>
        <div class="stat alt">
          <div class="lbl">Cycle day</div>
          <div class="val">${a.cycleDay ?? '—'}</div>
          <div class="sub">of ${a.avgCycle} days</div>
        </div>
        <div class="stat light">
          <div class="lbl">Fertile window</div>
          <div class="val" style="font-size:.9rem;color:#8a6f5c">${fertileTxt}</div>
        </div>
        <div class="stat light">
          <div class="lbl">Average cycle</div>
          <div class="val" style="font-size:1rem;color:#8a6f5c">${a.avgCycle} days</div>
          <div class="sub">${a.cyclesCount>0 ? 'based on '+a.cyclesCount+' cycle(s)' : 'default value'}</div>
        </div>`;
    }

    renderHormoneChart(a);
    renderTrainingContext(a);
    renderFertility(a);
  }

  function renderFertility(a){
    const f = getFertility(a);
    $("#ct-fertEmoji").textContent = f.emoji;
    $("#ct-fertTitle").textContent = f.label;
    $("#ct-fertSub").textContent = f.desc;
    const fill = $("#ct-fertProbFill");
    fill.style.width = f.score + "%";
    const css = getComputedStyle(root);
    const ctDanger = css.getPropertyValue("--ct-danger").trim();
    const ctSuccess = css.getPropertyValue("--ct-success").trim();
    const ctPrimary = css.getPropertyValue("--ct-primary").trim();
    const ctAccent = css.getPropertyValue("--ct-accent").trim();
    const ctSecondary = css.getPropertyValue("--ct-secondary").trim();
    fill.style.background = f.score >= 70 ? `linear-gradient(90deg,${ctDanger},${ctAccent})`
                          : f.score >= 40 ? `linear-gradient(90deg,${ctSuccess},${ctPrimary})`
                          : f.score >= 15 ? `linear-gradient(90deg,${ctAccent},${ctSecondary})`
                          : `linear-gradient(90deg,${ctAccent},${ctSecondary})`;
    $("#ct-fertProbVal").textContent = f.score + "%";
    $("#ct-fertFactors").innerHTML = f.factors.map(x=>`<span class="${x.cls}">${x.text}</span>`).join('');
  }

  let calRef = todayMid();
  calRef.setDate(1);

  function renderCal(){
    const a = analyze();
    const year = calRef.getFullYear(), month = calRef.getMonth();
    $("#ct-calTitle").textContent = calRef.toLocaleDateString('en-US',{month:'long',year:'numeric'});

    const statusMap = {};
    records.forEach(r=>{
      const start = parseISO(r.date);
      const dur = Math.max(1, Number(r.duration)||5);
      for(let i=0;i<dur;i++) statusMap[toISO(addDays(start,i))] = {type:'period'};
    });
    if(a.fertileStart && a.fertileEnd){
      let cur = new Date(a.fertileStart);
      while(cur <= a.fertileEnd){
        const k = toISO(cur);
        if(!statusMap[k]) statusMap[k] = {type:'fertile'};
        cur = addDays(cur,1);
      }
    }
    if(a.ovulation) statusMap[toISO(a.ovulation)] = {type:'ovulation'};
    if(a.nextPeriod){
      for(let i=0;i<a.avgPeriodLen;i++){
        const k = toISO(addDays(a.nextPeriod,i));
        if(!statusMap[k]) statusMap[k] = {type:'predicted-period'};
      }
    }

    const grid = $("#ct-calGrid");
    const dows = ['M','T','W','T','F','S','S'];
    let html = dows.map(d=>`<div class="cal-dow">${d}</div>`).join('');

    const first = new Date(year, month, 1);
    let startCol = (first.getDay()+6)%7;
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const todayISO = toISO(todayMid());

    for(let i=0;i<startCol;i++) html += `<div class="cal-day empty"></div>`;
    for(let d=1; d<=daysInMonth; d++){
      const cur = new Date(year, month, d);
      const iso = toISO(cur);
      const st = statusMap[iso];
      let cls = "cal-day";
      if(iso === todayISO) cls += " today";
      if(st){
        if(st.type==='period') cls+=" period";
        else if(st.type==='fertile') cls+=" fertile";
        else if(st.type==='ovulation') cls+=" ovulation";
        else if(st.type==='predicted-period') cls+=" predicted-period";
      }
      html += `<div class="${cls}" data-date="${iso}">${d}</div>`;
    }
    const totalCells = startCol + daysInMonth;
    const remainder = totalCells % 7;
    if(remainder !== 0) for(let i=0;i<(7-remainder);i++) html += `<div class="cal-day empty"></div>`;

    grid.innerHTML = html;
    grid.querySelectorAll('.cal-day:not(.empty)').forEach(el=>{
      el.addEventListener('click', ()=>{
        switchTab('log');
        $("#ct-regDate").value = el.dataset.date;
      });
    });
  }

  function renderHist(){
    const list = $("#ct-logList");
    $("#ct-histCount").textContent = records.length;
    if(records.length===0){
      list.innerHTML = `<div class="empty">No entries yet.<br>Start in the <b>Log</b> tab 🌸</div>`;
      return;
    }
    const sorted = [...records].sort((a,b)=> b.date.localeCompare(a.date));
    list.innerHTML = sorted.map(r=>{
      const syms = (r.symptoms||[]).map(s=>`<span>${s}</span>`).join('');
      const flowTxt = {light:'Light',medium:'Medium',heavy:'Heavy',spotting:'Spotting'}[r.flow]||r.flow||'—';
      return `
        <div class="log-item" data-id="${r.id}">
          <div class="info">
            <div class="d">${fmtISOtoLong(r.date)} <span class="tag">${r.duration||5} days</span></div>
            <div class="meta">
              <span>💧 ${flowTxt}</span>
              ${r.mood?`<span>${r.mood}</span>`:''}
              ${r.temp?`<span>🌡️ ${r.temp}°C</span>`:''}
            </div>
            ${syms?`<div class="meta" style="margin-top:5px">${syms}</div>`:''}
            ${r.notes?`<div class="note">“${r.notes}”</div>`:''}
          </div>
          <div class="log-actions">
            <button class="icon-btn edit" title="Edit" data-id="${r.id}">✏️</button>
            <button class="icon-btn del" title="Delete" data-id="${r.id}">🗑️</button>
          </div>
        </div>`;
    }).join('');

    list.querySelectorAll('.del').forEach(b=> b.addEventListener('click',()=> deleteRec(b.dataset.id)));
    list.querySelectorAll('.edit').forEach(b=> b.addEventListener('click',()=> openEdit(b.dataset.id)));
  }

  function addRecord(rec){
    const dup = records.find(r=> r.date === rec.date);
    if(dup){ Object.assign(dup, rec); save(); refreshAll(); toast("Entry updated ✓"); return; }
    rec.id = uid();
    records.push(rec);
    records.sort((a,b)=> a.date.localeCompare(b.date));
    save(); refreshAll();
    toast("Entry saved! 🌸");
  }
  function deleteRec(id){
    if(!confirm("Delete this entry?")) return;
    records = records.filter(r=> r.id !== id);
    save(); refreshAll();
    toast("Entry deleted");
  }
  function openEdit(id){
    const r = records.find(x=> x.id === id);
    if(!r) return;
    editingId = id;
    $("#ct-editId").value = id;
    $("#ct-editDate").value = r.date;
    $("#ct-editDuration").value = r.duration || 5;
    $("#ct-editFlow").value = r.flow || "medium";
    $("#ct-editMood").value = r.mood || "";
    $("#ct-editSym").value = (r.symptoms||[]).join(", ");
    $("#ct-editNotes").value = r.notes || "";
    $("#ct-editModal").style.display = "flex";
  }
  function closeEdit(){ $("#ct-editModal").style.display = "none"; editingId=null; }
  function saveEdit(){
    const id = $("#ct-editId").value;
    const r = records.find(x=> x.id === id);
    if(!r) return;
    r.date = $("#ct-editDate").value;
    r.duration = Number($("#ct-editDuration").value)||5;
    r.flow = $("#ct-editFlow").value;
    r.mood = $("#ct-editMood").value.trim();
    r.symptoms = $("#ct-editSym").value.split(",").map(s=>s.trim()).filter(Boolean);
    r.notes = $("#ct-editNotes").value.trim();
    records.sort((a,b)=> a.date.localeCompare(b.date));
    save(); closeEdit(); refreshAll();
    toast("Changes saved ✓");
  }

  function switchTab(name){
    $$(".tab").forEach(t=> t.classList.toggle("active", t.dataset.tab===name));
    $$(".panel").forEach(p=> p.classList.toggle("active", p.id==="ct-panel-"+name));
    if(name==="cal") renderCal();
    if(name==="hist") renderHist();
    if(name==="today") renderToday();
  }

  function setupChips(){
    $$("#ct-flowChips .chip").forEach(c=>{
      c.addEventListener('click',()=>{
        $$("#ct-flowChips .chip").forEach(x=>x.classList.remove("selected"));
        c.classList.add("selected");
      });
    });
    $$("#ct-symChips .chip").forEach(c=>{
      c.addEventListener('click',()=> c.classList.toggle("selected"));
    });
  }
  function getSelectedFlow(){
    const s = root.querySelector("#ct-flowChips .chip.selected");
    return s ? s.dataset.flow : "medium";
  }
  function getSelectedSymptoms(){
    return $$("#ct-symChips .chip.selected").map(c=> c.dataset.sym);
  }
  function resetForm(){
    $("#ct-regDuration").value = 5;
    $("#ct-regMood").value = "";
    $("#ct-regTemp").value = "";
    $("#ct-regNotes").value = "";
    $$("#ct-flowChips .chip").forEach((c,i)=> c.classList.toggle("selected", i===0));
    $$("#ct-symChips .chip").forEach(c=> c.classList.remove("selected"));
  }

  function refreshAll(){
    renderToday();
    if($("#ct-panel-cal").classList.contains("active")) renderCal();
    if($("#ct-panel-hist").classList.contains("active")) renderHist();
  }

  function init(){
    load();
    $("#ct-regDate").value = toISO(todayMid());
    $("#ct-regDate").max = toISO(todayMid());

    $$(".tab").forEach(t=> t.addEventListener('click',()=> switchTab(t.dataset.tab)));

    $("#ct-saveReg").addEventListener('click',()=>{
      const dateVal = $("#ct-regDate").value;
      if(!dateVal){ toast("Please select a date"); return; }
      const d = parseISO(dateVal);
      if(d > todayMid()){ toast("You cannot log a future date"); return; }
      addRecord({
        date: dateVal,
        duration: Number($("#ct-regDuration").value)||5,
        flow: getSelectedFlow(),
        symptoms: getSelectedSymptoms(),
        mood: $("#ct-regMood").value,
        temp: $("#ct-regTemp").value ? Number($("#ct-regTemp").value) : null,
        notes: $("#ct-regNotes").value.trim()
      });
      resetForm();
      $("#ct-regDate").value = toISO(todayMid());
      switchTab("today");
    });

    $("#ct-quickToday").addEventListener('click',()=>{
      switchTab("log");
      $("#ct-regDate").value = toISO(todayMid());
      $("#ct-regDate").scrollIntoView({behavior:'smooth',block:'center'});
    });

    $("#ct-calPrev").addEventListener('click',()=>{ calRef.setMonth(calRef.getMonth()-1); renderCal(); });
    $("#ct-calNext").addEventListener('click',()=>{ calRef.setMonth(calRef.getMonth()+1); renderCal(); });

    $("#ct-clearAll").addEventListener('click',()=>{
      if(records.length===0){ toast("No data to clear"); return; }
      if(confirm("Delete ALL entries? This cannot be undone.")){
        records=[]; save(); refreshAll(); toast("Data cleared");
      }
    });

    $("#ct-cancelEdit").addEventListener('click', closeEdit);
    $("#ct-saveEdit").addEventListener('click', saveEdit);
    $("#ct-editModal").addEventListener('click',(e)=>{ if(e.target.id==="ct-editModal") closeEdit(); });

    setupChips();
    refreshAll();
  }

  // Wait for DOM to be ready if needed
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  document.addEventListener('trainmei:nutrition-updated',()=>{
    if(document.querySelector('#cycle-page.active')){try{renderToday()}catch(e){console.warn('Cycle nutrition refresh:',e)}}
  });
  document.addEventListener('trainmei:nutrition-sync-complete',()=>{
    if(document.querySelector('#cycle-page.active')){try{renderToday()}catch(e){console.warn('Cycle sync refresh:',e)}}
  });

  // Read-only snapshot for the Data Core (Fase 2). Reuses analyzeCycleForDate;
  // does not duplicate storage or logic, and never asserts causal phase effects.
  window.tpCycleSnapshot=function(){
    const a=analyzeCycleForDate(todayMid());
    return a?{phase:a.phase,cycleDay:a.cycleDay,avgCycleLength:a.avg,recordCount:records.length}:{phase:null,cycleDay:null,avgCycleLength:null,recordCount:records.length};
  };
})();
