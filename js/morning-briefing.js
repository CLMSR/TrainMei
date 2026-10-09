(function () {
  'use strict';

  if (window.TrainMeiDailyBriefing) return;

  const MODAL_ID = 'daily-briefing-modal';
  const BUTTON_SELECTOR = '#daily-briefing-btn, #briefing-btn';

  let model = null;
  let isOpen = false;
  let refreshing = false;
  let refreshQueued = false;
  let previousBodyOverflow = '';
  let previousFocus = null;

  const $ = (selector, root = document) => root.querySelector(selector);

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);

  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const dayLabel = () => new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  const finite = value =>
    value !== null &&
    value !== undefined &&
    value !== '' &&
    Number.isFinite(Number(value));

  const numberOrNull = value => finite(value) ? Number(value) : null;
  const roundedOrNull = value => finite(value) ? Math.round(Number(value)) : null;

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'modal-backdrop db-backdrop';
    modal.id = MODAL_ID;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'db-modal-title');
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
      <section class="modal db-modal" role="document" tabindex="-1">
        <header class="db-head">
          <div class="db-heading-copy">
            <div class="eyebrow">TrainMei · DAILY PLAN</div>
            <h2 class="db-title" id="db-modal-title">Daily Briefing</h2>
            <div class="db-date-line" id="db-date">${esc(dayLabel())}</div>
          </div>
          <button type="button" class="icon-btn db-close"
            id="db-close-btn" aria-label="Close Daily Briefing">×</button>
        </header>

        <div class="db-body" id="db-body" aria-live="polite">
          <div class="db-loading">
            <span class="db-loading-ring" aria-hidden="true"></span>
            <span>Preparing your day…</span>
          </div>
        </div>
      </section>`;

    document.body.appendChild(modal);

    $('#db-close-btn', modal).addEventListener('click', close);

    modal.addEventListener('click', event => {
      if (event.target === modal) close();
    });

    modal.addEventListener('keydown', trapFocus);

    return modal;
  }

  function lockScroll() {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  function unlockScroll() {
    document.body.style.overflow = previousBodyOverflow;
  }

  function open() {
    const modal = ensureModal();

    if (isOpen) {
      refresh();
      return;
    }

    previousFocus = document.activeElement;
    isOpen = true;

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');

    lockScroll();

    requestAnimationFrame(() => $('#db-close-btn', modal)?.focus());

    refresh();
  }

  function close() {
    const modal = document.getElementById(MODAL_ID);

    if (!modal || !isOpen) return;

    isOpen = false;

    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');

    unlockScroll();

    if (previousFocus && typeof previousFocus.focus === 'function') {
      try {
        previousFocus.focus({ preventScroll: true });
      } catch (_) {
        previousFocus.focus();
      }
    }
  }

  function toggle() {
    isOpen ? close() : open();
  }

  function getModel() {
    return model;
  }

  async function getTodayWorkout(core, date) {
    try {
      const rows = await Promise.resolve(core.training(date, date));

      const row = (Array.isArray(rows) ? rows : []).find(item =>
        String(item?.date || '').slice(0, 10) === date
      );

      return row?.data || null;
    } catch (error) {
      console.warn('[DailyBriefing] Could not read today workout:', error);
      return null;
    }
  }

  async function buildModel() {
    const core = window.TrainingDataCore;

    if (!core) {
      throw new Error('TrainingDataCore is not available.');
    }

    const date = typeof core.dayKey === 'function'
      ? core.dayKey()
      : todayKey();

    const [loggedWorkout, plannedWorkout] = await Promise.all([
      getTodayWorkout(core, date),

      Promise.resolve().then(() => {
        try {
          return core.plannedWorkout?.(date) || null;
        } catch (error) {
          console.warn(
            '[DailyBriefing] Could not read planned workout:',
            error
          );
          return null;
        }
      })
    ]);

    const workout = loggedWorkout || plannedWorkout || null;
    const explicitRest = !!workout?.restDay;

    const isPlannedOnly =
      !loggedWorkout &&
      !!plannedWorkout &&
      !explicitRest;

    // Reutiliza el contexto unificado que ya calcula Training Brain.
    let brainModel = null;

    try {
      brainModel = window.TrainMeiBrain?.getModel?.() || null;
    } catch (_) {}

    let ctx = brainModel?.context?.date === date
      ? brainModel.context
      : null;

    let adaptation = ctx?.adaptation || brainModel?.adaptation || null;

    // Si Brain no tiene el contexto de hoy, solicita el del motor unificado.
    if (!ctx) {
      if (typeof core.getUnifiedContext !== 'function') {
        throw new Error('Unified context is not available.');
      }

      ctx = await core.getUnifiedContext(date, workout);
      adaptation = ctx?.adaptation || adaptation;
    }

    let demand = null;

    try {
      demand = typeof core.trainingDemand === 'function'
        ? core.trainingDemand(date, workout)
        : ctx?.training || null;
    } catch (error) {
      console.warn('[DailyBriefing] trainingDemand failed:', error);
    }

    demand = demand || ctx?.training || null;

    // Un día vacío no se considera automáticamente un día de descanso.
    let dayStatus = 'unknown';

    if (explicitRest || (!loggedWorkout && plannedWorkout?.restDay)) {
      dayStatus = 'rest';
    } else if (loggedWorkout && !loggedWorkout.restDay) {
      dayStatus = 'logged';
    } else if (plannedWorkout && !plannedWorkout.restDay) {
      dayStatus = 'planned';
    }

    let readiness = null;

    try {
      if (typeof core.readiness === 'function') {
        readiness = core.readiness(ctx?.workout || workout || null, {
          loadRatio: ctx?.loadRatio,
          fuelScore: ctx?.fuel?.score,
          cyclePhase: ctx?.cycle?.phase,
          training: demand || ctx?.training
        });
      }
    } catch (error) {
      console.warn('[DailyBriefing] readiness failed:', error);
    }

    let fuelRequirement = null;

    try {
      if (
        dayStatus !== 'rest' &&
        typeof core.fuelRequirement === 'function'
      ) {
        fuelRequirement = core.fuelRequirement(date, workout);
      }
    } catch (error) {
      console.warn('[DailyBriefing] fuelRequirement failed:', error);
    }

    // Lectura de nutrición mediante la capa existente.
    const nutritionData = window.TrainMeiNutritionData;
    let snapshot = null;

    try {
      if (nutritionData?.whenReady) {
        await nutritionData.whenReady();
      }

      snapshot = nutritionData?.getSnapshot?.() || null;
    } catch (error) {
      console.warn(
        '[DailyBriefing] nutrition snapshot unavailable:',
        error
      );
    }

    let nutritionContext = ctx?.nutrition || null;

    try {
      if (typeof core.nutritionContext === 'function') {
        nutritionContext =
          core.nutritionContext(date) || nutritionContext;
      }
    } catch (_) {}

    // No mostrar datos de otra fecha como si fueran los de hoy.
    const snapshotIsToday =
      !snapshot?.date ||
      String(snapshot.date).slice(0, 10) === date;

    const snapshotIntake = snapshotIsToday
      ? (snapshot?.intake || {})
      : {};

    const contextIntake = nutritionContext?.intake || {};

    const intake = {
      kcal: roundedOrNull(snapshotIntake.kcal ?? contextIntake.kcal),
      carb: roundedOrNull(snapshotIntake.carb ?? contextIntake.carb),
      prot: roundedOrNull(snapshotIntake.prot ?? contextIntake.prot),
      fat: roundedOrNull(snapshotIntake.fat ?? contextIntake.fat)
    };

    const targets = nutritionContext?.targets || {};
    const coverage = nutritionContext?.coverage || {};
    const fuel = ctx?.fuel || null;
    const recovery = ctx?.recovery || null;

    const recoveryPercent = roundedOrNull(
      ctx?.recoveryPercent ?? readiness?.score
    );

    const connected =
      snapshot?.connected === true ||
      nutritionContext?.connected === true;

    const hasIntake = Object.values(intake).some(
      value => value !== null
    );

    const training = {
      status: dayStatus,

      title: explicitRest
        ? 'Rest day'
        : (
          workout?.focus ||
          workout?.trainingCategory ||
          workout?.title ||
          demand?.type ||
          (dayStatus === 'unknown'
            ? 'Plan not available'
            : 'Training session')
        ),

      demand: dayStatus === 'rest'
        ? 'Rest day'
        : (demand?.demand || null),

      type: demand?.type || null,
      duration: numberOrNull(demand?.duration),
      loggedDuration: numberOrNull(demand?.loggedDuration),
      distance: numberOrNull(demand?.distance),
      sets: numberOrNull(demand?.sets),
      rpe: numberOrNull(demand?.rpe),
      planned: isPlannedOnly || !!demand?.planned,
      timeSource: demand?.timeSource || null
    };

    const recoveryModel = {
      score: roundedOrNull(readiness?.score),
      status: readiness?.status || null,
      confidence: readiness?.confidence || null,
      limiter: readiness?.mainLimitingFactor || null,
      factors: Array.isArray(readiness?.factors)
        ? readiness.factors
        : [],
      sleep: numberOrNull(recovery?.sleep),
      energy: numberOrNull(recovery?.energy),
      soreness: numberOrNull(recovery?.soreness),
      recoveryPercent
    };

    const nutrition = {
      connected,
      source: snapshot?.source || nutritionContext?.source || null,
      intake,

      targets: {
        kcal: roundedOrNull(targets.kcal),
        carb: roundedOrNull(targets.carb),
        prot: roundedOrNull(targets.prot),
        fat: roundedOrNull(targets.fat)
      },

      coverage: {
        kcal: roundedOrNull(coverage.kcal),
        carb: roundedOrNull(coverage.carb),
        prot: roundedOrNull(coverage.prot)
      },

      hasIntake,
      fuelScore: roundedOrNull(fuel?.score),
      fuelStatus: fuel?.status || null,
      fuelLimiter: fuel?.limitingFactor || null,

      preWorkout:
        fuelRequirement && !fuelRequirement.restDay
          ? {
              carbs: roundedOrNull(
                fuelRequirement.preWorkoutCarbs
              ),
              totalCarbs: roundedOrNull(
                fuelRequirement.carbs
              ),
              confidence: fuelRequirement.confidence || null,
              basis: fuelRequirement.basis || null
            }
          : null
    };

    const cycle = ctx?.cycle?.phase
      ? { phase: ctx.cycle.phase }
      : null;

    const focus = synthesise(
      training,
      recoveryModel,
      nutrition,
      adaptation
    );

    return {
      date,
      training,
      recovery: recoveryModel,
      nutrition,
      cycle,
      adaptation,
      focus,

      dataStatus: {
        hasContext: !!ctx,
        hasWorkoutRecord: !!loggedWorkout,
        hasPlannedWorkout: !!plannedWorkout
      },

      generatedAt: new Date().toISOString()
    };
  }

  function synthesise(training, recovery, nutrition, adaptation) {
    const isRest = training?.status === 'rest';

    const hasTraining =
      training?.status === 'logged' ||
      training?.status === 'planned';

    const rec = recovery?.recoveryPercent;
    const fuel = nutrition?.fuelScore;
    const highDemand = training?.demand === 'High';

    const lowFuel = fuel != null && fuel < 60;
    const lowRecovery = rec != null && rec < 55;
    const poorSleep = recovery?.sleep != null && recovery.sleep <= 2;

    const action = adaptation?.actions?.find(
      item => typeof item === 'string' && item.trim()
    ) || null;

    if (isRest) {
      return {
        priority: 'Recovery',
        title: 'Make recovery count',
        text: 'Rest is explicitly planned or recorded today. Prioritise normal meals, hydration and recovery; optional gentle mobility is fine if it feels good.'
      };
    }

    if (!hasTraining) {
      return {
        priority: 'Consistency',
        title: 'Confirm today’s plan',
        text: 'There is no confirmed workout or explicit rest day available. Check your Plan or Calendar before deciding what today should look like.'
      };
    }

    if (poorSleep && highDemand) {
      return {
        priority: 'Recovery',
        title: 'Keep effort in check',
        text: 'Sleep is logged low and today’s planned demand is high. Keep technique crisp and avoid adding intensity or extra volume.'
      };
    }

    if (lowFuel && highDemand) {
      return {
        priority: 'Fuel',
        title: 'Fuel the session',
        text: 'The existing fuel estimate is low for today. If practical, prioritise carbohydrates around training; do not compensate by restricting later.'
      };
    }

    if (lowRecovery && highDemand) {
      return {
        priority: 'Recovery',
        title: 'Adjust the session, not the goal',
        text: 'The existing readiness estimate is low. Keep the main work controlled and avoid extra accessory volume today.'
      };
    }

    if (rec != null && rec < 70 && highDemand) {
      return {
        priority: 'Recovery',
        title: 'Use readiness as your guardrail',
        text: 'Readiness is below the normal-training range. Keep the planned work stable and use technique and perceived effort to guide adjustments.'
      };
    }

    if (lowFuel) {
      return {
        priority: 'Fuel',
        title: 'Support your training with food',
        text: 'Fuel coverage is flagged as low by the existing model. Eat consistently and use the logged targets as context, not as a reason to skip meals.'
      };
    }

    if (action && !/no strong limiter detected/i.test(action)) {
      return {
        priority: 'Training',
        title: 'Your training signal today',
        text: action
      };
    }

    return {
      priority: 'Training',
      title: training.planned
        ? 'Execute the plan'
        : 'Train as recorded',

      text: 'Follow the planned session, focus on good execution and use your session feedback to guide future progression.'
    };
  }

  function badgeClass(demand) {
    if (demand === 'High') return 'db-badge--high';
    if (demand === 'Moderate') return 'db-badge--moderate';
    if (demand === 'Low') return 'db-badge--low';

    return 'db-badge--rest';
  }

  function priorityClass(priority) {
    return priority === 'Fuel'
      ? 'db-priority--fuel'
      : priority === 'Recovery'
        ? 'db-priority--recovery'
        : priority === 'Training'
          ? 'db-priority--training'
          : 'db-priority--consistency';
  }

  function renderTraining(training) {
    if (!training || training.status === 'unknown') {
      return `
        <section class="db-day-type db-day-type--unknown">
          <span class="db-day-icon" aria-hidden="true">?</span>
          <div class="db-day-main">
            <div class="db-day-label">Plan not confirmed</div>
            <div class="db-day-sub">
              No workout or explicit rest day found for today.
            </div>
          </div>
        </section>`;
    }

    if (training.status === 'rest') {
      return `
        <section class="db-day-type db-day-type--rest">
          <span class="db-day-icon" aria-hidden="true">☾</span>
          <div class="db-day-main">
            <div class="db-day-label">Rest / recovery day</div>
            <div class="db-day-sub">
              Explicitly planned or recorded
            </div>
          </div>
          <span class="db-badge db-badge--rest">REST</span>
        </section>`;
    }

    const meta = [
      training.type,

      training.duration != null
        ? `${training.duration} min${training.timeSource === 'estimated' ? ' est.' : ''}`
        : null,

      training.distance != null && training.distance > 0
        ? `${training.distance} km`
        : null,

      training.rpe != null && training.rpe > 0
        ? `RPE ${training.rpe}`
        : null
    ].filter(Boolean).join(' · ');

    return `
      <section class="db-day-type">
        <span class="db-day-icon" aria-hidden="true">↗</span>
        <div class="db-day-main">
          <div class="db-day-label">${esc(training.title)}</div>
          <div class="db-day-meta">
            ${esc(meta || (
              training.status === 'planned'
                ? 'Planned session'
                : 'Session logged'
            ))}
          </div>
        </div>
        <span class="db-badge ${badgeClass(training.demand)}">
          ${esc(training.demand || 'Demand unknown')}
        </span>
      </section>`;
  }

  function renderPillars(m) {
    const t = m.training;
    const r = m.recovery;
    const n = m.nutrition;

    const trainingValue = t.status === 'rest'
      ? 'REST'
      : t.status === 'unknown'
        ? 'UNKNOWN'
        : (t.demand || 'PLANNED').toUpperCase();

    const trainingClass = t.status === 'rest'
      ? 'db-pillar--rest'
      : t.status === 'unknown'
        ? 'db-pillar--neutral'
        : t.demand === 'High'
          ? 'db-pillar--high'
          : t.demand === 'Moderate'
            ? 'db-pillar--moderate'
            : 'db-pillar--low';

    const rec = r.recoveryPercent;

    const recoveryValue = rec == null
      ? 'NO DATA'
      : rec >= 75
        ? 'GOOD'
        : rec >= 55
          ? 'MODERATE'
          : 'LOW';

    const recoveryClass = rec == null
      ? 'db-pillar--neutral'
      : rec >= 75
        ? 'db-pillar--good'
        : rec >= 55
          ? 'db-pillar--moderate'
          : 'db-pillar--low';

    const fuel = n.fuelScore;

    const fuelValue = fuel == null
      ? (n.connected ? 'NO DATA' : 'NOT SYNCED')
      : fuel >= 90
        ? 'WELL FUELED'
        : fuel >= 70
          ? 'ADEQUATE'
          : 'LOW';

    const fuelClass = fuel == null
      ? 'db-pillar--neutral'
      : fuel >= 90
        ? 'db-pillar--good'
        : fuel >= 70
          ? 'db-pillar--moderate'
          : 'db-pillar--low';

    return `
      <div class="db-pillars">
        <div class="db-pillar ${trainingClass}">
          <div class="db-pillar-label">Training</div>
          <div class="db-pillar-value">${esc(trainingValue)}</div>
        </div>

        <div class="db-pillar ${recoveryClass}">
          <div class="db-pillar-label">Readiness</div>
          <div class="db-pillar-value">${esc(recoveryValue)}</div>
          ${rec != null
            ? `<div class="db-pillar-sub">${rec}% · model estimate</div>`
            : ''}
        </div>

        <div class="db-pillar ${fuelClass}">
          <div class="db-pillar-label">Fuel</div>
          <div class="db-pillar-value">${esc(fuelValue)}</div>
          ${fuel != null
            ? `<div class="db-pillar-sub">${fuel}% · target coverage</div>`
            : ''}
        </div>
      </div>`;
  }

  function renderFocus(focus) {
    return `
      <section class="db-focus ${priorityClass(focus.priority)}">
        <div class="db-focus-priority">
          TODAY’S PRIORITY · ${esc(focus.priority)}
        </div>
        <h3 class="db-focus-title">${esc(focus.title)}</h3>
        <p class="db-focus-text">${esc(focus.text)}</p>
      </section>`;
  }

  function renderPreWorkout(m) {
    if (
      m.training.status === 'rest' ||
      m.training.status === 'unknown'
    ) {
      return '';
    }

    const pw = m.nutrition.preWorkout;

    if (!pw || pw.carbs == null) {
      return `
        <section class="db-block">
          <div class="db-block-label">Before training</div>
          <div class="db-block-empty">
            ${m.nutrition.connected
              ? 'A personalised pre-workout estimate is not available for the current training data.'
              : 'Nutrition is not synced. The briefing will not invent a fuel target.'}
          </div>
        </section>`;
    }

    return `
      <section class="db-block">
        <div class="db-block-label">Pre-workout fuel estimate</div>
        <div class="db-preworkout">
          <div class="db-pw-item">
            <span class="db-pw-num">${pw.carbs}</span>
            <span class="db-pw-unit">g carbohydrates</span>
          </div>
          <div class="db-pw-timing">
            Based on today’s training demand ·
            ${esc(pw.confidence || 'Estimated confidence')}
          </div>
        </div>
        ${pw.confidence === 'Low'
          ? `<div class="db-block-note">
               Low-confidence estimate: duration, distance or set data is limited.
             </div>`
          : ''}
      </section>`;
  }

  function renderRecovery(recovery) {
    const items = [
      ['Sleep', recovery.sleep != null ? `${recovery.sleep}/5` : null],
      ['Energy', recovery.energy != null ? `${recovery.energy}/5` : null],
      ['Soreness', recovery.soreness != null ? `${recovery.soreness}/5` : null]
    ].filter(([, value]) => value != null);

    if (!items.length && recovery.recoveryPercent == null) {
      return `
        <section class="db-block">
          <div class="db-block-label">Recovery</div>
          <div class="db-block-empty">
            Not enough logged recovery data to show a reliable estimate.
          </div>
        </section>`;
    }

    return `
      <section class="db-block">
        <div class="db-block-label">
          Recovery signals
          ${recovery.recoveryPercent != null
            ? `<span class="db-block-label-score">${recovery.recoveryPercent}%</span>`
            : ''}
        </div>

        ${items.length
          ? `<div class="db-recovery-grid">
              ${items.map(([label, value]) => `
                <div class="db-recovery-item">
                  <span class="db-recovery-key">${esc(label)}</span>
                  <span class="db-recovery-val">${esc(value)}</span>
                </div>
              `).join('')}
            </div>`
          : ''}

        ${recovery.status
          ? `<div class="db-recovery-status">
               ${esc(recovery.status)} ·
               ${esc(recovery.confidence || 'confidence unavailable')}
             </div>`
          : ''}

        ${recovery.limiter
          ? `<div class="db-block-note">
               Lowest available signal: ${esc(recovery.limiter)}.
             </div>`
          : ''}
      </section>`;
  }

  function renderNutrition(nutrition) {
    if (!nutrition.connected && !nutrition.hasIntake) {
      return `
        <section class="db-block">
          <div class="db-block-label">Nutrition today</div>
          <div class="db-block-empty">
            FatSecret is not confirmed as synced for today.
            Intake values are hidden until current-day data is available.
          </div>
        </section>`;
    }

    if (!nutrition.hasIntake) {
      return `
        <section class="db-block">
          <div class="db-block-label">Nutrition today</div>
          <div class="db-block-empty">
            No intake values are available for today yet.
          </div>
        </section>`;
    }

    const rows = [
      ['Calories', nutrition.intake.kcal, 'kcal', nutrition.coverage.kcal],
      ['Carbs', nutrition.intake.carb, 'g', nutrition.coverage.carb],
      ['Protein', nutrition.intake.prot, 'g', nutrition.coverage.prot],
      ['Fat', nutrition.intake.fat, 'g', null]
    ].filter(([, value]) => value != null);

    return `
      <section class="db-block">
        <div class="db-block-label">
          Nutrition today
          <span class="db-block-label-note">
            ${nutrition.connected
              ? 'FatSecret'
              : 'source available · sync status unconfirmed'}
          </span>
        </div>

        <div class="db-nutri-grid">
          ${rows.map(([label, value, unit, coverage]) => `
            <div class="db-nutri-item">
              <span class="db-nutri-num">
                ${value}${unit === 'g' ? 'g' : ''}
              </span>
              <span class="db-nutri-key">
                ${label}${unit === 'kcal' ? ' · kcal' : ''}
              </span>
              ${coverage != null
                ? `<span class="db-nutri-cov">${coverage}% of target</span>`
                : ''}
            </div>
          `).join('')}
        </div>
      </section>`;
  }

  function renderModel(m) {
    const body = $('#db-body');
    if (!body) return;

    const date = $('#db-date');
    if (date) date.textContent = dayLabel();

    body.innerHTML = `
      ${renderTraining(m.training)}
      ${renderPillars(m)}
      ${renderFocus(m.focus)}
      ${renderPreWorkout(m)}
      ${renderRecovery(m.recovery)}
      ${renderNutrition(m.nutrition)}

      <div class="db-footnote">
        Uses TrainMei’s unified data model.
        Estimates depend on the information currently logged.
      </div>`;
  }

  function renderLoading() {
    const body = $('#db-body');

    if (body) {
      body.innerHTML = `
        <div class="db-loading">
          <span class="db-loading-ring" aria-hidden="true"></span>
          <span>Preparing your day…</span>
        </div>`;
    }
  }

  function renderError() {
    const body = $('#db-body');
    if (!body) return;

    body.innerHTML = `
      <div class="db-error">
        The briefing could not load right now.
        Your existing training data has not been changed.
        Try refreshing it.
      </div>
      <button type="button" class="btn db-retry" id="db-retry-btn">
        Retry
      </button>`;

    $('#db-retry-btn')?.addEventListener('click', refresh, {
      once: true
    });
  }

  async function refresh() {
    if (refreshing) {
      refreshQueued = true;
      return;
    }

    refreshing = true;

    if (isOpen) renderLoading();

    try {
      model = await buildModel();

      if (isOpen) renderModel(model);
    } catch (error) {
      console.error('[DailyBriefing] refresh failed:', error);

      if (isOpen) renderError();
    } finally {
      refreshing = false;

      if (refreshQueued) {
        refreshQueued = false;

        if (isOpen) refresh();
      }
    }
  }

  function trapFocus(event) {
    if (event.key !== 'Tab') return;

    const modal = document.getElementById(MODAL_ID);

    const focusable = [
      ...(modal?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) || [])
    ].filter(node => node.offsetParent !== null);

    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      document.activeElement === last
    ) {
      event.preventDefault();
      first.focus();
    }
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && isOpen) {
      close();
    }
  });

  [
    'trainmei:nutrition-updated',
    'trainmei:nutrition-sync-complete',
    'trainmei:core-learning',
    'trainmei:data-core-refreshed',
    'trainmei:day-saved'
  ].forEach(name => {
    document.addEventListener(name, () => {
      if (isOpen) refresh();
    });
  });

  // Delegación: también funciona si el botón se crea dinámicamente.
  document.addEventListener('click', event => {
    const button = event.target.closest(BUTTON_SELECTOR);
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    open();
  }, true);

  // Cerrar el briefing al navegar a otra sección.
  document.addEventListener('click', event => {
    if (!isOpen || event.target.closest(`#${MODAL_ID}`)) {
      return;
    }

    if (
      event.target.closest(
        '#main-nav .btn[data-page], .ios-tab[data-ios-page], #ios-add-tab'
      )
    ) {
      close();
    }
  }, true);

  window.TrainMeiDailyBriefing = {
    open,
    close,
    toggle,
    refresh,
    getModel
  };
})();