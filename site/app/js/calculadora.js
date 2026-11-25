/* Calculadora dentro do app. Um só diálogo, aberto por um botão ao lado de campos numéricos marcados com data-calc
   ("money" = reais com 2 casas, "number" = número com data-calc-casas casas, "auto" = decide pela unidade do desconto).
   "Usar resultado" grava o valor no campo que abriu a calculadora. Para ligar em outro campo: data-calc no <input>. */
(() => {
  const N = window.ProjetoTridCalculo;
  const $ = (id) => document.getElementById(id);
  const dlg = $('calcDialog');
  if (!N || !dlg) return;
  const visor = $('calcExpr'), resultado = $('calcResult'), alvoTxt = $('calcAlvo');
  let expr = '', alvo = null;

  const mostrar = (s) => s.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−').replace(/\./g, ',');
  const ultimoNumero = () => (expr.match(/[\d.]*$/) || [''])[0];
  const termina = (re) => re.test(expr);

  function pintar() {
    visor.textContent = mostrar(expr) || ' ';
    const v = N.avaliar(expr);
    resultado.textContent = expr ? (Number.isNaN(v) ? '…' : N.formatar(v)) : '0';
    resultado.classList.remove('erro');
  }
  function tecla(t) {
    if (/^\d$/.test(t)) expr += t;
    else if (t === ',' || t === '.') { if (!ultimoNumero().includes('.')) expr += ultimoNumero() === '' ? '0.' : '.'; }
    else if ('+-*/'.includes(t)) {
      if (!expr) { if (t === '-') expr = '-'; }
      else if (termina(/[+\-*/]$/)) { if (!(t === '-' && termina(/[*/]$/))) expr = expr.slice(0, -1) + t; else expr += t; }
      else expr += t;
    }
    else if (t === '%') { if (termina(/\d$/)) expr += '%'; }
    else if (t === 'C') expr = '';
    else if (t === 'Backspace') expr = expr.slice(0, -1);
    else if (t === '=') { const v = N.avaliar(expr); if (!Number.isNaN(v)) expr = String(v); else { resultado.textContent = 'Expressão incompleta'; resultado.classList.add('erro'); return; } }
    pintar();
  }

  function casas(input) {
    const tipo = input.dataset.calc;
    if (tipo === 'money') return { n: 2, fixas: true };
    if (tipo === 'auto') return $('discountUnit')?.textContent.trim() === '%' ? { n: 1, fixas: false } : { n: 2, fixas: true };
    return { n: Number(input.dataset.calcCasas || 2), fixas: false };
  }
  const rotuloDe = (input) => document.querySelector(`label[for="${input.id}"]`)?.textContent.replace(/\s+/g, ' ').replace(/\s*\*\s*$/, '').trim() || 'campo';

  function abrir(input) {
    alvo = input;
    const atual = N.avaliar(input.value);
    expr = Number.isNaN(atual) || atual === 0 ? '' : String(atual);
    alvoTxt.textContent = `Resultado vai para: ${rotuloDe(input)}`;
    pintar();
    dlg.showModal();
  }
  function usar() {
    const v = N.avaliar(expr);
    if (Number.isNaN(v) || !alvo) { resultado.textContent = 'Complete a conta'; resultado.classList.add('erro'); return; }
    const { n, fixas } = casas(alvo);
    alvo.value = N.paraCampo(Math.max(0, v), n, fixas);
    alvo.dispatchEvent(new Event('input', { bubbles: true }));
    alvo.dispatchEvent(new Event('change', { bubbles: true }));
    dlg.close();
    alvo.focus();
  }

  // botão de abrir ao lado de cada campo marcado
  document.querySelectorAll('input[data-calc]').forEach((input) => {
    const caixa = input.closest('.control-wrap');
    if (!caixa) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-ghost btn-icon btn-sm calc-open';
    const nomear = () => b.setAttribute('aria-label', `Abrir calculadora para ${rotuloDe(input)}`);
    nomear();
    b.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-calc"/></svg>';
    b.addEventListener('click', () => abrir(input));
    const rotulo = document.querySelector(`label[for="${input.id}"]`);
    if (rotulo) new MutationObserver(nomear).observe(rotulo, { childList: true, characterData: true, subtree: true }); // o rótulo muda (ex.: "Valor final do pedido")
    caixa.append(b);
  });

  dlg.querySelectorAll('[data-tecla]').forEach((b) => b.addEventListener('click', () => tecla(b.dataset.tecla)));
  $('calcUse').addEventListener('click', usar);
  $('calcClose').addEventListener('click', () => dlg.close());
  $('calcCancel').addEventListener('click', () => dlg.close());
  dlg.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const mapa = { x: '*', X: '*', Enter: '=', '=': '=', Delete: 'C', Backspace: 'Backspace' };
    const t = mapa[e.key] || (/^[\d,.+\-*/%]$/.test(e.key) ? e.key : null);
    if (!t) return;
    // Enter em botão do teclado (ex.: foco em "Usar resultado") mantém o comportamento normal do botão.
    if (e.key === 'Enter' && e.target.closest('button')) return;
    e.preventDefault();
    tecla(t);
  });
})();
