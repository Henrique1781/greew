/* ============================================================
   GREEN - noticias de futebol
   Fonte: RSS publico dos principais portais (gratis, sem chave).
   ============================================================ */
(function (global) {
  'use strict';

  var FONTES = [
    { id: 'ge', nome: 'ge.globo', url: 'https://pox.globo.com/rss/ge/futebol' },
    { id: 'espn', nome: 'ESPN', url: 'https://www.espn.com.br/rss/futebol/' },
    { id: 'gazeta', nome: 'Gazeta Esportiva', url: 'https://www.gazetaesportiva.com/feed/' },
    { id: 'uol', nome: 'UOL', url: 'https://rss.uol.com.br/feed/esporte.xml' },
    { id: 'trivela', nome: 'Trivela', url: 'https://trivela.com.br/feed/' }
  ];

  var cache = { itens: [], em: 0, erro: '' };
  var VALIDADE = 10 * 60 * 1000;   // 10 minutos

  function texto(el, tag) {
    var n = el.getElementsByTagName(tag)[0];
    return n ? (n.textContent || '').trim() : '';
  }

  function limpaHtml(s) {
    return String(s || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function imagemDe(item, xml) {
    var m = item.getElementsByTagName('media:content')[0] ||
      item.getElementsByTagName('content')[0] ||
      item.getElementsByTagName('enclosure')[0] ||
      item.getElementsByTagName('media:thumbnail')[0];
    if (m && m.getAttribute) {
      var u = m.getAttribute('url');
      if (u && /^https?:/.test(u)) return u;
    }
    var desc = texto(item, 'description') + texto(item, 'encoded');
    var img = /<img[^>]+src=["']([^"']+)["']/i.exec(desc);
    return img ? img[1] : '';
  }

  function parseRSS(xmlStr, fonte) {
    var doc = new DOMParser().parseFromString(xmlStr, 'text/xml');
    var itens = doc.getElementsByTagName('item');
    var out = [];
    for (var i = 0; i < itens.length && i < 25; i++) {
      var it = itens[i];
      var titulo = limpaHtml(texto(it, 'title'));
      if (!titulo) continue;
      var link = texto(it, 'link') || (it.getElementsByTagName('guid')[0] || {}).textContent || '';
      var data = texto(it, 'pubDate') || texto(it, 'published') || '';
      /* o ge.globo manda um resumo bom em atom:subtitle; os outros so tem description */
      var resumo = limpaHtml(texto(it, 'subtitle')) || limpaHtml(texto(it, 'description'));
      out.push({
        titulo: titulo,
        resumo: resumo.slice(0, 240),
        link: String(link).trim(),
        imagem: imagemDe(it, doc),
        fonte: fonte.nome,
        fonteId: fonte.id,
        ts: data ? (new Date(data).getTime() || 0) : 0
      });
    }
    return out;
  }

  function relevante(n) {
    /* os feeds gerais (UOL) trazem outros esportes: filtramos por assunto */
    if (n.fonteId !== 'uol') return true;
    return /futebol|brasileir|libertadores|copa|gol|t[ée]cnico|clube|s[ée]rie a|champions|zagueir|atacante|volante|escala/i
      .test(n.titulo + ' ' + n.resumo);
  }

  /** Busca as noticias (com cache de 10 min). onLog opcional. */
  async function buscar(forcar, onLog) {
    if (!forcar && cache.itens.length && (Date.now() - cache.em) < VALIDADE) return cache.itens;

    var todas = [];
    var falhas = 0;
    for (var i = 0; i < FONTES.length; i++) {
      var f = FONTES[i];
      try {
        if (onLog) onLog(f.nome);
        var xml = await Native.getTexto(f.url);
        todas = todas.concat(parseRSS(xml, f));
      } catch (_) {
        falhas++;
      }
    }

    var vistos = {};
    var itens = todas
      .filter(relevante)
      .filter(function (n) {
        var k = n.titulo.toLowerCase().slice(0, 60);
        if (vistos[k]) return false;
        vistos[k] = 1;
        return true;
      })
      .sort(function (a, b) { return b.ts - a.ts; })
      .slice(0, 80);

    if (!itens.length) {
      cache.erro = falhas === FONTES.length ? 'Não consegui acessar os portais de notícia.' : '';
      if (cache.erro) throw new Error(cache.erro);
    }
    cache.itens = itens;
    cache.em = Date.now();
    cache.erro = '';
    return itens;
  }

  function quando(ts) {
    if (!ts) return '';
    var min = Math.round((Date.now() - ts) / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return min + ' min';
    var h = Math.round(min / 60);
    if (h < 24) return h + 'h';
    return Math.round(h / 24) + 'd';
  }

  global.News = { buscar: buscar, quando: quando, FONTES: FONTES, cache: cache };
})(window);
