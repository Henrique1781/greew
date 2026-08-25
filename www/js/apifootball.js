/* ============================================================
   GREEN - API-Football (api-sports.io)
   Grade do dia, escalacao, estatisticas, probabilidade e desfalques.
   Plano gratis = 100 chamadas/dia, entao TUDO passa por cache e por
   um contador de cota. O placar ao vivo NAO vem daqui (ver js/live.js).
   ============================================================ */
(function (global) {
  'use strict';

  var BASE = 'https://v3.football.api-sports.io';
  var TZ = 'America/Sao_Paulo';

  /* ligas que interessam (ids confirmados na propria API) */
  var LIGAS = {
    br: [71, 72, 73, 632, 13, 11],          // Serie A, Serie B, Copa do Brasil, Supercopa, Libertadores, Sudamericana
    eu: [39, 140, 135, 78, 61, 94, 88, 2, 3, 848, 45, 143, 137, 81, 143],
    ar: [307]                                // Saudi Pro League
  };

  var NOMES = {
    71: 'Brasileirão Série A', 72: 'Brasileirão Série B', 73: 'Copa do Brasil',
    632: 'Supercopa do Brasil', 13: 'Libertadores', 11: 'Sul-Americana',
    39: 'Premier League', 140: 'La Liga', 135: 'Serie A (Itália)', 78: 'Bundesliga',
    61: 'Ligue 1', 94: 'Primeira Liga', 88: 'Eredivisie',
    2: 'Champions League', 3: 'Europa League', 848: 'Conference League',
    45: 'FA Cup', 143: 'Copa del Rey', 137: 'Coppa Italia', 81: 'DFB Pokal',
    307: 'Saudi Pro League'
  };

  function todasLigas() {
    return LIGAS.br.concat(LIGAS.eu, LIGAS.ar);
  }

  function regiaoDaLiga(id) {
    if (LIGAS.br.indexOf(id) >= 0) return 'br';
    if (LIGAS.ar.indexOf(id) >= 0) return 'ar';
    if (LIGAS.eu.indexOf(id) >= 0) return 'eu';
    return 'outros';
  }

  function chave() { return Store.state.cfg.afKey || ''; }
  function temChave() { return !!chave(); }

  /* ---------------- cota diaria ---------------- */

  function cota() {
    var m = Store.state.meta;
    if (!m.afCota || m.afCota.dia !== Store.hoje()) {
      m.afCota = { dia: Store.hoje(), n: 0 };
    }
    return m.afCota;
  }

  function gastou() {
    var c = cota();
    c.n++;
    Store.save();
  }

  function restam() {
    return Math.max(0, 100 - cota().n);
  }

  /* ---------------- cache (o que ja baixamos hoje nao baixa de novo) ---------------- */

  function cache() {
    var m = Store.state.meta;
    if (!m.afCache || m.afCache.dia !== Store.hoje()) {
      m.afCache = { dia: Store.hoje(), grade: {}, det: {} };
    }
    return m.afCache;
  }

  /* ---------------- chamada ---------------- */

  async function chamar(caminho, opts) {
    opts = opts || {};
    if (!temChave()) throw new Error('Configure a chave da API-Football em Ajustes.');
    if (restam() <= 0 && !opts.forcar) {
      throw new Error('Limite de 100 consultas do dia atingido. Volta amanhã ou use o plano pago.');
    }

    var url = BASE + caminho;
    var cab = { 'x-apisports-key': chave() };
    var j;

    /* a API manda CORS liberado, entao o fetch do proprio app funciona */
    try {
      var res = await fetch(url, { headers: cab });
      gastou();
      j = await res.json();
      if (!res.ok) throw new Error('HTTP ' + res.status);
    } catch (e) {
      if (global.Native && Native.isNative()) {
        var r = await Native.http({ method: 'GET', url: url, headers: cab });
        gastou();
        j = r.data;
      } else {
        throw new Error('Falha ao falar com a API-Football: ' + e.message);
      }
    }

    var err = j && j.errors;
    if (err && !Array.isArray(err) && Object.keys(err).length) {
      throw new Error(err.token || err.plan || err.requests || err.rateLimit || JSON.stringify(err));
    }
    return (j && j.response) || [];
  }

  /* ---------------- grade do dia (1 chamada) ---------------- */

  function horaLocal(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function mapear(f) {
    var lig = f.league || {};
    var t = f.teams || {};
    var st = (f.fixture && f.fixture.status) || {};
    return {
      liga: NOMES[lig.id] || lig.name || 'Outros',
      ligaId: lig.id,
      pais: lig.country || '',
      regiao: regiaoDaLiga(lig.id),
      mandante: (t.home && t.home.name) || '?',
      visitante: (t.away && t.away.name) || '?',
      crestCasa: (t.home && t.home.logo) || '',
      crestFora: (t.away && t.away.logo) || '',
      idCasa: (t.home && t.home.id) || 0,
      idFora: (t.away && t.away.id) || 0,
      afId: (f.fixture && f.fixture.id) || 0,
      hora: horaLocal(f.fixture && f.fixture.date),
      utc: (f.fixture && f.fixture.date) || '',
      status: st.short || '',
      elapsed: st.elapsed || 0,
      golsCasa: f.goals ? f.goals.home : null,
      golsFora: f.goals ? f.goals.away : null,
      fonte: 'api-football'
    };
  }

  async function jogosDoDia(dataISO, onLog) {
    var c = cache();
    if (c.grade[dataISO]) return c.grade[dataISO];

    if (onLog) onLog('Buscando a grade do dia...');
    var lista = await chamar('/fixtures?date=' + dataISO + '&timezone=' + encodeURIComponent(TZ));
    var ligas = todasLigas();
    var jogos = lista
      .filter(function (f) { return f.league && ligas.indexOf(f.league.id) >= 0; })
      .map(mapear)
      .sort(function (a, b) {
        var ra = ['br', 'ar', 'eu', 'outros'].indexOf(a.regiao);
        var rb = ['br', 'ar', 'eu', 'outros'].indexOf(b.regiao);
        if (ra !== rb) return ra - rb;
        return String(a.hora).localeCompare(String(b.hora));
      });

    c.grade[dataISO] = jogos;
    Store.save();
    return jogos;
  }

  /* ---------------- detalhes de um jogo ---------------- */

  function guardar(afId, campo, valor) {
    var c = cache();
    c.det[afId] = c.det[afId] || {};
    c.det[afId][campo] = { v: valor, em: Date.now() };
    Store.save();
  }

  function guardado(afId, campo, validadeMin) {
    var c = cache();
    var d = c.det[afId] && c.det[afId][campo];
    if (!d) return null;
    if (validadeMin && (Date.now() - d.em) > validadeMin * 60000) return null;
    return d.v;
  }

  /** Probabilidade + forma + confronto direto (1 chamada, vem tudo junto). */
  async function previsao(afId) {
    var g = guardado(afId, 'prev', 180);
    if (g) return g;
    var r = await chamar('/predictions?fixture=' + afId);
    var p = r[0] || null;
    guardar(afId, 'prev', p);
    return p;
  }

  /** Escalacao confirmada (sai ~40 min antes do jogo). */
  async function escalacao(afId) {
    var g = guardado(afId, 'esc', 15);
    if (g && g.length) return g;
    var r = await chamar('/fixtures/lineups?fixture=' + afId);
    guardar(afId, 'esc', r);
    return r;
  }

  /** Lesionados, suspensos e duvidas. */
  async function desfalques(afId) {
    var g = guardado(afId, 'desf', 240);
    if (g) return g;
    var r = await chamar('/injuries?fixture=' + afId);
    guardar(afId, 'desf', r);
    return r;
  }

  /** Estatisticas da partida (posse, finalizacoes, escanteios...). */
  async function estatisticas(afId) {
    var g = guardado(afId, 'stat', 5);
    if (g && g.length) return g;
    var r = await chamar('/fixtures/statistics?fixture=' + afId);
    guardar(afId, 'stat', r);
    return r;
  }

  /* ---------------- texto para a IA ---------------- */

  function formaLegivel(s) {
    /* "WWDLW" -> "V V E D V" (mais recente primeiro) */
    return String(s || '').slice(-6).split('').reverse()
      .map(function (c) { return c === 'W' ? 'V' : c === 'D' ? 'E' : c === 'L' ? 'D' : c; })
      .join(' ');
  }

  /* a API escreve a linha de gols como "-3.5" / "+2.5" */
  function linhaGols(v) {
    var s = String(v || '').trim();
    if (!s) return '';
    if (s.charAt(0) === '-') return 'menos de ' + s.slice(1) + ' gols (under)';
    if (s.charAt(0) === '+') return 'mais de ' + s.slice(1) + ' gols (over)';
    return s;
  }

  function textoPrevisao(p) {
    if (!p) return '';
    var pr = p.predictions || {};
    var cmp = p.comparison || {};
    var casa = (p.teams && p.teams.home) || {};
    var fora = (p.teams && p.teams.away) || {};
    var L = [];

    L.push('probabilidade da fonte: casa ' + (pr.percent && pr.percent.home) +
      ' | empate ' + (pr.percent && pr.percent.draw) +
      ' | fora ' + (pr.percent && pr.percent.away));
    if (pr.advice) L.push('conselho da fonte: ' + pr.advice);
    if (pr.under_over) L.push('linha de gols sugerida: ' + linhaGols(pr.under_over));

    [[casa, 'mandante'], [fora, 'visitante']].forEach(function (par) {
      var t = par[0];
      if (!t || !t.league) return;
      var lg = t.league;
      var g = lg.goals || {};
      var jogados = (lg.fixtures && lg.fixtures.played && lg.fixtures.played.total) || 0;
      L.push(t.name + ' (' + par[1] + '): forma ' + formaLegivel(lg.form) +
        ' | ' + jogados + ' jogos na competicao' +
        ' | media de gols feitos ' + ((g.for && g.for.average && g.for.average.total) || '?') +
        ' e sofridos ' + ((g.against && g.against.average && g.against.average.total) || '?') +
        ' | passou em branco em ' + ((lg.failed_to_score && lg.failed_to_score.total) !== undefined ? lg.failed_to_score.total : '?') +
        ' jogos | nao sofreu gol em ' + ((lg.clean_sheet && lg.clean_sheet.total) !== undefined ? lg.clean_sheet.total : '?') + ' jogos');
    });

    if (cmp.form) {
      L.push('comparativo da fonte: forma ' + cmp.form.home + ' x ' + cmp.form.away +
        ' | ataque ' + (cmp.att ? cmp.att.home + ' x ' + cmp.att.away : '?') +
        ' | defesa ' + (cmp.def ? cmp.def.home + ' x ' + cmp.def.away : '?'));
    }

    var h2h = p.h2h || [];
    if (h2h.length) {
      L.push('confronto direto (' + h2h.length + ' jogos): ' + h2h.slice(0, 6).map(function (m) {
        return String(m.fixture.date).slice(0, 10) + ' ' + m.teams.home.name + ' ' +
          (m.goals.home === null ? '-' : m.goals.home) + 'x' +
          (m.goals.away === null ? '-' : m.goals.away) + ' ' + m.teams.away.name;
      }).join(' | '));
    }
    return L.join(String.fromCharCode(10));
  }

  function textoDesfalques(lista) {
    if (!lista || !lista.length) return 'desfalques: nenhum registrado na base';
    var porTime = {};
    lista.forEach(function (x) {
      var t = (x.team && x.team.name) || '?';
      (porTime[t] = porTime[t] || []).push(
        (x.player && x.player.name) + ' (' + ((x.player && x.player.type) || '') +
        (x.player && x.player.reason ? ' - ' + x.player.reason : '') + ')'
      );
    });
    return Object.keys(porTime).map(function (t) {
      return 'desfalques ' + t + ': ' + porTime[t].slice(0, 10).join(', ');
    }).join(String.fromCharCode(10));
  }

  function textoEscalacao(lista) {
    if (!lista || !lista.length) return 'escalacao: ainda nao divulgada (sai cerca de 40 min antes)';
    return lista.map(function (t) {
      var xi = (t.startXI || []).map(function (p) { return p.player.name; }).join(', ');
      return 'escalacao ' + t.team.name + ' (' + (t.formation || '?') + '): ' + xi +
        (t.coach && t.coach.name ? ' | tecnico: ' + t.coach.name : '');
    }).join(String.fromCharCode(10));
  }

  /** Le do cache sem gastar chamada (para a tela decidir o que ja tem). */
  function cacheDe(afId, campo) {
    var c = cache();
    var d = c.det[afId] && c.det[afId][campo];
    return d ? d.v : null;
  }

  global.AF = {
    temChave: temChave,
    cacheDe: cacheDe,
    jogosDoDia: jogosDoDia,
    previsao: previsao,
    escalacao: escalacao,
    desfalques: desfalques,
    estatisticas: estatisticas,
    textoPrevisao: textoPrevisao,
    textoDesfalques: textoDesfalques,
    textoEscalacao: textoEscalacao,
    formaLegivel: formaLegivel,
    linhaGols: linhaGols,
    cota: cota,
    restam: restam,
    LIGAS: LIGAS,
    NOMES: NOMES
  };
})(window);
