/* ============================================================
   GREEN - grade de jogos do dia
   Fonte 1: football-data.org (grátis, principais campeonatos)
   Fonte 2: Claude + busca web (reserva, usa a chave que já existe)
   ============================================================ */
(function (global) {
  'use strict';

  /* ordem de exibicao: o que o usuario mais aposta primeiro */
  var PRIORIDADE = [
    'Campeonato Brasileiro Série A', 'Copa Libertadores', 'UEFA Champions League',
    'Premier League', 'Primera Division', 'Serie A', 'Bundesliga', 'Ligue 1',
    'Eredivisie', 'Primeira Liga', 'Championship', 'European Championship', 'FIFA World Cup'
  ];

  /* nomes que a API devolve em ingles -> como o brasileiro chama */
  var APELIDO = {
    'Primera Division': 'La Liga',
    'Serie A': 'Serie A (Itália)',
    'Campeonato Brasileiro Série A': 'Brasileirão Série A',
    'Championship': 'Championship (Inglaterra)',
    'Primeira Liga': 'Primeira Liga (Portugal)'
  };

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function isoDe(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function somaDias(iso, n) {
    var p = iso.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    d.setDate(d.getDate() + n);
    return isoDe(d);
  }

  /** utcDate -> {dataLocal, horaLocal} no fuso do aparelho */
  function local(utc) {
    var d = new Date(utc);
    if (isNaN(d.getTime())) return { data: '', hora: '' };
    return { data: isoDe(d), hora: pad(d.getHours()) + ':' + pad(d.getMinutes()) };
  }

  function ordenar(jogos) {
    return jogos.sort(function (a, b) {
      var pa = PRIORIDADE.indexOf(a.ligaOriginal || a.liga);
      var pb = PRIORIDADE.indexOf(b.ligaOriginal || b.liga);
      if (pa < 0) pa = 99;
      if (pb < 0) pb = 99;
      if (pa !== pb) return pa - pb;
      return String(a.hora).localeCompare(String(b.hora));
    });
  }

  /* ---------------- fonte 1: football-data.org ---------------- */
  async function viaFootballData(dataISO) {
    var key = Store.state.cfg.fdKey;
    if (!key) throw new Error('sem chave football-data');

    // pega 3 dias de UTC e filtra pelo dia local (jogo 21:30 no Brasil = dia seguinte em UTC)
    var url = Native.fdUrl('/matches?dateFrom=' + somaDias(dataISO, -1) + '&dateTo=' + somaDias(dataISO, 2));
    var json = await Native.getJSON(url, { 'X-Auth-Token': key });
    var lista = (json && json.matches) || [];

    var out = [];
    lista.forEach(function (m) {
      var lc = local(m.utcDate);
      if (lc.data !== dataISO) return;
      var comp = (m.competition && m.competition.name) || 'Outros';
      out.push({
        liga: APELIDO[comp] || comp,
        ligaOriginal: comp,
        mandante: nomeTime(m.homeTeam),
        visitante: nomeTime(m.awayTeam),
        hora: lc.hora,
        utc: m.utcDate,
        status: m.status || '',
        crestCasa: (m.homeTeam && m.homeTeam.crest) || '',
        crestFora: (m.awayTeam && m.awayTeam.crest) || '',
        /* ids usados para puxar forma, tabela e H2H reais */
        fdId: m.id || 0,
        idCasa: (m.homeTeam && m.homeTeam.id) || 0,
        idFora: (m.awayTeam && m.awayTeam.id) || 0,
        comp: (m.competition && m.competition.code) || '',
        fonte: 'football-data'
      });
    });
    return ordenar(out);
  }

  function nomeTime(t) {
    if (!t) return '?';
    return t.shortName || t.name || t.tla || '?';
  }

  /* ---------------- fonte 2: Claude + busca web ---------------- */
  async function viaIA(dataISO) {
    var jogos = await API.jogosDoDia(dataISO);
    return ordenar((jogos || []).map(function (j) {
      return {
        liga: j.liga || 'Outros',
        ligaOriginal: j.liga || '',
        mandante: j.mandante,
        visitante: j.visitante,
        hora: j.hora || '',
        utc: '',
        status: '',
        crestCasa: '', crestFora: '',
        fonte: 'ia'
      };
    }));
  }

  /**
   * Busca a grade do dia. Tenta a API esportiva e, se nao der, cai para a IA.
   * onLog(msg) opcional.
   */
  async function buscar(dataISO, onLog) {
    var cfg = Store.state.cfg;
    var erros = [];

    /* fonte principal: API-Football (tem Brasil, Europa e Arabia, com escudos e ids) */
    if (global.AF && AF.temChave()) {
      try {
        var r0 = await AF.jogosDoDia(dataISO, onLog);
        if (r0.length) return { jogos: r0, fonte: 'api-football' };
        erros.push('nenhum jogo dos campeonatos escolhidos neste dia');
      } catch (e0) {
        erros.push('API-Football: ' + e0.message);
      }
    }

    if (cfg.fdKey) {
      try {
        if (onLog) onLog('Buscando grade oficial...');
        var r = await viaFootballData(dataISO);
        if (r.length) return { jogos: r, fonte: 'football-data' };
        erros.push('a API não retornou jogos para este dia');
      } catch (e) {
        erros.push('football-data: ' + e.message);
      }
    }

    if (Motor.temChave()) {
      try {
        if (onLog) onLog('Procurando os jogos com a IA...');
        var r2 = await viaIA(dataISO);
        if (r2.length) return { jogos: r2, fonte: 'ia' };
        erros.push('a IA não encontrou jogos');
      } catch (e2) {
        erros.push('IA: ' + e2.message);
      }
    }

    if (!cfg.afKey && !cfg.fdKey && !Motor.temChave()) {
      throw new Error('Configure a chave da API-Football em Ajustes para carregar os jogos.');
    }
    throw new Error(erros.join(' | ') || 'Não consegui carregar os jogos do dia.');
  }

  async function testarChave(key) {
    var json = await Native.getJSON(Native.fdUrl('/competitions/BSA'), { 'X-Auth-Token': key });
    return !!(json && json.name);
  }

  global.Fixtures = { buscar: buscar, testarChave: testarChave, ordenar: ordenar };
})(window);
