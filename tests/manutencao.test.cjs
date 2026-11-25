const test = require('node:test');
const assert = require('node:assert');
const M = require('../site/app/js/manutencao.js');

const imps = [
  { print_minutes: 90, projetotrid_print_requests: [{ quantity: 2, requested_at: '2026-11-10T10:00:00Z' }, { quantity: 4, requested_at: '2026-10-01T10:00:00Z' }] },
  { print_minutes: 30, projetotrid_print_requests: [{ quantity: 1, requested_at: '2026-11-12T10:00:00Z' }] },
];

test('horímetro: valor informado + pedidos depois dele, só quando há uma impressora', () => {
  const imp = { hours: 100, hours_at: '2026-11-01T00:00:00Z' };
  assert.strictEqual(M.horasDesde(imps, imp.hours_at), 3.5); // 90 min × 2 + 30 min × 1
  assert.strictEqual(M.horimetro(imp, imps, true), 103.5);
  assert.strictEqual(M.horimetro(imp, imps, false), 100);
});

test('tarefa: faltam, vencida e perto (últimos 10% do intervalo)', () => {
  const t = { intervalo_h: 200, ultima_h: 100 };
  assert.deepStrictEqual(M.situacao(t, 150), { faltam: 150, pct: 25, vencida: false, perto: false });
  assert.strictEqual(M.situacao(t, 290).perto, true);
  const v = M.situacao(t, 320);
  assert.deepStrictEqual([v.faltam, v.pct, v.vencida], [-20, 100, true]);
});

test('impressora nova começa com as tarefas padrão contadas a partir das horas atuais', () => {
  const t = M.novasTarefas(42);
  assert.strictEqual(t.length, M.TAREFAS_PADRAO.length);
  assert.ok(t.every((x) => x.ultima_h === 42 && x.intervalo_h > 0));
});
