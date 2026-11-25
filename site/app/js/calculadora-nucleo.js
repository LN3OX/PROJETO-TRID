/* Calculadora · núcleo: avalia expressões simples sem usar eval.
   Aceita + − × ÷ (ou + - * /), vírgula ou ponto decimal e %. Regras do % como numa calculadora comum:
   100+10% = 110 · 100−10% = 90 · 200×10% = 20. Devolve NaN quando a expressão está incompleta ou inválida. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProjetoTridCalculo = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function tokens(texto) {
    const t = String(texto).replace(/\s+/g, '').replace(/[×x]/gi, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '.');
    const re = /(\d+\.?\d*|\.\d+)|([+\-*/%])/y;
    const lista = [];
    for (let i = 0; i < t.length;) {
      re.lastIndex = i;
      const m = re.exec(t);
      if (!m) return null;
      lista.push(m[1] !== undefined ? Number(m[1]) : m[2]);
      i = re.lastIndex;
    }
    return lista;
  }

  function avaliar(texto) {
    const tok = tokens(texto);
    if (!tok || !tok.length) return NaN;
    let p = 0;
    const falha = () => { throw new Error('inválido'); };
    function numero() {
      if (tok[p] === '-') { p++; const r = numero(); return { v: -r.v, pct: r.pct }; }
      if (typeof tok[p] !== 'number') falha();
      let v = tok[p++], pct = false;
      if (tok[p] === '%') { p++; pct = true; v /= 100; }
      return { v, pct };
    }
    function termo() {
      let a = numero();
      while (tok[p] === '*' || tok[p] === '/') {
        const op = tok[p++], b = numero();
        if (op === '/' && b.v === 0) falha();
        a = { v: op === '*' ? a.v * b.v : a.v / b.v, pct: false };
      }
      return a;
    }
    try {
      let a = termo();
      while (tok[p] === '+' || tok[p] === '-') {
        const op = tok[p++], b = termo(), delta = b.pct ? a.v * b.v : b.v;
        a = { v: op === '+' ? a.v + delta : a.v - delta, pct: false };
      }
      if (p < tok.length) return NaN;
      return Math.round(a.v * 1e10) / 1e10;
    } catch { return NaN; }
  }

  // Texto para mostrar o resultado: vírgula decimal, sem separador de milhar, até 6 casas.
  function formatar(n) {
    if (!Number.isFinite(n)) return '';
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6, useGrouping: false }).format(n);
  }

  // Texto para gravar num campo: casas fixas (dinheiro) ou o mínimo necessário até `casas`.
  function paraCampo(n, casas, fixas) {
    const texto = fixas ? n.toFixed(casas) : String(Number(n.toFixed(casas)));
    return texto.replace('.', ',');
  }

  return { avaliar, formatar, paraCampo };
});
