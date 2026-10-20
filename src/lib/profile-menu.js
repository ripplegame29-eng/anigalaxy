/*!
 * ProfileMenu — выпадающее меню профиля (без зависимостей, чистый JS).
 * Подключение: <link rel="stylesheet" href="profile-menu.css"> и <script src="profile-menu.js"></script>
 *
 * const menu = ProfileMenu.init({
 *   trigger: document.querySelector('#profile-btn'),   // кнопка, по клику на которую открывается меню
 *   getProfile: () => ({                                // вызывается при каждом открытии, всегда свежие данные
 *     name, email, premium, letter, avatarUrl,
 *     level, xp, xpToNext, xpPercent, era,              // уровень, всего XP, осталось до следующего, 0–100, название эры
 *     minutes, anime, coins                                 // плитки статистики — в меню больше не выводятся, но остаются в контракте
 *   }),
 *   onSelect: (id, item, event) => {},                  // клик по пункту (id: profile, list, shop, quests, ...)
 *   onLogout: () => {},                                 // клик по «Выйти»
 *   onEffectChange: (name) => {},                       // '', 'neon', 'glitch', 'rainbow'
 * });
 * Плашка PREMIUM в шапке: ProfileMenu.premiumButton({ container: headerEl, href: '#premium', premium: profile.premium })
 * Аватар в самой кнопке: trigger.innerHTML = ProfileMenu.avatarHTML(profile, 36) — тогда у него тоже кольцо XP и эффект.
 */
(function (g) {
  'use strict';

  var P = {
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    list:'<path d="M4 6h12M4 12h12M4 18h7M17 14l4 3-4 3z"/>',
    store:'<path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9c0 2.2 3 2.2 4 0 1 2.2 3 2.2 4 0 1 2.2 3 2.2 4 0 1 2.2 4 2.2 4 0"/>',
    bulb:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 0 0-4-10z"/>',
    trophy:'<path d="M8 4h8v6a4 4 0 0 1-8 0zM8 6H4v2a3 3 0 0 0 4 3M16 6h4v2a3 3 0 0 1-4 3M12 14v4M8 21h8"/>',
    gift:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8c-3 0-5-4-2-4 2 0 2 4 2 4zM12 8c3 0 5-4 2-4-2 0-2 4-2 4z"/>',
    /* Ивент: календарь с отметкой — в меню стоит вместо «Подарки Premium» */
    event:'<rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4M12 13v4M10 15h4"/>',
    palette:'<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2-.6-1.2.2-2.5 1.6-2.5H17a4 4 0 0 0 4-4c0-5-4-9.5-9-9.5z"/><circle cx="8" cy="11" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16" cy="11" r="1"/>',
    uplus:'<circle cx="10" cy="8" r="4"/><path d="M2 21c0-4 3.5-6 8-6M19 8v6M16 11h6"/>',
    bell:'<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>',
    gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    crown:'<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
    out:'<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>'
  };
  var DEFAULT_ITEMS = [
    {id:'profile',label:'Мой профиль',icon:'user'},
    {id:'list',label:'Мой список',icon:'list'},
    {id:'shop',label:'Магазин',icon:'store'},
    {id:'quests',label:'Квесты',icon:'bulb'},
    {id:'achievements',label:'Достижения',icon:'trophy'},
    {id:'cosmetics',label:'Косметика',icon:'palette'},
    {id:'invite',label:'Пригласи друзей',icon:'uplus'},
    /* Пункт «Подарки Premium» заменён на «Ивенты»: подарки ушли из меню */
    {id:'events',label:'Ивенты',icon:'event'},
    {id:'settings',label:'Настройки',icon:'gear'},
    {id:'premium',label:'Premium',icon:'crown'}
  ];
  var FX_CLASSES = ['pm-fx-neon', 'pm-fx-glitch', 'pm-fx-rainbow'];

  function ic(k){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+P[k]+'</svg>'}
  function fmt(n){return Number(n||0).toLocaleString('ru-RU')}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function clampPct(v){v=Number(v)||0;return Math.max(0,Math.min(100,v))}
  var reduce = g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* аватар с кольцом XP. empty=true — кольцо пустое (для анимации заполнения при открытии) */
  function avatarHTML(p, size, empty){
    p = p || {};
    var pct = clampPct(p.xpPercent);
    var inner = p.avatarUrl ? '<img src="'+esc(p.avatarUrl)+'" alt="">' : esc((p.letter || p.name || '?').toString().charAt(0).toUpperCase());
    return '<span class="pm-av" data-pm-av style="--s:'+(size||36)+'px">'+
      '<span class="pm-pic">'+inner+'</span>'+
      '<svg class="pm-rg" viewBox="0 0 100 100" aria-hidden="true"><circle class="pm-t" cx="50" cy="50" r="46"/>'+
      '<circle class="pm-v" cx="50" cy="50" r="46" data-pct="'+pct+'" style="stroke-dashoffset:'+(empty?289:289*(1-pct/100))+'"/></svg></span>';
  }

  var defsAdded = false;
  function addDefs(){
    if(defsAdded || document.getElementById('pm-xg')) return;
    defsAdded = true;
    var d = document.createElement('div');
    d.className = 'pm-root';
    d.innerHTML = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="pm-xg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#38c8ff"/><stop offset="1" stop-color="#2b7fff"/></linearGradient></defs></svg>';
    document.body.appendChild(d);
  }

  function init(opts){
    if(!opts || !opts.trigger || typeof opts.getProfile !== 'function') throw new Error('ProfileMenu: нужны trigger и getProfile');
    var o = {
      items: DEFAULT_ITEMS, storageKey: 'pm_effect', premiumLabel: 'PREMIUM', note: '',
      logoutLabel: 'Выйти'
    };
    for(var k in opts) o[k] = opts[k];
    addDefs();

    var uid = 'pm-menu-' + Math.random().toString(36).slice(2, 8);
    var trigger = o.trigger, listeners = [], isOpen = false, countRaf = [];
    function on(t, ev, fn, opt){t.addEventListener(ev, fn, opt);listeners.push([t, ev, fn, opt])}

    var root = document.createElement('div'); root.className = 'pm-root';
    var scrim = document.createElement('div'); scrim.className = 'pm-scrim';
    var menu = document.createElement('div'); menu.className = 'pm-menu'; menu.id = uid; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', 'Профиль');

    var itemsHTML = o.items.map(function(it, i){
      var ch = '<svg class="pm-ch" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
      return '<div class="pm-it'+(it.id === 'premium' ? ' pm-prem' : '')+'" style="--i:'+(i + 3)+'"><a class="pm-link" role="menuitem" data-id="'+esc(it.id)+'" href="'+esc(it.href||'#')+'">'+
        '<span class="pm-ico">'+ic(it.icon||'user')+'</span><span class="pm-tx">'+esc(it.label)+'</span>'+
        (it.badge ? '<span class="pm-badge" data-badge="'+esc(typeof it.badge==='string'?it.badge:it.id)+'" hidden></span>' : '') + ch +'</a></div>';
    }).join('');
    menu.innerHTML =
      '<div class="pm-aur" aria-hidden="true"></div>'+
      '<div class="pm-mh pm-rv" style="--i:0"><span data-pm="avatar"></span><div class="pm-who"><b><span data-pm="name"></span> <span class="pm-pr" data-pm="premium" hidden><span class="ag-premium"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3.5 18h17M3.5 18 2.5 8.7 8 12.4 12 5.6l4 6.8 5.5-3.7-1 9.3z"/></svg>PREMIUM</span></span></b><span data-pm="email"></span></div></div>'+
      '<div class="pm-lvl pm-rv" style="--i:1"><div class="pm-lt" data-pm="lvtile"></div><div class="pm-lm">'+
      '<div class="pm-lr"><b data-pm="lvline"></b><span class="pm-pc" data-pm="pct"></span></div>'+
      '<div class="pm-xb"><i data-pm="xp"></i></div><div class="pm-lr pm-lr2"><small data-pm="era"></small><small data-pm="remain"></small></div></div></div>'+
      /* Блок ежедневного входа по макету: кнопка с полосками серии и пилюлей,
         снизу — окно с сеткой дней. Награда начисляется по-настоящему */
      '<button type="button" class="pm-daily pm-rv" style="--i:2" data-pm="daily">'+
        '<span class="pm-dic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4M16 3v4M4 10h16M9 15l2 2 4-4"/></svg></span>'+
        '<span><b>Ежедневный вход</b><small data-pm="dsub"></small><span class="pm-pips" data-pm="pips"></span></span>'+
        '<span class="pm-pill" data-pm="pill">Забрать</span></button>'+
      '<div class="pm-ml"><div class="pm-hl" data-pm="hl"></div><nav class="pm-list" data-pm="list">'+
      itemsHTML+'<div class="pm-sep pm-rv" style="--i:'+(o.items.length + 3)+'"></div>'+
      '<div class="pm-it pm-out" style="--i:'+(o.items.length + 4)+'"><a class="pm-link" role="menuitem" data-id="logout" href="#"><span class="pm-ico">'+ic('out')+'</span><span class="pm-tx">'+esc(o.logoutLabel)+'</span></a></div></nav></div>'+
      /* Блок статистики (минуты / аниме / монеты) и переключатель эффекта
         аватара убраны из меню по решению владельца сайта: статистика есть в
         профиле, а эффекты переключаются там же. Само значение эффекта
         продолжает применяться — `pm_effect` читается как раньше. */
      (o.note ? '<p class="pm-note pm-rv" style="--i:'+(o.items.length + 5)+'">'+esc(o.note)+'</p>' : '')+
      /* Окно ежедневного входа рисует React-компонент (DailyLoginModal) —
         его вёрстка живёт по макету «Ежедневный вход», поэтому здесь лишней
         разметки нет. Блок ниже только показывает состояние и зовёт onDaily. */
      '<div class="pm-toast" data-pm="toast" role="status"></div>';
    root.appendChild(scrim); root.appendChild(menu); document.body.appendChild(root);

    function q(n){return menu.querySelector('[data-pm="'+n+'"]')}
    var hl = q('hl'), prof = {};

    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', uid);

    /* ---------- данные ---------- */
    function update(){
      prof = o.getProfile() || {};
      q('avatar').innerHTML = avatarHTML(prof, 68, true);
      q('name').textContent = prof.name || '';
      q('email').textContent = prof.email || '';
      q('premium').hidden = !prof.premium;
      q('lvtile').textContent = prof.level != null ? prof.level : '';
      q('lvline').textContent = 'Уровень ' + (prof.level != null ? prof.level : '—') + (prof.xp != null ? ' · ' + fmt(prof.xp) + ' XP' : '');
      q('era').textContent = prof.era ? 'Эра: ' + prof.era : '';
      q('remain').textContent = prof.xpToNext != null ? 'ещё ' + fmt(prof.xpToNext) + ' XP' : '';
      q('pct').textContent = clampPct(prof.xpPercent) + '%';
      menu.querySelectorAll('[data-badge]').forEach(function(b){
        var key = b.getAttribute('data-badge'), item = o.items.filter(function(i){return (typeof i.badge==='string'?i.badge:i.id)===key})[0];
        var v = item && typeof item.badge === 'function' ? item.badge(prof) : prof[key];
        v = Number(v) || 0; b.hidden = v <= 0; b.textContent = v > 99 ? '99+' : v;
      });
      applyEffect(getEffect());
      paintDaily();
    }

    /* ---------- ежедневный вход ---------- */
    var dsub = q('dsub'), dpips = q('pips'), dpill = q('pill'), dtoast = q('toast');
    var daily = o.daily || null, toastTimer = null;

    /* Блок входа в меню — тексты и полоски из макета `ag-menu (1).html`
       (его `render()`): подпись про серию и семь полосок, закрашенных по
       длине серии. Серия настоящая — она лежит в профиле (`streak`). */
    function paintDaily(){
      if(!daily) return;
      var v = daily.view();
      var streak = Math.max(0, Number(daily.streak) || 0);
      dsub.textContent = streak === 0
        ? 'Заберите первую награду'
        : (v.canClaim ? 'Серия: ' + streak + ' дн. Не прервите её'
                      : 'Серия: ' + streak + ' дн. Приходите завтра');
      var done = streak % 7 || (streak > 0 ? 7 : 0);
      var pips = '';
      for(var i = 0; i < 7; i++){
        pips += '<i class="' + (i < done ? 'pm-on' : '') + '"></i>';
      }
      dpips.innerHTML = pips;
      dpill.textContent = v.canClaim ? 'Забрать' : 'Получено';
      dpill.classList.toggle('pm-off', !v.canClaim);
    }
    function say(text){
      dtoast.textContent = text;
      dtoast.classList.add('pm-on');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function(){dtoast.classList.remove('pm-on')}, 2600);
    }
    /* Окно ежедневного входа рисует React-компонент (DailyLoginModal) — оно
       большое и свёрстано по макету «Ежедневный вход», поэтому меню только
       зовёт `onDaily`. */
    function openDaily(){
      paintDaily();
      if(o.onDaily) o.onDaily();
    }
    on(q('daily'), 'click', function(e){e.stopPropagation(); openDaily()});
    function countUp(el, to){
      to = Number(to) || 0;
      if(reduce){el.textContent = fmt(to);return}
      var t0 = performance.now();
      (function f(t){var p = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(Math.round(to * e)); if(p < 1) countRaf.push(requestAnimationFrame(f))})(t0);
    }

    /* ---------- эффект аватара ---------- */
    function getEffect(){
      if(o.getEffect) return o.getEffect() || '';
      try{return localStorage.getItem(o.storageKey) || ''}catch(e){return ''}
    }
    function applyEffect(name){
      document.querySelectorAll('[data-pm-av]').forEach(function(a){
        FX_CLASSES.forEach(function(c){a.classList.remove(c)});
        if(name) a.classList.add('pm-fx-' + name);
      });
    }
    function setEffect(name){
      name = name || '';
      try{ if(name) localStorage.setItem(o.storageKey, name); else localStorage.removeItem(o.storageKey) }catch(e){}
      applyEffect(name);
      if(o.onEffectChange) o.onEffectChange(name);
    }
    /* Переключатель эффекта («Нет / Неон / Глитч / Радуга») убран из меню:
       эффекты выбираются в профиле. Само значение продолжает применяться к
       аватару из `pm_effect`, а публичный `setEffect` оставлен — им можно
       переключить эффект снаружи. */

    /* ---------- позиция, открытие, закрытие ---------- */
    function position(){
      if(g.matchMedia('(max-width:640px)').matches){menu.style.top = menu.style.right = '';return}
      var r = trigger.getBoundingClientRect();
      menu.style.top = Math.round(r.bottom + 12) + 'px';
      menu.style.right = Math.max(8, Math.round(g.innerWidth - r.right)) + 'px';
      menu.style.maxHeight = (g.innerHeight - r.bottom - 24) + 'px';
    }
    function items(){return [].slice.call(menu.querySelectorAll('[role=menuitem]'))}
    function open(focusFirst){
      if(isOpen) return;
      update(); position(); isOpen = true;
      menu.classList.add('pm-on'); scrim.classList.add('pm-on'); trigger.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(function(){
        q('xp').style.width = clampPct(prof.xpPercent) + '%';
        menu.querySelectorAll('.pm-v').forEach(function(c){c.style.strokeDashoffset = 289 * (1 - clampPct(prof.xpPercent) / 100)});
      });
      if(focusFirst) setTimeout(function(){var l = items(); if(l[0]) l[0].focus()}, 60);
      if(o.onOpen) o.onOpen();
    }
    function close(focusTrigger){
      if(!isOpen) return;
      isOpen = false; countRaf.forEach(cancelAnimationFrame); countRaf = [];
      menu.classList.remove('pm-on'); scrim.classList.remove('pm-on'); trigger.setAttribute('aria-expanded', 'false');
      hl.style.opacity = 0; q('xp').style.width = '0';
      if(focusTrigger) trigger.focus();
      if(o.onClose) o.onClose();
    }
    function toggle(){isOpen ? close() : open()}

    /* ---------- события ---------- */
    on(trigger, 'click', function(e){e.preventDefault(); toggle()});
    on(trigger, 'keydown', function(e){if(e.key === 'ArrowDown' && !isOpen){e.preventDefault(); open(true)}});
    on(scrim, 'click', function(){close()});
    on(document, 'keydown', function(e){
      if(!isOpen) return;
      if(e.key === 'Escape'){ if(dmodal.classList.contains('pm-on')){closeDaily()} else {close(true)} }
      else if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
        e.preventDefault(); var l = items(), i = l.indexOf(document.activeElement);
        l[(i + (e.key === 'ArrowDown' ? 1 : -1) + l.length) % l.length].focus();
      } else if(e.key === 'Tab'){ close() }
    });
    on(g, 'resize', function(){if(isOpen) position()});
    on(g, 'scroll', function(){if(isOpen) position()}, {passive:true});

    on(menu, 'click', function(e){
      var a = e.target.closest('.pm-link'); if(!a) return;
      var id = a.getAttribute('data-id');
      if(id === 'logout'){e.preventDefault(); close(); if(o.onLogout) o.onLogout(e); return}
      var item = o.items.filter(function(i){return i.id === id})[0];
      if(!item.href) e.preventDefault();
      if(item.onClick) item.onClick(e, item);
      if(o.onSelect) o.onSelect(id, item, e);
      close();
    });

    /* скользящая подсветка */
    function go(it){hl.style.opacity = 1; hl.style.height = it.offsetHeight + 'px'; hl.style.transform = 'translateY(' + it.offsetTop + 'px)'}
    menu.querySelectorAll('.pm-it').forEach(function(it){
      on(it, 'pointerenter', function(){go(it)});
      on(it, 'focusin', function(){go(it)});
    });
    on(q('list'), 'pointerleave', function(){hl.style.opacity = 0});

    applyEffect(getEffect());

    return {
      open: open, close: close, toggle: toggle, update: update, setEffect: setEffect, getEffect: getEffect,
      isOpen: function(){return isOpen},
      destroy: function(){
        close();
        listeners.forEach(function(l){l[0].removeEventListener(l[1], l[2], l[3])});
        root.remove();
        trigger.removeAttribute('aria-haspopup'); trigger.removeAttribute('aria-expanded'); trigger.removeAttribute('aria-controls');
      }
    };
  }

  /* Плашка PREMIUM для шапки: ProfileMenu.premiumButton({container, label, href, onClick, premium}) */
  function premiumButton(opts){
    opts = opts || {};
    var el = document.createElement(opts.href ? 'a' : 'button');
    if(opts.href) el.href = opts.href; else el.type = 'button';
    el.className = 'pm-pbtn' + (opts.premium ? ' pm-pbtn-on' : '');
    el.setAttribute('aria-label', opts.label || 'PREMIUM');
    el.innerHTML = ic('crown') + '<span>' + esc(opts.label || 'PREMIUM') + '</span>';
    if(opts.onClick) el.addEventListener('click', opts.onClick);
    if(opts.container) opts.container.appendChild(el);
    return el;
  }

  var api = {init: init, avatarHTML: avatarHTML, premiumButton: premiumButton, DEFAULT_ITEMS: DEFAULT_ITEMS};
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  g.ProfileMenu = api;
})(typeof window !== 'undefined' ? window : this);
