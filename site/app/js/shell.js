/* Casca do app: monta a navegação a partir do registro de módulos, troca de página pela rota (hash)
   e exibe as mensagens de status como snackbar. Não conhece regras de negócio de nenhum módulo. */
(() => {
  const modules = window.PROJETOTRID_MODULES || [];
  const nav = document.getElementById('mainNav');
  const fallback = modules.find(m => m.default) || modules[0];
  const svgUse = (cls, id) => `<svg class="icon ${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;

  function buildNav() {
    if (!nav) return;
    nav.replaceChildren();
    modules.filter(m => !m.hidden).forEach(m => {
      const a = document.createElement('a');
      a.href = m.route;
      a.dataset.module = m.id;
      a.title = m.label;
      a.setAttribute('aria-label', m.label);
      a.innerHTML = `<span class="nav-indicator">${svgUse('nav-off', m.icon)}${svgUse('nav-on', m.iconActive || m.icon)}</span><span class="nav-label">${m.short || m.label}</span>`;
      nav.append(a);
    });
  }

  function current() {
    return modules.find(m => !m.default && m.route === location.hash) || fallback;
  }

  function render() {
    const active = current();
    modules.forEach(m => {
      const page = document.querySelector(`[data-page="${m.id}"]`);
      if (!page) return;
      const on = m === active;
      page.hidden = !on;
      page.inert = !on;
      page.setAttribute('aria-hidden', String(!on));
    });
    nav?.querySelectorAll('a[data-module]').forEach(a => a.setAttribute('aria-current', a.dataset.module === active?.id ? 'page' : 'false'));
    const menu = document.getElementById('accountSignedIn');
    if (menu) menu.open = false;
    if (active) document.title = `${active.label} | Projeto Trid`;
    return active;
  }

  /* status como snackbar: some sozinho, exceto mensagens de progresso (terminadas em “…”) */
  function autoHideStatus() {
    const status = document.getElementById('accountStatus');
    if (!status) return;
    let timer;
    new MutationObserver(() => {
      clearTimeout(timer);
      const text = status.textContent.trim();
      if (!text || text.endsWith('…')) return;
      timer = setTimeout(() => { status.textContent = ''; }, status.classList.contains('error') ? 9000 : 5000);
    }).observe(status, { childList: true, characterData: true, subtree: true });
  }

  /* menu da conta: fecha com Esc ou clique fora */
  function menuDismiss() {
    const menu = document.getElementById('accountSignedIn');
    if (!menu) return;
    document.addEventListener('click', e => { if (menu.open && !menu.contains(e.target)) menu.open = false; });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary')?.focus(); }
    });
  }

  buildNav();
  render();
  autoHideStatus();
  menuDismiss();
  window.addEventListener('hashchange', render);
  window.ProjetoTridShell = { render, current, modules };
})();
