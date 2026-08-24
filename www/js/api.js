/* ============================================================
   GREEN - pipeline de analise
   1) dados reais da API esportiva -> 2) raciocinio da IA -> 3) JSON das telas
   Funciona com DeepSeek (padrao) ou Claude, via js/motor.js
   ============================================================ */
(function (global) {
  'use strict';

  /* ================= schemas (usados quando o motor aceita schema) ================= */

  var S_ANALISE = {
    type: 'object',
    properties: {
      jogos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            liga: { type: 'string' },
            mandante: { type: 'string' },
            visitante: { type: 'string' },
            hora: { type: 'string' },
            veredito: { type: 'string' },
            confianca: { type: 'integer' },
            forma_mandante: { type: 'string' },
            forma_visitante: { type: 'string' },
            ultimos5_mandante: { type: 'string' },
            ultimos5_visitante: { type: 'string' },
            h2h: { type: 'string' },
            desfalques_mandante: { type: 'string' },
            desfalques_visitante: { type: 'string' },
            escalacoes: { type: 'string' },
            contexto: { type: 'string' },
            media_escanteios: { type: 'string' },
            media_cartoes: { type: 'string' },
            btts_pct: { type: 'integer' },
            over15_pct: { type: 'integer' },
            over25_pct: { type: 'integer' },
            alertas: { type: 'array', items: { type: 'string' } },
            palpites: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  mercado: { type: 'string' },
                  selecao: { type: 'string' },
                  odd: { type: 'number' },
                  confianca: { type: 'integer' },
                  risco: { type: 'string', enum: ['baixo', 'medio', 'alto'] },
                  justificativa: { type: 'string' }
                },
                required: ['mercado', 'selecao', 'odd', 'confianca', 'risco', 'justificativa'],
                additionalProperties: false
              }
            }
          },
          required: ['id', 'liga', 'mandante', 'visitante', 'hora', 'veredito', 'confianca',
            'forma_mandante', 'forma_visitante', 'ultimos5_mandante', 'ultimos5_visitante',
            'h2h', 'desfalques_mandante', 'desfalques_visitante', 'escalacoes', 'contexto',
            'media_escanteios', 'media_cartoes', 'btts_pct', 'over15_pct', 'over25_pct',
            'alertas', 'palpites'],
          additionalProperties: false
        }
      },
      bilhetes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            nome: { type: 'string' },
            foco: { type: 'string' },
            risco: { type: 'string', enum: ['baixo', 'medio', 'alto'] },
            odd_total: { type: 'number' },
            selecoes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  jogo: { type: 'string' },
                  mercado: { type: 'string' },
                  selecao: { type: 'string' },
                  odd: { type: 'number' },
                  confianca: { type: 'integer' }
                },
                required: ['jogo', 'mercado', 'selecao', 'odd', 'confianca'],
                additionalProperties: false
              }
            }
          },
          required: ['nome', 'foco', 'risco', 'odd_total', 'selecoes'],
          additionalProperties: false
        }
      },
      observacoes: { type: 'string' }
    },
    required: ['jogos', 'bilhetes', 'observacoes'],
    additionalProperties: false
  };

  var S_JOGOS = {
    type: 'object',
    properties: {
      jogos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            liga: { type: 'string' },
            mandante: { type: 'string' },
            visitante: { type: 'string' },
            hora: { type: 'string' }
          },
          required: ['liga', 'mandante', 'visitante', 'hora'],
          additionalProperties: false
        }
      }
    },
    required: ['jogos'],
    additionalProperties: false
  };

  var S_LICOES = {
    type: 'object',
    properties: {
      licoes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            mercado: { type: 'string' },
            licao: { type: 'string' },
            ajuste: { type: 'string' }
          },
          required: ['mercado', 'licao', 'ajuste'],
          additionalProperties: false
        }
      },
      diagnostico: { type: 'string' }
    },
    required: ['licoes', 'diagnostico'],
    additionalProperties: false
  };

  function nl(n) { return String.fromCharCode(10).repeat(n || 1); }

  /* ================= exemplos de json (motores sem schema) ================= */

  var EX_ANALISE = [
    '{',
    '  "jogos": [{',
    '    "id": "abc123", "liga": "Brasileirao Serie A", "mandante": "Flamengo", "visitante": "Palmeiras",',
    '    "hora": "21:30", "veredito": "Jogo truncado, tendencia de poucos gols.", "confianca": 72,',
    '    "forma_mandante": "3 vitorias seguidas em casa", "forma_visitante": "oscilando fora",',
    '    "ultimos5_mandante": "V V E V D", "ultimos5_visitante": "D V V E V",',
    '    "h2h": "3 dos ultimos 5 terminaram empatados",',
    '    "desfalques_mandante": "sem dado confiavel", "desfalques_visitante": "sem dado confiavel",',
    '    "escalacoes": "sem dado confiavel", "contexto": "briga direta pelo titulo",',
    '    "media_escanteios": "9,2 por jogo", "media_cartoes": "5,1 por jogo",',
    '    "btts_pct": 55, "over15_pct": 82, "over25_pct": 48,',
    '    "alertas": ["arbitro caseiro"],',
    '    "palpites": [{ "mercado": "Gols", "selecao": "Over 1.5", "odd": 1.35, "confianca": 84,',
    '      "risco": "baixo", "justificativa": "os dois marcaram em 8 dos ultimos 10" }]',
    '  }],',
    '  "bilhetes": [{ "nome": "Bilhete 1 - Gols", "foco": "Gols e Ambas Marcam", "risco": "medio",',
    '    "odd_total": 19.8, "selecoes": [{ "jogo": "Flamengo x Palmeiras", "mercado": "Gols",',
    '    "selecao": "Over 1.5", "odd": 1.35, "confianca": 84 }] }],',
    '  "observacoes": "rodada com poucos favoritos claros"',
    '}'
  ].join(nl(1));

  var EX_JOGOS = '{ "jogos": [{ "liga": "Brasileirao Serie A", "mandante": "Flamengo", ' +
    '"visitante": "Palmeiras", "hora": "21:30" }] }';

  var EX_LICOES = '{ "licoes": [{ "mercado": "Gols", "licao": "evitar over 2.5 em mata-mata fora de casa", ' +
    '"ajuste": "exigir 3 dos ultimos 5 com over" }], "diagnostico": "rodada perdida por excesso de risco" }';

  var SEM = 'sem dado confiavel';

  /* ================= prompts ================= */

  function dataExtenso() {
    try {
      return new Date().toLocaleDateString('pt-BR', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
      });
    } catch (_) { return Store.hoje(); }
  }

  function systemAnalise(temDados) {
    var cfg = Store.state.cfg;
    var mem = Store.memoriaTexto();
    var s = cfg.prompt + nl(2);
    s += 'DATA DE HOJE: ' + dataExtenso() + ' (fuso de Brasilia).' + nl(1);

    if (temDados) {
      s += 'Voce vai receber DADOS REAIS de uma base esportiva (forma recente com placares, ' +
        'classificacao e confronto direto). Baseie a analise NESSES numeros e cite-os.' + nl(1);
    }
    if (Motor.temBuscaWeb()) {
      s += 'Voce tambem tem busca na web: use para desfalques, escalacoes provaveis e odds de hoje.' + nl(1);
    } else {
      s += 'Voce NAO tem acesso a internet nesta execucao. Para desfalques, escalacoes e odds exatas ' +
        'escreva "' + SEM + '" em vez de inventar, e reduza a confianca quando a informacao que falta ' +
        'for decisiva. Nunca afirme lesao, suspensao ou escalacao como fato sem ter recebido isso nos dados.' + nl(1);
    }

    if (mem) {
      s += nl(1) + 'LICOES APRENDIDAS EM RODADAS ANTERIORES (criterio obrigatorio, vieram de erros reais):' +
        nl(1) + mem + nl(1);
    }
    var st = Store.stats();
    if (st.total.g + st.total.r >= 5) {
      s += nl(1) + 'DESEMPENHO REAL DESTE USUARIO POR MERCADO:' + nl(1) +
        st.mercados.slice(0, 8).map(function (m) {
          return '- ' + m.mercado + ': ' + m.taxa + '% (' + m.g + 'G/' + m.r + 'R)';
        }).join(nl(1)) +
        nl(1) + 'Prefira os mercados com melhor historico e desconfie dos piores.' + nl(1);
    }
    return s;
  }

  function userAnalise(jogos, dados) {
    var cfg = Store.state.cfg;
    var lista = jogos.map(function (j, i) {
      return (i + 1) + ') [' + j.id + '] ' + j.liga + ' - ' + j.mandante + ' x ' + j.visitante +
        (j.hora ? ' as ' + j.hora : '');
    }).join(nl(1));

    var s = 'PRONTO. Analise os jogos de hoje:' + nl(2) + lista + nl(2);
    if (dados) s += 'DADOS REAIS DA BASE ESPORTIVA:' + nl(1) + dados + nl(2);
    s += 'Produza um DOSSIE em portugues, jogo a jogo, cobrindo: momento e ultimos 5 com placares, ' +
      'confronto direto, desfalques e escalacoes (ou "' + SEM + '"), contexto e importancia, ' +
      'e metricas (escanteios, cartoes, ambas marcam, over 1.5 e 2.5).' + nl(1) +
      'Depois os palpites de BAIXO RISCO de cada jogo, com odd estimada e confianca de 0 a 100.' + nl(2) +
      'Por fim monte os 3 bilhetes (stake ' + cfg.moeda + ' ' + cfg.stake + ', odd total alvo ~' + cfg.alvo + '):' + nl(1) +
      'Bilhete 1 = Gols/Ambas Marcam | Bilhete 2 = Dupla Chance/Empate Anula | Bilhete 3 = Misto (maior confianca).' + nl(1) +
      'REGRA DURA DOS BILHETES: no maximo UMA selecao por jogo em cada bilhete. ' +
      'A casa de aposta nao aceita duas selecoes do mesmo jogo na mesma multipla, e ' +
      '"Dupla Chance 1X" com "Empate Anula" do mesmo time e a mesma aposta repetida.' + nl(1) +
      'Se nao der para chegar na odd alvo com seguranca, entregue a odd possivel e avise ' +
      'que seria preciso mais jogos para chegar no alvo.';
    return s;
  }

  /* ================= normalizacao ================= */

  function txt(v, padrao) {
    if (v === null || v === undefined) return padrao || '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) return v.map(function (x) { return txt(x); }).join(' | ');
    try { return JSON.stringify(v); } catch (_) { return padrao || ''; }
  }

  function inteiro(v, padrao) {
    var n = parseFloat(String(v).replace(',', '.').replace(/[^0-9.]/g, ''));
    if (isNaN(n)) return padrao === undefined ? 0 : padrao;
    // alguns modelos devolvem confianca em escala 0-1 (ex.: 0.78 = 78%)
    if (n > 0 && n <= 1) n = n * 100;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function numero(v, padrao) {
    var n = parseFloat(String(v).replace(',', '.').replace(/[^0-9.]/g, ''));
    if (isNaN(n) || n <= 0) return padrao === undefined ? 0 : padrao;
    return n;
  }

  function risco(v) {
    var s = String(v || '').toLowerCase();
    if (s.indexOf('baix') === 0 || s === 'low') return 'baixo';
    if (s.indexOf('alt') === 0 || s === 'high') return 'alto';
    return 'medio';
  }

  /**
   * Casa de aposta nao aceita (ou recalcula) duas selecoes do mesmo jogo na mesma
   * multipla - e "Dupla Chance 1X" + "Empate Anula" e a mesma aposta duas vezes.
   * Mantem so a de maior confianca por jogo.
   */
  function umaPorJogo(sels) {
    var porJogo = {};
    sels.forEach(function (s) {
      var k = String(s.jogo || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!porJogo[k] || s.confianca > porJogo[k].confianca) porJogo[k] = s;
    });
    return Object.keys(porJogo).map(function (k) { return porJogo[k]; });
  }

  function normalizaAnalise(bruto, jogos) {
    var d = bruto || {};
    var porId = {};
    jogos.forEach(function (j) { porId[j.id] = j; });

    var out = [];
    (Array.isArray(d.jogos) ? d.jogos : []).forEach(function (a, i) {
      a = a || {};
      var ref = porId[a.id] || jogos[i];
      if (!ref) return;
      out.push({
        id: ref.id,
        liga: txt(a.liga, ref.liga) || ref.liga,
        mandante: txt(a.mandante, ref.mandante) || ref.mandante,
        visitante: txt(a.visitante, ref.visitante) || ref.visitante,
        hora: txt(a.hora, ref.hora) || ref.hora,
        veredito: txt(a.veredito, SEM),
        confianca: inteiro(a.confianca, 50),
        forma_mandante: txt(a.forma_mandante, SEM),
        forma_visitante: txt(a.forma_visitante, SEM),
        ultimos5_mandante: txt(a.ultimos5_mandante, SEM),
        ultimos5_visitante: txt(a.ultimos5_visitante, SEM),
        h2h: txt(a.h2h, SEM),
        desfalques_mandante: txt(a.desfalques_mandante, SEM),
        desfalques_visitante: txt(a.desfalques_visitante, SEM),
        escalacoes: txt(a.escalacoes, SEM),
        contexto: txt(a.contexto, SEM),
        media_escanteios: txt(a.media_escanteios, SEM),
        media_cartoes: txt(a.media_cartoes, SEM),
        btts_pct: inteiro(a.btts_pct, 0),
        over15_pct: inteiro(a.over15_pct, 0),
        over25_pct: inteiro(a.over25_pct, 0),
        alertas: (Array.isArray(a.alertas) ? a.alertas : []).map(function (x) { return txt(x); }).filter(Boolean),
        palpites: (Array.isArray(a.palpites) ? a.palpites : []).map(function (p) {
          p = p || {};
          return {
            mercado: txt(p.mercado, 'Outros'),
            selecao: txt(p.selecao, ''),
            odd: numero(p.odd, 1.5),
            confianca: inteiro(p.confianca, 50),
            risco: risco(p.risco),
            justificativa: txt(p.justificativa, '')
          };
        }).filter(function (p) { return p.selecao; })
      });
    });

    var bilhetes = (Array.isArray(d.bilhetes) ? d.bilhetes : []).map(function (b, i) {
      b = b || {};
      var sels = (Array.isArray(b.selecoes) ? b.selecoes : []).map(function (s) {
        s = s || {};
        return {
          jogo: txt(s.jogo, ''),
          mercado: txt(s.mercado, 'Outros'),
          selecao: txt(s.selecao, ''),
          odd: numero(s.odd, 1.5),
          confianca: inteiro(s.confianca, 50)
        };
      }).filter(function (s) { return s.selecao; });

      sels = umaPorJogo(sels);
      var prod = sels.reduce(function (acc, s) { return acc * s.odd; }, 1);
      return {
        nome: txt(b.nome, 'Bilhete ' + (i + 1)),
        foco: txt(b.foco, ''),
        risco: risco(b.risco),
        // a odd tem que bater com as selecoes que sobraram
        odd_total: Number(prod.toFixed(2)),
        selecoes: sels
      };
    }).filter(function (b) { return b.selecoes.length; });

    return { jogos: out, bilhetes: bilhetes, observacoes: txt(d.observacoes, '') };
  }

  /* ================= operacoes ================= */

  async function analisar(jogos, onEvent) {
    onEvent('info', 'Motor: ' + Motor.nomeAmigavel());

    /* 1) dados duros da base esportiva */
    var dados = '';
    try {
      dados = await Stats.dossie(jogos, function (m) { onEvent('dados', m); });
      if (dados) onEvent('resultado', 'estatísticas reais coletadas');
      else onEvent('info', 'Sem chave da API esportiva: seguindo só com o raciocínio da IA.');
    } catch (e) {
      onEvent('info', 'Dados esportivos indisponíveis (' + e.message + ').');
    }

    /* 2) dossie analitico */
    onEvent('info', 'Analisando ' + jogos.length + ' jogo(s)...');
    var dossie = await Motor.texto({
      system: systemAnalise(!!dados),
      user: userAnalise(jogos, dados),
      maxTokens: 32000,
      buscaWeb: true,
      onEvent: onEvent,
      timeout: 900000
    });
    dossie = (dossie || '').trim();
    if (!dossie) throw new Error('A análise voltou vazia. Tente de novo.');

    /* 3) estruturacao para as telas */
    onEvent('info', 'Montando bilhetes...');
    var refs = jogos.map(function (j) {
      return '[' + j.id + '] ' + j.liga + ' | ' + j.mandante + ' x ' + j.visitante + ' | ' + (j.hora || 's/ horario');
    }).join(nl(1));

    var bruto = await Motor.json({
      system: 'Voce converte um dossie de analise esportiva em json estruturado. ' +
        'Nao invente nada fora do dossie: se faltar dado escreva "' + SEM + '". ' +
        'Use exatamente os ids informados. confianca e inteiro de 0 a 100 (nunca de 0 a 1). ' +
        'odd_total do bilhete e o produto das odds das selecoes. ' +
        'Cada bilhete pode ter no maximo UMA selecao por jogo.',
      user: 'IDS DOS JOGOS:' + nl(1) + refs + nl(2) + 'DOSSIE:' + nl(1) + dossie + nl(2) +
        'Converta em json com TODOS os jogos e os 3 bilhetes.',
      exemplo: EX_ANALISE,
      schema: S_ANALISE,
      maxTokens: 32000,
      effort: 'medium',
      timeout: 900000
    });

    var finais = normalizaAnalise(bruto, jogos);
    if (!finais.jogos.length) throw new Error('Não consegui estruturar a análise. O dossiê foi salvo.');
    return { dados: finais, dossie: dossie };
  }

  async function lerPrints(imagens) {
    var d = await Motor.json({
      system: 'Voce extrai jogos de futebol de prints de tela.',
      user: 'Extraia TODOS os jogos visiveis nestas imagens: campeonato (liga), mandante, visitante ' +
        'e horario HH:MM. Se o campeonato nao aparecer use "Outros"; se o horario nao aparecer deixe vazio. ' +
        'Nao invente jogos.',
      images: imagens,
      exemplo: EX_JOGOS,
      schema: S_JOGOS,
      maxTokens: 8000,
      effort: 'low',
      timeout: 300000
    });
    return (d && Array.isArray(d.jogos))
      ? d.jogos.filter(function (j) { return j && j.mandante && j.visitante; })
      : [];
  }

  async function aprender(itens) {
    var linhas = itens.map(function (h) {
      return '- ' + (h.resultado === 'green' ? 'GREEN' : 'RED') + ' | ' + (h.jogo || h.tipo) +
        ' | ' + h.mercado + ': ' + h.selecao + ' @' + (h.odd || '-') +
        (h.motivo ? ' | o que aconteceu: ' + h.motivo : '');
    }).join(nl(1));

    var d = await Motor.json({
      system: 'Voce faz post-mortem de apostas. Seja duro e objetivo. Cada licao deve ser um criterio ' +
        'pratico e acionavel para as proximas analises. Nada de conselho generico como "analisar melhor".',
      user: 'Resultado da rodada:' + nl(1) + linhas + nl(2) +
        'Memoria atual:' + nl(1) + (Store.memoriaTexto() || '(vazia)') + nl(2) +
        'Gere no maximo 5 licoes novas (sem repetir as existentes) e um diagnostico curto.',
      exemplo: EX_LICOES,
      schema: S_LICOES,
      maxTokens: 8000,
      effort: 'medium',
      timeout: 300000
    });
    return {
      licoes: (d && Array.isArray(d.licoes)) ? d.licoes : [],
      diagnostico: (d && txt(d.diagnostico)) || ''
    };
  }

  async function jogosDoDia(dataISO) {
    var pedido = 'Liste os jogos de futebol do dia ' + dataISO + ' (horario de Brasilia) dos principais ' +
      'campeonatos: Brasileirao Serie A e B, Copa do Brasil, Libertadores, Sul-Americana, Champions League, ' +
      'Premier League, La Liga, Serie A italiana, Bundesliga, Ligue 1 e Primeira Liga. ' +
      'Para cada jogo: campeonato, mandante, visitante e horario HH:MM.';

    if (Motor.temBuscaWeb()) {
      var lista = await Motor.texto({
        system: 'Voce lista jogos de futebol usando busca na web. So liste partidas confirmadas em fonte ' +
          'confiavel (ge.globo, sofascore, flashscore, espn). Nao invente jogos nem horarios.',
        user: pedido + ' Uma linha por jogo.',
        maxTokens: 12000,
        effort: 'low',
        buscaWeb: true,
        timeout: 420000
      });
      if (!lista) return [];
      var d1 = await Motor.json({
        system: 'Converta a lista de jogos em json. Nao adicione jogos que nao estejam na lista.',
        user: lista,
        exemplo: EX_JOGOS,
        schema: S_JOGOS,
        maxTokens: 12000,
        effort: 'low',
        timeout: 300000
      });
      return (d1 && d1.jogos) || [];
    }

    var d2 = await Motor.json({
      system: 'Voce lista jogos de futebol. Sem acesso a internet, liste apenas o que souber com seguranca ' +
        'razoavel e nunca invente horario preciso: se nao souber, deixe vazio.',
      user: pedido,
      exemplo: EX_JOGOS,
      schema: S_JOGOS,
      maxTokens: 12000,
      effort: 'low',
      timeout: 300000
    });
    return (d2 && d2.jogos) || [];
  }

  global.API = {
    analisar: analisar,
    lerPrints: lerPrints,
    aprender: aprender,
    jogosDoDia: jogosDoDia,
    testarChave: function () { return Motor.testar(); }
  };
})(window);
