/* ============================================================
   GREEN - motor de IA (DeepSeek padrao, Claude opcional)
   Uma unica interface para o resto do app: texto() e json().
   ============================================================ */
(function (global) {
  'use strict';

  var DS = {
    url: 'https://api.deepseek.com/chat/completions',
    modelos: {
      'deepseek-v4-flash': { nome: 'DeepSeek V4 Flash (barato)', visao: false },
      'deepseek-v4-pro': { nome: 'DeepSeek V4 Pro (mais forte)', visao: false },
      'deepseek-v4-flash-vision-exp': { nome: 'DeepSeek V4 Flash Visão', visao: true }
    },
    visao: 'deepseek-v4-flash-vision-exp'
  };

  var CL = {
    url: 'https://api.anthropic.com/v1/messages',
    versao: '2023-06-01'
  };

  /* ---------------- infos do motor ativo ---------------- */

  function cfg() { return Store.state.cfg; }

  function provedor() { return cfg().provider === 'claude' ? 'claude' : 'deepseek'; }

  function chave() {
    return provedor() === 'claude' ? cfg().apiKey : cfg().dsKey;
  }

  function modelo() {
    return provedor() === 'claude' ? (cfg().model || 'claude-opus-5') : (cfg().dsModel || 'deepseek-v4-pro');
  }

  function temBuscaWeb() {
    return provedor() === 'claude' && !!cfg().web;
  }

  function nomeAmigavel() {
    if (provedor() === 'claude') return 'Claude (' + modelo() + ')';
    var m = DS.modelos[modelo()];
    return m ? m.nome : modelo();
  }

  function exigeChave() {
    if (!chave()) {
      throw new Error(provedor() === 'claude'
        ? 'Configure a chave da Anthropic em Ajustes.'
        : 'Configure a chave do DeepSeek em Ajustes.');
    }
  }

  /* ---------------- HTTP (nativo no Android, fetch no navegador) ---------------- */

  function cabecalhos() {
    if (provedor() === 'claude') {
      return {
        'content-type': 'application/json',
        'x-api-key': chave(),
        'anthropic-version': CL.versao,
        'anthropic-dangerous-direct-browser-access': 'true'
      };
    }
    return {
      'content-type': 'application/json',
      'authorization': 'Bearer ' + chave()
    };
  }

  function endpoint() { return provedor() === 'claude' ? CL.url : DS.url; }

  function mensagemErro(json, status) {
    if (json && json.error) {
      if (typeof json.error === 'string') return json.error;
      if (json.error.message) return json.error.message;
    }
    if (json && json.message) return json.message;
    if (status === 401) return 'Chave inválida ou sem crédito.';
    if (status === 402) return 'Sem saldo na conta do DeepSeek.';
    if (status === 429) return 'Muitas chamadas seguidas. Espere alguns segundos.';
    return 'HTTP ' + status;
  }

  async function postar(body, timeout) {
    exigeChave();
    var usarNativo = global.Native && Native.isNative();

    if (usarNativo) {
      var r = await Native.http({
        method: 'POST', url: endpoint(), headers: cabecalhos(), data: body, timeout: timeout || 900000
      });
      if (r.status < 200 || r.status >= 300) throw new Error(mensagemErro(r.data, r.status));
      return r.data;
    }

    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, timeout || 900000);
    var res;
    try {
      res = await fetch(endpoint(), {
        method: 'POST', headers: cabecalhos(), body: JSON.stringify(body), signal: ctrl.signal
      });
    } catch (e) {
      clearTimeout(t);
      if (e.name === 'AbortError') throw new Error('Tempo esgotado na chamada da IA.');
      throw new Error('Falha de rede ao chamar a IA: ' + e.message);
    }
    clearTimeout(t);
    var j = null;
    try { j = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error(mensagemErro(j, res.status));
    return j;
  }

  /* ---------------- streaming (SSE) ---------------- */

  async function postarStream(body, onEvent, timeout) {
    exigeChave();

    // no Android o HTTP nativo nao entrega stream: cai para chamada normal
    if (global.Native && Native.isNative()) {
      var semStream = Object.assign({}, body);
      delete semStream.stream;
      onEvent('info', 'Processando (sem tempo real neste aparelho)...');
      var j = await postar(semStream, timeout);
      var txt = textoDaResposta(j);
      onEvent('texto', txt);
      return txt;
    }

    var res;
    try {
      res = await fetch(endpoint(), {
        method: 'POST', headers: cabecalhos(), body: JSON.stringify(Object.assign({}, body, { stream: true }))
      });
    } catch (e) {
      throw new Error('Falha de rede ao chamar a IA: ' + e.message);
    }
    if (!res.ok) {
      var je = null;
      try { je = await res.json(); } catch (_) {}
      throw new Error(mensagemErro(je, res.status));
    }
    if (!res.body || !res.body.getReader) {
      var full = await res.text();
      var t2 = lerSSE(full, onEvent, {});
      return t2;
    }

    var reader = res.body.getReader();
    var dec = new TextDecoder();
    var buf = '';
    var estado = { texto: '', blocos: {} };

    while (true) {
      var ch = await reader.read();
      if (ch.done) break;
      buf += dec.decode(ch.value, { stream: true });
      var partes = buf.split('\n\n');
      buf = partes.pop();
      for (var i = 0; i < partes.length; i++) lerSSE(partes[i], onEvent, estado);
    }
    return estado.texto;
  }

  function lerSSE(bloco, onEvent, estado) {
    estado.texto = estado.texto || '';
    estado.blocos = estado.blocos || {};
    var linhas = bloco.split('\n');
    for (var i = 0; i < linhas.length; i++) {
      var ln = linhas[i];
      if (ln.indexOf('data:') !== 0) continue;
      var pl = ln.slice(5).trim();
      if (!pl || pl === '[DONE]') continue;
      var ev;
      try { ev = JSON.parse(pl); } catch (_) { continue; }
      if (provedor() === 'claude') estado.texto = eventoClaude(ev, estado, onEvent);
      else estado.texto = eventoDeepSeek(ev, estado, onEvent);
    }
    return estado.texto;
  }

  function eventoDeepSeek(ev, estado, onEvent) {
    if (ev.error) throw new Error(mensagemErro(ev, 500));
    var ch = ev.choices && ev.choices[0];
    if (!ch) return estado.texto;
    var d = ch.delta || ch.message || {};
    if (d.reasoning_content) onEvent('raciocinio', d.reasoning_content);
    if (d.content) {
      estado.texto += d.content;
      onEvent('texto', d.content);
    }
    return estado.texto;
  }

  function eventoClaude(ev, estado, onEvent) {
    if (ev.type === 'content_block_start') {
      var cb = ev.content_block || {};
      estado.blocos[ev.index] = { type: cb.type, json: '' };
      if (cb.type === 'server_tool_use') onEvent('busca', '');
      if (cb.type === 'web_search_tool_result') {
        var n = Array.isArray(cb.content) ? cb.content.length : 0;
        onEvent('resultado', n ? n + ' fontes lidas' : 'fontes lidas');
      }
      return estado.texto;
    }
    if (ev.type === 'content_block_delta') {
      var d = ev.delta || {};
      if (d.type === 'text_delta') {
        estado.texto += d.text;
        onEvent('texto', d.text);
      } else if (d.type === 'thinking_delta') {
        onEvent('raciocinio', d.thinking || '');
      } else if (d.type === 'input_json_delta') {
        var b = estado.blocos[ev.index];
        if (b) b.json += d.partial_json || '';
      }
      return estado.texto;
    }
    if (ev.type === 'content_block_stop') {
      var bl = estado.blocos[ev.index];
      if (bl && bl.type === 'server_tool_use') {
        var q = /"query"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(bl.json || '');
        onEvent('query', q ? q[1] : '');
      }
      return estado.texto;
    }
    if (ev.type === 'error') throw new Error((ev.error && ev.error.message) || 'Erro no stream.');
    return estado.texto;
  }

  function textoDaResposta(j) {
    if (!j) return '';
    if (provedor() === 'claude') {
      return (j.content || []).filter(function (b) { return b.type === 'text'; })
        .map(function (b) { return b.text || ''; }).join(String.fromCharCode(10)).trim();
    }
    var ch = j.choices && j.choices[0];
    return ((ch && ch.message && ch.message.content) || '').trim();
  }

  /* ---------------- montagem do corpo ---------------- */

  function corpo(op) {
    var max = op.maxTokens || 16000;
    var esforco = op.effort || cfg().effort || 'high';

    if (provedor() === 'claude') {
      var conteudo = [];
      (op.images || []).forEach(function (im) {
        conteudo.push({ type: 'image', source: { type: 'base64', media_type: im.media_type, data: im.data } });
      });
      conteudo.push({ type: 'text', text: op.user });
      var b = {
        model: modelo(),
        max_tokens: max,
        system: op.system,
        messages: [{ role: 'user', content: conteudo }],
        thinking: { type: 'adaptive' },
        output_config: { effort: esforco }
      };
      if (op.json) b.output_config.format = { type: 'json_schema', schema: op.schema };
      if (op.buscaWeb && cfg().web) {
        b.tools = [{ type: 'web_search_20260209', name: 'web_search', max_uses: 14 }];
        delete b.output_config.format;
      }
      return b;
    }

    /* DeepSeek (formato OpenAI) */
    var msgs = [];
    if (op.system) msgs.push({ role: 'system', content: op.system });
    if (op.images && op.images.length) {
      var partes = op.images.map(function (im) {
        return { type: 'image_url', image_url: { url: 'data:' + im.media_type + ';base64,' + im.data } };
      });
      partes.push({ type: 'text', text: op.user });
      msgs.push({ role: 'user', content: partes });
    } else {
      msgs.push({ role: 'user', content: op.user });
    }

    var body = {
      model: op.images && op.images.length ? DS.visao : modelo(),
      messages: msgs,
      max_tokens: Math.min(max, 64000),
      thinking: { type: 'enabled' },
      reasoning_effort: esforco === 'max' || esforco === 'xhigh' ? 'high' : esforco
    };
    if (op.json) body.response_format = { type: 'json_object' };
    return body;
  }

  /* ---------------- interface publica ---------------- */

  /** Texto livre. Se onEvent existir, transmite em tempo real. */
  async function texto(op) {
    var body = corpo(op);
    if (op.onEvent) return postarStream(body, op.onEvent, op.timeout);
    var j = await postar(body, op.timeout);
    return textoDaResposta(j);
  }

  /**
   * JSON garantido. No DeepSeek nao ha schema, entao o exemplo vai no prompt
   * e o resultado passa por uma tentativa de reparo se vier quebrado.
   */
  async function json(op) {
    var pedido = op.user;
    if (provedor() !== 'claude') {
      pedido += String.fromCharCode(10, 10) +
        'Responda SOMENTE com um objeto json valido, sem texto antes ou depois, ' +
        'sem blocos de codigo, exatamente neste formato:' + String.fromCharCode(10) + op.exemplo;
    }
    var bruto = await texto(Object.assign({}, op, { user: pedido, json: true, onEvent: null }));
    var obj = extrair(bruto);
    if (obj) return obj;

    // uma tentativa de reparo
    var conserto = await texto({
      system: 'Voce corrige json quebrado. Responda apenas o json valido, sem comentarios.',
      user: 'Conserte este json para que ele seja valido e siga o formato pedido:' +
        String.fromCharCode(10) + String(bruto).slice(0, 60000),
      json: true,
      maxTokens: op.maxTokens || 16000,
      effort: 'low',
      schema: op.schema,
      timeout: op.timeout
    });
    obj = extrair(conserto);
    if (!obj) throw new Error('A IA respondeu num formato que não consegui ler. Tente de novo.');
    return obj;
  }

  function extrair(txt) {
    if (!txt) return null;
    var t = String(txt).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    try { return JSON.parse(t); } catch (_) {}
    var i = t.indexOf('{'), f = t.lastIndexOf('}');
    if (i >= 0 && f > i) {
      try { return JSON.parse(t.slice(i, f + 1)); } catch (_) {}
    }
    return null;
  }

  async function testar() {
    var r = await texto({
      system: 'Responda em uma palavra.',
      user: 'Diga: ok',
      maxTokens: 64,
      effort: 'low',
      timeout: 90000
    });
    return !!r;
  }

  global.Motor = {
    texto: texto,
    json: json,
    testar: testar,
    provedor: provedor,
    modelo: modelo,
    modelosDeepSeek: DS.modelos,
    nomeAmigavel: nomeAmigavel,
    temBuscaWeb: temBuscaWeb,
    temChave: function () { return !!chave(); }
  };
})(window);
