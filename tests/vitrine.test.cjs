const test = require('node:test');
const assert = require('node:assert');
const V = require('../site/app/js/vitrine.js');

test('endereço da vitrine: só minúsculas, números e hífen, 3 a 40 caracteres, sem hífen nas pontas', () => {
  for (const ok of ['abc', 'projetotrid', 'loja-do-joao', 'a'.repeat(40)]) assert.ok(V.slugValido(ok), ok);
  for (const ruim of ['ab', '-abc', 'abc-', 'Abc', 'a b', 'ação', 'a'.repeat(41), '', null]) assert.ok(!V.slugValido(ruim), String(ruim));
  assert.strictEqual(V.paraSlug('  Ateliê 3D da Ana!  '), 'atelie-3d-da-ana');
});

test('mensagem "quero uma igual" leva o nome da loja e da peça', () => {
  assert.strictEqual(V.pedido('Projeto Trid', { name: 'Vaso', color: 'Azul' }), 'Olá, Projeto Trid! Vi na vitrine: Vaso (Azul). Quero uma igual. Pode me passar o orçamento?');
});

test('URL pública da foto codifica cada parte do caminho', () => {
  assert.strictEqual(V.fotoUrl('https://x.supabase.co', 'u1/peça 1.jpg'), 'https://x.supabase.co/storage/v1/object/public/inventta3d-vitrine/u1/pe%C3%A7a%201.jpg');
  assert.strictEqual(V.fotoUrl('https://x.supabase.co', null), '');
});
