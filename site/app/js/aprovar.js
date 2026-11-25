/* Projeto Trid · página pública do link de aprovação (aprovar.html?t=<token>). Sem login.
   Lê o orçamento pela função projetotrid_quote_public (só itens, quantidades e preços; nunca custos)
   e grava a resposta por projetotrid_quote_respond. */
(() => {
  const $ = (id) => document.getElementById(id);
  if (!$('apvMain')) return;
  const token = new URLSearchParams(location.search).get('t') || '';
  const real = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const backend = window.SITE_BACKEND, cliente = window.supabase?.createClient(backend.url, backend.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const data = (iso) => new Date(iso).toLocaleDateString('pt-BR');

  function erro(titulo, texto) { $('apvTitle').textContent = titulo; $('apvIntro').textContent = texto; $('apvCard').hidden = true; $('apvActions').hidden = true; }

  function mostrar(q) {
    $('apvTitle').textContent = q.client_name ? `${q.client_name}, este é o seu orçamento` : 'Seu orçamento';
    $('apvIntro').textContent = `${q.title} · enviado em ${data(q.created_at)}`;
    const ul = $('apvItems');
    ul.replaceChildren();
    for (const it of q.items) {
      const li = el('li'), info = el('div');
      info.append(el('strong', '', `${it.quantity}× ${it.product}`), el('small', '', [it.material, it.color].filter(Boolean).join(' · ') || ' '));
      li.append(info, el('span', '', `${real.format(Number(it.unit_price))} / un.`));
      ul.append(li);
    }
    const tot = $('apvTotals');
    tot.replaceChildren();
    if (Number(q.discount_amount) > 0) {
      const d = el('div'); d.append(el('span', '', 'Desconto'), el('span', '', `− ${real.format(Number(q.discount_amount))}`)); tot.append(d);
    }
    const t = el('div', 'apv-total'); t.append(el('span', '', 'Total'), el('strong', '', real.format(Number(q.total)))); tot.append(t);
    $('apvCard').hidden = false;
    const respondido = q.client_response || q.status !== 'orcado';
    $('apvActions').hidden = respondido;
    if (respondido) {
      $('apvMsg').textContent = q.client_response === 'ajuste' ? `Você pediu um ajuste em ${data(q.client_response_at)}. Em breve entraremos em contato.`
        : q.status === 'recusado' ? 'Este orçamento não está mais disponível.'
          : `Orçamento aprovado${q.client_response_at ? ` em ${data(q.client_response_at)}` : ''}. Obrigado!`;
    }
  }

  async function carregar() {
    if (!cliente) return erro('Não foi possível abrir', 'Atualize a página para tentar de novo.');
    if (!/^[0-9a-f-]{36}$/i.test(token)) return erro('Link inválido', 'Confira se o link foi copiado inteiro ou peça um novo a quem enviou o orçamento.');
    const { data: q, error } = await cliente.rpc('projetotrid_quote_public', { p_token: token });
    if (error) return erro('Não foi possível abrir', 'Verifique sua conexão e atualize a página.');
    if (!q) return erro('Orçamento não encontrado', 'O link pode ter sido desativado. Peça um novo a quem enviou o orçamento.');
    mostrar(q);
  }

  async function responder(decisao) {
    const nota = $('apvNote').value.trim();
    if (decisao === 'ajuste' && !nota) { $('apvMsg').textContent = 'Conte o que você quer ajustar.'; $('apvNote').focus(); return; }
    for (const b of $('apvActions').querySelectorAll('button')) b.disabled = true;
    $('apvMsg').textContent = 'Enviando…';
    const { error } = await cliente.rpc('projetotrid_quote_respond', { p_token: token, p_decision: decisao, p_note: nota });
    if (error) {
      for (const b of $('apvActions').querySelectorAll('button')) b.disabled = false;
      $('apvMsg').textContent = 'Não foi possível enviar. Tente de novo em instantes.';
      return;
    }
    await carregar();
  }

  $('apvApprove').addEventListener('click', () => responder('aprovado'));
  $('apvAdjust').addEventListener('click', () => { $('apvNoteBox').hidden = false; $('apvAdjust').hidden = true; $('apvNote').focus(); });
  $('apvSend').addEventListener('click', () => responder('ajuste'));
  carregar();
})();
