/* ============================================================
   GREEN - app: rotas, telas e acoes
   ============================================================ */
(function (global) {
  'use strict';

  var S = Store.state;
  var esc = UI.esc, ICONS = UI.ICONS;

  var App = {
    filtro: 'todos',
    data: Store.hoje(),
    aba: 'resumo',
    rodando: false,
    carregando: false,
    inicio: 0,
    timer: null,
    fonteJogos: '',
    logs: [],
    parcial: ''
  };

  /* ================= util ================= */

  function nav(hash) { location.hash = hash; }

  function rota() {
    var h = (location.hash || '#/jogos').replace(/^#/, '');
    var p = h.split('/').filter(Boolean);
    return { nome: p[0] || 'jogos', arg: p[1] || '' };
  }

  function normMercado(m) {
    var s = String(m || '').toLowerCase();
    if (/over|under|mais de|menos de|\+\d|gols/.test(s) && !/escanteio|cart/.test(s)) return 'Gols (Over/Under)';
    if (/ambas|btts/.test(s)) return 'Ambas Marcam';
    if (/dupla/.test(s)) return 'Dupla Chance';
    if (/empate anula|dnb|draw no bet/.test(s)) return 'Empate Anula';
    if (/escanteio|corner/.test(s)) return 'Escanteios';
    if (/handicap/.test(s)) return 'Handicap Asiatico';
    if (/cart|cartao|cartoes/.test(s)) return 'Cartoes';
    if (/vencedor|1x2|resultado/.test(s)) return 'Vencedor';
    return m || 'Outros';
  }

  function diasStrip() {
    var out = [];
    for (var i = -1; i <= 5; i++) {
      var d = new Date();
      d.setDate(d.getDate() + i);
      var iso = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      var lb = i === 0 ? 'HOJE' : (pad(d.getDate()) + ' ' + ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'][d.getMonth()]);
      out.push({ iso: iso, label: lb });
    }
    return out;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function vazio(msg, botao) {
    return '<div class="empty">' + ICONS.empty + '<div>' + msg + '</div>' +
      (botao ? '<div style="margin-top:16px">' + botao + '</div>' : '') + '</div>';
  }

  /* ================= tela: JOGOS ================= */

  function viewJogos() {
    var jogos = Store.jogosDoDia(App.data);
    var favs = jogos.filter(function (j) { return j.fav; }).length;
    var sel = jogos.filter(function (j) { return j.sel; }).length;
    var lista = App.filtro === 'fav' ? jogos.filter(function (j) { return j.fav; })
      : App.filtro === 'sel' ? jogos.filter(function (j) { return j.sel; })
        : jogos;

    var h = '';
    h += '<div class="chips">' +
      chip('todos', 'Todos', jogos.length) +
      chip('fav', 'Favoritos', favs) +
      chip('sel', 'Selecionados', sel) +
      '<button class="chip" data-act="atualizar">' + ICONS.refresh + ' Atualizar</button>' +
      '</div>';

    h += '<div class="datestrip"><span class="dicon">' + ICONS.cal + '</span>' +
      diasStrip().map(function (d) {
        return '<button class="dchip' + (d.iso === App.data ? ' on' : '') + '" data-act="data" data-id="' + d.iso + '">' + d.label + '</button>';
      }).join('') + '</div>';

    if (App.carregando) {
      h += '<div class="league"><div class="league-head"><h3 class="cond">Carregando a grade do dia</h3>' +
        '<span class="chev"><span class="spin"></span></span></div>' +
        '<div class="match sk"><div class="teams"><div class="skbar w60"></div><div class="skbar w45"></div></div></div>' +
        '<div class="match sk"><div class="teams"><div class="skbar w50"></div><div class="skbar w65"></div></div></div>' +
        '<div class="match sk"><div class="teams"><div class="skbar w70"></div><div class="skbar w40"></div></div></div>' +
        '</div>';
    } else if (!lista.length) {
      h += vazio(jogos.length ? 'Nenhum jogo neste filtro.' : 'Nenhum jogo carregado para este dia.',
        '<button class="btn sm" data-act="atualizar">' + ICONS.refresh + ' Carregar jogos do dia</button>');
    } else {
      h += '<div class="listbar">' +
        '<span>' + lista.length + ' jogos' + (App.fonteJogos === 'ia' ? ' · via IA' :
          App.fonteJogos === 'football-data' ? ' · grade oficial' : '') + '</span>' +
        '<button data-act="todos-sel">' + (sel === jogos.length && sel ? 'Limpar seleção' : 'Marcar todos') + '</button>' +
        '</div>';
      var ligas = {};
      lista.forEach(function (j) { (ligas[j.liga] = ligas[j.liga] || []).push(j); });
      Object.keys(ligas).forEach(function (lg) {
        h += '<div class="league"><div class="league-head">' +
          '<h3 class="cond">' + esc(lg) + '</h3><span class="cnt">' + ligas[lg].length + '</span>' +
          '<span class="chev">' + ICONS.chev + '</span></div>';
        h += ligas[lg].map(matchRow).join('');
        h += '</div>';
      });
    }

    h += '<div class="actionbar">' +
      '<button class="btn" data-act="pronto"' + (sel ? '' : ' disabled') + '>' + ICONS.bolt +
      ' PRONTO — ANALISAR' + (sel ? ' (' + sel + ')' : '') + '</button>' +
      '<div style="height:8px"></div>' +
      '<button class="btn ghost" data-act="add">' + ICONS.plus + ' Adicionar jogos</button>' +
      '</div>';
    return h;
  }

  function chip(id, label, n) {
    return '<button class="chip' + (App.filtro === id ? ' on' : '') + '" data-act="filtro" data-id="' + id + '">' +
      esc(label) + '<span class="n">' + n + '</span></button>';
  }

  function matchRow(j) {
    var tem = !!S.analises[j.id];
    var st = String(j.status || '').toUpperCase();
    var tag = tem ? 'ANALISADO'
      : st === 'FINISHED' ? 'ENCERRADO'
        : (st === 'IN_PLAY' || st === 'PAUSED') ? 'AO VIVO'
          : 'PENDENTE';
    var cls = tem ? ' ok' : (st === 'IN_PLAY' || st === 'PAUSED') ? ' vivo' : '';
    return '<div class="match">' +
      '<button class="pickbox' + (j.sel ? ' on' : '') + '" data-act="sel" data-id="' + j.id + '">' + ICONS.check + '</button>' +
      '<div class="teams" data-act="abrir" data-id="' + j.id + '">' +
      '<div class="trow">' + UI.crest(j.mandante, j.crestCasa) + '<span class="nm">' + esc(j.mandante) + '</span>' +
      '<button class="star' + (j.fav ? ' on' : '') + '" data-act="fav" data-id="' + j.id + '">' + ICONS.star + '</button></div>' +
      '<div class="trow">' + UI.crest(j.visitante, j.crestFora) + '<span class="nm">' + esc(j.visitante) + '</span></div>' +
      '</div>' +
      '<div class="meta">' +
      '<span class="hora">' + esc(j.hora || '--:--') + '</span>' +
      '<span class="tag' + cls + '">' + tag + '</span>' +
      '</div></div>';
  }

  /* ================= tela: ANALISE ================= */

  function viewAnalise() {
    var ids = Object.keys(S.analises);
    if (!ids.length) {
      return '<div class="hero"><h1>Análise</h1><p>Nenhuma análise gerada ainda.</p></div>' +
        vazio('Selecione os jogos na aba Jogos e toque em PRONTO.',
          '<button class="btn sm" data-act="ir" data-id="jogos">Ir para Jogos</button>');
    }
    var h = '<div class="hero"><h1>Análise</h1><p>' + ids.length + ' jogo(s) · ' +
      esc(S.meta.ultimaAnalise || '') + '</p></div>';

    if (S.meta.obs) h += '<div class="card"><h4>Leitura da rodada</h4><p>' + esc(S.meta.obs) + '</p></div>';

    ids.forEach(function (id) {
      var a = S.analises[id];
      var top = (a.palpites || [])[0];
      h += '<div class="card" data-act="abrir" data-id="' + id + '">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
        '<span class="tiny muted cond">' + esc(a.liga) + '</span>' +
        '<span class="pill ' + (a.confianca >= 75 ? 'baixo' : a.confianca >= 55 ? 'medio' : 'alto') + '" style="margin-left:auto">' +
        (a.confianca >= 75 ? 'confiança alta' : a.confianca >= 55 ? 'confiança média' : 'confiança baixa') + '</span></div>' +
        '<div class="trow" style="margin-bottom:6px">' + UI.crest(a.mandante) + '<span class="nm">' + esc(a.mandante) + '</span>' +
        '<span class="tiny muted">' + esc(a.hora || '') + '</span></div>' +
        '<div class="trow" style="margin-bottom:10px">' + UI.crest(a.visitante) + '<span class="nm">' + esc(a.visitante) + '</span></div>' +
        (top ? '<div class="pick" style="margin-bottom:8px"><div class="top"><span class="mk">' + esc(top.mercado) +
          '</span><span class="odd">' + UI.odd(top.odd) + '</span></div><div class="sel">' + esc(top.selecao) + '</div>' +
          UI.confBar(top.confianca) + '</div>' : '') +
        '<p class="tiny">' + esc(a.veredito) + '</p></div>';
    });
    return h;
  }

  /* ================= tela: DETALHE DO JOGO ================= */

  function viewJogo(id) {
    var a = S.analises[id];
    var j = S.jogos.find(function (x) { return x.id === id; });
    if (!a) {
      return '<div class="hero"><h1>' + esc(j ? j.mandante + ' x ' + j.visitante : 'Jogo') + '</h1>' +
        '<p>' + esc(j ? j.liga : '') + '</p></div>' +
        vazio('Este jogo ainda não foi analisado.',
          '<button class="btn sm" data-act="analisar-um" data-id="' + id + '">Analisar agora</button>');
    }

    var h = '<div style="text-align:center;padding:16px 12px 6px">' +
      '<div class="tiny muted cond" style="margin-bottom:12px">' + esc(a.liga) + '</div>' +
      '<div style="display:flex;align-items:center;justify-content:center;gap:14px">' +
      '<div style="flex:1;text-align:center">' + UI.crestBig(a.mandante, j && j.crestCasa) +
      '<div style="font-size:13px;font-weight:700">' + esc(a.mandante) + '</div></div>' +
      '<div style="min-width:78px"><div style="font-size:20px;font-weight:800;color:var(--accent)">' + esc(a.hora || '--:--') + '</div>' +
      '<div class="tiny muted">' + (App.data === Store.hoje() ? 'hoje' : esc(App.data)) + '</div></div>' +
      '<div style="flex:1;text-align:center">' + UI.crestBig(a.visitante, j && j.crestFora) +
      '<div style="font-size:13px;font-weight:700">' + esc(a.visitante) + '</div></div>' +
      '</div></div>';

    var abas = [['resumo', 'Resumo'], ['forma', 'Forma'], ['h2h', 'H2H'], ['desfalques', 'Desfalques'],
      ['metricas', 'Métricas'], ['palpites', 'Palpites']];
    h += '<div class="tabs">' + abas.map(function (t) {
      return '<button class="chip' + (App.aba === t[0] ? ' on' : '') + '" data-act="aba" data-id="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div>';

    if (App.aba === 'resumo') {
      h += '<div class="card"><h4>Veredito</h4><p>' + esc(a.veredito) + '</p>' +
        '<div style="margin-top:10px">' + UI.confBar(a.confianca) + '</div></div>';
      h += '<div class="card"><h4>Contexto e importância</h4><p>' + esc(a.contexto) + '</p></div>';
      if ((a.alertas || []).length) {
        h += '<div class="card"><h4>Alertas de risco</h4>' +
          a.alertas.map(function (x) { return '<p>• ' + esc(x) + '</p>'; }).join('') + '</div>';
      }
    } else if (App.aba === 'forma') {
      h += '<div class="card"><h4>' + esc(a.mandante) + ' (mandante)</h4>' +
        '<div class="kv"><span class="k">Últimos 5</span><span class="v">' + esc(a.ultimos5_mandante) + '</span></div>' +
        '<p style="margin-top:8px">' + esc(a.forma_mandante) + '</p></div>';
      h += '<div class="card"><h4>' + esc(a.visitante) + ' (visitante)</h4>' +
        '<div class="kv"><span class="k">Últimos 5</span><span class="v">' + esc(a.ultimos5_visitante) + '</span></div>' +
        '<p style="margin-top:8px">' + esc(a.forma_visitante) + '</p></div>';
    } else if (App.aba === 'h2h') {
      h += '<div class="card"><h4>Confronto direto</h4><p>' + esc(a.h2h) + '</p></div>';
    } else if (App.aba === 'desfalques') {
      h += '<div class="card"><h4>Desfalques ' + esc(a.mandante) + '</h4><p>' + esc(a.desfalques_mandante) + '</p></div>';
      h += '<div class="card"><h4>Desfalques ' + esc(a.visitante) + '</h4><p>' + esc(a.desfalques_visitante) + '</p></div>';
      h += '<div class="card"><h4>Escalações prováveis</h4><p>' + esc(a.escalacoes) + '</p></div>';
    } else if (App.aba === 'metricas') {
      h += '<div class="card"><h4>Médias e tendências</h4>' +
        kv('Escanteios', a.media_escanteios) +
        kv('Cartões / faltas', a.media_cartoes) +
        kv('Ambas marcam (BTTS)', a.btts_pct + '%') +
        kv('Over 1.5 gols', a.over15_pct + '%') +
        kv('Over 2.5 gols', a.over25_pct + '%') +
        '</div>';
    } else {
      h += '<div class="card"><h4>Palpites sugeridos</h4>' +
        (a.palpites || []).map(function (p, i) {
          return '<div class="pick"><div class="top"><span class="mk">' + esc(p.mercado) + '</span>' +
            '<span class="pill ' + esc(p.risco) + '">risco ' + esc(p.risco) + '</span>' +
            '<span class="odd">' + UI.odd(p.odd) + '</span></div>' +
            '<div class="sel">' + esc(p.selecao) + '</div>' +
            UI.confBar(p.confianca) +
            '<div class="just">' + esc(p.justificativa) + '</div>' +
            '<div style="margin-top:9px"><button class="btn ghost sm" data-act="reg-pick" data-id="' + a.id + ':' + i + '">Registrar no histórico</button></div>' +
            '</div>';
        }).join('') + '</div>';
    }
    return h;
  }

  function kv(k, v) {
    return '<div class="kv"><span class="k">' + esc(k) + '</span><span class="v">' + esc(v) + '</span></div>';
  }

  /* ================= tela: BILHETES ================= */

  function viewBilhetes() {
    if (!S.bilhetes.length) {
      return '<div class="hero"><h1>Bilhetes</h1><p>Desafio ' + UI.money(S.cfg ? S.cfg.stake : 5) + '</p></div>' +
        vazio('Nenhum bilhete montado ainda.', '<button class="btn sm" data-act="ir" data-id="jogos">Selecionar jogos</button>');
    }
    var stake = Number(S.cfg.stake) || 5;
    var h = '<div class="hero"><h1>Bilhetes</h1><p>Stake ' + UI.money(stake) + ' · alvo @' + S.cfg.alvo + ' · ' + esc(S.meta.ultimaAnalise || '') + '</p></div>';

    S.bilhetes.forEach(function (b, bi) {
      var total = Number(b.odd_total) || (b.selecoes || []).reduce(function (a, s) { return a * (Number(s.odd) || 1); }, 1);
      h += '<div class="ticket">' +
        '<div class="thead"><div class="nm">' + esc(b.nome) + '</div><div class="fx">' + esc(b.foco) +
        ' · <span class="pill ' + esc(b.risco) + '">risco ' + esc(b.risco) + '</span></div></div>';
      (b.selecoes || []).forEach(function (s) {
        h += '<div class="leg"><span class="dot"></span><div class="info">' +
          '<div class="jg">' + esc(s.jogo) + ' · ' + esc(s.mercado) + '</div>' +
          '<div class="sl">' + esc(s.selecao) + '</div></div>' +
          '<div class="od">' + UI.odd(s.odd) + '</div></div>';
      });
      h += '<div class="tfoot">' +
        '<div class="box"><div class="lb">Odd total</div><div class="vl acc">' + UI.odd(total) + '</div></div>' +
        '<div class="box"><div class="lb">Stake</div><div class="vl">' + UI.money(stake) + '</div></div>' +
        '<div class="box" style="text-align:right"><div class="lb">Retorno</div><div class="vl grn">' + UI.money(stake * total) + '</div></div>' +
        '</div>' +
        (total < Number(S.cfg.alvo) * 0.6
          ? '<div class="aviso">Odd bem abaixo do alvo @' + esc(S.cfg.alvo) + '. Com poucos jogos ' +
          'não dá para chegar lá sem enfiar palpite ruim — analise mais jogos para subir a odd com segurança.</div>'
          : '') +
        '<div style="padding:10px 14px"><button class="btn ghost sm" data-act="reg-bilhete" data-id="' + bi + '">Registrar no histórico</button></div>' +
        '</div>';
    });
    return h;
  }

  /* ================= tela: PLACAR ================= */

  function viewPlacar() {
    var st = Store.stats();
    var t = st.total;
    var h = '<div class="hero"><h1>Placar</h1><p>Aprendizado e desempenho real dos palpites</p></div>';

    h += '<div class="card"><h4>Resumo</h4>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center;margin-top:4px">' +
      box('Taxa', t.taxa + '%', 'var(--accent)') +
      box('Greens', String(t.g), 'var(--green)') +
      box('Reds', String(t.r), 'var(--red)') +
      '</div>' +
      '<div style="margin-top:12px">' + kv('Investido em bilhetes', UI.money(t.stake)) +
      kv('Retorno', UI.money(t.retorno)) +
      '<div class="kv"><span class="k">Lucro</span><span class="v" style="color:' +
      (t.lucro >= 0 ? 'var(--green)' : 'var(--red)') + '">' + UI.money(t.lucro) + '</span></div></div></div>';

    if (st.mercados.length) {
      h += '<div class="sect-title">Desempenho por mercado<span class="line"></span></div>';
      h += '<div class="table"><div class="th"><span>Mercado</span><span style="text-align:center">J</span>' +
        '<span style="text-align:center">G</span><span style="text-align:right">%</span></div>' +
        st.mercados.map(function (m, i) {
          return '<div class="tr"><span class="rk"><span class="num">' + (i + 1) + '</span><span>' + esc(m.mercado) + '</span></span>' +
            '<span class="c">' + m.n + '</span><span class="c">' + m.g + '</span><span class="pts">' + m.taxa + '</span></div>';
        }).join('') + '</div>';
    }

    var pend = S.hist.filter(function (x) { return x.resultado === 'pend'; });
    h += '<div class="sect-title">Conferir resultados<span class="line"></span></div>';
    if (!pend.length) {
      h += '<div class="card"><p class="muted tiny">Nada pendente. Registre bilhetes ou palpites para conferir depois.</p></div>';
    } else {
      pend.forEach(function (p) {
        h += '<div class="card"><div class="tiny muted">' + esc(p.jogo || '') + ' · ' + esc(p.mercado) + '</div>' +
          '<div style="font-weight:700;margin:4px 0 10px">' + esc(p.selecao) + ' <span style="color:var(--accent)">' + UI.odd(p.odd) + '</span></div>' +
          '<div style="display:flex;gap:8px">' +
          '<button class="btn sm" style="flex:1;background:rgba(49,208,122,.16);color:var(--green)" data-act="res" data-id="' + p.id + ':green">GREEN</button>' +
          '<button class="btn sm" style="flex:1;background:rgba(255,77,94,.14);color:var(--red)" data-act="res" data-id="' + p.id + ':red">RED</button>' +
          '<button class="btn sm ghost" data-act="del-hist" data-id="' + p.id + '">' + ICONS.trash + '</button>' +
          '</div></div>';
      });
    }

    var paraAprender = S.hist.filter(function (x) { return x.resultado !== 'pend' && !x.aprendido; });
    h += '<div class="sect-title">Memória do agente<span class="line"></span></div>';
    h += '<div class="card"><p class="tiny muted">O agente guarda lições dos erros e aplica em toda análise seguinte. ' +
      'Hoje ele tem <b>' + S.memoria.length + '</b> lição(ões) na memória.</p>' +
      '<div style="margin-top:10px;display:flex;gap:8px">' +
      '<button class="btn sm" data-act="aprender"' + (paraAprender.length ? '' : ' disabled') + '>' + ICONS.brain +
      ' Aprender com a rodada (' + paraAprender.length + ')</button>' +
      '<button class="btn ghost sm" data-act="ir" data-id="ajustes">Ver memória</button>' +
      '</div></div>';
    return h;
  }

  function box(lb, vl, cor) {
    return '<div style="background:var(--surface-2);border:1px solid var(--line);border-radius:12px;padding:10px 6px">' +
      '<div class="lb tiny muted" style="text-transform:uppercase;letter-spacing:.06em">' + lb + '</div>' +
      '<div style="font-size:20px;font-weight:800;color:' + cor + '">' + vl + '</div></div>';
  }

  /* ================= tela: AJUSTES ================= */

  function viewAjustes() {
    var c = S.cfg;
    var h = '<div class="hero"><h1>Ajustes</h1><p>Motor de análise, banca e memória</p></div>';

    var ds = c.provider !== 'claude';

    h += '<div class="sect-title">Jogos do dia<span class="line"></span></div>';
    h += '<div class="field"><label>Chave football-data.org (grátis)</label>' +
      '<input class="input" type="password" placeholder="cole aqui a chave" data-cfg="fdKey" value="' + esc(c.fdKey) + '">' +
      '<p class="tiny muted" style="margin-top:6px">É ela que traz a grade do dia, escudos, classificação, ' +
      'últimos jogos e confronto direto — os números reais que alimentam a análise. ' +
      'Grátis em football-data.org/client/register</p>' +
      '<div style="margin-top:8px;display:flex;gap:8px">' +
      '<button class="btn ghost sm" data-act="testar-fd">Testar chave</button>' +
      '<button class="btn ghost sm" data-act="atualizar">Buscar jogos agora</button></div></div>';
    h += '<div class="switch"><div><div class="tx">Carregar jogos ao abrir</div>' +
      '<div class="sub">A grade do dia aparece sozinha</div></div>' +
      '<button class="sw' + (c.autoLoad ? ' on' : '') + '" data-act="toggle" data-id="autoLoad"><i></i></button></div>';

    h += '<div class="sect-title">Motor de IA<span class="line"></span></div>';
    h += '<div class="field"><label>Motor</label><div class="segmented">' +
      '<button class="seg' + (ds ? ' on' : '') + '" data-act="motor" data-id="deepseek">DeepSeek</button>' +
      '<button class="seg' + (ds ? '' : ' on') + '" data-act="motor" data-id="claude">Claude</button>' +
      '</div></div>';

    if (ds) {
      h += '<div class="field"><label>Chave DeepSeek</label>' +
        '<input class="input" type="password" placeholder="sk-..." data-cfg="dsKey" value="' + esc(c.dsKey) + '">' +
        '<p class="tiny muted" style="margin-top:6px">Crie em platform.deepseek.com. ' +
        'Bem mais barato que o Claude: a análise de uma rodada custa centavos.</p></div>';
      h += '<div class="field"><div class="row2">' +
        '<div><label>Modelo</label><select class="input" data-cfg="dsModel">' +
        opt('deepseek-v4-pro', 'V4 Pro (recomendado)', c.dsModel) +
        opt('deepseek-v4-flash', 'V4 Flash (barato)', c.dsModel) +
        '</select></div>' +
        '<div><label>Profundidade</label><select class="input" data-cfg="effort">' +
        opt('low', 'Baixa', c.effort) + opt('medium', 'Média', c.effort) + opt('high', 'Alta', c.effort) +
        '</select></div></div></div>';
      h += '<div class="card" style="border-color:var(--accent-dim)"><h4>Como o DeepSeek pega os dados</h4>' +
        '<p class="tiny">A API do DeepSeek não tem busca na web. Quem traz os números é a chave ' +
        'football-data.org acima: forma recente com placares, classificação e confronto direto vão prontos ' +
        'para a IA. O que fica de fora é desfalque/escalação de última hora — nesses campos o app escreve ' +
        '"sem dado confiável" em vez de inventar. Se quiser esses dados também, use o motor Claude ' +
        'com pesquisa web ligada.</p></div>';
    } else {
      h += '<div class="field"><label>Chave Anthropic</label>' +
        '<input class="input" type="password" placeholder="sk-ant-..." data-cfg="apiKey" value="' + esc(c.apiKey) + '"></div>';
      h += '<div class="field"><div class="row2">' +
        '<div><label>Modelo</label><select class="input" data-cfg="model">' +
        opt('claude-opus-5', 'Opus 5', c.model) +
        opt('claude-sonnet-5', 'Sonnet 5', c.model) +
        opt('claude-haiku-4-5', 'Haiku 4.5', c.model) +
        '</select></div>' +
        '<div><label>Profundidade</label><select class="input" data-cfg="effort">' +
        opt('medium', 'Média', c.effort) + opt('high', 'Alta', c.effort) +
        opt('xhigh', 'Muito alta', c.effort) + opt('max', 'Máxima', c.effort) +
        '</select></div></div></div>';
      h += '<div class="switch"><div><div class="tx">Pesquisa web ao vivo</div>' +
        '<div class="sub">Desfalques, escalações e odds de hoje</div></div>' +
        '<button class="sw' + (c.web ? ' on' : '') + '" data-act="toggle" data-id="web"><i></i></button></div>';
    }

    h += '<div class="field"><button class="btn ghost" data-act="testar">Testar conexão</button></div>';

    h += '<div class="sect-title">Banca<span class="line"></span></div>';
    h += '<div class="field"><div class="row2">' +
      '<div><label>Stake por bilhete</label><input class="input" type="number" step="1" min="1" data-cfg="stake" value="' + esc(c.stake) + '"></div>' +
      '<div><label>Odd alvo</label><input class="input" type="number" step="1" min="2" data-cfg="alvo" value="' + esc(c.alvo) + '"></div>' +
      '</div></div>';

    h += '<div class="sect-title">Prompt mestre<span class="line"></span></div>';
    h += '<div class="field"><label>Instruções do agente</label>' +
      '<textarea class="input" data-cfg="prompt" style="min-height:220px">' + esc(c.prompt) + '</textarea>' +
      '<div style="margin-top:8px"><button class="btn ghost sm" data-act="reset-prompt">Restaurar padrão</button></div></div>';

    h += '<div class="sect-title">Memória de aprendizado (' + S.memoria.length + ')<span class="line"></span></div>';
    h += '<div class="field"><div style="display:flex;gap:8px">' +
      '<input class="input" id="novaLicao" placeholder="Ex.: evitar Over 2.5 em jogo de mata-mata">' +
      '<button class="btn sm" data-act="add-licao">Add</button></div></div>';
    if (S.memoria.length) {
      S.memoria.forEach(function (m) {
        h += '<div class="card" style="padding:11px 13px"><div style="display:flex;gap:10px;align-items:flex-start">' +
          '<div style="flex:1"><div class="tiny muted">' + esc(m.data) + ' · ' + esc(m.mercado) + '</div>' +
          '<div style="font-size:13px;margin-top:3px">' + esc(m.licao) + '</div></div>' +
          '<button class="star" style="color:var(--muted)" data-act="del-licao" data-id="' + m.id + '">' + ICONS.trash + '</button>' +
          '</div></div>';
      });
    } else {
      h += '<div class="card"><p class="tiny muted">Sem lições ainda. Marque os resultados no Placar e toque em "Aprender com a rodada".</p></div>';
    }

    h += '<div class="sect-title">Dados<span class="line"></span></div>';
    h += '<div class="field"><button class="btn ghost" data-act="exportar">Exportar backup (JSON)</button></div>';
    h += '<div class="field"><button class="btn danger" data-act="limpar-tudo">Apagar jogos, análises e histórico</button></div>';
    h += '<div class="field"><p class="tiny muted">As chaves ficam salvas só neste aparelho e são enviadas apenas ' +
      'para o serviço de cada uma (DeepSeek, Anthropic e football-data.org). ' +
      'Aposte com responsabilidade: nenhuma análise garante resultado.</p></div>';
    return h;
  }

  function opt(v, lb, atual) {
    return '<option value="' + v + '"' + (atual === v ? ' selected' : '') + '>' + lb + '</option>';
  }

  /* ================= tela: RODANDO ================= */

  function viewRodando() {
    var h = '<div class="progress"><div class="ttl">' + (App.rodando ? '<span class="spin"></span>' : ICONS.check) +
      (App.rodando ? 'Analisando rodada...' : 'Análise concluída') +
      '<span class="cron" id="cron">' + relogio() + '</span></div>' +
      '<div class="log" id="log">' + App.logs.map(function (l) {
        return '<div class="' + (l.c || '') + '">' + esc(l.t) + '</div>';
      }).join('') + '</div></div>';
    h += '<div class="card" id="parcialWrap"' + (App.parcial ? '' : ' hidden') + '>' +
      '<h4>Dossiê em tempo real</h4>' +
      '<p class="tiny" id="parcial" style="white-space:pre-wrap">' + esc(App.parcial.slice(-1400)) + '</p></div>';
    if (!App.rodando) {
      h += '<div class="actionbar"><button class="btn" data-act="ir" data-id="bilhetes">Ver bilhetes</button></div>';
    }
    return h;
  }

  function relogio() {
    if (!App.inicio) return '';
    var s = Math.round((Date.now() - App.inicio) / 1000);
    return (s < 60 ? s + 's' : Math.floor(s / 60) + 'min ' + pad(s % 60) + 's');
  }

  /* ================= render ================= */

  function render() {
    var r = rota();
    var view = document.getElementById('view');
    var html;
    if (r.nome === 'jogos') html = viewJogos();
    else if (r.nome === 'analise') html = viewAnalise();
    else if (r.nome === 'jogo') html = viewJogo(r.arg);
    else if (r.nome === 'bilhetes') html = viewBilhetes();
    else if (r.nome === 'placar') html = viewPlacar();
    else if (r.nome === 'ajustes') html = viewAjustes();
    else if (r.nome === 'rodando') html = viewRodando();
    else html = viewJogos();
    view.innerHTML = html;
    document.getElementById('btnBack').hidden = (r.nome !== 'jogo');
    document.getElementById('brand').style.visibility = 'visible';
    renderTabs(r.nome);
    if (r.nome !== 'rodando') view.scrollTop = 0;
  }

  function renderTabs(atual) {
    var abas = [
      ['jogos', 'Jogos', ICONS.jogos, Store.jogosDoDia(App.data).length],
      ['analise', 'Análise', ICONS.analise, Object.keys(S.analises).length],
      ['bilhetes', 'Bilhetes', ICONS.bilhetes, S.bilhetes.length],
      ['placar', 'Placar', ICONS.placar, S.hist.filter(function (x) { return x.resultado === 'pend'; }).length],
      ['ajustes', 'Ajustes', ICONS.ajustes, 0]
    ];
    document.getElementById('tabbar').innerHTML = abas.map(function (a) {
      var on = (atual === a[0]) || (atual === 'jogo' && a[0] === 'analise') || (atual === 'rodando' && a[0] === 'analise');
      return '<button class="tab' + (on ? ' on' : '') + '" data-act="ir" data-id="' + a[0] + '">' +
        a[2] + '<span>' + a[1] + '</span>' + (a[3] ? '<span class="badge">' + a[3] + '</span>' : '') + '</button>';
    }).join('');
  }

  /* ================= acoes ================= */

  function log(t, c) {
    App.logs.push({ t: t, c: c });
    if (App.logs.length > 300) App.logs.shift();
    if (rota().nome === 'rodando') {
      var el = document.getElementById('log');
      if (el) {
        var d = document.createElement('div');
        if (c) d.className = c;
        d.textContent = t;
        el.appendChild(d);
        el.scrollTop = el.scrollHeight;
      }
    }
  }

  async function rodarAnalise(jogos) {
    if (App.rodando) return;
    if (!Motor.temChave()) {
      UI.toast('Configure a chave do motor de IA em Ajustes.', 'err');
      nav('#/ajustes');
      return;
    }
    App.rodando = true; App.logs = []; App.parcial = '';
    App.inicio = Date.now();
    if (App.timer) clearInterval(App.timer);
    App.timer = setInterval(function () {
      var el = document.getElementById('cron');
      if (el) el.textContent = relogio();
    }, 1000);
    nav('#/rodando'); render();
    log('› Leva alguns minutos. Pode deixar a tela ligada.');

    try {
      var res = await API.analisar(jogos, function (tipo, txt) {
        if (tipo === 'info') log('› ' + txt);
        else if (tipo === 'dados') log('  📊 ' + txt);
        else if (tipo === 'busca') log('› pesquisando na web...');
        else if (tipo === 'query') { if (txt) log('  🔎 "' + txt + '"'); }
        else if (tipo === 'resultado') log('  ✓ ' + txt, 'ok');
        else if (tipo === 'pensando') log('› raciocinando...');
        else if (tipo === 'texto') {
          App.parcial += txt;
          if (rota().nome === 'rodando') {
            var wrap = document.getElementById('parcialWrap');
            var el = document.getElementById('parcial');
            if (wrap) wrap.hidden = false;
            if (el) el.textContent = App.parcial.slice(-1400);
          }
        }
      });

      var mapa = {};
      jogos.forEach(function (j) { mapa[j.id] = j; });
      (res.dados.jogos || []).forEach(function (a, i) {
        var alvo = mapa[a.id] || jogos[i];
        if (!alvo) return;
        a.id = alvo.id;
        a.liga = a.liga || alvo.liga;
        a.hora = a.hora || alvo.hora;
        S.analises[alvo.id] = a;
      });
      S.bilhetes = res.dados.bilhetes || [];
      S.meta.obs = res.dados.observacoes || '';
      S.meta.dossie = res.dossie;
      S.meta.ultimaAnalise = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      Store.save();

      log('✓ Análise concluída: ' + (res.dados.jogos || []).length + ' jogo(s), ' +
        (res.dados.bilhetes || []).length + ' bilhete(s).', 'ok');
      UI.toast('Análise pronta!', 'ok');
    } catch (e) {
      log('✗ ' + e.message, 'er');
      UI.toast(e.message, 'err');
      if (App.parcial) {
        S.meta.dossie = App.parcial;
        Store.save();
        log('› O dossiê parcial foi salvo (Ajustes > backup).');
      }
    } finally {
      App.rodando = false;
      if (App.timer) { clearInterval(App.timer); App.timer = null; }
      render();
    }
  }

  /** Carrega a grade do dia (API esportiva -> IA) e junta com o que ja existe. */
  async function atualizarJogos(dataISO, silencioso) {
    if (App.carregando) return;
    var dia = dataISO || App.data;
    if (!S.cfg.fdKey && !Motor.temChave()) {
      if (!silencioso) { UI.toast('Configure uma chave em Ajustes para carregar os jogos.', 'err'); nav('#/ajustes'); }
      return;
    }
    App.carregando = true;
    if (rota().nome === 'jogos') render();
    try {
      var r = await Fixtures.buscar(dia, function (m) { if (!silencioso) UI.toast(m); });
      var novos = Store.mergeJogos(r.jogos, dia);
      App.fonteJogos = r.fonte;
      S.meta.ultimaGrade = new Date().toISOString();
      Store.save();
      if (!silencioso || novos) {
        UI.toast(novos ? novos + ' jogo(s) carregado(s)' : 'Grade já estava atualizada', 'ok');
      }
    } catch (e) {
      if (!silencioso) UI.toast(e.message, 'err');
    } finally {
      App.carregando = false;
      render();
    }
  }

  function sheetAdd() {
    UI.sheet('<h3>Jogos do dia</h3>' +
      '<button class="sheet-opt" data-act="atualizar"><span class="ic">' + ICONS.globe + '</span>' +
      '<span><span class="tt">Atualizar grade do dia</span><br><span class="ds">Busca os jogos de ' + App.data + '</span></span></button>' +
      '<button class="sheet-opt" data-act="add-print"><span class="ic">' + ICONS.cam + '</span>' +
      '<span><span class="tt">Importar prints</span><br><span class="ds">A IA lê as fotos e monta a lista</span></span></button>' +
      '<button class="sheet-opt" data-act="add-manual"><span class="ic">' + ICONS.kbd + '</span>' +
      '<span><span class="tt">Digitar confronto</span><br><span class="ds">Liga, mandante, visitante e horário</span></span></button>' +
      '<button class="sheet-opt" data-act="limpar-dia"><span class="ic">' + ICONS.trash + '</span>' +
      '<span><span class="tt">Limpar jogos do dia</span><br><span class="ds">Remove jogos e análises de ' + App.data + '</span></span></button>');
  }

  function sheetManual() {
    UI.sheet('<h3>Novo confronto</h3>' +
      '<div class="field"><label>Campeonato</label><input class="input" id="fLiga" placeholder="Brasileirão Série A"></div>' +
      '<div class="field"><label>Mandante</label><input class="input" id="fMan" placeholder="Flamengo"></div>' +
      '<div class="field"><label>Visitante</label><input class="input" id="fVis" placeholder="Palmeiras"></div>' +
      '<div class="field"><label>Horário</label><input class="input" id="fHora" placeholder="21:30"></div>' +
      '<div class="field"><button class="btn" data-act="salvar-manual">Adicionar</button></div>');
  }

  async function importarPrints(files) {
    if (!files || !files.length) return;
    if (!Motor.temChave()) { UI.toast('Configure a chave do motor de IA em Ajustes.', 'err'); nav('#/ajustes'); return; }
    UI.closeSheet();
    UI.toast('Lendo ' + files.length + ' imagem(ns)...');
    try {
      var imgs = [];
      for (var i = 0; i < files.length && i < 6; i++) imgs.push(await comprimir(files[i]));
      var jogos = await API.lerPrints(imgs);
      if (!jogos.length) { UI.toast('Não encontrei jogos nas imagens.', 'err'); return; }
      jogos.forEach(function (j) { j.sel = true; j.fonte = 'print'; });
      var novos = Store.mergeJogos(jogos, App.data);
      Store.save();
      UI.toast(novos ? novos + ' jogo(s) importado(s)' : 'Esses jogos já estavam na lista', 'ok');
      nav('#/jogos'); render();
    } catch (e) {
      UI.toast(e.message, 'err');
    }
  }

  function comprimir(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error('Não consegui ler a imagem.')); };
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          var max = 1500;
          var r = Math.min(1, max / Math.max(img.width, img.height));
          var cv = document.createElement('canvas');
          cv.width = Math.round(img.width * r);
          cv.height = Math.round(img.height * r);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          var url = cv.toDataURL('image/jpeg', 0.82);
          resolve({ media_type: 'image/jpeg', data: url.split(',')[1] });
        };
        img.onerror = function () { reject(new Error('Formato de imagem não suportado.')); };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  async function aprender() {
    var itens = S.hist.filter(function (x) { return x.resultado !== 'pend' && !x.aprendido; });
    if (!itens.length) return;
    if (!Motor.temChave()) { UI.toast('Configure a chave do motor de IA em Ajustes.', 'err'); return; }
    UI.toast('Analisando o que deu certo e o que falhou...');
    try {
      var r = await API.aprender(itens);
      (r.licoes || []).forEach(function (l) {
        Store.addLicao(l.licao + (l.ajuste ? ' → ' + l.ajuste : ''), l.mercado, 'auto');
      });
      itens.forEach(function (x) { x.aprendido = true; });
      Store.save();
      UI.toast((r.licoes || []).length + ' lição(ões) na memória', 'ok');
      if (r.diagnostico) alert('Diagnóstico da rodada:\n\n' + r.diagnostico);
      render();
    } catch (e) {
      UI.toast(e.message, 'err');
    }
  }

  function registrarBilhete(i) {
    var b = S.bilhetes[i];
    if (!b) return;
    var total = Number(b.odd_total) || (b.selecoes || []).reduce(function (a, s) { return a * (Number(s.odd) || 1); }, 1);
    Store.registrar({
      tipo: 'bilhete', jogo: b.nome, mercado: 'Bilhete ' + (b.foco || ''),
      selecao: (b.selecoes || []).length + ' seleções', odd: total, stake: Number(S.cfg.stake) || 5
    });
    (b.selecoes || []).forEach(function (s) {
      Store.registrar({
        tipo: 'pick', jogo: s.jogo, mercado: normMercado(s.mercado),
        selecao: s.selecao, odd: Number(s.odd) || 0
      });
    });
    Store.save();
    UI.toast('Bilhete registrado. Confira o resultado no Placar.', 'ok');
    render();
  }

  /* ================= eventos ================= */

  function onClick(e) {
    if (!e.target || !e.target.closest) return;
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');
    var id = el.getAttribute('data-id') || '';

    if (act === 'ir') { nav('#/' + id); return; }
    if (act === 'filtro') { App.filtro = id; render(); return; }
    if (act === 'data') { App.data = id; render(); return; }
    if (act === 'aba') { App.aba = id; render(); return; }
    if (act === 'abrir') { App.aba = 'resumo'; nav('#/jogo/' + id); return; }

    if (act === 'sel') {
      e.stopPropagation();
      var j = S.jogos.find(function (x) { return x.id === id; });
      if (j) { j.sel = !j.sel; Store.save(); render(); }
      return;
    }
    if (act === 'fav') {
      e.stopPropagation();
      var f = S.jogos.find(function (x) { return x.id === id; });
      if (f) { f.fav = !f.fav; Store.save(); render(); }
      return;
    }
    if (act === 'pronto') {
      var sel = Store.jogosDoDia(App.data).filter(function (x) { return x.sel; });
      if (!sel.length) { UI.toast('Selecione pelo menos um jogo.', 'err'); return; }
      rodarAnalise(sel);
      return;
    }
    if (act === 'analisar-um') {
      var jg = S.jogos.find(function (x) { return x.id === id; });
      if (jg) rodarAnalise([jg]);
      return;
    }
    if (act === 'add') { sheetAdd(); return; }
    if (act === 'atualizar') { UI.closeSheet(); atualizarJogos(App.data, false); return; }
    if (act === 'todos-sel') {
      var doDia = Store.jogosDoDia(App.data);
      var marcar = doDia.some(function (x) { return !x.sel; });
      doDia.forEach(function (x) { x.sel = marcar; });
      Store.save(); render();
      return;
    }
    if (act === 'testar-fd') {
      var k = S.cfg.fdKey;
      if (!k) { UI.toast('Cole a chave primeiro.', 'err'); return; }
      UI.toast('Testando...');
      Fixtures.testarChave(k)
        .then(function () { UI.toast('Chave válida! Grade oficial liberada.', 'ok'); })
        .catch(function (err) { UI.toast(err.message, 'err'); });
      return;
    }
    if (act === 'add-manual') { sheetManual(); return; }
    if (act === 'add-print') { document.getElementById('filePick').click(); return; }
    if (act === 'salvar-manual') {
      var liga = val('fLiga'), man = val('fMan'), vis = val('fVis'), hora = val('fHora');
      if (!man || !vis) { UI.toast('Informe os dois times.', 'err'); return; }
      Store.addJogo({ liga: liga || 'Outros', mandante: man, visitante: vis, hora: hora, data: App.data, sel: true });
      Store.save(); UI.closeSheet(); UI.toast('Jogo adicionado', 'ok'); render();
      return;
    }
    if (act === 'limpar-dia') {
      if (UI.confirmar('Remover todos os jogos e análises de ' + App.data + '?')) {
        Store.limparDia(App.data); Store.save(); UI.closeSheet(); render();
      }
      return;
    }
    if (act === 'reg-bilhete') { registrarBilhete(Number(id)); return; }
    if (act === 'reg-pick') {
      var parts = id.split(':');
      var a = S.analises[parts[0]];
      var p = a && a.palpites[Number(parts[1])];
      if (p) {
        Store.registrar({
          tipo: 'pick', jogo: a.mandante + ' x ' + a.visitante, mercado: normMercado(p.mercado),
          selecao: p.selecao, odd: Number(p.odd) || 0
        });
        Store.save(); UI.toast('Registrado no Placar', 'ok'); render();
      }
      return;
    }
    if (act === 'res') {
      var pr = id.split(':');
      var motivo = '';
      if (pr[1] === 'red') motivo = prompt('O que aconteceu? (ex.: expulsão aos 20min, gol no fim)') || '';
      Store.setResultado(pr[0], pr[1], motivo);
      Store.save(); render();
      return;
    }
    if (act === 'del-hist') {
      S.hist = S.hist.filter(function (x) { return x.id !== id; });
      Store.save(); render();
      return;
    }
    if (act === 'aprender') { aprender(); return; }
    if (act === 'toggle') { S.cfg[id] = !S.cfg[id]; Store.save(); render(); return; }
    if (act === 'motor') {
      S.cfg.provider = id;
      if (id === 'deepseek' && (S.cfg.effort === 'xhigh' || S.cfg.effort === 'max')) S.cfg.effort = 'high';
      Store.save(); render();
      UI.toast('Motor: ' + (id === 'claude' ? 'Claude' : 'DeepSeek'), 'ok');
      return;
    }
    if (act === 'testar') {
      UI.toast('Testando...');
      API.testarChave().then(function () { UI.toast('Conexão OK', 'ok'); })
        .catch(function (err) { UI.toast(err.message, 'err'); });
      return;
    }
    if (act === 'reset-prompt') {
      S.cfg.prompt = Store.PROMPT_MESTRE; Store.save(); render();
      UI.toast('Prompt restaurado', 'ok');
      return;
    }
    if (act === 'add-licao') {
      var t = val('novaLicao');
      if (!t) return;
      Store.addLicao(t, 'geral', 'manual'); Store.save(); render();
      return;
    }
    if (act === 'del-licao') { Store.removeLicao(id); Store.save(); render(); return; }
    if (act === 'exportar') { exportar(); return; }
    if (act === 'limpar-tudo') {
      if (UI.confirmar('Apagar jogos, análises, bilhetes e histórico? (a chave e a memória de aprendizado são mantidas)')) {
        var mem = S.memoria.slice();
        Store.reset();
        Store.state.memoria = mem;
        Store.save();
        nav('#/jogos'); render();
      }
      return;
    }
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function exportar() {
    var blob = new Blob([JSON.stringify(Store.state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'green-backup-' + Store.hoje() + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  function onChange(e) {
    if (!e.target || !e.target.closest) return;
    var el = e.target.closest('[data-cfg]');
    if (!el) return;
    var k = el.getAttribute('data-cfg');
    var v = el.value;
    if (k === 'stake' || k === 'alvo') v = Number(v) || (k === 'stake' ? 5 : 20);
    S.cfg[k] = v;
    Store.save();
  }

  /* ================= boot ================= */

  function boot() {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true; inp.id = 'filePick';
    inp.style.display = 'none';
    inp.addEventListener('change', function () { importarPrints(inp.files); inp.value = ''; });
    document.body.appendChild(inp);

    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('input', function (e) {
      if (e.target.matches('textarea[data-cfg]')) onChange(e);
    });

    document.getElementById('btnBack').addEventListener('click', function () { history.back(); });
    document.getElementById('btnHeaderAction').addEventListener('click', function () {
      var r = rota().nome;
      if (r === 'jogos') sheetAdd();
      else nav('#/jogos');
    });

    global.addEventListener('hashchange', render);
    if (!location.hash) location.hash = '#/jogos';
    render();

    /* Android: barra de status, splash e botao voltar */
    if (global.Native) {
      Native.setup(function () {
        if (rota().nome === 'jogo') { history.back(); return true; }
        if (rota().nome !== 'jogos') { nav('#/jogos'); return true; }
        return false;   // na tela inicial, deixa o Android fechar o app
      });
    }

    if ('serviceWorker' in navigator && navigator.serviceWorker &&
      location.protocol !== 'file:' && !(global.Native && Native.isNative())) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }

    if (!Motor.temChave() && !S.cfg.onboarded) {
      S.cfg.onboarded = true; Store.save();
      setTimeout(function () {
        UI.toast('Comece configurando as chaves em Ajustes.');
      }, 700);
    }

    /* grade do dia sozinha ao abrir */
    if (S.cfg.autoLoad && !Store.jogosDoDia(App.data).length) {
      setTimeout(function () { atualizarJogos(App.data, true); }, 400);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  global.App = App;
})(window);
