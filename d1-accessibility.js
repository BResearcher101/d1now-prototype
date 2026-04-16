(function(){
  const STORAGE_KEY = 'd1now-accessibility-settings-v1';
  const defaultSettings = {
    theme: 'light', font: 'sans', size: 'medium', spacing: 'normal',
    links: false, motion: false, guide: false
  };
  const state = loadSettings();

  function loadSettings(){
    try { return {...defaultSettings, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {})}; }
    catch { return {...defaultSettings}; }
  }
  function saveSettings(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

  function applyState(){
    const root = document.documentElement;
    [
      'd1a-theme-light','d1a-theme-sepia','d1a-theme-dark','d1a-theme-contrast',
      'd1a-font-serif','d1a-font-readable',
      'd1a-size-small','d1a-size-medium','d1a-size-large','d1a-size-xlarge',
      'd1a-spacing-normal','d1a-spacing-wide',
      'd1a-links-underlined','d1a-reduce-motion','d1a-reading-guide'
    ].forEach(c=>root.classList.remove(c));

    root.classList.add('d1a-theme-' + state.theme);
    if(state.font === 'serif') root.classList.add('d1a-font-serif');
    if(state.font === 'readable') root.classList.add('d1a-font-readable');
    root.classList.add('d1a-size-' + state.size);
    root.classList.add('d1a-spacing-' + state.spacing);
    if(state.links) root.classList.add('d1a-links-underlined');
    if(state.motion) root.classList.add('d1a-reduce-motion');
    if(state.guide) root.classList.add('d1a-reading-guide');
    syncButtons();
  }

  function syncButtons(){
    document.querySelectorAll('[data-d1a-setting]').forEach(btn=>{
      const type = btn.dataset.d1aSetting;
      const value = btn.dataset.d1aValue;
      const active = state[type] === value;
      btn.setAttribute('aria-pressed', String(active));
      btn.classList.toggle('is-active', active);
    });
    document.querySelectorAll('[data-d1a-toggle]').forEach(btn=>{
      const key = btn.dataset.d1aToggle;
      btn.setAttribute('aria-pressed', String(!!state[key]));
    });
  }

  function setState(key, value){ state[key] = value; saveSettings(); applyState(); }
  function toggleState(key){ state[key] = !state[key]; saveSettings(); applyState(); }

  let currentUtterance = null;
  function getReadableText(){
    const main = document.querySelector('[data-d1-main]') || document.querySelector('main') || document.body;
    return main.innerText.replace(/\s+/g, ' ').trim();
  }
  function speakPage(){
    if(!('speechSynthesis' in window)){ showStatus('Read aloud is not supported in this browser.'); return; }
    window.speechSynthesis.cancel();
    const text = getReadableText();
    if(!text){ showStatus('There is no readable text on this page yet.'); return; }
    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.lang = document.documentElement.lang || 'en-IE';
    currentUtterance.rate = 1; currentUtterance.pitch = 1;
    currentUtterance.onend = ()=>updateReadButtons(false);
    currentUtterance.onerror = ()=>updateReadButtons(false);
    window.speechSynthesis.speak(currentUtterance);
    updateReadButtons(true);
  }
  function stopSpeaking(){ if('speechSynthesis' in window) window.speechSynthesis.cancel(); updateReadButtons(false); }
  function updateReadButtons(reading){
    document.querySelectorAll('[data-d1a-read]').forEach(btn=>btn.hidden = reading);
    document.querySelectorAll('[data-d1a-stop]').forEach(btn=>btn.hidden = !reading);
  }

  function openEl(el){ if(el) el.setAttribute('aria-hidden', 'false'); }
  function closeEl(el){ if(el) el.setAttribute('aria-hidden', 'true'); }
  function maybeCloseBackdrop(){
    const accessOpen = document.getElementById('d1a-access-panel')?.getAttribute('aria-hidden') === 'false';
    const searchOpen = document.getElementById('d1a-search-modal')?.getAttribute('aria-hidden') === 'false';
    if(!accessOpen && !searchOpen) closeEl(document.getElementById('d1a-backdrop'));
  }

  function showStatus(message){
    const box = document.getElementById('d1a-status');
    if(!box) return;
    box.textContent = message;
    openEl(box);
    clearTimeout(showStatus._t);
    showStatus._t = setTimeout(()=>closeEl(box), 2600);
  }

  function ensureIds(){
    document.querySelectorAll('main h1, main h2, main h3, [data-d1-main] h1, [data-d1-main] h2, [data-d1-main] h3').forEach((h, i)=>{
      if(!h.id) h.id = 'section-' + h.textContent.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') + '-' + (i+1);
    });
  }
  function getSearchableNodes(){
    const selectors = 'main h1, main h2, main h3, main p, main li, [data-d1-main] h1, [data-d1-main] h2, [data-d1-main] h3, [data-d1-main] p, [data-d1-main] li';
    return Array.from(document.querySelectorAll(selectors)).filter(node => node.offsetParent !== null && node.textContent.trim().length > 0);
  }
  function escapeHtml(str){
    return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function escapeRegExp(string){ return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function highlight(text, query){
    if(!query) return escapeHtml(text);
    const safe = escapeRegExp(query.trim());
    if(!safe) return escapeHtml(text);
    return escapeHtml(text).replace(new RegExp('(' + safe + ')', 'ig'), '<mark class="d1a-mark">$1</mark>');
  }
  function buildSearchResults(query){
    ensureIds();
    const q = query.trim().toLowerCase();
    const hits = [];
    getSearchableNodes().forEach(node=>{
      const text = node.textContent.trim();
      const hay = text.toLowerCase();
      if(!q || !hay.includes(q)) return;
      const heading = node.closest('section, article, main')?.querySelector('h1, h2, h3');
      const target = heading || node;
      const title = heading ? heading.textContent.trim() : 'Page content';
      const href = '#' + target.id;
      const idx = hay.indexOf(q);
      const start = Math.max(0, idx - 48);
      const end = Math.min(text.length, idx + q.length + 72);
      let excerpt = text.slice(start, end);
      if(start > 0) excerpt = '…' + excerpt;
      if(end < text.length) excerpt = excerpt + '…';
      hits.push({title, href, excerpt});
    });
    return hits.slice(0, 14);
  }
  function renderResults(results, query){
    const list = document.getElementById('d1a-results');
    if(!list) return;
    list.innerHTML = '';
    if(!query.trim()){
      list.innerHTML = '<p class="d1a-search-hint">Try a page title, topic, person, or keyword like “trial”, “YAP”, “mentor”, or “resources”.</p>';
      return;
    }
    if(!results.length){
      list.innerHTML = '<p class="d1a-search-hint">No results found on this page. Try another keyword.</p>';
      return;
    }
    results.forEach(result=>{
      const a = document.createElement('a');
      a.className = 'd1a-result';
      a.href = result.href;
      a.innerHTML = '<strong>' + highlight(result.title, query) + '</strong><div>' + highlight(result.excerpt, query) + '</div><small>Jump to section</small>';
      a.addEventListener('click', ()=> closeSearch());
      list.appendChild(a);
    });
  }

  function openSearch(){
    openEl(document.getElementById('d1a-search-modal'));
    openEl(document.getElementById('d1a-backdrop'));
    const input = document.getElementById('d1a-search-input');
    if(input){ input.value = ''; renderResults([], ''); setTimeout(()=>input.focus(), 20); }
  }
  function closeSearch(){ closeEl(document.getElementById('d1a-search-modal')); maybeCloseBackdrop(); }
  function openAccess(){ openEl(document.getElementById('d1a-access-panel')); openEl(document.getElementById('d1a-backdrop')); }
  function closeAccess(){ closeEl(document.getElementById('d1a-access-panel')); maybeCloseBackdrop(); }
  function resetSettings(){ Object.assign(state, defaultSettings); saveSettings(); applyState(); showStatus('Accessibility settings reset.'); }

  function inject(){
    if(document.getElementById('d1a-backdrop')) return;
    const backdrop = document.createElement('div');
    backdrop.id = 'd1a-backdrop';
    backdrop.className = 'd1a-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');

    const floating = document.createElement('div');
    floating.className = 'd1a-floating-stack';
    floating.innerHTML = `
      <button class="d1a-floating-action" type="button" id="d1a-access-open" aria-controls="d1a-access-panel" aria-expanded="false">⚙️ <span>Accessibility</span></button>
      <button class="d1a-floating-action d1a-floating-action--secondary" type="button" data-d1a-read>🔊 <span>Read aloud</span></button>
      <button class="d1a-floating-action d1a-floating-action--ghost" type="button" data-d1a-stop hidden>⏹ <span>Stop reading</span></button>
    `;

    const panel = document.createElement('aside');
    panel.id = 'd1a-access-panel';
    panel.className = 'd1a-panel d1a-surface';
    panel.setAttribute('aria-hidden', 'true');
    panel.setAttribute('aria-label', 'Accessibility settings');
    panel.innerHTML = `
      <h2>Accessibility</h2>
      <p>Adjust the page to suit your reading style and preferences.</p>
      <div class="d1a-panel-section"><span class="d1a-panel-label">Text size</span><div class="d1a-chip-row">
        <button class="d1a-chip" type="button" data-d1a-setting="size" data-d1a-value="small">Small</button>
        <button class="d1a-chip" type="button" data-d1a-setting="size" data-d1a-value="medium">Default</button>
        <button class="d1a-chip" type="button" data-d1a-setting="size" data-d1a-value="large">Large</button>
        <button class="d1a-chip" type="button" data-d1a-setting="size" data-d1a-value="xlarge">Extra large</button>
      </div></div>
      <div class="d1a-panel-section"><span class="d1a-panel-label">Font</span><div class="d1a-chip-row">
        <button class="d1a-chip" type="button" data-d1a-setting="font" data-d1a-value="sans">Sans</button>
        <button class="d1a-chip" type="button" data-d1a-setting="font" data-d1a-value="serif">Serif</button>
        <button class="d1a-chip" type="button" data-d1a-setting="font" data-d1a-value="readable">Readable</button>
      </div></div>
      <div class="d1a-panel-section"><span class="d1a-panel-label">Theme</span><div class="d1a-chip-row">
        <button class="d1a-chip" type="button" data-d1a-setting="theme" data-d1a-value="light">White</button>
        <button class="d1a-chip" type="button" data-d1a-setting="theme" data-d1a-value="sepia">Sepia</button>
        <button class="d1a-chip" type="button" data-d1a-setting="theme" data-d1a-value="dark">Night</button>
        <button class="d1a-chip" type="button" data-d1a-setting="theme" data-d1a-value="contrast">High contrast</button>
      </div></div>
      <div class="d1a-panel-section"><span class="d1a-panel-label">Reading comfort</span><div class="d1a-chip-row">
        <button class="d1a-chip" type="button" data-d1a-setting="spacing" data-d1a-value="normal">Normal spacing</button>
        <button class="d1a-chip" type="button" data-d1a-setting="spacing" data-d1a-value="wide">Wide spacing</button>
      </div></div>
      <div class="d1a-inline-toggle"><label for="d1a-toggle-links">Underline links</label><button class="d1a-switch" type="button" id="d1a-toggle-links" data-d1a-toggle="links" aria-pressed="false"></button></div>
      <div class="d1a-inline-toggle"><label for="d1a-toggle-motion">Reduce motion</label><button class="d1a-switch" type="button" id="d1a-toggle-motion" data-d1a-toggle="motion" aria-pressed="false"></button></div>
      <div class="d1a-inline-toggle"><label for="d1a-toggle-guide">Reading guide layout</label><button class="d1a-switch" type="button" id="d1a-toggle-guide" data-d1a-toggle="guide" aria-pressed="false"></button></div>
      <div class="d1a-panel-actions">
        <button class="d1a-btn d1a-btn--primary" type="button" id="d1a-search-open-inline">Search page</button>
        <button class="d1a-btn d1a-btn--secondary" type="button" id="d1a-read-open-inline">Read aloud</button>
        <button class="d1a-btn d1a-btn--plain" type="button" id="d1a-reset">Reset</button>
      </div>
    `;

    const searchModal = document.createElement('div');
    searchModal.id = 'd1a-search-modal';
    searchModal.className = 'd1a-modal';
    searchModal.setAttribute('aria-hidden', 'true');
    searchModal.innerHTML = `
      <div class="d1a-modal-card d1a-surface" role="dialog" aria-modal="true" aria-label="Search this page">
        <div class="d1a-modal-head"><h2>Search this page</h2><button class="d1a-btn d1a-btn--plain" type="button" id="d1a-search-close">Close</button></div>
        <div class="d1a-modal-body">
          <div class="d1a-search-box"><input class="d1a-search-input" id="d1a-search-input" type="search" placeholder="Search headings, keywords, people, or resources" autocomplete="off"></div>
          <div id="d1a-results" class="d1a-results"></div>
        </div>
      </div>
    `;

    const status = document.createElement('div');
    status.id = 'd1a-status';
    status.className = 'd1a-status d1a-surface';
    status.setAttribute('aria-hidden', 'true');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    document.body.append(backdrop, floating, panel, searchModal, status);

    const target = document.querySelector('[data-d1a-top-actions]');
    if(target){
      target.innerHTML = `
        <button class="d1a-top-btn" type="button" id="d1a-header-access">⚙️ <span>Accessibility</span></button>
        <button class="d1a-top-btn" type="button" id="d1a-header-search">🔍 <span>Search</span></button>
      `;
    }
    bindEvents();
    applyState();
  }

  function bindEvents(){
    document.getElementById('d1a-access-open')?.addEventListener('click', ()=>{
      const panel = document.getElementById('d1a-access-panel');
      const expanded = panel?.getAttribute('aria-hidden') === 'false';
      expanded ? closeAccess() : openAccess();
      document.getElementById('d1a-access-open')?.setAttribute('aria-expanded', String(!expanded));
    });
    document.getElementById('d1a-header-access')?.addEventListener('click', openAccess);
    document.getElementById('d1a-header-search')?.addEventListener('click', openSearch);
    document.getElementById('d1a-search-open-inline')?.addEventListener('click', openSearch);
    document.getElementById('d1a-search-close')?.addEventListener('click', closeSearch);
    document.getElementById('d1a-read-open-inline')?.addEventListener('click', speakPage);
    document.querySelectorAll('[data-d1a-read]').forEach(btn=>btn.addEventListener('click', speakPage));
    document.querySelectorAll('[data-d1a-stop]').forEach(btn=>btn.addEventListener('click', stopSpeaking));
    document.getElementById('d1a-reset')?.addEventListener('click', resetSettings);
    document.querySelectorAll('[data-d1a-setting]').forEach(btn=>btn.addEventListener('click', ()=> setState(btn.dataset.d1aSetting, btn.dataset.d1aValue)));
    document.querySelectorAll('[data-d1a-toggle]').forEach(btn=>btn.addEventListener('click', ()=> toggleState(btn.dataset.d1aToggle)));
    document.getElementById('d1a-backdrop')?.addEventListener('click', ()=>{ closeAccess(); closeSearch(); });
    document.getElementById('d1a-search-input')?.addEventListener('input', e=>renderResults(buildSearchResults(e.target.value), e.target.value));
    document.addEventListener('keydown', e=>{ if(e.key === 'Escape'){ closeAccess(); closeSearch(); } });
  }

  document.addEventListener('DOMContentLoaded', inject);
  window.D1Accessibility = { openAccess, closeAccess, openSearch, closeSearch, speakPage, stopSpeaking, resetSettings };
})();
