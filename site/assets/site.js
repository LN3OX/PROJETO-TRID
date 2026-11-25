/* Calculadora da página: o mesmo cálculo do aplicativo (/app/js/calculations.js), com valores de exemplo. */
(() => {
  const $ = (s) => document.querySelector(s);
  if (!window.ProjetoTridCalculations || !$('#calc')) return;
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const BASE = { packPrice: 120, packQty: 1000, waste: 8, failure: 5, power: 120, energyRate: 0.95, printerCost: 3200, lifeHours: 5000, maintenance: 0.4, setupMin: 20, finishMin: 10, laborRate: 30, packaging: 6, salesFee: 0, taxRate: 0 };
  const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  const campos = { peso: $('#c-peso'), minutos: $('#c-tempo'), margem: $('#c-margem'), qtd: $('#c-qtd') };
  const saida = { peso: $('#o-peso'), minutos: $('#o-tempo'), margem: $('#o-margem'), qtd: $('#o-qtd') };
  const fmt = { peso: (v) => `${v} g`, minutos: (v) => `${Math.floor(v / 60)}h${String(v % 60).padStart(2, '0')}`, margem: (v) => `${v}%`, qtd: String };
  let fala = 0;
  function atualizar() {
    const v = {};
    for (const k in campos) {
      const c = campos[k];
      v[k] = Number(c.value); saida[k].textContent = fmt[k](v[k]);
      c.style.setProperty('--p', `${((c.value - c.min) / (c.max - c.min)) * 100}%`);
    }
    const r = window.ProjetoTridCalculations.calculate({ ...BASE, amount: v.peso, printHours: hhmm(v.minutos), margin: v.margem, quantity: v.qtd });
    if (!r) return;
    $('#r-unit').textContent = BRL.format(r.unitPrice);
    $('#r-total').textContent = BRL.format(r.price);
    $('#r-lucro').textContent = BRL.format(r.profit);
    clearTimeout(fala); // leitor de tela: só depois de parar de mexer
    fala = setTimeout(() => { $('#calc-fala').textContent = `Preço por peça ${BRL.format(r.unitPrice)}, total do pedido ${BRL.format(r.price)}, lucro estimado ${BRL.format(r.profit)}.`; }, 700);
  }
  Object.values(campos).forEach((c) => c.addEventListener('input', atualizar));
  atualizar();
})();

/* peça 3D de demonstração (vaso torcido): gira sozinha e carrega só quando aparece */
(() => {
  const hosts = [...document.querySelectorAll('[data-peca]')];
  if (!hosts.length) return;
  let modulo = null;
  const montar = async (host) => {
    modulo ??= await import('/assets/logo3d.js');
    const peca = await modulo.criarPeca(host, { interativo: host.hasAttribute('data-interativo'), paleta: host.dataset.peca, velocidade: Number(host.dataset.velocidade) || 1.6 });
    if (!peca) return;
    const botoes = [...document.querySelectorAll('.cor')];
    if (host.hasAttribute('data-interativo')) botoes.forEach((b) => b.addEventListener('click', () => { botoes.forEach((o) => o.setAttribute('aria-pressed', String(o === b))); peca.paleta(b.dataset.p); }));
  };
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); montar(e.target); } }), { rootMargin: '300px' });
  hosts.forEach((h) => io.observe(h));
})();

/* tema: o botão alterna claro/escuro e grava a escolha (a mesma chave do aplicativo, projetotrid-theme) */
(() => {
  const raiz = document.documentElement, mq = matchMedia('(prefers-color-scheme: dark)'), meta = document.querySelector('meta[name="theme-color"]'), botao = document.querySelector('[data-tema]');
  if (!botao) return;
  const escuro = () => (raiz.dataset.theme || (mq.matches ? 'dark' : 'light')) === 'dark';
  const pintar = () => { const d = escuro(); botao.setAttribute('aria-pressed', String(d)); botao.setAttribute('aria-label', d ? 'Usar tema claro' : 'Usar tema escuro'); if (meta) meta.content = d ? '#16130b' : '#fff8ef'; };
  botao.addEventListener('click', () => { raiz.dataset.theme = escuro() ? 'light' : 'dark'; try { localStorage.setItem('projetotrid-theme', raiz.dataset.theme); } catch { /* sem armazenamento */ } pintar(); });
  mq.addEventListener('change', pintar);
  pintar();
})();

/* preço do hero: conta de zero até o valor uma vez, ao abrir a página (parado com "reduzir movimento") */
(() => {
  const el = document.getElementById('hero-total');
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const fim = 289, BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), t0 = performance.now() + 500;
  el.textContent = BRL.format(0);
  const passo = (agora) => { const k = Math.min(1, Math.max(0, (agora - t0) / 1400)); el.textContent = BRL.format(fim * (1 - (1 - k) ** 3)); if (k < 1) requestAnimationFrame(passo); };
  requestAnimationFrame(passo);
})();

/* #como: o preço se forma etapa por etapa, com os números do mesmo cálculo do aplicativo (peça de demonstração) */
(() => {
  const raiz = document.getElementById('construcao');
  if (!raiz || !window.ProjetoTridCalculations) return;
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const base = { packPrice: 120, packQty: 1000, waste: 8, failure: 5, power: 120, energyRate: 0.95, printerCost: 3200, lifeHours: 5000, maintenance: 0.4, setupMin: 5, finishMin: 1, laborRate: 30, packaging: 0.5, salesFee: 0, taxRate: 0 };
  const r = window.ProjetoTridCalculations.calculate({ ...base, amount: 9, printHours: '00:40', margin: 120, quantity: 50 });
  if (!r) return;
  const valores = { material: r.material, energia: r.energy, maquina: r.machine, trabalho: r.labor + r.packaging, falhas: r.failureCost, lucro: Math.max(0, r.profit) };
  const ordem = ['material', 'energia', 'maquina', 'trabalho', 'falhas', 'lucro'];
  const mostrar = [0, 1, 3, 6, 6]; // quantas partes cada etapa já mostra
  const soma = ordem.reduce((t, k) => t + valores[k], 0);
  const botoes = [...raiz.closest('section').querySelectorAll('.passo')], total = raiz.querySelector('#co-total'), rotulo = raiz.querySelector('#co-rotulo'), un = raiz.querySelector('#co-un');
  const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches;
  raiz.querySelectorAll('.construcao__linhas li').forEach((li) => { li.querySelector('b').textContent = BRL.format(valores[li.dataset.parte]); });
  let atual = -1, auto = 0, contagem = 0;
  function ir(k, animar = true) {
    atual = k;
    botoes.forEach((b, i) => { b.setAttribute('aria-pressed', String(i === k)); b.classList.toggle('feito', i < k); });
    const n = mostrar[k];
    let acumulado = 0;
    ordem.forEach((p, i) => {
      const ligado = i < n; if (ligado) acumulado += valores[p];
      raiz.querySelector(`.construcao__linhas li[data-parte="${p}"]`).classList.toggle('on', ligado);
      raiz.querySelector(`.construcao__barra i[data-parte="${p}"]`).style.flexBasis = ligado ? `${(valores[p] / soma) * 100}%` : '0%';
    });
    raiz.classList.toggle('pronto', k === 4);
    rotulo.textContent = k === 4 ? 'Preço sugerido do pedido' : 'Soma até agora';
    un.textContent = k === 4 ? `${BRL.format(r.unitPrice)} por chaveiro` : '';
    const alvo = k === 4 ? r.price : acumulado, de = parseFloat(total.dataset.v || '0'); total.dataset.v = String(alvo);
    cancelAnimationFrame(contagem);
    if (!animar || reduzir) { total.textContent = BRL.format(alvo); return; }
    const t0 = performance.now(), dur = 700;
    const passo = (agora) => { const q = Math.min(1, (agora - t0) / dur); total.textContent = BRL.format(de + (alvo - de) * (1 - (1 - q) ** 3)); if (q < 1) contagem = requestAnimationFrame(passo); };
    contagem = requestAnimationFrame(passo);
  }
  const parar = () => { clearInterval(auto); auto = 0; };
  botoes.forEach((b, i) => b.addEventListener('click', () => { parar(); ir(i); }));
  if (reduzir) { ir(4, false); return; }
  ir(0, false);
  // ao entrar na tela, percorre as cinco etapas uma vez e descansa na última (mexer nas etapas interrompe)
  new IntersectionObserver((es, io) => { if (!es.some((e) => e.isIntersecting)) return; io.disconnect(); let k = 0; auto = setInterval(() => { k += 1; if (k > 4) { parar(); return; } ir(k); }, 1500); }, { threshold: 0.45 }).observe(raiz);
})();
