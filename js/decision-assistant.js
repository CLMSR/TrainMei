/* Decision Assistant: presentation layer over TrainingDataCore; no separate learner or automatic edits. */
(()=>{'use strict';
  const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let busy=false;
  function ensure() {
  const home = $('#home-page');
  if (!home) return null;

  let el = $('#home-decision-assistant');

  if (!el) {
    el = document.createElement('section');
    el.id = 'home-decision-assistant';
    el.className = 'home-decision-assistant';
    el.setAttribute('aria-live', 'polite');

    const target = home.querySelector(
      '.home-grid, .home-dashboard, .home-cards'
    );

    // insertBefore requires a direct child of `home`.
    const directChild = target
      ? target.parentElement === home
        ? target
        : target.closest('#home-page > *')
      : home.children[1] || home.firstElementChild;

    if (directChild && directChild.parentElement === home) {
      home.insertBefore(el, directChild);
    } else {
      home.appendChild(el);
    }
  }

  return el;
}

  async function refresh(){if(busy)return;busy=true;const el=ensure();if(!el){busy=false;return}const core=window.TrainingDataCore;if(!core?.decisionSupport){el.innerHTML='<strong>Training decision</strong><p>TrainingDataCore is still loading.</p>';busy=false;return}try{const d=await core.decisionSupport();const sig=(d.signals||[]).filter(x=>!String(x.value).includes('Unavailable')).slice(0,2);el.innerHTML=`<div class="hda-head"><div><span class="eyebrow">TODAY · TRAINMEI BRAIN</span><h2>${esc(d.action)}</h2></div><span class="hda-confidence">${esc(d.confidence||'Limited')} evidence</span></div><p>${esc((d.actions||[]).join(' ')||'Use the warm-up and session feedback as the final check.')}</p><div class="hda-signals">${sig.map(x=>`<span><strong>${esc(x.label)}</strong> ${esc(x.value)}</span>`).join('')}</div><div class="hda-actions"><button type="button" class="btn" data-hda-open-briefing>Open Daily Briefing</button><button type="button" class="btn" data-hda-open-insights>Review Insights</button></div><small>Suggestion only. No saved workout has been changed.</small>`}catch(e){console.warn('[Decision Assistant]',e);el.innerHTML='<strong>Training decision</strong><p>Not enough current data to make a reliable suggestion.</p>'}finally{busy=false}}
  document.addEventListener('click',e=>{if(e.target.closest('[data-hda-open-briefing]'))document.getElementById('home-briefing-body')?.scrollIntoView({behavior:'smooth',block:'start'});if(e.target.closest('[data-hda-open-insights]'))document.querySelector('.home-insights-section')?.scrollIntoView({behavior:'smooth',block:'start'})});
  ['trainmei:core-learning','trainmei:day-saved','trainmei:data-core-refreshed','trainmei:nutrition-updated','trainmei:nutrition-sync-complete'].forEach(n=>document.addEventListener(n,()=>{if($('#home-page')?.classList.contains('active'))refresh()}));
  document.addEventListener('DOMContentLoaded',()=>{refresh();document.addEventListener('click',e=>{if(e.target.closest('[data-page="home-page"]'))refresh()})});
  window.TrainMeiDecisionAssistant={refresh};
})();