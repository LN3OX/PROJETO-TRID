/* Abas acessíveis (padrão WAI-ARIA): [role=tablist] com botões [role=tab][aria-controls].
   Clique ou setas ←/→, Home e End trocam a aba; só a aba ativa fica na ordem de tabulação.
   Avisa a troca com o evento "projetotrid:aba" (detail: id do painel aberto). */
(() => {
  function ativar(tab, focar) {
    const lista = tab.closest('[role=tablist]');
    lista.querySelectorAll('[role=tab]').forEach((t) => {
      const on = t === tab, painel = document.getElementById(t.getAttribute('aria-controls'));
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (painel) painel.hidden = !on;
    });
    if (focar) tab.focus();
    document.dispatchEvent(new CustomEvent('projetotrid:aba', { detail: tab.getAttribute('aria-controls') }));
  }
  document.querySelectorAll('[role=tablist]').forEach((lista) => {
    const tabs = () => [...lista.querySelectorAll('[role=tab]')];
    lista.addEventListener('click', (e) => { const t = e.target.closest('[role=tab]'); if (t) ativar(t); });
    lista.addEventListener('keydown', (e) => {
      const ts = tabs(), i = ts.indexOf(document.activeElement);
      if (i < 0) return;
      const alvo = { ArrowRight: ts[(i + 1) % ts.length], ArrowLeft: ts[(i - 1 + ts.length) % ts.length], Home: ts[0], End: ts[ts.length - 1] }[e.key];
      if (alvo) { e.preventDefault(); ativar(alvo, true); }
    });
  });
  window.ProjetoTridAbas = { ativar };
})();
