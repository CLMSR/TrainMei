/* ===== KEYBOARD SHORTCUT MANAGER =====
   User-configurable desktop shortcuts. Navigation shortcuts are global,
   while single-letter commands are disabled inside editable controls. */
(function(){
  'use strict';
  const STORAGE='training-planner:keyboard-shortcuts-v1';
  const isMac=/Mac|iPhone|iPad|iPod/i.test(navigator.platform||navigator.userAgent);
  const MOD=isMac?'meta':'ctrl';
  const DEFAULTS={
    home:'h',calendar:'c',integrations:'i',today:'t',
    dayPrev:MOD+'+shift+arrowleft',dayNext:MOD+'+shift+arrowright',
    dayPrevAlt:MOD+'+arrowup',dayNextAlt:MOD+'+arrowdown',
    back:MOD+'+arrowleft',forward:MOD+'+arrowright',
    close:'escape',search:MOD+'+k',help:'?'
  };
  const LABELS={
    home:'Home',calendar:'Calendar',integrations:'Smart Integrations',today:'Today',
    dayPrev:'Previous day',dayNext:'Next day',dayPrevAlt:'Previous day (alternate)',dayNextAlt:'Next day (alternate)',back:'Back',forward:'Forward',
    close:'Close',search:'Quick Actions / Search',help:'Show shortcuts'
  };
  let shortcuts=load();
  let recordingKey=null;
  const navHistory=[];
  const navForward=[];
  const originalShowPage=window.showPage;
  let navigatingHistory=false;
  if(typeof originalShowPage==='function')window.showPage=function(id){
    const current=document.querySelector('.page.active')?.id;
    if(!navigatingHistory&&id&&current&&current!==id){navHistory.push(current);if(navHistory.length>50)navHistory.shift();navForward.length=0}
    return originalShowPage(id);
  };
  function appBack(){
    if(!navHistory.length){if(window.history.length>1)window.history.back();return}
    const current=document.querySelector('.page.active')?.id;
    const previous=navHistory.pop();
    if(current)navForward.push(current);
    navigatingHistory=true;
    try{document.getElementById(previous)?.classList.contains('page') && document.querySelector(`[data-page=\"${previous}\"]`)?.click()}finally{navigatingHistory=false}
  }
  function appForward(){
    if(!navForward.length){window.history.forward();return}
    const current=document.querySelector('.page.active')?.id;
    const next=navForward.pop();
    if(current)navHistory.push(current);
    navigatingHistory=true;
    try{document.getElementById(next)?.classList.contains('page') && document.querySelector(`[data-page=\"${next}\"]`)?.click()}finally{navigatingHistory=false}
  }

  function load(){
    try{return {...DEFAULTS,...JSON.parse(localStorage.getItem(STORAGE)||'{}')}}catch{return {...DEFAULTS}}
  }
  function save(){localStorage.setItem(STORAGE,JSON.stringify(shortcuts))}
  function isEditable(target){
    const el=target instanceof Element?target:null;
    if(!el)return false;
    return !!el.closest('input,textarea,select,[contenteditable="true"],[contenteditable="plaintext-only"],[role="textbox"]');
  }
  function normalizeEvent(e){
    const parts=[];
    if(e.ctrlKey)parts.push('ctrl');
    if(e.metaKey)parts.push('meta');
    if(e.altKey)parts.push('alt');
    if(e.shiftKey)parts.push('shift');
    let key=String(e.key||'').toLowerCase();
    if(key==='?')return '?';
    const map={' ':'space','esc':'escape','arrowleft':'arrowleft','arrowright':'arrowright','arrowup':'arrowup','arrowdown':'arrowdown','?':'?'};
    key=map[key]||key;
    if(['control','meta','alt','shift'].includes(key))return null;
    return [...parts,key].join('+');
  }
  function formatShortcut(value){
    const parts=String(value||'').split('+');
    return parts.map(p=>{
      const m={meta:isMac?'⌘':'Ctrl',ctrl:'Ctrl',alt:isMac?'⌥':'Alt',shift:'⇧',arrowleft:'←',arrowright:'→',arrowup:'↑',arrowdown:'↓',escape:'Esc',space:'Space'};
      return m[p]||p.toUpperCase();
    }).join(' ');
  }
  function render(){
    document.querySelectorAll('[data-shortcut-edit]').forEach(btn=>{
      const key=btn.dataset.shortcutEdit;
      btn.textContent=recordingKey===key?'Press keys…':formatShortcut(shortcuts[key]);
      btn.classList.toggle('recording',recordingKey===key);
    });
  }
  function duplicateFor(key,value){
    return Object.keys(shortcuts).find(k=>k!==key&&shortcuts[k]===value);
  }
  function isNavigationKey(key){return ['back','forward','dayPrev','dayNext','dayPrevAlt','dayNextAlt'].includes(key)}
  function run(action){
    const active=document.querySelector('.page.active')?.id||'';
    if(action==='home'){document.querySelector('[data-page=\"home-page\"]')?.click();return}
    if(action==='calendar'){document.querySelector('[data-page=\"calendar-page\"]')?.click();return}
    if(action==='integrations'){document.querySelector('[data-page=\"integrations-page\"]')?.click();return}
    if(action==='today'){
      const api=window.TrainMeiState||window.__tp;
      if(api?.openDay&&api?.todayKey){api.openDay(api.todayKey());}else{document.querySelector('[data-page=\"calendar-page\"]')?.click();}
      return;
    }
    if(action==='dayPrev'||action==='dayNext'||action==='dayPrevAlt'||action==='dayNextAlt'){
      const api=window.TrainMeiState||window.__tp;
      const key=api?.selectedDateKey;
      if(api?.openDay&&/^\d{4}-\d{2}-\d{2}$/.test(key||'')){
        const [y,m,d]=key.split('-').map(Number),dt=new Date(y,m-1,d+((action==='dayPrev'||action==='dayPrevAlt')?-1:1));
        api.openDay(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`);
      }
      return;
    }
    if(action==='back'){
      if(isEditable(document.activeElement))return;
      const backBtn=document.querySelector('#day-page.active #back-btn');
      if(backBtn){backBtn.click();return;}
      appBack();
      return;
    }
    if(action==='forward'){
      if(isEditable(document.activeElement))return;
      if(navForward.length){appForward();return;}
      const api=window.TrainMeiState||window.__tp;
      const key=api?.selectedDateKey;
      if(document.querySelector('#day-page.active') && api?.openDay && /^\d{4}-\d{2}-\d{2}$/.test(key||'')){
        const [y,m,d]=key.split('-').map(Number),dt=new Date(y,m-1,d+1);
        api.openDay(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`);
        return;
      }
      window.history.forward();
      return;
    }
    if(action==='close'){
      const openModal=document.querySelector('.modal-backdrop.show');
      if(openModal){openModal.classList.remove('show');return}
      if(active==='day-page'&&typeof renderMonth==='function'){renderMonth();return}
      return;
    }
    if(action==='search'){
      if(typeof openSearch==='function'){openSearch();return}
      const input=document.querySelector('#smart-search-input');
      const modal=document.querySelector('#smart-search-modal');
      if(modal){modal.classList.add('show');input?.focus()}
      return;
    }
    if(action==='help'){
      const panel=document.querySelector('#shortcuts-panel');
      const body=document.querySelector('#shortcuts-panel-body');
      const header=document.querySelector('#shortcuts-panel-header');
      const settings=document.querySelector('#settings-modal');
      if(settings&&!settings.classList.contains('show'))settings.classList.add('show');
      if(panel&&body&&header){header.classList.add('open');header.setAttribute('aria-expanded','true');body.classList.add('open')}
    }
  }
  document.addEventListener('keydown',e=>{
    if(recordingKey){
      e.preventDefault();e.stopPropagation();
      const value=normalizeEvent(e);
      if(!value)return;
      const conflict=duplicateFor(recordingKey,value);
      if(conflict){
        alert(`Shortcut already assigned to ${LABELS[conflict]}.`);
        recordingKey=null;render();return;
      }
      shortcuts[recordingKey]=value;save();recordingKey=null;render();return;
    }
    if(e.isComposing)return;
    const editable=isEditable(e.target);
    const value=normalizeEvent(e);
    if(!value)return;
    const action=Object.keys(shortcuts).find(k=>shortcuts[k]===value);
    if(!action)return;
    if(editable&&!isNavigationKey(action)&&action!=='close'&&action!=='search'&&action!=='help')return;
    e.preventDefault();
    run(action);
  },true);
  document.addEventListener('click',e=>{
    const edit=e.target.closest('[data-shortcut-edit]');
    if(edit){recordingKey=edit.dataset.shortcutEdit;render();return}
    if(e.target.closest('#reset-shortcuts')){shortcuts={...DEFAULTS};save();recordingKey=null;render();return}
    const header=e.target.closest('#shortcuts-panel-header');
    if(header){
      const body=document.querySelector('#shortcuts-panel-body');
      header.classList.toggle('open');body?.classList.toggle('open');
      header.setAttribute('aria-expanded',String(header.classList.contains('open')));
    }
  });
  document.addEventListener('keydown',e=>{
    const header=document.querySelector('#shortcuts-panel-header');
    if(document.activeElement===header&&(e.key==='Enter'||e.key===' ')){e.preventDefault();header.click()}
  });
  render();
})();

