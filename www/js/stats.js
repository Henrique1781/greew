/* ============================================================
   GREEN - dados duros (football-data.org)
   Monta um dossie estatistico REAL para a IA raciocinar em cima:
   forma recente com placares, classificacao e confronto direto.
   ============================================================ */
(function (global) {
  'use strict';

  var INTERVALO = 6500;           // plano gratuito: 10 chamadas/minuto
  var ultimaChamada = 0;
  var cache = { recentes: null, tabelas: {}, h2h: {} };

  function esperar(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  /** garante o espacamento entre chamadas para nao tomar 429 */
  async function fila(url) {
    var agora = Date.now();
    var falta = INTERVALO - (agora - ultimaChamada);
    if (falta > 0) await esperar(falta);
    ultimaChamada = Date.now();
    return Native.getJSON(Native.fdUrl(url), { 'X-Auth-Token': Store.state.cfg.fdKey });
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function menos(dias) {
    var d = new Date();
    d.setDate(d.getDate() - dias);
    return iso(d);
  }

  /* ---------- 1. resultados recentes de todo mundo (1 chamada) ---------- */
  async function recentes(onLog) {
    if (cache.recentes) return cache.recentes;
    var tentativas = [50, 21];
    for (var i = 0; i < tentativas.length; i++) {
      try {
        if (onLog) onLog('Baixando resultados dos últimos ' + tentativas[i] + ' dias...');
        var j = await fila('/matches?dateFrom=' + menos(tentativas[i]) +
          '&dateTo=' + menos(1) + '&status=FINISHED');
        var porTime = {};
        ((j && j.matches) || []).forEach(function (m) {
          [['homeTeam', 'awayTeam'], ['awayTeam', 'homeTeam']].forEach(function (par) {
            var t = m[par[0]];
            if (!t || !t.id) return;
            (porTime[t.id] = porTime[t.id] || []).push(m);
          });
        });
        Object.keys(porTime).forEach(function (k) {
          porTime[k].sort(function (a, b) { return new Date(b.utcDate) - new Date(a.utcDate); });
        });
        cache.recentes = porTime;
        return porTime;
      } catch (e) {
        if (i === tentativas.length - 1) throw e;
      }
    }
    return {};
  }

  /* ---------- 2. classificacao da competicao ---------- */
  async function tabela(code, onLog) {
    if (!code) return null;
    if (cache.tabelas[code] !== undefined) return cache.tabelas[code];
    try {
      if (onLog) onLog('Classificação: ' + code + '...');
      var j = await fila('/competitions/' + code + '/standings');
      var geral = ((j && j.standings) || []).filter(function (s) { return s.type === 'TOTAL'; })[0];
      cache.tabelas[code] = (geral && geral.table) || null;
    } catch (_) {
      cache.tabelas[code] = null;
    }
    return cache.tabelas[code];
  }

  function naTabela(tab, idTime) {
    if (!tab) return null;
    for (var i = 0; i < tab.length; i++) {
      if (tab[i].team && tab[i].team.id === idTime) return tab[i];
    }
    return null;
  }

  /* ---------- 3. confronto direto ---------- */
  async function h2h(fdId, onLog) {
    if (!fdId) return null;
    if (cache.h2h[fdId] !== undefined) return cache.h2h[fdId];
    try {
      if (onLog) onLog('Confronto direto...');
      var j = await fila('/matches/' + fdId + '/head2head?limit=8');
      cache.h2h[fdId] = j || null;
    } catch (_) {
      cache.h2h[fdId] = null;
    }
    return cache.h2h[fdId];
  }

  /* ---------- formatacao ---------- */

  function placar(m) {
    var ft = (m.score && m.score.fullTime) || {};
    return (ft.home === null || ft.home === undefined ? '?' : ft.home) + 'x' +
      (ft.away === null || ft.away === undefined ? '?' : ft.away);
  }

  function resumoTime(nome, idTime, lista, entrada) {
    if (!lista || !lista.length) {
      return nome + ': sem resultados recentes na base' +
        (entrada ? ' | tabela: ' + linhaTabela(entrada) : '');
    }
    var ult = lista.slice(0, 5);
    var v = 0, e = 0, d = 0, gp = 0, gc = 0, btts = 0, over25 = 0;
    var detalhe = ult.map(function (m) {
      var casa = m.homeTeam && m.homeTeam.id === idTime;
      var ft = (m.score && m.score.fullTime) || {};
      var meus = casa ? ft.home : ft.away;
      var deles = casa ? ft.away : ft.home;
      if (typeof meus === 'number' && typeof deles === 'number') {
        gp += meus; gc += deles;
        if (meus > deles) v++; else if (meus === deles) e++; else d++;
        if (meus > 0 && deles > 0) btts++;
        if (meus + deles > 2.5) over25++;
      }
      var adv = casa ? (m.awayTeam && m.awayTeam.shortName) || (m.awayTeam && m.awayTeam.name)
        : (m.homeTeam && m.homeTeam.shortName) || (m.homeTeam && m.homeTeam.name);
      return (casa ? 'casa' : 'fora') + ' vs ' + adv + ' ' + placar(m);
    }).join(' | ');

    var linha = nome + ': ' + v + 'V ' + e + 'E ' + d + 'D nos ultimos ' + ult.length +
      ' | gols ' + gp + ' pro / ' + gc + ' contra' +
      ' | ambas marcaram em ' + btts + '/' + ult.length +
      ' | over 2.5 em ' + over25 + '/' + ult.length;
    if (entrada) linha += String.fromCharCode(10) + '  tabela: ' + linhaTabela(entrada);
    linha += String.fromCharCode(10) + '  jogos: ' + detalhe;
    return linha;
  }

  function linhaTabela(t) {
    return t.position + 'o lugar, ' + t.points + ' pts em ' + t.playedGames + ' jogos (' +
      t.won + 'V ' + t.draw + 'E ' + t.lost + 'D), gols ' + t.goalsFor + ':' + t.goalsAgainst +
      (t.form ? ', forma ' + t.form : '');
  }

  function resumoH2H(j) {
    if (!j) return 'H2H: sem dados na base.';
    var ag = j.aggregates || {};
    var partes = [];
    if (ag.numberOfMatches) {
      partes.push(ag.numberOfMatches + ' confrontos');
      if (ag.homeTeam) partes.push('mandante: ' + ag.homeTeam.wins + 'V ' + ag.homeTeam.draws + 'E ' + ag.homeTeam.losses + 'D');
      if (ag.awayTeam) partes.push('visitante: ' + ag.awayTeam.wins + 'V ' + ag.awayTeam.draws + 'E ' + ag.awayTeam.losses + 'D');
      if (ag.totalGoals !== undefined) {
        partes.push('media de ' + (ag.totalGoals / ag.numberOfMatches).toFixed(2) + ' gols por jogo');
      }
    }
    var lista = (j.matches || []).slice(0, 5).map(function (m) {
      var d = String(m.utcDate || '').slice(0, 10);
      return d + ' ' + ((m.homeTeam && m.homeTeam.shortName) || '?') + ' ' + placar(m) + ' ' +
        ((m.awayTeam && m.awayTeam.shortName) || '?');
    });
    return 'H2H: ' + (partes.join(', ') || 'sem agregados') +
      (lista.length ? String.fromCharCode(10) + '  ' + lista.join(' | ') : '');
  }

  /**
   * Monta o dossie de dados reais dos jogos escolhidos.
   * Retorna '' quando nao ha chave da API esportiva.
   */
  /* ---------- fonte principal: API-Football ---------- */
  async function dossieAF(jogos, onLog) {
    var blocos = [];
    for (var i = 0; i < jogos.length; i++) {
      var j = jogos[i];
      if (!j.afId) continue;

      /* 2 chamadas por jogo: previsao (traz forma + H2H junto) e desfalques */
      if (AF.restam() < 2) {
        if (onLog) onLog('Cota diária no fim — os jogos restantes vão sem dados extras.');
        break;
      }
      if (onLog) onLog(j.mandante + ' x ' + j.visitante + ' (restam ' + AF.restam() + ' consultas)');

      var partes = ['### ' + j.mandante + ' x ' + j.visitante +
        ' (' + j.liga + ', ' + (j.hora || 's/ horario') + ')'];

      try {
        partes.push(AF.textoPrevisao(await AF.previsao(j.afId)));
      } catch (e) {
        partes.push('previsao indisponivel: ' + e.message);
      }
      try {
        partes.push(AF.textoDesfalques(await AF.desfalques(j.afId)));
      } catch (_) {
        partes.push('desfalques indisponiveis');
      }

      /* escalacao so entra se ja tiver sido publicada (nao gasta chamada se ja veio no cache) */
      var esc = null;
      try { esc = await AF.escalacao(j.afId); } catch (_) {}
      if (esc && esc.length) partes.push(AF.textoEscalacao(esc));

      blocos.push(partes.filter(Boolean).join(String.fromCharCode(10)));
    }
    return blocos.join(String.fromCharCode(10, 10));
  }

  async function dossie(jogos, onLog) {
    /* prioridade: API-Football (mais completa). football-data fica de reserva. */
    if (global.AF && AF.temChave()) {
      var comId = jogos.filter(function (j) { return j.afId; });
      if (comId.length) {
        var t = await dossieAF(comId, onLog);
        if (t) return t;
      }
    }
    if (!Store.state.cfg.fdKey) return '';
    var comIds = jogos.filter(function (j) { return j.idCasa && j.idFora; });
    if (!comIds.length) return '';

    var base = {};
    try {
      base = await recentes(onLog);
    } catch (e) {
      if (onLog) onLog('Não consegui baixar os resultados recentes: ' + e.message);
    }

    var blocos = [];
    for (var i = 0; i < comIds.length; i++) {
      var j = comIds[i];
      if (onLog) onLog('Dados de ' + j.mandante + ' x ' + j.visitante + '...');
      var tab = await tabela(j.comp, onLog);
      var cara = await h2h(j.fdId, onLog);

      var b = '### ' + j.mandante + ' x ' + j.visitante + ' (' + j.liga + ', ' + (j.hora || 's/ horario') + ')' +
        String.fromCharCode(10) +
        resumoTime(j.mandante + ' [mandante]', j.idCasa, base[j.idCasa], naTabela(tab, j.idCasa)) +
        String.fromCharCode(10) +
        resumoTime(j.visitante + ' [visitante]', j.idFora, base[j.idFora], naTabela(tab, j.idFora)) +
        String.fromCharCode(10) + resumoH2H(cara);
      blocos.push(b);
    }

    return blocos.join(String.fromCharCode(10, 10));
  }

  function limparCache() {
    cache = { recentes: null, tabelas: {}, h2h: {} };
  }

  global.Stats = { dossie: dossie, limparCache: limparCache };
})(window);
