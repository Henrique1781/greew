/* ============================================================
   GREEN - helpers de UI (icones, escudos, toast, bottom sheet)
   ============================================================ */
(function (global) {
  'use strict';

  var ICONS = {
    jogos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 4l3 2 6-3.5L18 6l3-2v9.5C21 18 16.5 21.5 12 23.5 7.5 21.5 3 18 3 13.5z"/><path d="M8.5 12l2.5 2.5L16 9" stroke-linecap="round"/></svg>',
    analise: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V9M9.5 19V5M15 19v-7M20.5 19v-4"/></svg>',
    bilhetes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M4 6.5A1.5 1.5 0 015.5 5h13A1.5 1.5 0 0120 6.5V9a2.4 2.4 0 000 4.8v3.7A1.5 1.5 0 0118.5 19h-13A1.5 1.5 0 014 17.5v-3.7A2.4 2.4 0 004 9z"/><path d="M14 5v14" stroke-dasharray="2 2.4"/></svg>',
    placar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v4a4 4 0 01-8 0z"/><path d="M16 5h3v2a3 3 0 01-3 3M8 5H5v2a3 3 0 003 3"/><path d="M12 12v4M9 20h6M10.5 16h3l.7 4h-4.4z"/></svg>',
    ajustes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.5 12a7.5 7.5 0 00-.1-1.2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 00-2.1-1.2L14.6 3h-4l-.4 2.6c-.8.3-1.5.7-2.1 1.2l-2.3-1-2 3.4 2 1.5a7.6 7.6 0 000 2.5l-2 1.5 2 3.4 2.3-1c.6.5 1.3 1 2.1 1.2l.4 2.6h4l.4-2.6c.8-.3 1.5-.7 2.1-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/></svg>',
    star: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    chev: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    cam: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 8.5A1.5 1.5 0 014.5 7h2.2l1.2-2h8.2l1.2 2h2.2A1.5 1.5 0 0121 8.5v9A1.5 1.5 0 0119.5 19h-15A1.5 1.5 0 013 17.5z"/><circle cx="12" cy="13" r="3.4"/></svg>',
    kbd: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 12h10l1-12"/></svg>',
    cal: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>',
    brain: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M9 4a3 3 0 00-3 3 3 3 0 00-2 5.3A3 3 0 006 17a3 3 0 003 3z"/><path d="M15 4a3 3 0 013 3 3 3 0 012 5.3A3 3 0 0118 17a3 3 0 01-3 3z"/><path d="M12 4v16"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 10-2.3 6M20 5v6h-6"/></svg>',
    globe: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M3.5 9h17M3.5 15h17M12 3a15 15 0 010 18A15 15 0 0112 3z"/></svg>',
    empty: '<svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9.5h.01M15 9.5h.01"/></svg>'
  };

  var PALETA = ['#C8102E', '#0057B8', '#1B7F3B', '#5B2C8D', '#E36414', '#0E7C86',
    '#B3272D', '#243B7A', '#8A1538', '#2F6F4E', '#7A4E1D', '#334155'];

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }

  function iniciais(nome) {
    var p = String(nome || '?').replace(/[^\wÀ-ÿ\s]/g, ' ').trim().split(/\s+/);
    if (p.length === 1) return p[0].slice(0, 3).toUpperCase();
    return (p[0][0] + p[1][0] + (p[2] ? p[2][0] : '')).toUpperCase();
  }

  /** escudo: usa a imagem oficial quando existe e cai nas iniciais se falhar */
  function crest(nome, url) {
    var c = PALETA[hash(String(nome || '')) % PALETA.length];
    var base = '<span class="crestmini" style="background:' + c + '">' + esc(iniciais(nome)) + '</span>';
    if (!url) return base;
    return '<span class="crestwrap">' + base +
      '<img src="' + esc(url) + '" alt="" loading="lazy" onerror="this.remove()"></span>';
  }

  /** versao grande usada na tela de detalhe */
  function crestBig(nome, url) {
    var c = PALETA[hash(String(nome || '')) % PALETA.length];
    var base = '<span class="crestbig" style="background:' + c + '">' + esc(iniciais(nome)) + '</span>';
    if (!url) return base;
    return '<span class="crestwrap big">' + base +
      '<img src="' + esc(url) + '" alt="" loading="lazy" onerror="this.remove()"></span>';
  }

  function confBar(pct) {
    var p = Math.max(0, Math.min(100, Number(pct) || 0));
    var cls = p >= 75 ? 'hi' : (p < 55 ? 'lo' : '');
    return '<div class="conf"><div class="bar"><i class="' + cls + '" style="width:' + p + '%"></i></div>' +
      '<span class="pct">' + p + '%</span></div>';
  }

  function money(v) {
    var n = Number(v) || 0;
    return Store.state.cfg.moeda + ' ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function odd(v) {
    var n = Number(v) || 0;
    return '@' + n.toFixed(2);
  }

  /* ---------- toast ---------- */
  function toast(msg, tipo) {
    var wrap = document.getElementById('toasts');
    var el = document.createElement('div');
    el.className = 'toast' + (tipo ? ' ' + tipo : '');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .25s';
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 260);
    }, tipo === 'err' ? 5200 : 2600);
  }

  /* ---------- bottom sheet ---------- */
  function sheet(html) {
    var s = document.getElementById('sheet');
    var b = document.getElementById('sheetBackdrop');
    document.getElementById('sheetBody').innerHTML = html;
    s.hidden = false; b.hidden = false;
    b.onclick = closeSheet;
    return s;
  }
  function closeSheet() {
    document.getElementById('sheet').hidden = true;
    document.getElementById('sheetBackdrop').hidden = true;
  }

  function confirmar(msg) { return global.confirm(msg); }

  global.UI = {
    ICONS: ICONS, esc: esc, crest: crest, crestBig: crestBig, iniciais: iniciais, confBar: confBar,
    money: money, odd: odd, toast: toast, sheet: sheet, closeSheet: closeSheet,
    confirmar: confirmar
  };
})(window);
