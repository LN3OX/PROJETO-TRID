/* Projeto Trid · Painel do mês: quanto foi orçado, lucro estimado, filamento e horas orçados, pedidos registrados,
   peças mais pedidas e clientes que mais orçaram. Lê orçamentos e o histórico de impressões; não grava nada.
   Núcleo puro (testado em tests/painel.test.cjs) + tela. */
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.ProjetoTridPainel = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const FECHADOS = ['aprovado', 'fila', 'imprimindo', 'acabamento', 'pronto', 'entregue'];
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const noMes = (iso, ano, mes) => { const d = new Date(iso); return d.getFullYear() === ano && d.getMonth() === mes; };
  const top = (mapa, n = 5) => [...mapa].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR')).slice(0, n);

  // calc = ProjetoTridCalculations (calculate + printDurationHours)
  function resumoMes(orcamentos, impressoes, ano, mes, calc) {
    const doMes = orcamentos.filter((o) => noMes(o.created_at, ano, mes));
    let valor = 0, lucro = 0, gramas = 0, horas = 0, fechado = 0, fechados = 0;
    const clientes = new Map();
    for (const o of doMes) {
      const total = Number(o.total) || 0;
      let custo = 0, taxa = 0;
      for (const it of o.items || []) {
        const d = it.data || it, r = calc.calculate(d);
        if (!r) continue;
        custo += r.cost;
        taxa = ((Number(d.salesFee) || 0) + (Number(d.taxRate) || 0)) / 100;
        gramas += (Number(d.amount) || 0) * r.q * (1 + Math.min(300, Number(d.waste) || 0) / 100);
        horas += (calc.printDurationHours(d.printHours) || 0) * r.q;
      }
      valor += total;
      if (FECHADOS.includes(o.status)) { fechado += total; fechados++; }
      lucro += total * (1 - taxa) - custo; // usa o total final (com desconto e preço ajustado)
      const nome = String(o.client_name || '').trim();
      if (nome) clientes.set(nome, (clientes.get(nome) || 0) + total);
    }
    let pedidos = 0, unidades = 0, custoImpressao = 0;
    const pecas = new Map();
    for (const p of impressoes) for (const r of p.inventta3d_print_requests || []) {
      if (!noMes(r.requested_at, ano, mes)) continue;
      const q = Number(r.quantity) || 0;
      pedidos++; unidades += q; custoImpressao += q * (Number(r.unit_print_cost) || 0);
      pecas.set(p.name, (pecas.get(p.name) || 0) + q);
    }
    return { orcamentos: doMes.length, valor, fechado, fechados, lucro, ticket: doMes.length ? valor / doMes.length : 0, gramas, horas, pedidos, unidades, custoImpressao, topPecas: top(pecas), topClientes: top(clientes) };
  }

  // valor orçado nos n meses que terminam em (ano, mes), do mais antigo para o mais recente
  function serie(orcamentos, ano, mes, n = 6) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(ano, mes - i, 1), a = d.getFullYear(), m = d.getMonth();
      out.push({ ano: a, mes: m, rotulo: MESES[m], valor: orcamentos.filter((o) => noMes(o.created_at, a, m)).reduce((t, o) => t + (Number(o.total) || 0), 0) });
    }
    return out;
  }

  return { resumoMes, serie, MESES };
});

(() => {
  if (typeof document === 'undefined') return;
  const P = window.ProjetoTridPainel, $ = (id) => document.getElementById(id), app = () => window.ProjetoTridApp;
  if (!$('dashBody')) return;
  const ROTA = '#/painel', NOMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const real = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const num = (n, c = 0) => n.toLocaleString('pt-BR', { maximumFractionDigits: c, minimumFractionDigits: c });
  const peso = (g) => (g >= 1000 ? `${num(g / 1000, 2)} kg` : `${num(g)} g`);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const hoje = new Date();
  let ano = hoje.getFullYear(), mes = hoje.getMonth(), orcs = [], imps = [], carregado = false;

  async function carregar() {
    const ok = app()?.client() && app()?.user();
    if (!ok) { orcs = []; imps = []; carregado = false; return desenhar(); }
    $('dashStatus').textContent = 'Carregando o painel…';
    const c = app().client();
    // ponytail: busca até 1000 orçamentos e filtra no aparelho; trocar por consulta por período se o volume crescer
    const [q, p] = await Promise.all([
      c.from('inventta3d_quotes').select('id,client_name,items,total,created_at,status').order('created_at', { ascending: false }).limit(1000),
      c.from('inventta3d_prints').select('id,name,inventta3d_print_requests(id,quantity,unit_print_cost,requested_at)').limit(1000),
    ]);
    if (q.error || p.error) { $('dashStatus').textContent = 'Não foi possível carregar o painel. Atualize a página para tentar novamente.'; return; }
    orcs = q.data || []; imps = p.data || []; carregado = true;
    $('dashStatus').textContent = '';
    desenhar();
  }

  function bloco(rotulo, valor, detalhe, { destaque = false, atual = null, anterior = null, mesAnterior = '' } = {}) {
    const b = el('div', 'dash-kpi' + (destaque ? ' destaque' : ''));
    b.append(el('span', 'dash-kpi-label', rotulo), el('strong', 'dash-kpi-value', valor));
    // variação contra o mês anterior (só quando o mês anterior teve valor)
    if (atual !== null && anterior > 0) {
      const v = Math.round(((atual - anterior) / anterior) * 100);
      b.append(el('span', `dash-kpi-var ${v > 0 ? 'sobe' : v < 0 ? 'desce' : ''}`, `${v > 0 ? '+' : ''}${v}% em relação a ${mesAnterior}`));
    }
    if (detalhe) b.append(el('span', 'dash-kpi-detail', detalhe));
    return b;
  }
  const compacto = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });

  function lista(titulo, itens, fmt, vazio) {
    const s = el('section', 'dash-card'), ol = el('ol', 'dash-rank');
    s.append(el('h2', '', titulo));
    if (!itens.length) s.append(el('p', 'dash-empty', vazio));
    else { itens.forEach(([nome, v]) => { const li = el('li'); li.append(el('span', '', nome), el('strong', '', fmt(v))); ol.append(li); }); s.append(ol); }
    return s;
  }

  function grafico(dados) {
    const s = el('section', 'dash-card dash-chart'), max = Math.max(...dados.map((d) => d.valor), 0);
    s.append(el('h2', '', 'Valor orçado nos últimos 6 meses'));
    const barras = el('div', 'dash-bars');
    barras.setAttribute('role', 'img');
    barras.setAttribute('aria-label', dados.map((d) => `${NOMES[d.mes]}: ${real.format(d.valor)}`).join('; '));
    dados.forEach((d, i) => {
      const col = el('div', 'dash-col' + (i === dados.length - 1 ? ' atual' : ''));
      const barra = el('div', 'dash-bar');
      barra.style.setProperty('--p', max ? Math.max(0.012, d.valor / max) : 0.012);
      const dica = el('span', 'dash-tip', real.format(d.valor));
      col.tabIndex = 0;
      col.append(dica, el('span', 'dash-val', d.valor ? compacto.format(d.valor) : '—'), barra, el('span', 'dash-col-label', d.rotulo));
      barras.append(col);
    });
    s.append(barras);
    return s;
  }

  function desenhar() {
    $('dashMonth').textContent = `${NOMES[mes][0].toUpperCase()}${NOMES[mes].slice(1)} de ${ano}`;
    const futuro = ano > hoje.getFullYear() || (ano === hoje.getFullYear() && mes >= hoje.getMonth());
    $('dashNext').disabled = futuro;
    const corpo = $('dashBody');
    corpo.replaceChildren();
    if (!carregado) return;
    const r = P.resumoMes(orcs, imps, ano, mes, window.ProjetoTridCalculations);
    const pa = mes === 0 ? ano - 1 : ano, pm = mes === 0 ? 11 : mes - 1, ant = P.resumoMes(orcs, imps, pa, pm, window.ProjetoTridCalculations);
    const comp = (a, b) => ({ atual: a, anterior: b, mesAnterior: NOMES[pm] });
    const kpis = el('div', 'dash-kpis');
    kpis.append(
      bloco('Lucro estimado', real.format(r.lucro), 'Se todos forem fechados', { destaque: true, ...comp(r.lucro, ant.lucro) }),
      bloco('Valor orçado', real.format(r.valor), `${r.orcamentos} ${r.orcamentos === 1 ? 'orçamento' : 'orçamentos'}`, comp(r.valor, ant.valor)),
      bloco('Valor fechado', real.format(r.fechado), `${r.fechados} ${r.fechados === 1 ? 'pedido aprovado' : 'pedidos aprovados'}`, comp(r.fechado, ant.fechado)),
      bloco('Ticket médio', real.format(r.ticket)),
      bloco('Filamento orçado', peso(r.gramas), `${num(r.horas, 1)} h de impressão`),
      bloco('Pedidos registrados', String(r.pedidos), `${r.unidades} ${r.unidades === 1 ? 'peça' : 'peças'} · ${real.format(r.custoImpressao)} de impressão`),
    );
    corpo.append(kpis, grafico(P.serie(orcs, ano, mes)), el('div', 'dash-lists'));
    corpo.lastChild.append(
      lista('Peças mais pedidas', r.topPecas, (v) => `${v} un`, 'Nenhum pedido registrado neste mês.'),
      lista('Clientes que mais orçaram', r.topClientes, (v) => real.format(v), 'Nenhum orçamento com cliente neste mês.'),
    );
  }

  $('dashPrev').addEventListener('click', () => { mes--; if (mes < 0) { mes = 11; ano--; } desenhar(); });
  $('dashNext').addEventListener('click', () => { mes++; if (mes > 11) { mes = 0; ano++; } desenhar(); });
  document.addEventListener('projetotrid:auth', () => { carregado = false; if (location.hash === ROTA) carregar(); });
  window.addEventListener('hashchange', () => { if (location.hash === ROTA) carregar(); });
  if (location.hash === ROTA) carregar(); else desenhar();
})();
