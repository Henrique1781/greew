/* ============================================================
   GREEN - Store: estado persistente (localStorage)
   ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'green.v1';

  var PROMPT_MESTRE = [
    'Aja como um Especialista em Analise de Dados Esportivos e Agente de Apostas Inteligente.',
    'Seu objetivo e fornecer analises probabilisticas de alta precisao para jogos de futebol,',
    'focando na MINIMIZACAO DE RISCOS e na maximizacao de lucro a longo prazo.',
    '',
    'MENTALIDADE: fria, calculista e 100% baseada em dados reais e atualizados.',
    'Nao se deixe levar por "camisa" de time, torcida ou narrativa. Apenas numeros e contexto atual.',
    'Se os dados forem insuficientes ou conflitantes para um jogo, DIGA ISSO e reduza a confianca',
    '- e melhor recusar um palpite do que forcar um green improvavel.',
    '',
    'PARA CADA JOGO, produza:',
    '1. Momento atual: ultimos 5 jogos de cada equipe (V/E/D, gols marcados e sofridos, mando de campo).',
    '2. Confronto direto (H2H): historico recente entre as duas equipes.',
    '3. Escalacoes e desfalques: lesionados, suspensos, poupados e o impacto real no rendimento.',
    '4. Contexto e importancia: mata-mata, briga por titulo, rebaixamento, classico, time poupando,',
    '   viagem/altitude, calendario apertado, motivacao de cada lado.',
    '5. Metricas: media de escanteios (a favor/contra), media de cartoes e faltas,',
    '   tendencia de ambas marcam (BTTS) e Over/Under de gols (1.5 / 2.5 / 3.5).',
    '',
    'SUGESTOES DE APOSTA (baixo risco, alta chance de green). Priorize:',
    'Dupla Chance (1X / X2), Empate Anula (DNB), Over/Under de gols, Ambas Marcam (Sim/Nao),',
    'Escanteios com linha conservadora e Handicap Asiatico favoravel.',
    'Evite apostas cegas em zebras e mercados exoticos.',
    '',
    'BILHETES (Desafio 5 para 100): monte 3 bilhetes multiplos cruzando os melhores palpites,',
    'cada um mirando odd total proxima do alvo definido pelo usuario:',
    'Bilhete 1 - focado em Gols e Ambas Marcam.',
    'Bilhete 2 - focado em Dupla Chance e Vencedor/Empate Anula.',
    'Bilhete 3 - Misto: os palpites de maior confianca absoluta de todos os jogos analisados.',
    'Nunca coloque dois palpites conflitantes do MESMO jogo no mesmo bilhete',
    '(ex.: Under 2.5 + Ambas Marcam Sim).',
    '',
    'ODDS: use valores de mercado realistas. Se nao tiver a odd real, estime de forma conservadora',
    'e deixe claro que e estimativa.'
  ].join('\n');

  var defaults = {
    cfg: {
      provider: 'deepseek',   // 'deepseek' | 'claude'
      dsKey: '',              // chave DeepSeek
      dsModel: 'deepseek-v4-pro',
      apiKey: '',             // chave Anthropic (opcional)
      afKey: '',              // chave API-Football (grade, escalacao, probabilidade)
      fdKey: '',              // chave football-data.org (fonte antiga, opcional)
      autoLoad: true,
      model: 'claude-opus-5',
      effort: 'high',
      web: true,
      stake: 5,
      alvo: 20,
      moeda: 'R$',
      prompt: PROMPT_MESTRE,
      onboarded: false
    },
    jogos: [],        // {id,liga,mandante,visitante,hora,data,fav,sel,crestCasa,crestFora,fonte}
    analises: {},     // jogoId -> objeto de analise
    bilhetes: [],     // bilhetes da ultima rodada
    memoria: [],      // {id,data,licao,mercado,origem}
    hist: [],         // {id,data,tipo,jogo,mercado,selecao,odd,resultado,motivo}
    meta: { ultimaAnalise: null, dossie: '', obs: '', custo: null, afCota: null, afCache: null }
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return clone(defaults);
      var s = JSON.parse(raw);
      var out = clone(defaults);
      Object.keys(defaults).forEach(function (k) {
        if (s[k] === undefined) return;
        if (k === 'cfg' || k === 'meta') out[k] = Object.assign(out[k], s[k]);
        else out[k] = s[k];
      });
      return out;
    } catch (e) {
      console.warn('store: falha ao ler', e);
      return clone(defaults);
    }
  }

  var state = load();
  var listeners = [];

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('store: falha ao salvar', e);
    }
    listeners.forEach(function (fn) { try { fn(state); } catch (_) {} });
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function hoje() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  var Store = {
    KEY: KEY,
    PROMPT_MESTRE: PROMPT_MESTRE,
    state: state,
    save: save,
    uid: uid,
    hoje: hoje,
    on: function (fn) { listeners.push(fn); },

    /* ---------- jogos ---------- */
    addJogo: function (j) {
      var jogo = {
        id: uid(),
        liga: (j.liga || 'Outros').trim(),
        mandante: (j.mandante || '').trim(),
        visitante: (j.visitante || '').trim(),
        hora: (j.hora || '').trim(),
        data: j.data || hoje(),
        fav: !!j.fav,
        sel: !!j.sel,
        crestCasa: j.crestCasa || '',
        crestFora: j.crestFora || '',
        status: j.status || '',
        utc: j.utc || '',
        fdId: j.fdId || 0,
        afId: j.afId || 0,
        idCasa: j.idCasa || 0,
        idFora: j.idFora || 0,
        comp: j.comp || '',
        ligaId: j.ligaId || 0,
        pais: j.pais || '',
        regiao: j.regiao || '',
        elapsed: j.elapsed || 0,
        golsCasa: j.golsCasa === undefined ? null : j.golsCasa,
        golsFora: j.golsFora === undefined ? null : j.golsFora,
        fonte: j.fonte || 'manual'
      };
      state.jogos.push(jogo);
      return jogo;
    },

    /** chave de comparacao para nao duplicar jogo ja existente no dia */
    chave: function (j) {
      function n(x) {
        return String(x || '').toLowerCase()
          .normalize('NFD').replace(/[̀-ͯ]/g, '')
          .split(/[^a-z0-9]+/)
          .filter(function (p) {
            return p && !/^(fc|cf|sc|ec|ac|afc|cd|club|clube|de|do|da|the)$/.test(p);
          })
          .join('');
      }
      return n(j.mandante) + '|' + n(j.visitante);
    },

    /** junta a grade baixada com o que ja existe no dia (sem duplicar) */
    mergeJogos: function (lista, data) {
      var d = data || hoje();
      var self = this;
      var existentes = {};
      state.jogos.filter(function (j) { return j.data === d; })
        .forEach(function (j) { existentes[self.chave(j)] = j; });

      var novos = 0;
      (lista || []).forEach(function (j) {
        var k = self.chave(j);
        var atual = existentes[k];
        if (atual) {
          // completa o que faltava sem perder selecao/favorito do usuario
          if (!atual.crestCasa && j.crestCasa) atual.crestCasa = j.crestCasa;
          if (!atual.crestFora && j.crestFora) atual.crestFora = j.crestFora;
          if (!atual.hora && j.hora) atual.hora = j.hora;
          if (j.status) atual.status = j.status;
          if (atual.liga === 'Outros' && j.liga) atual.liga = j.liga;
          if (!atual.idCasa && j.idCasa) {
            atual.idCasa = j.idCasa;
            atual.idFora = j.idFora;
            atual.fdId = j.fdId;
            atual.comp = j.comp;
          }
          if (!atual.afId && j.afId) {
            atual.afId = j.afId;
            atual.ligaId = j.ligaId;
            atual.pais = j.pais;
            atual.regiao = j.regiao;
            atual.liga = j.liga || atual.liga;
          }
          if (j.golsCasa !== undefined && j.golsCasa !== null) {
            atual.golsCasa = j.golsCasa;
            atual.golsFora = j.golsFora;
            atual.elapsed = j.elapsed || atual.elapsed;
          }
          return;
        }
        j.data = d;
        existentes[k] = self.addJogo(j);
        novos++;
      });
      return novos;
    },
    removeJogo: function (id) {
      state.jogos = state.jogos.filter(function (j) { return j.id !== id; });
      delete state.analises[id];
    },
    jogosDoDia: function (data) {
      return state.jogos.filter(function (j) { return j.data === (data || hoje()); });
    },
    selecionados: function () {
      return state.jogos.filter(function (j) { return j.sel; });
    },
    limparDia: function (data) {
      var d = data || hoje();
      state.jogos.filter(function (j) { return j.data === d; })
        .forEach(function (j) { delete state.analises[j.id]; });
      state.jogos = state.jogos.filter(function (j) { return j.data !== d; });
      state.bilhetes = [];
    },

    /* ---------- memoria de aprendizado ---------- */
    addLicao: function (licao, mercado, origem) {
      state.memoria.unshift({
        id: uid(), data: hoje(), licao: licao,
        mercado: mercado || 'geral', origem: origem || 'manual'
      });
      if (state.memoria.length > 60) state.memoria.length = 60;
    },
    removeLicao: function (id) {
      state.memoria = state.memoria.filter(function (m) { return m.id !== id; });
    },
    memoriaTexto: function () {
      if (!state.memoria.length) return '';
      return state.memoria.slice(0, 30).map(function (m, i) {
        return (i + 1) + '. [' + m.mercado + '] ' + m.licao;
      }).join('\n');
    },

    /* ---------- historico de resultados ---------- */
    registrar: function (item) {
      item.id = item.id || uid();
      item.data = item.data || hoje();
      item.resultado = item.resultado || 'pend';
      state.hist.unshift(item);
      return item;
    },
    setResultado: function (id, res, motivo) {
      var h = state.hist.find(function (x) { return x.id === id; });
      if (h) { h.resultado = res; if (motivo !== undefined) h.motivo = motivo; }
    },
    stats: function () {
      var byMk = {};
      var tot = { g: 0, r: 0, p: 0, stake: 0, retorno: 0 };
      state.hist.forEach(function (h) {
        var k = h.mercado || 'Outros';
        if (!byMk[k]) byMk[k] = { mercado: k, g: 0, r: 0, p: 0, n: 0 };
        byMk[k].n++;
        if (h.resultado === 'green') { byMk[k].g++; tot.g++; }
        else if (h.resultado === 'red') { byMk[k].r++; tot.r++; }
        else { byMk[k].p++; tot.p++; }
        if (h.tipo === 'bilhete') {
          var st = Number(h.stake || 0);
          tot.stake += st;
          if (h.resultado === 'green') tot.retorno += st * Number(h.odd || 0);
        }
      });
      var lista = Object.keys(byMk).map(function (k) {
        var b = byMk[k];
        var dec = b.g + b.r;
        b.taxa = dec ? Math.round((b.g / dec) * 100) : 0;
        return b;
      }).sort(function (a, b) { return b.taxa - a.taxa || b.n - a.n; });
      var dec = tot.g + tot.r;
      tot.taxa = dec ? Math.round((tot.g / dec) * 100) : 0;
      tot.lucro = tot.retorno - tot.stake;
      return { mercados: lista, total: tot };
    },

    reset: function () {
      var cfg = clone(state.cfg);
      var novo = clone(defaults);
      novo.cfg = cfg;
      Object.keys(state).forEach(function (k) { delete state[k]; });
      Object.assign(state, novo);
      save();
    }
  };

  global.Store = Store;
})(window);
