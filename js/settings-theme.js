/* ===== SETTINGS / THEME ===== */
(function(){
  const STORAGE_KEY='training-planner:theme';
  const THEMES=['original','minimal','calm','mono','memphis','editorial','chic','athletic','clinical','performance'];
  const root=document.body;
  const modal=document.getElementById('settings-modal');
  const metaTheme=document.querySelector('meta[name="theme-color"]');
  if(!modal||!root)return;
  function normalizeTheme(value){return THEMES.includes(value)?value:'original'}
  function applyTheme(value, persist=true){
    const theme=normalizeTheme(value);
    root.dataset.theme=theme;
    if(metaTheme){
      const colors={original:'#EEEAE1',minimal:'#FAFBFC',calm:'#F6F1E8',mono:'#F2F1EE',memphis:'#FDF0E0',editorial:'#F4F1EA',chic:'#FAF9F7',athletic:'#0D0D0D',clinical:'#F0F4F8',performance:'#1C1C1C'};
      metaTheme.setAttribute('content',colors[theme]);
    }
    document.querySelectorAll('[data-theme-choice]').forEach(option=>{
      const selected=option.dataset.themeChoice===theme;
      option.classList.toggle('selected',selected);
      const check=option.querySelector('.theme-check');
      if(check)check.hidden=!selected;
      option.setAttribute('aria-pressed',String(selected));
    });
    if(persist)localStorage.setItem(STORAGE_KEY,theme);
  }
  function openSettings(){
    applyTheme(localStorage.getItem(STORAGE_KEY)||'original',false);
    modal.classList.add('show');
  }
  function closeSettings(){modal.classList.remove('show')}
  applyTheme(localStorage.getItem(STORAGE_KEY)||'original',false);
  document.getElementById('settings-btn')?.addEventListener('click',openSettings);
  document.getElementById('close-settings')?.addEventListener('click',closeSettings);
  modal.addEventListener('click',e=>{
    if(e.target===modal)closeSettings();
    const option=e.target.closest('[data-theme-choice]');
    if(option)applyTheme(option.dataset.themeChoice,true);
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('show'))closeSettings()});
  const tPanelHeader = document.getElementById('theme-panel-header');
  const tPanelBody = document.getElementById('theme-panel-body');
  if(tPanelHeader && tPanelBody){
    tPanelHeader.classList.remove('open');
    tPanelHeader.addEventListener('click', () => {
      tPanelHeader.classList.toggle('open');
      tPanelBody.classList.toggle('open');
    });
  }

})();

