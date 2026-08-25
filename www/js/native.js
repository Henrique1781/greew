/* ============================================================
   GREEN - ponte com o Android (Capacitor)
   Em navegador tudo cai no fallback web sem quebrar nada.
   ============================================================ */
(function (global) {
  'use strict';

  function cap() { return global.Capacitor; }

  function isNative() {
    var c = cap();
    return !!(c && typeof c.isNativePlatform === 'function' && c.isNativePlatform());
  }

  function plugin(nome) {
    var c = cap();
    return (c && c.Plugins && c.Plugins[nome]) || null;
  }

  /** Requisicao HTTP nativa: nao passa pelo WebView, entao ignora CORS. */
  async function http(opts) {
    var H = plugin('CapacitorHttp');
    if (!H) throw new Error('HTTP nativo indisponível');
    var r = await H.request({
      method: opts.method || 'GET',
      url: opts.url,
      headers: opts.headers || {},
      data: opts.data,
      params: opts.params,
      connectTimeout: opts.timeout || 120000,
      readTimeout: opts.timeout || 600000,
      responseType: 'json'
    });
    var dados = r.data;
    if (typeof dados === 'string') {
      try { dados = JSON.parse(dados); } catch (_) {}
    }
    return { status: r.status, data: dados, headers: r.headers };
  }

  /**
   * URL da API esportiva.
   * A football-data.org so libera CORS para "http://localhost" (sem porta), entao
   * no navegador a chamada direta e barrada. No app Android usamos HTTP nativo
   * (sem CORS); no PC passamos pelo proxy do servidor local (tools/serve.js).
   */
  function fdUrl(caminho) {
    var direto = 'https://api.football-data.org/v4' + caminho;
    if (isNative()) return direto;
    if (location.protocol === 'file:') return direto;   // vai falhar, mas a mensagem explica
    return '/fd' + caminho;
  }

  /**
   * URL de qualquer fonte externa (SofaScore, RSS, API-Football).
   * No Android vai direto (HTTP nativo ignora CORS); no navegador passa
   * pelo proxy do servidor local, porque essas fontes nao mandam CORS.
   */
  function externa(url) {
    if (isNative() || location.protocol === 'file:') return url;
    return '/px?u=' + encodeURIComponent(url);
  }

  /** GET de texto puro (usado nos RSS, que sao XML). */
  async function getTexto(url, headers) {
    if (isNative()) {
      var r = await http({ method: 'GET', url: url, headers: headers, responseType: 'text' });
      if (r.status < 200 || r.status >= 300) throw new Error('HTTP ' + r.status);
      return typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
    }
    var res = await fetch(externa(url), { headers: headers || {} });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.text();
  }

  /** GET JSON: nativo quando der, senao fetch comum. */
  async function getJSON(url, headers) {
    if (isNative()) {
      var r = await http({ method: 'GET', url: url, headers: headers });
      if (r.status < 200 || r.status >= 300) {
        var msg = (r.data && (r.data.message || r.data.error)) || ('HTTP ' + r.status);
        throw new Error(msg);
      }
      return r.data;
    }
    var res;
    try {
      res = await fetch(url, { headers: headers || {} });
    } catch (e) {
      if (url.indexOf('football-data.org') > 0) {
        throw new Error('No PC a API esportiva só funciona pelo servidor local ' +
          '(rode iniciar.bat e abra http://localhost:5173). No app Android funciona direto.');
      }
      throw e;
    }
    var j = null;
    try { j = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error((j && (j.message || j.error)) || ('HTTP ' + res.status));
    return j;
  }

  function setup(onBack) {
    if (!isNative()) return;

    var sb = plugin('StatusBar');
    if (sb) {
      try {
        sb.setStyle({ style: 'DARK' });
        sb.setBackgroundColor({ color: '#000000' });
        sb.setOverlaysWebView({ overlay: false });
      } catch (_) {}
    }

    var sp = plugin('SplashScreen');
    if (sp) setTimeout(function () { try { sp.hide(); } catch (_) {} }, 200);

    var app = plugin('App');
    if (app && app.addListener) {
      app.addListener('backButton', function (ev) {
        var tratado = onBack && onBack();
        if (tratado) return;
        if (ev && ev.canGoBack) history.back();
        else if (app.exitApp) app.exitApp();
      });
    }
  }

  global.Native = {
    isNative: isNative,
    plugin: plugin,
    http: http,
    getJSON: getJSON,
    getTexto: getTexto,
    externa: externa,
    fdUrl: fdUrl,
    setup: setup
  };
})(window);
