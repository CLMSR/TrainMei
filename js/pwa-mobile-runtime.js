/* TrainMei PWA runtime: service worker registration and mobile keyboard safeguards. */
(() => {
  'use strict';

  const root = document.documentElement;
  const body = document.body;
  const standalone = window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  if (standalone) root.classList.add('pwa-installed');

  // Relative path works for a GitHub Pages project site as well as a custom domain.
  if ('serviceWorker' in navigator && /^https?:$/.test(window.location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(registration => registration.update().catch(() => {}))
        .catch(error => console.warn('[TrainMei PWA] Service worker registration failed:', error));
    }, { once: true });
  }

  const isEditable = element =>
    element instanceof HTMLElement &&
    element.matches(
      'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]), textarea, select, [contenteditable="true"]'
    );

  let focusTimer = 0;
  const revealFocusedControl = () => {
    const active = document.activeElement;
    if (!isEditable(active)) {
      body.classList.remove('keyboard-open');
      return;
    }
    body.classList.add('keyboard-open');
    window.clearTimeout(focusTimer);
    focusTimer = window.setTimeout(() => {
      const rect = active.getBoundingClientRect();
      const viewport = window.visualViewport;
      const visibleBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
      const visibleTop = viewport ? viewport.offsetTop : 0;
      const margin = 18;
      if (rect.bottom > visibleBottom - margin || rect.top < visibleTop + margin) {
        active.scrollIntoView({
          block: rect.bottom > visibleBottom - margin ? 'nearest' : 'center',
          inline: 'nearest',
          behavior: 'auto'
        });
      }
    }, 90);
  };

  document.addEventListener('focusin', event => {
    if (isEditable(event.target)) {
      body.classList.add('keyboard-open');
      window.setTimeout(revealFocusedControl, 180);
    }
  });

  document.addEventListener('focusout', () => {
    window.setTimeout(() => {
      if (!isEditable(document.activeElement)) body.classList.remove('keyboard-open');
    }, 120);
  });

  if (window.visualViewport) {
    let lastHeight = window.visualViewport.height;
    window.visualViewport.addEventListener('resize', () => {
      const height = window.visualViewport.height;
      const active = document.activeElement;
      if (isEditable(active) && height < lastHeight - 80) {
        body.classList.add('keyboard-open');
        window.setTimeout(revealFocusedControl, 100);
      } else if (height > lastHeight + 80 && !isEditable(active)) {
        body.classList.remove('keyboard-open');
      }
      lastHeight = height;
    });
  }
})();
