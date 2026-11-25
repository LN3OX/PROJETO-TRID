const test = require('node:test');
const assert = require('node:assert');
const P = require('../site/app/js/painel.js');
const calc = require('../site/app/js/calculations.js');

const dados = { quantity: 2, amount: 50, packPrice: 120, packQty: 1000, waste: 10, failure: 0, power: 100, energyRate: 1, printerCost: 0, lifeHours: 1, maintenance: 0, printHours: '01:30', setupMin: 0, finishMin: 0, laborRate: 0, packaging: 0, salesFee: 10, taxRate: 0, margin: 100 };
const custo = calc.calculate(dados).cost; // material 13,20 + energia 0,30 = 13,50
const orc = (total, quando, cliente = '') => ({ total, created_at: quando, client_name: cliente, items: [{ data: dados }] });

test('resumo do mês: soma só o mês pedido; lucro usa o total final menos taxas e custo', () => {
  const orcs = [orc(100, '2026-11-03T12:00:00'), { ...orc(60, '2026-11-20T12:00:00', 'Ana'), status: 'entregue' }, orc(999, '2026-10-31T12:00:00', 'Ana')];
  const r = P.resumoMes(orcs, [], 2026, 10, calc);
  assert.strictEqual(r.orcamentos, 2);
  assert.strictEqual(r.valor, 160);
  assert.strictEqual(r.ticket, 80);
  assert.deepStrictEqual([r.fechado, r.fechados], [60, 1]); // só o entregue conta como fechado
  assert.ok(Math.abs(custo - 13.5) < 1e-9);
  assert.ok(Math.abs(r.lucro - (160 * 0.9 - 2 * custo)) < 1e-9);
  assert.ok(Math.abs(r.gramas - 2 * 50 * 2 * 1.1) < 1e-9); // 2 orçamentos × 2 peças × 50 g × 1,1
  assert.ok(Math.abs(r.horas - 2 * 2 * 1.5) < 1e-9);
  assert.deepStrictEqual(r.topClientes, [['Ana', 60]]);
});

test('pedidos do histórico: conta pedidos, peças e custo; ranking por unidades', () => {
  const imps = [
    { name: 'Suporte', projetotrid_print_requests: [{ quantity: 3, unit_print_cost: 2, requested_at: '2026-11-02T10:00:00' }, { quantity: 1, unit_print_cost: 2, requested_at: '2026-09-02T10:00:00' }] },
    { name: 'Chaveiro', projetotrid_print_requests: [{ quantity: 5, unit_print_cost: 1, requested_at: '2026-11-10T10:00:00' }] },
  ];
  const r = P.resumoMes([], imps, 2026, 10, calc);
  assert.deepStrictEqual([r.pedidos, r.unidades, r.custoImpressao], [2, 8, 11]);
  assert.deepStrictEqual(r.topPecas, [['Chaveiro', 5], ['Suporte', 3]]);
  assert.deepStrictEqual([r.orcamentos, r.valor, r.ticket], [0, 0, 0]);
});

test('série de 6 meses atravessa a virada do ano, do mais antigo para o atual', () => {
  const s = P.serie([orc(10, '2026-01-05T12:00:00'), orc(5, '2025-09-05T12:00:00')], 2026, 1);
  assert.deepStrictEqual(s.map((x) => x.rotulo), ['set', 'out', 'nov', 'dez', 'jan', 'fev']);
  assert.deepStrictEqual(s.map((x) => x.valor), [5, 0, 0, 0, 10, 0]);
});
