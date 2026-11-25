/* Projeto Trid · aprovação de acessos pelo app (só para administradores).
   Quem tem is_admin na tabela projetotrid_access vê "Aprovar acessos" no menu da conta.
   A permissão de verdade está no banco: as funções projetotrid_access_list e projetotrid_access_set recusam quem não é administrador. */
(function () {
  const app = () => window.ProjetoTridApp;
  const ROTULO = { pending: 'Aguardando', approved: 'Aprovado', blocked: 'Bloqueado' };
  let item = null, dialogo = null, verificando = 0;

  const dataCurta = (iso) => { try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return ''; } };

  function montarItem() {
    if (item) return item;
    const painel = document.querySelector('#accountSignedIn .account-menu-panel');
    if (!painel) return null;
    item = document.createElement('button');
    item.type = 'button'; item.className = 'menu-item'; item.id = 'acessosAbrir'; item.hidden = true;
    item.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-group"/></svg><span>Aprovar acessos</span><span class="acessos-badge" id="acessosBadge" hidden></span>';
    painel.insertBefore(item, painel.querySelector('.menu-divider'));
    item.addEventListener('click', () => { document.getElementById('accountSignedIn')?.removeAttribute('open'); abrir(); });
    return item;
  }

  function montarDialogo() {
    if (dialogo) return dialogo;
    dialogo = document.createElement('dialog');
    dialogo.className = 'preview-dialog acessos-dialog'; dialogo.id = 'acessosDialog';
    dialogo.setAttribute('aria-labelledby', 'acessosTitulo');
    dialogo.innerHTML = '<div class="preview-head"><h2 id="acessosTitulo">Aprovar acessos</h2><button type="button" class="btn btn-ghost btn-icon btn-sm" id="acessosFechar" aria-label="Fechar"><svg class="icon" aria-hidden="true"><use href="#i-x"/></svg></button></div>' +
      '<div class="preview-body"><p class="acessos-intro">Quem entra pelo Google aparece aqui. Aprove para liberar o sistema ou bloqueie para recusar.</p><ul class="acessos-lista" id="acessosLista"></ul><p class="message" id="acessosMsg" aria-live="polite"></p></div>';
    document.body.append(dialogo);
    dialogo.querySelector('#acessosFechar').addEventListener('click', () => dialogo.close());
    dialogo.querySelector('#acessosLista').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-status]');
      if (b) mudar(b.dataset.email, b.dataset.status, b);
    });
    return dialogo;
  }

  function linha(c) {
    const li = document.createElement('li');
    li.className = 'acessos-item';
    const info = document.createElement('div'); info.className = 'acessos-info';
    const email = document.createElement('span'); email.className = 'acessos-email'; email.textContent = c.email;
    const meta = document.createElement('span'); meta.className = 'acessos-meta';
    meta.textContent = `Pediu em ${dataCurta(c.requested_at)}${c.is_me ? ' · você' : ''}${c.is_admin ? ' · administrador' : ''}`;
    const st = document.createElement('span'); st.className = `acessos-status acessos-${c.status}`; st.textContent = ROTULO[c.status] || c.status;
    info.append(email, meta);
    const acoes = document.createElement('div'); acoes.className = 'acessos-acoes';
    if (!c.is_me) {
      if (c.status !== 'approved') acoes.append(botao('Aprovar', 'approved', c.email, 'btn-primary'));
      if (c.status !== 'blocked') acoes.append(botao('Bloquear', 'blocked', c.email, 'btn-outline'));
    }
    li.append(info, st, acoes);
    return li;
  }
  function botao(texto, status, email, classe) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = `btn btn-sm ${classe}`; b.textContent = texto;
    b.dataset.status = status; b.dataset.email = email;
    b.setAttribute('aria-label', `${texto} ${email}`);
    return b;
  }

  async function carregar() {
    const d = montarDialogo(), lista = d.querySelector('#acessosLista'), msg = d.querySelector('#acessosMsg');
    msg.textContent = '';
    const { data, error } = await app().client().rpc('projetotrid_access_list');
    if (error) { lista.replaceChildren(); msg.textContent = 'Não foi possível carregar a lista. Confira a conexão e tente de novo.'; return; }
    const contas = data || [];
    lista.replaceChildren(...contas.map(linha));
    if (!contas.length) msg.textContent = 'Ninguém pediu acesso ainda.';
    atualizarContador(contas.filter((c) => c.status === 'pending').length);
  }

  async function mudar(email, status, b) {
    const msg = montarDialogo().querySelector('#acessosMsg');
    b.disabled = true;
    const { error } = await app().client().rpc('projetotrid_access_set', { p_email: email, p_status: status });
    if (error) { b.disabled = false; msg.textContent = 'Não foi possível salvar. Tente de novo.'; return; }
    app().status?.(status === 'approved' ? `${email} aprovado.` : `${email} bloqueado.`);
    await carregar();
  }

  function atualizarContador(n) {
    const badge = document.getElementById('acessosBadge');
    if (!badge) return;
    badge.hidden = !n; badge.textContent = n ? String(n) : '';
    item?.setAttribute('aria-label', n ? `Aprovar acessos, ${n} aguardando` : 'Aprovar acessos');
  }

  async function abrir() {
    const d = montarDialogo();
    if (!d.open) d.showModal();
    await carregar();
  }

  async function verificar() {
    const a = app(), vez = ++verificando;
    const it = montarItem();
    if (!it) return;
    if (!a?.client() || !a.user()) { it.hidden = true; return; }
    try {
      const { data, error } = await a.client().rpc('projetotrid_is_admin');
      if (vez !== verificando) return;
      it.hidden = error || data !== true;
      if (!it.hidden) {
        const r = await a.client().rpc('projetotrid_access_list');
        if (vez === verificando && !r.error) atualizarContador((r.data || []).filter((c) => c.status === 'pending').length);
      }
    } catch { if (vez === verificando) it.hidden = true; }
  }

  const inicial = () => { if (app()?.user()) verificar(); };
  if (document.readyState === 'complete') setTimeout(inicial, 0); else window.addEventListener('load', () => setTimeout(inicial, 0));
  document.addEventListener('projetotrid:auth', () => { verificar(); if (!app()?.user()) dialogo?.close(); });
})();
