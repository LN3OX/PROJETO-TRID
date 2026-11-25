/* Projeto Trid · vitrine, lado do dono: aba "Vitrine" em Impressões (dados da loja e link público)
   e a seção "Vitrine" nos detalhes de cada peça (mostrar, preço, descrição e foto).
   impressoes.js chama ProjetoTridVitrine.secao(peça, aoSalvar) ao abrir os detalhes. */
(() => {
  const $ = (id) => document.getElementById(id), app = () => window.ProjetoTridApp, V = window.ProjetoTridVitrineNucleo;
  if (!$('shopForm') || !V) return;
  const BUCKET = 'projetotrid-vitrine', MAX_FOTO = 5 * 1024 * 1024;
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const num = (v) => Number(String(v).replace(/\./g, '').replace(',', '.'));
  let loja = null, carregada = false;
  const linkPublico = (slug) => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}vitrine.html?loja=${slug}`;

  async function carregar() {
    if (!(app()?.client() && app()?.user())) { loja = null; carregada = false; return; }
    const { data, error } = await app().client().from('projetotrid_shop').select('owner_id,slug,name,whatsapp,intro,enabled').limit(1);
    if (error) { $('shopMsg').textContent = 'Não foi possível carregar a vitrine.'; return; }
    loja = data?.[0] || null; carregada = true; preencher();
  }

  function preencher() {
    $('shopEnabled').checked = !!loja?.enabled;
    $('shopName').value = loja?.name || '';
    $('shopSlug').value = loja?.slug || '';
    $('shopWhats').value = loja?.whatsapp || '';
    $('shopIntro').value = loja?.intro || '';
    mostrarLink();
  }
  function mostrarLink() {
    const slug = $('shopSlug').value.trim(), ok = V.slugValido(slug);
    $('shopLink').textContent = ok ? linkPublico(slug) : 'Use de 3 a 40 letras minúsculas, números ou hífen.';
    $('shopOpen').hidden = $('shopCopy').hidden = !(ok && loja?.slug === slug && loja?.enabled);
    $('shopOpen').href = ok ? linkPublico(slug) : '#';
  }

  async function salvar(e) {
    e.preventDefault();
    const dados = { name: $('shopName').value.trim().slice(0, 60), slug: $('shopSlug').value.trim(), whatsapp: $('shopWhats').value.replace(/\D/g, '').slice(0, 15), intro: $('shopIntro').value.trim().slice(0, 300), enabled: $('shopEnabled').checked };
    if (!V.slugValido(dados.slug)) { $('shopMsg').textContent = 'Escolha um endereço com 3 a 40 letras minúsculas, números ou hífen.'; $('shopSlug').focus(); return; }
    if (dados.enabled && dados.whatsapp.length < 10) { $('shopMsg').textContent = 'Informe o WhatsApp com DDD para receber os pedidos.'; $('shopWhats').focus(); return; }
    if (!confirm('Salvar as configurações da vitrine?')) return;
    const t = app().client().from('projetotrid_shop');
    const r = loja ? await t.update(dados).eq('owner_id', loja.owner_id).select().single() : await t.insert(dados).select().single();
    if (r.error) { $('shopMsg').textContent = /duplicate|unique|23505/i.test(r.error.message || r.error.code || '') ? 'Esse endereço já está em uso. Escolha outro.' : 'Não foi possível salvar. Tente novamente.'; return; }
    loja = r.data; $('shopMsg').textContent = ''; preencher();
    app().status(loja.enabled ? 'Vitrine salva e ativa.' : 'Vitrine salva (desativada).');
  }

  // seção nos detalhes da peça; aoSalvar(peçaAtualizada) redesenha o histórico
  function secao(p, aoSalvar) {
    const box = el('section', 'showcase-box'), msg = el('p', 'message');
    box.append(el('h3', '', 'Vitrine'));
    if (!loja) box.append(el('p', 'showcase-tip', 'Configure a aba Vitrine para publicar suas peças.'));
    const mostra = el('label', 'showcase-check'), chk = el('input');
    chk.type = 'checkbox'; chk.checked = !!p.showcase; mostra.append(chk, document.createTextNode(' Mostrar esta peça na vitrine'));
    const preco = el('input', 'control numeric'); preco.inputMode = 'decimal'; preco.setAttribute('aria-label', 'Preço na vitrine (a partir de, em reais)'); preco.placeholder = 'Preço a partir de (R$)';
    preco.value = p.showcase_price != null ? String(Number(p.showcase_price).toFixed(2)).replace('.', ',') : '';
    const texto = el('textarea', 'control'); texto.maxLength = 300; texto.rows = 2; texto.setAttribute('aria-label', 'Descrição na vitrine'); texto.placeholder = 'Descrição curta (opcional)'; texto.value = p.showcase_text || '';
    const foto = el('input'); foto.type = 'file'; foto.accept = 'image/jpeg,image/png,image/webp'; foto.setAttribute('aria-label', 'Foto da peça para a vitrine');
    const atual = V.fotoUrl(window.SITE_BACKEND.url, p.photo_path);
    if (atual) { const img = el('img', 'showcase-thumb'); img.src = atual; img.alt = `Foto atual de ${p.name}`; box.append(img); }
    const salvarBtn = el('button', 'btn btn-sm btn-solid', 'Salvar vitrine'); salvarBtn.type = 'button';
    salvarBtn.addEventListener('click', async () => {
      const f = foto.files[0], valor = preco.value.trim() === '' ? null : num(preco.value);
      if (valor != null && !(valor >= 0)) { msg.textContent = 'Informe o preço em reais.'; return; }
      if (f && (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > MAX_FOTO)) { msg.textContent = 'Use uma foto JPG, PNG ou WebP de até 5 MB.'; return; }
      if (!confirm('Salvar as alterações desta peça na vitrine?')) return;
      msg.textContent = 'Salvando…'; salvarBtn.disabled = true;
      const c = app().client(), campos = { showcase: chk.checked, showcase_price: valor, showcase_text: texto.value.trim().slice(0, 300) };
      try {
        if (f) {
          const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[f.type], caminho = `${app().user().id}/${p.id}-${Date.now()}.${ext}`;
          const up = await c.storage.from(BUCKET).upload(caminho, f, { contentType: f.type, upsert: false });
          if (up.error) throw up.error;
          if (p.photo_path) await c.storage.from(BUCKET).remove([p.photo_path]);
          campos.photo_path = caminho;
        }
        const r = await c.from('projetotrid_prints').update(campos).eq('id', p.id).select('id,showcase,showcase_price,showcase_text,photo_path').single();
        if (r.error) throw r.error;
        msg.textContent = ''; aoSalvar({ ...p, ...r.data });
        app().status(r.data.showcase ? `${p.name} está na vitrine.` : `${p.name} saiu da vitrine.`);
      } catch { msg.textContent = 'Não foi possível salvar a vitrine. Tente novamente.'; }
      finally { salvarBtn.disabled = false; }
    });
    box.append(mostra, preco, texto, foto, salvarBtn, msg);
    return box;
  }

  $('shopForm').addEventListener('submit', salvar);
  $('shopSlug').addEventListener('input', () => { const v = V.paraSlug($('shopSlug').value); if (v !== $('shopSlug').value) $('shopSlug').value = v; mostrarLink(); });
  $('shopName').addEventListener('change', () => { if (!$('shopSlug').value) { $('shopSlug').value = V.paraSlug($('shopName').value); mostrarLink(); } });
  $('shopCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('shopLink').textContent); app().status('Link da vitrine copiado.'); } catch { app().status('Copie o link mostrado acima.', true); } });
  document.addEventListener('projetotrid:auth', () => { carregada = false; carregar(); });
  document.addEventListener('projetotrid:aba', (e) => { if (e.detail === 'panelVitrine' && !carregada) carregar(); });
  carregar();
  window.ProjetoTridVitrine = { secao, recarregar: carregar };
})();
