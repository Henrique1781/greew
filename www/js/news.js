/* ============================================================
   GREEN - noticias de futebol
   Fonte: RSS publico dos principais portais (gratis, sem chave).
   ============================================================ */
(function (global) {
  'use strict';

  var FONTES = [
    { id: 'ge', nome: 'ge.globo', url: 'https://pox.globo.com/rss/ge/futebol' },
    { id: 'gazeta', nome: 'Gazeta Esportiva', url: 'https://www.gazetaesportiva.com/feed/' },
    { id: 'torcedores', nome: 'Torcedores', url: 'https://www.torcedores.com/feed' },
    { id: 'trivela', nome: 'Trivela', url: 'https://trivela.com.br/feed/' },
    { id: 'uol', nome: 'UOL', url: 'https://rss.uol.com.br/feed/esporte.xml' }
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

  function valida(u) {
    if (!u || !/^https?:\/\//i.test(u)) return '';
    if (!/\.(jpe?g|png|webp|avif)(\?|$)/i.test(u) && u.indexOf('glbimg') < 0 &&
      u.indexOf('espncdn') < 0 && u.indexOf('/image') < 0) {
      /* sem extensao conhecida: aceita mesmo assim, mas descarta icone/pixel */
      if (/1x1|spacer|pixel|blank|logo\.|favicon/i.test(u)) return '';
    }
    return u;
  }

  /** procura a capa em todos os lugares que os portais costumam usar */
  function imagemDe(item) {
    var tags = ['media:content', 'media:thumbnail', 'enclosure', 'image', 'itunes:image'];
    for (var i = 0; i < tags.length; i++) {
      var nos = item.getElementsByTagName(tags[i]);
      for (var k = 0; k < nos.length; k++) {
        var n = nos[k];
        if (!n.getAttribute) continue;
        var u = valida(n.getAttribute('url') || n.getAttribute('href') || '');
        if (u) return u;
      }
    }
    /* dentro do texto: <img src="..."> na descricao ou no conteudo completo */
    var corpo = texto(item, 'description') + ' ' +
      texto(item, 'content:encoded') + ' ' + texto(item, 'encoded') + ' ' + texto(item, 'content');
    var img = /<img[^>]+src=["']([^"']+)["']/i.exec(corpo);
    if (img) {
      var u2 = valida(img[1]);
      if (u2) return u2;
    }
    var solta = /(https?:\/\/[^\s"'<>]+\.(?:jpe?g|png|webp))/i.exec(corpo);
    return solta ? valida(solta[1]) : '';
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
        imagem: imagemDe(it),
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
      /* so entra noticia com capa: sem imagem o card fica feio e vazio */
      .filter(function (n) { return !!n.imagem; })
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
