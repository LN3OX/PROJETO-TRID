/* Projeto Trid · Pedidos: status de produção dos orçamentos salvos (fila), data de entrega, lembrete de retorno
   para orçamentos sem resposta e etiqueta com QR para colar no saco da peça.
   Liga-se à lista de "Salvos" do app.js por ProjetoTridPedidos.filtrar(rows) e ProjetoTridPedidos.decorar(...).
   Núcleo puro (testado em tests/pedidos.test.cjs) + tela. */
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.ProjetoTridPedidosNucleo = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const STATUS = [['orcado', 'Orçado'], ['aprovado', 'Aprovado'], ['fila', 'Na fila'], ['imprimindo', 'Imprimindo'], ['acabamento', 'Acabamento'], ['pronto', 'Pronto'], ['entregue', 'Entregue'], ['recusado', 'Recusado']];
  const PRODUCAO = ['aprovado', 'fila', 'imprimindo', 'acabamento'];
  const FECHADOS = ['aprovado', 'fila', 'imprimindo', 'acabamento', 'pronto', 'entregue'];
  const DIAS_RETORNO = 3;
  const status = (r) => r.status || 'orcado';
  const dia = (d) => { const x = new Date(d); return Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()); };
  const diaISO = (s) => { const [a, m, d] = String(s).split('-').map(Number); return Date.UTC(a, m - 1, d); };

  const atrasado = (r, hoje = new Date()) => !!r.due_date && !['entregue', 'recusado'].includes(status(r)) && diaISO(r.due_date) < dia(hoje);
  const diasSemResposta = (r, hoje = new Date()) => (status(r) === 'orcado' ? Math.floor((dia(hoje) - dia(r.status_at || r.created_at)) / 86400000) : 0);
  const aguardando = (r, hoje) => diasSemResposta(r, hoje) >= DIAS_RETORNO;

  function filtrar(lista, chave, hoje = new Date()) {
    const f = {
      todos: () => true,
      orcados: (r) => status(r) === 'orcado',
      producao: (r) => PRODUCAO.includes(status(r)),
      prontos: (r) => status(r) === 'pronto',
      entregues: (r) => status(r) === 'entregue',
      atrasados: (r) => atrasado(r, hoje),
    }[chave] || (() => true);
    return lista.filter((r) => f(r));
  }

  function lembrete(r, assinatura = 'Projeto Trid') {
    const nome = String(r.client_name || '').trim().split(/\s+/)[0];
    return `Olá${nome ? `, ${nome}` : ''}! Tudo bem? Passando para saber se você conseguiu ver o orçamento de ${r.title || 'impressão 3D'}. Posso ajudar com alguma dúvida ou ajuste? ${assinatura}`;
  }

  const whatsapp = (fone, texto) => { let d = String(fone || '').replace(/\D/g, ''); if (d.length === 10 || d.length === 11) d = '55' + d; return d.length >= 12 ? `https://wa.me/${d}?text=${encodeURIComponent(texto)}` : ''; };

  const linkAprovacao = (base, token) => `${base.replace(/[^/]*$/, '')}aprovar.html?t=${token}`;
  const convite = (r, link) => { const nome = String(r.client_name || '').trim().split(/\s+/)[0]; return `Olá${nome ? `, ${nome}` : ''}! Seu orçamento de ${r.title || 'impressão 3D'} está pronto. Veja os detalhes e aprove por aqui: ${link}`; };

  return { linkAprovacao, convite, STATUS, PRODUCAO, FECHADOS, DIAS_RETORNO, status, atrasado, diasSemResposta, aguardando, filtrar, lembrete, whatsapp };
});

(() => {
  if (typeof document === 'undefined') return;
  const N = window.ProjetoTridPedidosNucleo, $ = (id) => document.getElementById(id), app = () => window.ProjetoTridApp;
  if (!$('savedFilter')) return;
  const nomes = Object.fromEntries(N.STATUS);
  const real = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const destaque = new URLSearchParams(location.search).get('pedido');
  let filtro = 'todos', rolou = false;
  const pequeno = matchMedia('(max-width: 719px)');
  pequeno.addEventListener('change', () => document.querySelectorAll('.order-more').forEach((d) => { d.open = !pequeno.matches; }));
  // no celular, tocar fora fecha o menu "Mais"
  document.addEventListener('click', (e) => { if (!pequeno.matches) return; document.querySelectorAll('.order-more[open]').forEach((d) => { if (!d.contains(e.target)) d.open = false; }); });

  async function gravar(r, campos, msg) {
    const { error } = await app().client().from('inventta3d_quotes').update(campos).eq('id', r.id);
    if (error) { app().status('Não foi possível atualizar o pedido. Tente novamente.', true); return false; }
    Object.assign(r, campos);
    app().renderSaved?.();
    if (msg) app().status(msg);
    return true;
  }

  function decorar(row, r, info, acoes) {
    const st = N.status(r), linha = el('div', 'order-line');
    acoes.classList.add('order-actions');
    if (N.atrasado(r)) linha.append(el('span', 'order-chip st-atrasado', 'Atrasado'));
    const dias = N.diasSemResposta(r);
    if (N.aguardando(r)) linha.append(el('span', 'order-chip st-aguardando', `Sem resposta há ${dias} dias`));
    const sel = el('select', `control order-status st-${st}`);
    sel.setAttribute('aria-label', `Status de ${r.title || 'pedido'}`);
    N.STATUS.forEach(([v, t]) => { const o = el('option', '', t); o.value = v; sel.append(o); });
    sel.value = st;
    sel.addEventListener('change', () => gravar(r, { status: sel.value, status_at: new Date().toISOString() }, `Pedido marcado como ${nomes[sel.value].toLowerCase()}.`));
    const dataLabel = el('label', 'order-date-label', 'Entrega');
    const data = el('input', 'control order-date');
    data.type = 'date'; data.value = r.due_date || '';
    data.id = `order-date-${r.id}`; dataLabel.htmlFor = data.id;
    data.setAttribute('aria-label', `Entrega de ${r.title || 'pedido'}`);
    data.addEventListener('change', () => gravar(r, { due_date: data.value || null }, data.value ? 'Data de entrega salva.' : 'Data de entrega removida.'));
    if (r.client_response === 'aprovado') linha.prepend(el('span', 'order-chip st-entregue', 'Cliente aprovou'));
    if (r.client_response === 'ajuste') linha.prepend(el('span', 'order-chip st-aguardando', 'Cliente pediu ajuste'));
    linha.append(sel, dataLabel, data);
    info.append(linha);
    if (r.client_response === 'ajuste' && r.client_note) info.append(el('small', 'order-note', `“${r.client_note}”`));
    if (st === 'orcado') {
      const lk = el('button', 'btn btn-sm btn-outline', 'Enviar link');
      lk.type = 'button'; lk.setAttribute('aria-label', `Link de aprovação de ${r.title || 'pedido'}`);
      lk.addEventListener('click', () => enviarLink(r));
      acoes.insertBefore(lk, acoes.lastElementChild);
    }
    if (N.aguardando(r)) {
      const link = N.whatsapp(r.client_phone, N.lembrete(r));
      if (link) { const a = el('a', 'btn btn-sm btn-tonal', 'Lembrar'); a.href = link; a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('aria-label', `Lembrar ${r.client_name || 'cliente'} pelo WhatsApp`); acoes.prepend(a); }
    }
    const etq = el('button', 'btn btn-sm btn-outline', 'Etiqueta');
    etq.type = 'button'; etq.setAttribute('aria-label', `Etiqueta de ${r.title || 'pedido'}`);
    etq.addEventListener('click', () => etiqueta(r));
    acoes.insertBefore(etq, acoes.lastElementChild);
    // ações secundárias num menu "Mais" no celular (no computador o menu fica aberto e some o botão)
    const mais = el('details', 'order-more'), sum = el('summary', 'btn btn-sm btn-outline order-more-btn', 'Mais');
    sum.setAttribute('aria-label', `Mais ações de ${r.title || 'pedido'}`);
    const lista = el('div', 'order-more-list');
    [...acoes.children].filter((b) => !/^(Abrir|Lembrar)$/.test(b.textContent.trim())).forEach((b) => lista.append(b));
    if (lista.children.length) { mais.append(sum, lista); acoes.append(mais); mais.open = !pequeno.matches; }
    if (destaque && r.id === destaque) {
      row.classList.add('order-destaque');
      if (!rolou) { rolou = true; requestAnimationFrame(() => row.scrollIntoView({ block: 'center' })); }
    }
  }

  // cria o token (se ainda não houver), abre o WhatsApp do cliente com o convite e copia o link
  async function enviarLink(r) {
    if (!r.share_token) { const token = crypto.randomUUID(); if (!(await gravar(r, { share_token: token }))) return; }
    const link = N.linkAprovacao(location.origin + location.pathname, r.share_token), texto = N.convite(r, link);
    try { await navigator.clipboard.writeText(link); } catch { /* sem permissão de cópia: o link segue no WhatsApp */ }
    const wa = N.whatsapp(r.client_phone, texto);
    if (wa) window.open(wa, '_blank', 'noopener');
    app().status(wa ? 'Link de aprovação copiado e aberto no WhatsApp do cliente.' : 'Link de aprovação copiado. Envie ao cliente.');
  }

  function etiqueta(r) {
    const url = `${location.origin}${location.pathname}?pedido=${encodeURIComponent(r.id)}#/orcamentos-salvos`;
    const qr = window.qrcode(0, 'M'); qr.addData(url); qr.make();
    const corpo = $('labelSheet');
    corpo.replaceChildren();
    const texto = el('div', 'label-text');
    const itens = (r.items || []).map((it) => { const d = it.data || it; return `${d.quantity || 1}× ${String(d.product || 'Peça').trim()}`; });
    texto.append(el('strong', '', r.client_name || 'Cliente'), el('span', '', itens.join(' · ') || (r.title || '')));
    if (r.due_date) texto.append(el('span', '', `Entrega: ${r.due_date.split('-').reverse().join('/')}`));
    texto.append(el('span', '', `${nomes[N.status(r)]} · ${real.format(Number(r.total) || 0)}`), el('small', '', `Pedido ${String(r.id).slice(0, 8)}`));
    const img = el('div', 'label-qr');
    img.innerHTML = qr.createSvgTag({ cellSize: 3, margin: 0, scalable: true });
    img.firstElementChild?.setAttribute('aria-label', 'QR code do pedido');
    corpo.append(img, texto);
    $('labelDialog').showModal();
  }

  // no celular os filtros viram um seletor (seis botões não cabem numa linha)
  const selFiltro = el('select', 'control order-filter-select');
  selFiltro.setAttribute('aria-label', 'Filtrar pedidos por status');
  $('savedFilter').querySelectorAll('button[data-filtro]').forEach((b) => { const o = el('option', '', `Status: ${b.textContent.trim()}`); o.value = b.dataset.filtro; selFiltro.append(o); });
  selFiltro.addEventListener('change', () => $('savedFilter').querySelector(`button[data-filtro="${selFiltro.value}"]`)?.click());
  $('savedFilter').after(selFiltro);

  // filtros (chips) acima da lista
  $('savedFilter').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-filtro]');
    if (!b) return;
    filtro = b.dataset.filtro; selFiltro.value = filtro;
    $('savedFilter').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    app().renderSaved?.();
  });
  $('labelPrint').addEventListener('click', () => {
    const area = $('printArea'), antes = area.innerHTML;
    area.innerHTML = `<div class="label-print">${$('labelSheet').innerHTML}</div>`;
    window.print();
    area.innerHTML = antes;
  });
  $('labelClose').addEventListener('click', () => $('labelDialog').close());

  window.ProjetoTridPedidos = { filtrar: (rows) => N.filtrar(rows, filtro), decorar };
  app()?.renderSaved?.(); // a lista pode ter sido desenhada antes deste arquivo carregar
})();
