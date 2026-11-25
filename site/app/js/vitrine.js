/* Projeto Trid · vitrine pública (vitrine.html?loja=<endereço>). Sem login.
   Lê pela função projetotrid_showcase (só peças marcadas: nome, material, cor, preço, descrição e foto).
   "Quero uma igual" abre o WhatsApp da loja; nada é gravado pelo visitante. */
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.ProjetoTridVitrineNucleo = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const slugValido = (s) => /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/.test(String(s || ''));
  const paraSlug = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  const pedido = (loja, peca) => `Olá${loja ? `, ${loja}` : ''}! Vi na vitrine: ${peca.name}${peca.color ? ` (${peca.color})` : ''}. Quero uma igual. Pode me passar o orçamento?`;
  const fotoUrl = (base, caminho) => (caminho ? `${base}/storage/v1/object/public/projetotrid-vitrine/${caminho.split('/').map(encodeURIComponent).join('/')}` : '');
  return { slugValido, paraSlug, pedido, fotoUrl };
});

(() => {
  if (typeof document === 'undefined') return;
  const $ = (id) => document.getElementById(id), V = window.ProjetoTridVitrineNucleo;
  if (!$('vitMain')) return;
  const loja = new URLSearchParams(location.search).get('loja') || '';
  const real = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const backend = window.SITE_BACKEND, cliente = window.supabase?.createClient(backend.url, backend.key, { auth: { persistSession: false, autoRefreshToken: false } });

  function aviso(titulo, texto) { $('vitTitle').textContent = titulo; $('vitIntro').textContent = texto; }

  async function carregar() {
    if (!cliente) return aviso('Não foi possível abrir', 'Atualize a página para tentar de novo.');
    if (!V.slugValido(loja)) return aviso('Vitrine não encontrada', 'Confira o endereço da vitrine.');
    const { data: v, error } = await cliente.rpc('projetotrid_showcase', { p_slug: loja });
    if (error) return aviso('Não foi possível abrir', 'Verifique sua conexão e atualize a página.');
    if (!v) return aviso('Vitrine não encontrada', 'Ela pode estar desativada. Confira o endereço com a loja.');
    document.title = `${v.name || 'Vitrine'} | Projeto Trid`;
    $('vitTitle').textContent = v.name || 'Vitrine';
    $('vitIntro').textContent = v.intro || 'Peças impressas em 3D sob encomenda.';
    const grade = $('vitGrid');
    grade.replaceChildren();
    if (!v.items.length) { grade.append(el('p', 'vit-vazio', 'Nenhuma peça na vitrine por enquanto.')); return; }
    for (const p of v.items) {
      const card = el('article', 'vit-card'), foto = el('div', 'vit-foto');
      const url = V.fotoUrl(backend.url, p.photo_path);
      if (url) { const img = el('img'); img.src = url; img.alt = p.name; img.loading = 'lazy'; foto.append(img); }
      else { foto.classList.add('sem-foto'); foto.innerHTML = '<svg class="icon" aria-hidden="true" viewBox="0 -960 960 960"><path d="M480-80 120-280v-400l360-200 360 200v400L480-80Zm0-92 280-156v-284L480-768 200-612v284l280 156Z"/></svg>'; }
      const corpo = el('div', 'vit-corpo');
      corpo.append(el('h2', '', p.name), el('small', '', [p.material, p.color].filter(Boolean).join(' · ')));
      if (p.text) corpo.append(el('p', '', p.text));
      if (p.price != null) corpo.append(el('strong', 'vit-preco', `A partir de ${real.format(Number(p.price))}`));
      const wa = v.whatsapp ? `https://wa.me/${v.whatsapp.length <= 11 ? '55' + v.whatsapp : v.whatsapp}?text=${encodeURIComponent(V.pedido(v.name, p))}` : '';
      if (wa) { const a = el('a', 'btn btn-primary', 'Quero uma igual'); a.href = wa; a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('aria-label', `Quero uma igual: ${p.name}`); corpo.append(a); }
      card.append(foto, corpo);
      grade.append(card);
    }
  }
  carregar();
})();
