/* Botão dividido "Enviar": a ação principal faz o último envio usado; a seta abre o menu com as formas de envio.
   As ações em si (WhatsApp, e-mail, copiar, PDF, pré-visualizar) continuam nos botões do menu, tratados em app.js. */
(() => {
  const $ = (id) => document.getElementById(id);
  const split = $('shareSplit');
  if (!split) return;
  const main = $('shareMain'), caret = $('shareMenuBtn'), menu = $('shareMenu');
  const ACOES = {
    whatsapp: { btn: 'whatsappBtn', rotulo: 'Enviar pelo WhatsApp', icone: 'i-whatsapp' },
    email: { btn: 'emailBtn', rotulo: 'Enviar por e-mail', icone: 'i-mail' },
    texto: { btn: 'copyBtn', rotulo: 'Copiar texto', icone: 'i-copy' },
    pdf: { btn: 'pdfBtn', rotulo: 'Baixar PDF', icone: 'i-file' },
  };
  const CHAVE = 'projetotrid-envio';
  let atual = 'whatsapp';
  try { const salvo = localStorage.getItem(CHAVE); if (ACOES[salvo]) atual = salvo; } catch { /* sem armazenamento: usa o padrão */ }
  const itens = () => [...menu.querySelectorAll('[role="menuitem"]')];

  // Espelha no botão principal o estado ocupado da ação atual ("Preparando PDF…").
  function sincronizar() {
    const item = $(ACOES[atual].btn);
    main.disabled = item.disabled;
    $('shareMainLbl').textContent = item.disabled ? item.querySelector('.lbl').textContent : ACOES[atual].rotulo;
  }
  function pintar() {
    $('shareMainIcon').querySelector('use').setAttribute('href', '#' + ACOES[atual].icone);
    itens().forEach((i) => i.toggleAttribute('data-atual', i.dataset.envio === atual));
    sincronizar();
  }
  const observador = new MutationObserver(sincronizar);
  Object.values(ACOES).forEach((a) => observador.observe($(a.btn), { attributes: true, attributeFilter: ['disabled'], subtree: true, childList: true, characterData: true }));

  function abrir() {
    menu.hidden = false;
    caret.setAttribute('aria-expanded', 'true');
    (menu.querySelector('[data-atual]') || itens()[0]).focus();
  }
  function fechar(devolverFoco) {
    if (menu.hidden) return;
    menu.hidden = true;
    caret.setAttribute('aria-expanded', 'false');
    if (devolverFoco) caret.focus();
  }

  main.addEventListener('click', () => $(ACOES[atual].btn).click());
  caret.addEventListener('click', () => (menu.hidden ? abrir() : fechar(true)));
  caret.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown' && menu.hidden) { e.preventDefault(); abrir(); } });
  // Escolher no menu executa a ação (o próprio botão trata o clique) e a torna a principal; "Pré-visualizar" só executa.
  menu.addEventListener('click', (e) => {
    const item = e.target.closest('[role="menuitem"]');
    if (!item) return;
    if (ACOES[item.dataset.envio]) {
      atual = item.dataset.envio;
      try { localStorage.setItem(CHAVE, atual); } catch { /* ignora */ }
      pintar();
    }
    fechar(true);
  });
  menu.addEventListener('keydown', (e) => {
    const lista = itens(), i = lista.indexOf(document.activeElement);
    const ir = { ArrowDown: (i + 1) % lista.length, ArrowUp: (i - 1 + lista.length) % lista.length, Home: 0, End: lista.length - 1 }[e.key];
    if (ir !== undefined) { e.preventDefault(); lista[ir].focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); fechar(true); }
    else if (e.key === 'Tab') fechar(false);
  });
  document.addEventListener('pointerdown', (e) => { if (!split.contains(e.target)) fechar(false); });
  pintar();
})();

/* Copiar detalhamento: leva para a área de transferência a composição que aparece na tela ("Composição do preço").
   É de uso interno; nada disso entra no orçamento enviado ao cliente. */
(() => {
  const botao = document.getElementById('copyDetailBtn');
  if (!botao) return;
  const rotulo = botao.querySelector('.lbl'), aviso = document.getElementById('copyDetailStatus');
  const original = rotulo.textContent;
  botao.addEventListener('click', async () => {
    const linhas = ['DETALHAMENTO DO ORÇAMENTO · USO INTERNO (não enviar ao cliente)', ''];
    document.querySelectorAll('details.internal .cost-row').forEach((l) => linhas.push(`${l.querySelector('span').textContent}: ${l.querySelector('strong').textContent}`));
    const total = document.getElementById('batchTotal');
    if (total) linhas.push('', `Total do pedido: ${total.textContent}`);
    let msg;
    try { await navigator.clipboard.writeText(linhas.join('\n')); msg = 'Detalhamento copiado'; } catch { msg = 'Não foi possível copiar'; }
    rotulo.textContent = msg;
    aviso.textContent = msg;
    setTimeout(() => { rotulo.textContent = original; aviso.textContent = ''; }, 3000);
  });
})();
