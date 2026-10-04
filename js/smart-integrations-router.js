/* ===== Smart Integrations: shared-panel router =====
   The Garmin/OCR, Nutri Tracker calculator and Workout Creator panels are authored once
   (inside the Integrations page two-column layout) and reused as full pages.
   This module relocates those DOM nodes into their dedicated page slots and
   wires the launch-card / back navigation for them, since they live outside
   #main-nav and are not covered by the main showPage() click handler. */
(function(){
  function moveSmartPanels(){
    const moves = [
      ['si-garmin-panel', 'ocr-tool-slot'],
      ['smart-wod-panel', 'workout-creator-slot']
    ];
    moves.forEach(function(pair){
      const source = document.getElementById(pair[0]);
      const target = document.getElementById(pair[1]);
      if (source && target && !target.contains(source)) {
        target.appendChild(source);
      }
    });
    document.querySelectorAll('.smart-tool-page [data-smart-panel-body]').forEach(function(body){
      body.classList.add('open');
    });
    document.querySelectorAll('.smart-tool-page .smart-panel-header').forEach(function(header){
      header.classList.add('open');
      header.setAttribute('aria-expanded', 'true');
    });
  }
  moveSmartPanels();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', moveSmartPanels);
  } else {
    setTimeout(moveSmartPanels, 0);
  }
  document.addEventListener('click', function(e){
    const card = e.target.closest('.smart-launch-card[data-page]');
    if (card) {
      e.preventDefault();
      const pageId = card.dataset.page;
      moveSmartPanels();
      if (typeof showPage === 'function') {
        showPage(pageId);
      } else {
        document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
        const target = document.getElementById(pageId);
        if (target) target.classList.add('active');
        document.querySelectorAll('#main-nav .btn[data-page]').forEach(function(b){
          b.classList.toggle('active', b.dataset.page === pageId);
        });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const back = e.target.closest('[data-smart-back]');
    if (back) {
      e.preventDefault();
      if (typeof showPage === 'function') {
        showPage('integrations-page');
      } else {
        document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
        document.getElementById('integrations-page')?.classList.add('active');
        document.querySelectorAll('#main-nav .btn[data-page]').forEach(function(b){
          b.classList.toggle('active', b.dataset.page === 'integrations-page');
        });
      }
    }
  });
})();
