/* ============================================================
   GREEN - placar ao vivo
   Fonte: endpoint publico do SofaScore (sem chave, sem cota).
   Uma chamada traz TODOS os jogos rolando no mundo; casamos com a
   nossa lista pelo nome dos times.
   Se essa fonte sair do ar, o resto do app continua funcionando:
   o ao vivo simplesmente para de atualizar.
   ============================================================ */
(function (global) {
  'use strict';

  var URL_LIVE = 'https://api.sofascore.com/api/v1/sport/football/events/live';

  var estado = {
    jogos: {},        // chave do confronto -> {casa,fora,minuto,status,ao_vivo}
    atualizadoEm: 0,
    erro: '',
    buscando: false
  };

  /* nomes de time vem diferentes em cada fonte: normalizamos para comparar */
  function limpa(nome) {
    return String(nome || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .split(/[^a-z0-9]+/)
      .filter(function (p) {
        return p && !/^(fc|cf|sc|ec|ac|afc|cd|sad|club|clube|de|do|da|the|futebol|football|atletico|atletico)$/.test(p);
      })
      .join('');
  }

  /* algumas siglas/apelidos que as fontes escrevem diferente */
  var APELIDOS = {
    athletico: 'athleticopr',
    paranaense: 'athleticopr',
    atleticomineiro: 'atleticomg',
    redbullbragantino: 'bragantino',
    saopaulo: 'saopaulo',
    vascogama: 'vasco',
    manutd: 'manchesterunited',
    manchesterutd: 'manchesterunited',
    mancity: 'manchestercity',
    wolverhampton: 'wolves',
    tottenhamhotspur: 'tottenham',
    internazionale: 'inter',
    bayernmunich: 'bayernmunchen',
    parissaintgermain: 'psg',
    alhilalsfc: 'alhilal',
    alnassrfc: 'alnassr'
  };

  function normaliza(nome) {
    var n = limpa(nome);
    return APELIDOS[n] || n;
  }

  function chave(casa, fora) {
    return normaliza(casa) + '|' + normaliza(fora);
  }

  function minutoDe(ev) {
    var st = (ev.status && ev.status.description) || '';
    var tipo = (ev.status && ev.status.type) || '';
    if (tipo === 'finished') return 'FIM';
    if (/halftime|intervalo/i.test(st)) return 'INT';
    if (ev.time && typeof ev.time.currentPeriodStartTimestamp === 'number' && tipo === 'inprogress') {
      var base = /2nd|segundo/i.test(st) ? 45 : 0;
      var min = Math.floor((Date.now() / 1000 - ev.time.currentPeriodStartTimestamp) / 60) + base;
      if (min >= 0 && min < 130) return min + "'";
    }
    return st || '';
  }

  /**
   * A fonte responde com Access-Control-Allow-Origin: *, entao o fetch do
   * proprio navegador/WebView funciona direto - e e o caminho que menos
   * chama atencao. Se falhar, tentamos o HTTP nativo do Android.
   */
  async function baixar() {
    try {
      var res = await fetch(URL_LIVE, { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      if (global.Native && Native.isNative()) {
        var r = await Native.http({ method: 'GET', url: URL_LIVE, headers: { accept: 'application/json' } });
        if (r.status < 200 || r.status >= 300) throw new Error('HTTP ' + r.status);
        return r.data;
      }
      throw e;
    }
  }

  /** Busca o placar ao vivo. Devolve quantos jogos vieram. */
  async function atualizar() {
    if (estado.buscando) return 0;
    estado.buscando = true;
    try {
      var j = await baixar();
      var evs = (j && j.events) || [];
      var mapa = {};
      evs.forEach(function (ev) {
        if (!ev.homeTeam || !ev.awayTeam) return;
        var tipo = (ev.status && ev.status.type) || '';
        var reg = {
          casa: ev.homeScore && typeof ev.homeScore.current === 'number' ? ev.homeScore.current : null,
          fora: ev.awayScore && typeof ev.awayScore.current === 'number' ? ev.awayScore.current : null,
          minuto: minutoDe(ev),
          aoVivo: tipo === 'inprogress',
          liga: (ev.tournament && ev.tournament.name) || ''
        };
        /* indexa pelos varios nomes que o time pode ter */
        [ev.homeTeam.name, ev.homeTeam.shortName, ev.homeTeam.nameCode].forEach(function (c) {
          [ev.awayTeam.name, ev.awayTeam.shortName, ev.awayTeam.nameCode].forEach(function (f) {
            if (c && f) mapa[chave(c, f)] = reg;
          });
        });
      });
      estado.jogos = mapa;
      estado.atualizadoEm = Date.now();
      estado.erro = '';
      return evs.length;
    } catch (e) {
      estado.erro = e.message;
      return 0;
    } finally {
      estado.buscando = false;
    }
  }

  /** Placar ao vivo de um jogo nosso, ou null. */
  function de(jogo) {
    if (!jogo) return null;
    return estado.jogos[chave(jogo.mandante, jogo.visitante)] || null;
  }

  function temAlgumAoVivo(jogos) {
    return (jogos || []).some(function (j) {
      var l = de(j);
      return l && l.aoVivo;
    });
  }

  function info() {
    return {
      atualizadoEm: estado.atualizadoEm,
      erro: estado.erro,
      quantos: Object.keys(estado.jogos).length
    };
  }

  global.Live = {
    atualizar: atualizar,
    de: de,
    temAlgumAoVivo: temAlgumAoVivo,
    info: info,
    normaliza: normaliza
  };
})(window);
