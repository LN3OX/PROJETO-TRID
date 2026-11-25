/* Capturas REAIS das telas de gestão do aplicativo (orçamentos salvos, clientes, painel do mês e impressões),
   com dados fictícios. Roda o app local com o banco falso dos testes.
   Uso:  node scripts/capturar-negocio.cjs      (as imagens vão para site/assets/img/) */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { entrar } = require('../tests/e2e/apoio.cjs');
const calc = require('../site/app/js/calculations.js');

const SAIDA = path.join(__dirname, '..', 'site', 'assets', 'img');
const BASE = 'http://127.0.0.1:5190';
const noAr = () => new Promise((ok) => http.get(BASE, (r) => { r.resume(); ok(true); }).on('error', () => ok(false)));

const PADRAO = { filamentType: 'PLA', packPrice: 120, packQty: 1000, waste: 8, failure: 5, power: 120, energyRate: 0.95, printerCost: 3200, lifeHours: 5000, maintenance: 0.4, setupMin: 20, finishMin: 10, laborRate: 30, packaging: 6, salesFee: 0, taxRate: 0, margin: 120 };
const dia = (n) => new Date(Date.now() - n * 86400000).toISOString();
const peca = (product, quantity, amount, printHours, filamentColor, extra = {}) => ({ ...PADRAO, product, quantity, amount, printHours, filamentColor, ...extra });

function orcamento(id, cliente, itens, dias, status, extra = {}) {
  const items = itens.map((d) => ({ data: d, result: calc.calculate(d) }));
  const subtotal = items.reduce((s, i) => s + i.result.price, 0);
  return { id, owner_id: 'x', title: itens[0].product, client_name: cliente, client_email: '', client_phone: '', items, share_mode: 'summary', discount_mode: 'percent', discount_input: 0, subtotal, discount_amount: 0, discount_percent: 0, total: subtotal, status, status_at: dia(dias), created_at: dia(dias), ...extra };
}

function semear(db) {
  db.projetotrid_customers.push(
    { id: 'c1', owner_id: 'x', name: 'Marina Souza', email: 'marina@exemplo.com', phone: '(11) 90000-0001', notes: 'Prefere vermelho e verde', created_at: dia(40) },
    { id: 'c2', owner_id: 'x', name: 'Rafael Cardoso', email: 'rafael@exemplo.com', phone: '(11) 90000-0002', notes: 'Pedidos de brindes para a empresa', created_at: dia(32) },
    { id: 'c3', owner_id: 'x', name: 'Ana Lima', email: 'ana@exemplo.com', phone: '(21) 90000-0003', notes: '', created_at: dia(25) },
    { id: 'c4', owner_id: 'x', name: 'Studio Prisma', email: 'contato@exemplo.com', phone: '(31) 90000-0004', notes: 'Peças de decoração em lote', created_at: dia(18) },
    { id: 'c5', owner_id: 'x', name: 'Carlos Mendes', email: 'carlos@exemplo.com', phone: '(11) 90000-0005', notes: '', created_at: dia(9) },
  );
  db.projetotrid_quotes.push(
    orcamento('q1', 'Marina Souza', [peca('Vaso decorativo', 12, 38, '03:40', 'Vermelho')], 1, 'orcado'),
    orcamento('q2', 'Rafael Cardoso', [peca('Chaveiro com logo', 50, 6, '00:25', 'Preto'), peca('Suporte de mesa', 10, 55, '02:10', 'Cinza')], 3, 'imprimindo'),
    orcamento('q3', 'Studio Prisma', [peca('Luminária geométrica', 6, 120, '07:30', 'Branco')], 5, 'aprovado'),
    orcamento('q4', 'Ana Lima', [peca('Porta-lápis', 4, 45, '02:50', 'Azul')], 8, 'pronto'),
    orcamento('q5', 'Carlos Mendes', [peca('Organizador de cabos', 20, 18, '01:05', 'Preto')], 11, 'entregue'),
    orcamento('q6', 'Marina Souza', [peca('Enfeite de Natal', 30, 14, '00:50', 'Vermelho')], 14, 'entregue'),
    orcamento('q7', 'Rafael Cardoso', [peca('Placa de mesa', 8, 30, '01:40', 'Grafite')], 17, 'recusado'),
  );
  const imp = (id, name, material, color, g, min, custo, pedidos) => ({ id, owner_id: 'x', name, material, color, weight_g: g, print_minutes: min, material_cost: custo * 0.4, energy_cost: custo * 0.1, machine_cost: custo * 0.5, print_cost: custo, file_path: null, file_name: `${name.toLowerCase().replace(/ /g, '_')}.3mf`, file_size: 2400000, showcase: false, showcase_price: null, showcase_text: '', photo_path: null, created_at: dia(30), updated_at: dia(2), projetotrid_print_requests: pedidos.map(([cid, cn, q, d], i) => ({ id: `${id}-r${i}`, customer_id: cid, customer_name: cn, quantity: q, unit_print_cost: custo, requested_at: dia(d), quote_id: null })) });
  db.projetotrid_prints.push(
    imp('p1', 'Vaso decorativo', 'PLA', 'Vermelho', 38, 220, 6.4, [['c1', 'Marina Souza', 12, 1]]),
    imp('p2', 'Chaveiro com logo', 'PLA', 'Preto', 6, 25, 1.1, [['c2', 'Rafael Cardoso', 50, 3]]),
    imp('p3', 'Luminária geométrica', 'PETG', 'Branco', 120, 450, 19.8, [['c4', 'Studio Prisma', 6, 5]]),
    imp('p4', 'Organizador de cabos', 'PLA', 'Preto', 18, 65, 3.2, [['c5', 'Carlos Mendes', 20, 11]]),
  );
  // o banco falso junta os pedidos de impressão pela tabela própria
  for (const pr of db.projetotrid_prints) db.projetotrid_print_requests.push(...pr.projetotrid_print_requests.map((r) => ({ ...r, print_id: pr.id })));
  // meses anteriores, para o gráfico do painel
  db.projetotrid_quotes.push(
    orcamento('q8', 'Ana Lima', [peca('Porta-lápis', 10, 45, '02:50', 'Azul')], 40, 'entregue'),
    orcamento('q9', 'Rafael Cardoso', [peca('Chaveiro com logo', 30, 6, '00:25', 'Preto')], 48, 'entregue'),
    orcamento('q10', 'Studio Prisma', [peca('Luminária geométrica', 4, 120, '07:30', 'Branco')], 75, 'entregue'),
    orcamento('q11', 'Marina Souza', [peca('Vaso decorativo', 8, 38, '03:40', 'Verde')], 105, 'entregue'),
  );
}

(async () => {
  let servidor = null;
  if (!(await noAr())) { servidor = spawn(process.execPath, [path.join(__dirname, '..', 'tests', 'e2e', 'servidor.cjs')], { stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 1500)); }
  const navegador = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
  try {
    const ctx = await navegador.newContext({ baseURL: BASE, viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1.5, colorScheme: 'light', locale: 'pt-BR' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.log('ERRO', String(e).slice(0, 160)));
    const banco = await entrar(p);
    semear(banco.db);
    for (const [rota, arq] of [['orcamentos-salvos', 'app-salvos.jpg'], ['clientes', 'app-clientes.jpg'], ['painel', 'app-painel.jpg'], ['impressoes', 'app-impressoes.jpg']]) {
      await p.evaluate((r) => { document.documentElement.style.scrollBehavior = 'auto'; location.hash = '#/' + r; }, rota);
      await p.waitForTimeout(2200);
      await p.evaluate(() => scrollTo(0, 0));
      await p.screenshot({ path: path.join(SAIDA, arq), type: 'jpeg', quality: 86 });
      console.log('ok', arq);
    }
    // orçamentos salvos numa janela mais alta (1000 x 820), para o painel do site mostrar a tela inteira
    await p.setViewportSize({ width: 1000, height: 820 });
    await p.evaluate(() => { location.hash = '#/orcamentos-salvos'; });
    await p.waitForTimeout(2200); await p.evaluate(() => scrollTo(0, 0));
    await p.screenshot({ path: path.join(SAIDA, 'app-salvos.jpg'), type: 'jpeg', quality: 86 });
    await ctx.close();
    // as mesmas telas no celular (390 x 844), para o site mostrar legíveis
    const cel = await navegador.newContext({ baseURL: BASE, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light', locale: 'pt-BR' });
    const q = await cel.newPage();
    const b2 = await entrar(q);
    semear(b2.db);
    for (const [rota, arq] of [['clientes', 'app-cel-clientes.jpg'], ['painel', 'app-cel-painel.jpg'], ['impressoes', 'app-cel-impressoes.jpg']]) {
      await q.evaluate((r) => { document.documentElement.style.scrollBehavior = 'auto'; location.hash = '#/' + r; }, rota);
      await q.waitForTimeout(2200);
      await q.evaluate(() => scrollTo(0, 0));
      await q.screenshot({ path: path.join(SAIDA, arq), type: 'jpeg', quality: 86 });
      console.log('ok', arq);
    }
    await cel.close();
  } finally {
    await navegador.close();
    if (servidor) servidor.kill();
  }
})();
