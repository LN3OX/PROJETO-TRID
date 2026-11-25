/* Projeto Trid · Preço para marketplace: a partir de quanto você quer receber, calcula o preço do anúncio
   descontando comissão, taxa fixa por venda, imposto e frete pago por você. Visão interna (não vai ao cliente).
   Núcleo puro (testado em tests/marketplace.test.cjs) + bloco na tela de resultado. */
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.ProjetoTridMarketplace = api;
})(typeof self !== 'undefined' ? self : this, function () {
  // ponytail: tabelas públicas de 2026 (fontes divergem; a plataforma muda sem aviso). Tudo é editável na tela.
  const PLATAFORMAS = {
    shopee: { nome: 'Shopee', faixas: [[0, 79.99, 20, 4.5], [80, 99.99, 14, 16], [100, 199.99, 14, 20], [200, Infinity, 14, 26]] },
    'ml-classico': { nome: 'Mercado Livre · Clássico', faixas: [[0, Infinity, 12, 0]] },
    'ml-premium': { nome: 'Mercado Livre · Premium', faixas: [[0, Infinity, 17, 0]] },
    outra: { nome: 'Outra plataforma', faixas: [[0, Infinity, 0, 0]] },
  };

  // preço = (recebe + taxa fixa + frete) / (1 − comissão − imposto), testando cada faixa até achar a que contém o preço
  function calcular(recebe, faixas, { imposto = 0, frete = 0 } = {}) {
    for (const [min, max, comissao, fixa] of faixas) {
      const resto = 1 - (comissao + imposto) / 100;
      if (resto <= 0) continue;
      const preco = Math.ceil(((recebe + fixa + frete) / resto) * 100) / 100;
      if (preco >= min && preco <= max + 0.009) {
        const c = preco * comissao / 100, i = preco * imposto / 100;
        return { preco, comissao: c, fixa, imposto: i, frete, recebe: preco - c - fixa - i - frete, taxaComissao: comissao };
      }
    }
    return null;
  }

  return { PLATAFORMAS, calcular };
});

(() => {
  if (typeof document === 'undefined') return;
  const M = window.ProjetoTridMarketplace, $ = (id) => document.getElementById(id);
  if (!$('mktPlatform')) return;
  const real = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const numero = (v) => { const n = Number(String(v).replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const totalPedido = () => numero(($('batchTotal').textContent.match(/[\d.]+,\d{2}/) || ['0'])[0]);
  let editado = false; // "quero receber" segue o total até a pessoa digitar outro valor

  function preencherTaxas() {
    const f = M.PLATAFORMAS[$('mktPlatform').value].faixas;
    const unica = f.length === 1;
    $('mktFeeField').hidden = !unica;
    if (unica) { $('mktFee').value = String(f[0][2]).replace('.', ','); $('mktFixed').value = String(f[0][3].toFixed(2)).replace('.', ','); }
    $('mktFixedField').hidden = !unica;
    $('mktTiers').hidden = unica;
  }

  function atualizar() {
    if (!editado) $('mktNet').value = totalPedido().toFixed(2).replace('.', ',');
    const plat = M.PLATAFORMAS[$('mktPlatform').value];
    const faixas = plat.faixas.length === 1 ? [[0, Infinity, numero($('mktFee').value), numero($('mktFixed').value)]] : plat.faixas;
    const r = M.calcular(numero($('mktNet').value), faixas, { imposto: numero($('mktTax').value), frete: numero($('mktShip').value) });
    const out = $('mktResult');
    out.replaceChildren();
    if (!r) { out.textContent = 'Confira as taxas: a soma de comissão e imposto chega a 100%.'; return; }
    const linha = (k, v, forte) => { const d = document.createElement('div'); d.className = 'cost-row' + (forte ? ' total' : ''); const a = document.createElement('span'), b = document.createElement('strong'); a.textContent = k; b.textContent = v; d.append(a, b); return d; };
    out.append(
      linha('Anuncie por', real.format(r.preco), true),
      linha(`Comissão (${String(r.taxaComissao).replace('.', ',')}%)`, `− ${real.format(r.comissao)}`),
      linha('Taxa fixa por venda', `− ${real.format(r.fixa)}`),
      linha('Imposto', `− ${real.format(r.imposto)}`),
      linha('Frete pago por você', `− ${real.format(r.frete)}`),
      linha('Você recebe', real.format(r.recebe), true),
    );
  }

  $('mktPlatform').addEventListener('change', () => { preencherTaxas(); atualizar(); });
  $('mktNet').addEventListener('input', () => { editado = true; atualizar(); });
  for (const id of ['mktFee', 'mktFixed', 'mktTax', 'mktShip']) $(id).addEventListener('input', atualizar);
  $('mktReset').addEventListener('click', () => { editado = false; atualizar(); });
  new MutationObserver(atualizar).observe($('batchTotal'), { childList: true, characterData: true, subtree: true });
  preencherTaxas();
  atualizar();
})();
