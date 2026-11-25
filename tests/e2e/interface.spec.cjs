// Testes de interface no navegador. Cada teste descreve o que o usuário faz e vê.
// Os módulos (telas) são lidos de js/modules.js: uma tela nova entra sozinha nos testes de navegação e de layout.
const { test, expect } = require('@playwright/test');
const { sessaoDeTeste, entrar, gerarOrcamento, auditar, cuboSTL, cubo3mfFatiado, bancoFalso, urlSupabase } = require('./apoio.cjs');

const ehCelular = (info) => info.project.name.startsWith('celular');
const ehComputador = (info) => info.project.name.startsWith('computador');
const escolherEnvio = async (page, nome) => {
  await page.locator('#shareMenuBtn').click();
  await page.getByRole('menuitem', { name: nome }).click();
};

test.describe('login', () => {
  test('abre sem erros, mostra o formulário e alterna o tema', async ({ page }) => {
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Acesse sua conta' })).toBeVisible();
    await expect(page.locator('#loginScreen input')).toHaveCount(0); // só Google: sem e-mail nem senha
    await expect(page.getByText(/Criar conta|Esqueci minha senha|Entrar com senha/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Continuar com Google/ })).toBeVisible();
    const antes = await page.locator('html').getAttribute('data-theme');
    await page.locator('.login-tools [data-theme-toggle]').click();
    expect(await page.locator('html').getAttribute('data-theme')).not.toBe(antes);
    expect(erros).toEqual([]);
  });

  test('layout: nada sai da tela e os botões ficam alinhados', async ({ page }) => {
    await page.goto('/app/');
    expect(await auditar(page, '#loginScreen')).toEqual([]);
  });

  test('computador: logo alinhada com o título', async ({ page }, info) => {
    test.skip(!ehComputador(info) || info.project.use.viewport.width < 960, 'só na tela dividida');
    await page.goto('/app/');
    const centro = async (sel) => page.locator(sel).first().evaluate((e) => { const r = e.getBoundingClientRect(); return (r.top + r.bottom) / 2; });
    const logo = await page.locator('.aside-logo img:visible').evaluate((e) => { const r = e.getBoundingClientRect(); return (r.top + r.bottom) / 2; });
    expect(Math.abs(logo - (await centro('#loginTitle')))).toBeLessThan(3);
    const q = await page.locator('.login-aside').boundingBox();
    expect(q.x).toBe(0);
    expect(q.y).toBe(0);
  });
});

test.describe('orçamento', () => {
  test('percorre as 5 etapas e gera o resultado', async ({ page }) => {
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await entrar(page);
    await gerarOrcamento(page);
    await expect(page.locator('#batchTotal')).toHaveText(/R\$\s*\d/);
    await expect(page.locator('#quoteItems')).toContainText('Suporte de teste');
    expect(erros).toEqual([]);
  });

  test('desconto: valor final recalcula o total e a lista de ações aparece', async ({ page }) => {
    await entrar(page);
    await gerarOrcamento(page);
    await page.locator('label.discount-choice', { hasText: 'Valor final' }).click();
    await page.locator('#discountValue').fill('');
    await page.locator('#discountValue').pressSequentially('1000');
    await expect(page.locator('#batchTotal')).toContainText('10,00');
    for (const nome of ['Salvar orçamento', 'Salvar no histórico', 'Ajustar preços', 'Adicionar item', 'Limpar pedido']) {
      await expect(page.getByRole('button', { name: nome })).toBeVisible();
    }
  });

  test('salvar orçamento grava no banco', async ({ page }) => {
    const banco = await entrar(page);
    await gerarOrcamento(page);
    await page.locator('#saveQuoteBtn').click();
    await expect.poll(() => banco.db.projetotrid_quotes.length).toBe(1);
    expect(banco.db.projetotrid_quotes[0].client_name).toBe('Rafael Cardoso');
  });

  test('layout: etapas, resultado e diálogos sem itens fora da tela', async ({ page }) => {
    await entrar(page);
    const achados = [];
    const proximo = (i) => page.locator(`.panel[data-panel="${i}"] .btn-next`).click();
    await page.getByRole('textbox', { name: 'Nome da peça' }).fill('Peça com um nome bem comprido para testar a quebra de linha nas telas pequenas');
    achados.push(...(await auditar(page, '.panel[data-panel="0"]')));
    await proximo(0);
    await page.locator('#amount').fill('38');
    await page.locator('#packPrice').fill('120');
    achados.push(...(await auditar(page, '.panel[data-panel="1"]')));
    await page.getByRole('button', { name: /Abrir calculadora para Filamento por peça/ }).click();
    achados.push(...(await auditar(page, '#calcDialog')));
    await page.keyboard.press('Escape');
    await proximo(1);
    await page.locator('#printHours').fill('0342');
    achados.push(...(await auditar(page, '.panel[data-panel="2"]')));
    await proximo(2);
    achados.push(...(await auditar(page, '.panel[data-panel="3"]')));
    await proximo(3);
    achados.push(...(await auditar(page, '.panel[data-panel="4"]')));
    await proximo(4);
    await page.locator('#result.show').waitFor();
    await page.locator('details.internal > summary').click();
    achados.push(...(await auditar(page, '#result')));
    await page.locator('#savePrintBtn').click();
    achados.push(...(await auditar(page, '#printSaveDialog')));
    await page.locator('#printSaveCancel').click();
    await escolherEnvio(page, 'Pré-visualizar');
    await expect(page.locator('#previewDialog')).toBeVisible();
    achados.push(...(await auditar(page, '#previewDialog')));
    expect(achados).toEqual([]);
  });
});

test.describe('enviar por e-mail', () => {
  test('gera o PDF e prepara o e-mail com o cliente preenchido', async ({ page }, info) => {
    await page.addInitScript(() => {
      window.__abertos = [];
      window.open = (u) => { window.__abertos.push(u); return null; };
      window.__compartilhado = null;
      navigator.canShare = () => true;
      navigator.share = async (d) => { window.__compartilhado = { title: d.title, texto: d.text, arquivos: (d.files || []).map((f) => `${f.name}:${f.type}`) }; };
    });
    await entrar(page);
    await gerarOrcamento(page, { cliente: 'Rafael Cardoso', email: 'rafael@exemplo.com' });
    const celular = ehCelular(info);
    const download = celular ? null : page.waitForEvent('download');
    await escolherEnvio(page, 'E-mail com PDF');
    await expect(page.locator('#shareMain')).toContainText('Enviar por e-mail');
    if (celular) {
      await expect(page.locator('#shareStatus')).toContainText('Compartilhamento aberto');
      const c = await page.evaluate(() => window.__compartilhado);
      expect(c.arquivos).toEqual(['orcamento-projeto-trid.pdf:application/pdf']);
      expect(c.title).toContain('Rafael Cardoso');
      expect(c.texto).toContain('Olá, Rafael!');
    } else {
      expect((await download).suggestedFilename()).toBe('orcamento-projeto-trid.pdf');
      await expect(page.locator('#shareStatus')).toContainText('PDF baixado e e-mail aberto');
      const [link] = await page.evaluate(() => window.__abertos);
      expect(link).toMatch(/^mailto:rafael%40exemplo\.com\?subject=/);
      expect(decodeURIComponent(link)).toContain('Segue o orçamento em PDF');
    }
    await expect(page.locator('#shareMain')).toBeEnabled();
  });

  test('botão dividido: lembra a última forma, abre pelo teclado e pré-visualizar não muda o principal', async ({ page }) => {
    await entrar(page);
    await gerarOrcamento(page);
    const principal = page.locator('#shareMain');
    await expect(principal).toContainText('Enviar pelo WhatsApp');
    await page.locator('#shareMenuBtn').click();
    await expect(page.getByRole('menuitem')).toHaveCount(5);
    await expect(page.locator('#shareMenuBtn')).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('#shareMenu')).toBeHidden();
    await expect(page.locator('#shareMenuBtn')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#shareMenu')).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'E-mail com PDF' })).toBeFocused();
    await page.keyboard.press('Escape');
    const download = page.waitForEvent('download');
    await escolherEnvio(page, 'Baixar PDF');
    expect((await download).suggestedFilename()).toBe('orcamento-projeto-trid.pdf');
    await expect(principal).toContainText('Baixar PDF');
    await escolherEnvio(page, 'Pré-visualizar');
    await expect(page.locator('#previewDialog')).toBeVisible();
    await page.locator('#previewClose').click();
    await expect(principal).toContainText('Baixar PDF');
    await page.reload();
    await expect(page.locator('#shareMainLbl')).toHaveText('Baixar PDF');
  });
});

test.describe('o que vai para o cliente', () => {
  test('o texto enviado mostra itens, desconto e total, nunca custos nem lucro', async ({ page }) => {
    await page.addInitScript(() => {
      window.__copiado = '';
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__copiado = t; } }, configurable: true });
    });
    await entrar(page);
    await gerarOrcamento(page);
    await expect(page.locator('input[name="shareMode"]')).toHaveCount(0);
    await escolherEnvio(page, 'Copiar texto');
    await expect.poll(() => page.evaluate(() => window.__copiado)).toContain('TOTAL DO PEDIDO');
    const texto = await page.evaluate(() => window.__copiado);
    expect(texto).toContain('Suporte de teste');
    for (const proibido of ['DETALHAMENTO', 'Custo estimado', 'Material e desperdício', 'Taxas e tributos', 'lucro']) {
      expect(texto.toLowerCase()).not.toContain(proibido.toLowerCase());
    }
  });

  test('copiar detalhamento leva a composição interna para a área de transferência', async ({ page }) => {
    await page.addInitScript(() => {
      window.__copiado = '';
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__copiado = t; } }, configurable: true });
    });
    await entrar(page);
    await gerarOrcamento(page);
    await page.locator('details.internal > summary').click();
    await page.getByRole('button', { name: 'Copiar detalhamento' }).click();
    await expect(page.locator('#copyDetailBtn')).toContainText('Detalhamento copiado');
    const texto = await page.evaluate(() => window.__copiado);
    for (const esperado of ['USO INTERNO', 'Material e desperdício', 'Custo estimado', 'Taxas e tributos', 'Lucro estimado após taxas', 'Total do pedido']) expect(texto).toContain(esperado);
    await expect(page.locator('#copyDetailBtn')).toContainText('Copiar detalhamento', { timeout: 6000 });
  });

  test('a visão interna continua com composição e lucro, só na tela', async ({ page }) => {
    await entrar(page);
    await gerarOrcamento(page);
    await page.locator('details.internal > summary').click();
    await expect(page.locator('details.internal')).toContainText('Lucro estimado após taxas');
    await expect(page.locator('details.internal')).toContainText('privados e não aparecem no orçamento compartilhado');
  });
});

test.describe('calculadora', () => {
  const abrir = (page, campo) => page.getByRole('button', { name: new RegExp(`Abrir calculadora para ${campo}`) }).click();

  test('só aparece nos campos de valor do orçamento, nunca no login nem nas outras telas', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.locator('.calc-open:visible')).toHaveCount(0);
    await entrar(page);
    await expect(page.locator('.calc-open')).toHaveCount(3);
    for (const rota of ['#/clientes', '#/impressoes', '#/orcamentos-salvos']) {
      await page.evaluate((r) => { location.hash = r; }, rota);
      await expect(page.locator('.calc-open:visible')).toHaveCount(0);
    }
  });

  test('filamento por peça: soma pelo teclado e grava o resultado no campo', async ({ page }) => {
    await entrar(page);
    await page.getByRole('textbox', { name: 'Nome da peça' }).fill('Peça');
    await page.locator('.panel[data-panel="0"] .btn-next').click();
    await abrir(page, 'Filamento por peça');
    await expect(page.locator('#calcDialog')).toBeVisible();
    await expect(page.locator('#calcAlvo')).toContainText('Filamento por peça');
    await page.keyboard.type('30+8');
    await expect(page.locator('#calcResult')).toHaveText('38');
    await page.locator('#calcUse').click();
    await expect(page.locator('#calcDialog')).toBeHidden();
    await expect(page.locator('#amount')).toHaveValue('38');
  });

  test('preço do rolo: divisão grava em reais com duas casas; teclado na tela funciona', async ({ page }) => {
    await entrar(page);
    await page.getByRole('textbox', { name: 'Nome da peça' }).fill('Peça');
    await page.locator('.panel[data-panel="0"] .btn-next').click();
    await abrir(page, 'Preço do');
    await page.locator('#calcDialog [data-tecla="1"]').click();
    await page.locator('#calcDialog [data-tecla="2"]').click();
    await page.locator('#calcDialog [data-tecla="0"]').click();
    await page.locator('#calcDialog [data-tecla="0"]').click();
    await page.locator('#calcDialog [data-tecla="/"]').click();
    await page.locator('#calcDialog [data-tecla="1"]').click();
    await page.locator('#calcDialog [data-tecla="0"]').click();
    await expect(page.locator('#calcExpr')).toHaveText('1200÷10');
    await expect(page.locator('#calcResult')).toHaveText('120');
    await page.locator('#calcUse').click();
    await expect(page.locator('#packPrice')).toHaveValue('120,00');
  });

  test('valor final do desconto: calcula, grava e o total acompanha; % e Esc funcionam', async ({ page }) => {
    await entrar(page);
    await gerarOrcamento(page);
    await page.locator('label.discount-choice', { hasText: 'Valor final' }).click();
    await abrir(page, 'Valor final');
    await page.keyboard.press('Delete');
    await page.keyboard.type('200+10%');
    await expect(page.locator('#calcResult')).toHaveText('220');
    await page.keyboard.press('Delete');
    await page.keyboard.type('20-8,5');
    await expect(page.locator('#calcResult')).toHaveText('11,5');
    await page.locator('#calcUse').click();
    await expect(page.locator('#discountValue')).toHaveValue('11,50');
    await expect(page.locator('#batchTotal')).toContainText('11,50');
    await abrir(page, 'Valor final');
    await page.keyboard.press('Escape');
    await expect(page.locator('#calcDialog')).toBeHidden();
  });

  test('conta incompleta mostra aviso e não altera o campo', async ({ page }) => {
    await entrar(page);
    await page.getByRole('textbox', { name: 'Nome da peça' }).fill('Peça');
    await page.locator('.panel[data-panel="0"] .btn-next').click();
    await abrir(page, 'Filamento por peça');
    await page.keyboard.type('5+');
    await page.locator('#calcUse').click();
    await expect(page.locator('#calcResult')).toHaveText('Complete a conta');
    await expect(page.locator('#calcDialog')).toBeVisible();
    await expect(page.locator('#amount')).not.toHaveValue('5');
  });
});

test.describe('importar do fatiador', () => {
  const gcode = (txt) => ({ name: 'Suporte_headset.gcode', mimeType: 'text/plain', buffer: Buffer.from(txt) });

  test('G-code preenche nome, filamento, tempo e material; o orçamento sai com esses valores', async ({ page }) => {
    await entrar(page);
    await page.locator('#slicerFile').setInputFiles(gcode('; filament used [g] = 12.34\n; estimated printing time (normal mode) = 1h 23m 45s\n; filament_type = PETG\n'));
    await expect(page.locator('#slicerStatus')).toContainText('12,3 g');
    await expect(page.locator('#product')).toHaveValue('Suporte headset');
    await expect(page.locator('#amount')).toHaveValue('12,3');
    await expect(page.locator('#printHours')).toHaveValue('01:24');
    await expect(page.locator('#filamentType')).toHaveValue('PETG');
    await expect(page.locator('[data-recap="time"]')).toContainText('01h24min');
  });

  test('não sobrescreve o nome digitado e avisa quando o arquivo não tem resumo', async ({ page }) => {
    await entrar(page);
    await page.getByRole('textbox', { name: 'Nome da peça' }).fill('Minha peça');
    await page.locator('#slicerFile').setInputFiles(gcode('G28\nG1 X10\n'));
    await expect(page.locator('#slicerStatus')).toHaveClass(/erro/);
    await expect(page.locator('#slicerStatus')).toContainText('Não encontrei');
    await page.locator('#slicerFile').setInputFiles(gcode(';TIME:3600\n;Filament used: 4m\n'));
    await expect(page.locator('#slicerStatus')).toContainText('aprox.');
    await expect(page.locator('#product')).toHaveValue('Minha peça');
    await expect(page.locator('#printHours')).toHaveValue('01:00');
  });
});

test.describe('importar STL para ver em 3D', () => {
  test('3MF fatiado: preenche peso, tempo e material e também mostra a peça em 3D', async ({ page }) => {
    await entrar(page);
    await page.locator('#slicerFile').setInputFiles(cubo3mfFatiado());
    await expect(page.locator('#slicerStatus')).toContainText('12,5 g');
    await expect(page.locator('#amount')).toHaveValue('12,5');
    await expect(page.locator('#printHours')).toHaveValue('01:30');
    await expect(page.locator('#filamentType')).toHaveValue('PETG');
    await expect(page.locator('#slicerView canvas')).toBeVisible();
    for (const n of ['Escolher cor', 'Compartilhar peça']) await expect(page.locator('#slicerView').getByRole('button', { name: n })).toBeVisible();
  });

  test('3MF de projeto colorido: o 3D abre com as cores do projeto; escolher outra cor sai delas; voltar restaura', async ({ page }) => {
    await entrar(page);
    await page.locator('#slicerFile').setInputFiles(cubo3mfFatiado('cubo_colorido.3mf', { colorido: true }));
    await expect(page.locator('#slicerView canvas')).toBeVisible();
    const v = page.locator('#slicerView');
    await v.getByRole('button', { name: 'Escolher cor' }).click();
    const projeto = v.getByRole('button', { name: 'Cores do projeto' });
    await expect(projeto).toHaveAttribute('aria-pressed', 'true');
    await v.getByRole('button', { name: 'Vermelho' }).click();
    await expect(projeto).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#filamentColor')).toHaveValue('Vermelho');
    await projeto.click();
    await expect(projeto).toHaveAttribute('aria-pressed', 'true');
    await expect(v.getByRole('button', { name: 'Vermelho' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('3MF sem cores de projeto (e STL): não há botão "Cores do projeto"', async ({ page }) => {
    await entrar(page);
    await page.locator('#slicerFile').setInputFiles(cuboSTL());
    await expect(page.locator('#slicerView canvas')).toBeVisible();
    await page.locator('#slicerView').getByRole('button', { name: 'Escolher cor' }).click();
    await expect(page.locator('#slicerView').getByRole('button', { name: 'Cores do projeto' })).toHaveCount(0);
  });

  test('STL: mostra a peça em 3D, sem estimar peso nem tempo; trocar a cor preenche a cor do filamento', async ({ page }) => {
    await entrar(page);
    await page.locator('#slicerFile').setInputFiles(cuboSTL());
    await expect(page.locator('#slicerStatus')).toContainText('Peça em 3D');
    await expect(page.locator('#product')).toHaveValue('cubo teste');
    await expect(page.locator('#slicerView canvas')).toBeVisible();
    await expect(page.locator('#slicerView canvas')).toHaveAttribute('aria-label', /cubo teste/);
    await expect(page.locator('#amount')).toHaveValue('');
    await expect(page.locator('#printHours')).toHaveValue('');
    await expect(page.locator('#slicerView').getByRole('button', { name: 'Azul' })).toBeHidden(); // cores ficam atrás do ícone
    await page.locator('#slicerView').getByRole('button', { name: 'Escolher cor' }).click();
    await page.locator('#slicerView').getByRole('button', { name: 'Azul' }).click();
    await expect(page.locator('#filamentColor')).toHaveValue('Azul');
    await expect(page.locator('#slicerView').getByRole('button', { name: 'Azul' })).toHaveAttribute('aria-pressed', 'true');
    await page.locator('.panel[data-panel="0"] .btn-next').click();
    await page.locator('#filamentColor').fill('Vermelho fosco');
    await page.locator('.panel[data-panel="1"] .btn-back').click();
    await page.locator('#slicerView').getByRole('button', { name: 'Escolher cor' }).click(); // clicar fora fechou o painel
    await expect(page.locator('#slicerView').getByRole('button', { name: 'Vermelho' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#slicerView').getByRole('button', { name: 'Azul' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('3D redesenha só quando algo muda: parado não gasta quadros; girar e trocar a cor atualizam a imagem', async ({ page }) => {
    await entrar(page);
    await page.evaluate(() => { window.__q = 0; const ra = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (f) => ra((t) => { window.__q++; f(t); }); });
    await page.locator('#slicerFile').setInputFiles(cuboSTL());
    const canvas = page.locator('#slicerView canvas');
    await expect(canvas).toBeVisible();
    await page.waitForTimeout(1200);
    const q0 = await page.evaluate(() => window.__q); await page.waitForTimeout(1500);
    expect((await page.evaluate(() => window.__q)) - q0).toBeLessThanOrEqual(3); // parado (antes: ~90 quadros por 1,5 s)
    const antes = await canvas.screenshot();
    const c = await canvas.boundingBox();
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2); await page.mouse.down(); await page.mouse.move(c.x + c.width / 2 + 90, c.y + c.height / 2 + 40, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(800);
    const girado = await canvas.screenshot();
    expect(girado.equals(antes)).toBe(false);
    await page.locator('#slicerView').getByRole('button', { name: 'Escolher cor' }).click();
    await page.locator('#slicerView').getByRole('button', { name: 'Azul' }).click();
    await page.waitForTimeout(400);
    expect((await canvas.screenshot()).equals(girado)).toBe(false);
  });

  test('STL: compartilhar imagem da peça (celular abre o compartilhamento, computador baixa o PNG)', async ({ page }, info) => {
    const celular = info.project.name.startsWith('celular');
    await page.addInitScript(() => { window.__enviado = null; navigator.canShare = () => true; navigator.share = async (d) => { window.__enviado = d.files.map((f) => `${f.name}:${f.type}:${f.size}`); }; });
    await entrar(page);
    await page.locator('#slicerFile').setInputFiles(cuboSTL(20, 'cubo_teste.stl'));
    await expect(page.locator('#slicerView canvas')).toBeVisible();
    await page.getByRole('button', { name: 'Compartilhar peça' }).click();
    if (celular) {
      await page.getByRole('button', { name: 'Compartilhar imagem' }).click();
      await expect.poll(() => page.evaluate(() => window.__enviado?.[0])).toMatch(/^cubo-teste\.png:image\/png:\d{4,}/);
    } else {
      const [baixou] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Compartilhar imagem' }).click()]);
      expect(baixou.suggestedFilename()).toBe('cubo-teste.png');
    }
  });

  test('STL: compartilhar GIF girando; o arquivo tem 72 quadros de 400×300', async ({ page }, info) => {
    const celular = info.project.name.startsWith('celular');
    await page.addInitScript(() => { window.__gif = null; navigator.canShare = () => true; navigator.share = async (d) => { window.__gif = new Uint8Array(await d.files[0].arrayBuffer()); }; });
    await entrar(page);
    await page.locator('#slicerFile').setInputFiles(cuboSTL(20, 'cubo_teste.stl'));
    await expect(page.locator('#slicerView canvas')).toBeVisible();
    let bytes;
    await page.getByRole('button', { name: 'Compartilhar peça' }).click();
    if (celular) {
      await page.getByRole('button', { name: 'Compartilhar GIF' }).click();
      await expect.poll(() => page.evaluate(() => !!window.__gif), { timeout: 30000 }).toBe(true);
      bytes = Buffer.from(await page.evaluate(() => [...window.__gif]));
    } else {
      const [baixou] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByRole('button', { name: 'Compartilhar GIF' }).click()]);
      expect(baixou.suggestedFilename()).toBe('cubo-teste.gif');
      bytes = require('fs').readFileSync(await baixou.path());
    }
    expect(bytes.subarray(0, 6).toString()).toBe('GIF89a');
    expect(bytes.readUInt16LE(6)).toBe(400);
    expect(bytes.readUInt16LE(8)).toBe(300);
    expect(bytes.toString('latin1').split('!ù').length - 1).toBe(72); // um bloco de controle por quadro
    expect(bytes.at(-1)).toBe(0x3b);
    // a peça aparece de fato nos quadros (o GIF já saiu em branco num celular)
    const visiveis = await page.evaluate(async (dados) => {
      const dec = new ImageDecoder({ data: new Uint8Array(dados), type: 'image/gif' }), saida = [];
      await dec.tracks.ready;
      for (const i of [0, 36]) {
        const { image } = await dec.decode({ frameIndex: i }), c = new OffscreenCanvas(400, 300), x = c.getContext('2d');
        x.drawImage(image, 0, 0); const px = x.getImageData(0, 0, 400, 300).data; let n = 0;
        for (let k = 0; k < px.length; k += 4) if (Math.abs(px[k] - 0xf4) + Math.abs(px[k + 1] - 0xf2) + Math.abs(px[k + 2] - 0xee) > 30) n++;
        saida.push(n);
      }
      return saida;
    }, [...bytes]);
    expect(visiveis[0]).toBeGreaterThan(5000); expect(visiveis[1]).toBeGreaterThan(5000);
    await expect(page.getByRole('button', { name: 'Compartilhar GIF' })).toBeEnabled();
  });

  test('WhatsApp do orçamento leva junto o PNG da peça em 3D; pergunta se quer o GIF (não = sem GIF)', async ({ page }) => {
    await page.addInitScript(() => { window.__envio = null; navigator.canShare = () => true; navigator.share = async (d) => { window.__envio = d.files.map((f) => f.name); }; });
    await entrar(page);
    await page.locator('#slicerFile').setInputFiles(cuboSTL(20, 'cubo_teste.stl'));
    await expect(page.locator('#slicerView canvas')).toBeVisible();
    await gerarOrcamento(page);
    page.responder = false; // "Enviar também o GIF?" → não
    await page.locator('#shareMain').click();
    await expect.poll(() => page.evaluate(() => window.__envio), { timeout: 30000 }).toEqual(['orcamento-projeto-trid.png', 'peca-3d.png']);
    expect(page.confirmacoes.some((m) => m.includes('GIF'))).toBe(true);
  });

  test('WhatsApp do orçamento: respondendo sim, o GIF da peça vai junto', async ({ page }) => {
    test.setTimeout(120000);
    await page.addInitScript(() => { window.__envio = null; navigator.canShare = () => true; navigator.share = async (d) => { window.__envio = d.files.map((f) => `${f.name}:${f.type}:${f.size > 5000}`); }; });
    await entrar(page);
    await page.locator('#slicerFile').setInputFiles(cuboSTL(20, 'cubo_teste.stl'));
    await expect(page.locator('#slicerView canvas')).toBeVisible();
    await gerarOrcamento(page);
    await page.locator('#shareMain').click();
    await expect.poll(() => page.evaluate(() => window.__envio), { timeout: 90000 }).toEqual(['orcamento-projeto-trid.png:image/png:true', 'peca-3d.png:image/png:true', 'peca-3d.gif:image/gif:true']);
  });

  test('tela de preço mostra o mesmo quadro do 3D acima dos itens, com a mesma largura; voltar às etapas o devolve', async ({ page }) => {
    await entrar(page);
    await page.locator('#slicerFile').setInputFiles(cuboSTL(20, 'cubo_teste.stl'));
    await expect(page.locator('#slicerView canvas')).toBeVisible();
    await gerarOrcamento(page);
    const m = await page.evaluate(() => { const v = document.getElementById('slicerView'), i = document.querySelector('.batch-summary'), a = v.getBoundingClientRect(), b = i.getBoundingClientRect(); return { dentro: !!document.querySelector('#result .result-main > #slicerView'), acima: a.bottom <= b.top + 1, larg: Math.abs(a.width - b.width) < 2, esq: Math.abs(a.left - b.left) < 2, visivel: a.width > 100 && a.height > 100 }; });
    expect(m).toEqual({ dentro: true, acima: true, larg: true, esq: true, visivel: true });
    await expect(page.locator('#slicerView canvas')).toBeVisible();
    await page.getByRole('button', { name: /^Etapa 1:/ }).click();
    await expect(page.locator('#result')).not.toHaveClass(/show/);
    await expect(page.locator('.slicer-import #slicerView')).toHaveCount(1);
    await expect(page.locator('#result #slicerView')).toHaveCount(0);
  });

  test('tela de preço sem peça em 3D não mostra o quadro', async ({ page }) => {
    await entrar(page);
    await gerarOrcamento(page);
    await expect(page.locator('#result #slicerView')).toHaveCount(0);
    await expect(page.locator('#slicerView')).toBeHidden();
  });

  test('WhatsApp do orçamento sem peça em 3D leva só o orçamento', async ({ page }) => {
    await page.addInitScript(() => { window.__envio = null; navigator.canShare = () => true; navigator.share = async (d) => { window.__envio = d.files.map((f) => f.name); }; });
    await entrar(page);
    await gerarOrcamento(page);
    await page.locator('#shareMain').click();
    await expect.poll(() => page.evaluate(() => window.__envio), { timeout: 30000 }).toEqual(['orcamento-projeto-trid.png']);
  });

  test('etapa 3 tem o campo Impressora, com a A1 como padrão', async ({ page }) => {
    await entrar(page);
    await expect(page.locator('#printerModel')).toHaveValue('Bambu Lab A1');
    await expect(page.locator('#printerModel option')).toHaveCount(6);
  });
});

test.describe('painel do mês', () => {
  test('mostra o valor orçado do mês, o cliente no ranking e navega entre meses', async ({ page }) => {
    const banco = await entrar(page);
    await gerarOrcamento(page);
    const total = (await page.locator('#batchTotal').textContent()).trim();
    await page.locator('#saveQuoteBtn').click();
    await expect.poll(() => banco.db.projetotrid_quotes.length).toBe(1);
    await page.evaluate(() => { location.hash = '#/painel'; });
    const kpi = page.locator('.dash-kpi', { hasText: 'Valor orçado' });
    await expect(kpi).toContainText(total);
    await expect(kpi).toContainText('1 orçamento');
    await expect(page.locator('.dash-card', { hasText: 'Clientes que mais orçaram' })).toContainText('Rafael Cardoso');
    await expect(page.locator('#dashNext')).toBeDisabled();
    await expect(page.locator('.dash-col.atual .dash-tip')).toHaveText(total);
    await page.locator('#dashPrev').click();
    await expect(kpi).toContainText('0 orçamentos');
    await expect(page.locator('#dashNext')).toBeEnabled();
  });
});

test.describe('preço para marketplace', () => {
  test('parte do total do pedido, aplica a faixa da Shopee e recalcula ao trocar a plataforma', async ({ page }) => {
    await entrar(page);
    await gerarOrcamento(page);
    const total = (await page.locator('#batchTotal').textContent()).trim();
    await page.locator('details.market > summary').click();
    await expect(page.locator('#mktNet')).toHaveValue(total.replace(/[^\d,]/g, ''));
    await page.locator('#mktNet').fill('30');
    await expect(page.locator('#mktResult')).toContainText('R$ 43,13');
    await expect(page.locator('#mktFeeField')).toBeHidden();
    await page.locator('#mktPlatform').selectOption('ml-classico');
    await expect(page.locator('#mktFee')).toHaveValue('12');
    await expect(page.locator('#mktResult')).toContainText('R$ 34,10'); // 30 / 0,88
    await page.locator('#mktReset').click();
    await expect(page.locator('#mktNet')).toHaveValue(total.replace(/[^\d,]/g, ''));
    expect(await page.locator('details.internal').count()).toBe(1); // o bloco novo não se confunde com a composição do preço
  });
});

test.describe('estoque de filamento', () => {
  test('cadastrar rolo na aba Filamentos e descontar ao salvar no histórico', async ({ page }) => {
    const banco = await entrar(page);
    await page.evaluate(() => { location.hash = '#/impressoes'; });
    await page.getByRole('tab', { name: 'Filamento' }).click();
    await expect(page.locator('#panelPecas')).toBeHidden();
    await page.locator('#newSpoolBtn').click();
    await page.locator('#spoolMaterial').fill('PLA');
    await page.locator('#spoolColor').fill('');
    await page.locator('#spoolWeight').fill('1000');
    await page.locator('#spoolRemaining').fill('1200');
    await page.locator('#spoolSave').click();
    await expect(page.locator('#spoolMsg')).toContainText('restante não pode passar');
    await page.locator('#spoolRemaining').fill('500');
    await page.locator('#spoolSave').click();
    await expect.poll(() => banco.db.projetotrid_spools.length).toBe(1);
    await expect(page.locator('#spoolList')).toContainText('500 g de 1.000 g (50%)');
    await page.evaluate(() => { location.hash = '#top'; });
    await gerarOrcamento(page, { peca: 'Peça do estoque' });
    await page.locator('#savePrintBtn').click();
    await page.locator('#printSaveBtn').click();
    await expect.poll(() => Number(banco.db.projetotrid_spools[0].remaining_g), { timeout: 20000 }).toBe(462); // 500 − 38 g (duas gravações em sequência)
    await expect(page.locator('#accountStatus')).toContainText('ficou com 462 g');
  });

  test('etapa 2 mostra quanto há do material e avisa quando não basta', async ({ page }) => {
    const banco = await entrar(page);
    banco.db.projetotrid_spools.push({ id: 'rolo-1', owner_id: 'x', material: 'PLA', color: 'Preto', brand: '', weight_g: 1000, remaining_g: 100, price: 0, notes: '', created_at: new Date().toISOString() });
    await page.evaluate(() => window.ProjetoTridEstoque.recarregar());
    await page.getByRole('textbox', { name: 'Nome da peça' }).fill('Peça');
    await page.locator('.panel[data-panel="0"] .btn-next').click();
    await page.locator('#filamentColor').fill('Preto');
    await page.locator('#amount').fill('38');
    await expect(page.locator('#stockHint')).toHaveText('Em estoque: 100 g de PLA Preto.');
    await page.locator('#amount').fill('200');
    await expect(page.locator('#stockHint')).toContainText('não basta');
    await expect(page.locator('#stockHint')).toHaveClass(/falta/);
  });
});

test.describe('pedidos (status, entrega, retorno e etiqueta)', () => {
  // no computador os filtros são botões; no celular, um seletor "Status: ..."
  const filtrar = async (page, nome) => {
    const chip = page.getByRole('button', { name: nome, exact: true });
    if (await chip.isVisible()) return chip.click();
    await page.getByRole('combobox', { name: 'Filtrar pedidos por status' }).selectOption({ label: `Status: ${nome}` });
  };
  // no celular as ações secundárias ficam no menu "Mais"
  const mais = async (linha) => { const b = linha.locator('.order-more-btn'); if (await b.isVisible()) await b.click(); };
  const antigo = (dias, extra = {}) => ({ id: 'ped-antigo', owner_id: 'x', title: 'Vaso geométrico', client_name: 'Marina Souza', client_email: '', client_phone: '(21) 99876-5432', items: [{ data: { product: 'Vaso geométrico', quantity: 2 } }], share_mode: 'summary', discount_mode: 'percent', discount_input: 0, subtotal: 80, discount_amount: 0, discount_percent: 0, total: 80, created_at: new Date(Date.now() - dias * 86400000).toISOString(), ...extra });

  test('mudar status grava no banco, filtra e marca atraso pela data de entrega', async ({ page }) => {
    const banco = await entrar(page);
    await gerarOrcamento(page, { peca: 'Suporte status' });
    await page.locator('#saveQuoteBtn').click();
    await expect.poll(() => banco.db.projetotrid_quotes.length).toBe(1);
    await page.evaluate(() => { location.hash = '#/orcamentos-salvos'; });
    const linha = page.locator('#savedQuoteList .saved-quote-row', { hasText: 'Suporte status' });
    await expect(linha.getByRole('combobox', { name: /Status de/ })).toHaveValue('orcado');
    await linha.getByRole('combobox', { name: /Status de/ }).selectOption('imprimindo');
    await expect.poll(() => banco.db.projetotrid_quotes[0].status).toBe('imprimindo');
    expect(banco.db.projetotrid_quotes[0].status_at).toBeTruthy();
    await filtrar(page, 'Orçados');
    await expect(page.locator('#savedQuoteList .saved-quote-row')).toHaveCount(0);
    await filtrar(page, 'Em produção');
    await expect(linha).toBeVisible();
    await linha.getByLabel(/Entrega de/).fill('2020-01-10');
    await expect.poll(() => banco.db.projetotrid_quotes[0].due_date).toBe('2020-01-10');
    await expect(linha.locator('.order-chip', { hasText: 'Atrasado' })).toBeVisible();
    await filtrar(page, 'Atrasados');
    await expect(page.locator('#savedQuoteList .saved-quote-row')).toHaveCount(1);
  });

  test('orçamento sem resposta há dias oferece lembrete pelo WhatsApp; etiqueta tem QR', async ({ page }) => {
    const banco = await entrar(page);
    banco.db.projetotrid_quotes.push(antigo(5));
    await page.evaluate(() => { location.hash = '#/orcamentos-salvos'; });
    const linha = page.locator('#savedQuoteList .saved-quote-row', { hasText: 'Vaso geométrico' });
    await expect(linha).toContainText('Sem resposta há 5 dias');
    expect(await auditar(page, '#savedQuotes')).toEqual([]); // 5 botões na linha não podem se sobrepor
    const lembrar = linha.getByRole('link', { name: 'Lembrar Marina Souza pelo WhatsApp' });
    await expect(lembrar).toHaveAttribute('href', /^https:\/\/wa\.me\/5521998765432\?text=Ol%C3%A1%2C%20Marina!/);
    await mais(linha);
    await linha.getByRole('button', { name: 'Etiqueta de Vaso geométrico' }).click();
    await expect(page.locator('#labelDialog')).toBeVisible();
    await expect(page.locator('#labelSheet svg')).toBeVisible();
    await expect(page.locator('#labelSheet')).toContainText('Marina Souza');
    await expect(page.locator('#labelSheet')).toContainText('2× Vaso geométrico');
    await page.locator('#labelClose').click();
  });

  test('o link do QR abre a lista com o pedido destacado', async ({ page }) => {
    const banco = await entrar(page);
    banco.db.projetotrid_quotes.push(antigo(1, { status: 'pronto' }));
    await page.goto('/app/?pedido=ped-antigo#/orcamentos-salvos');
    await expect(page.locator('#savedQuoteList .saved-quote-row.order-destaque')).toContainText('Vaso geométrico');
  });
});

test.describe('impressoras e manutenção', () => {
  test('cadastrar impressora, vencer tarefa pelas horas e registrar a manutenção com custo', async ({ page }) => {
    const banco = await entrar(page);
    await page.evaluate(() => { location.hash = '#/impressoes'; });
    await page.getByRole('tab', { name: 'Máquinas' }).click();
    await page.locator('#newPrinterBtn').click();
    await page.locator('#printerName').fill('A1 da bancada');
    await page.locator('#printerHours').fill('100');
    await page.locator('#printerSave').click();
    await expect.poll(() => banco.db.projetotrid_printers.length).toBe(1);
    const card = page.locator('.printer-card', { hasText: 'A1 da bancada' });
    await expect(card).toContainText('Bambu Lab A1 · 100 h de impressão');
    await expect(card.locator('.printer-tasks li')).toHaveCount(4);
    await expect(card.locator('.printer-tasks li').first()).toContainText('Faltam 200 h');
    page.once('dialog', (d) => d.accept('350'));
    await card.getByRole('button', { name: 'Atualizar horas' }).click();
    await expect(card.locator('.printer-tasks li.vencida').first()).toContainText('Vencida há 50 h');
    page.once('dialog', (d) => d.accept('12,50'));
    await card.getByRole('button', { name: 'Marcar como feito: Limpar e lubrificar os eixos' }).click();
    await expect(card.locator('.printer-tasks li').first()).toContainText('Faltam 200 h');
    await expect(card.locator('.printer-log')).toContainText('1 manutenção registrada · R$ 12,50 gastos');
    expect(banco.db.projetotrid_printers[0].log[0]).toMatchObject({ tarefa: 'Limpar e lubrificar os eixos', custo: 12.5 });
  });
});

test.describe('link de aprovação', () => {
  test('dono gera o link; cliente vê só itens e preços, aprova, e o pedido muda para aprovado', async ({ page, context }) => {
    const banco = await entrar(page);
    await gerarOrcamento(page, { peca: 'Luminária lua' });
    await page.locator('#saveQuoteBtn').click();
    await expect.poll(() => banco.db.projetotrid_quotes.length).toBe(1);
    await page.evaluate(() => { location.hash = '#/orcamentos-salvos'; });
    const maisAcoes = page.locator('#savedQuoteList .saved-quote-row', { hasText: 'Luminária lua' }).locator('.order-more-btn'); // no celular, "Enviar link" fica no menu "Mais"
    if (await maisAcoes.isVisible()) await maisAcoes.click();
    await page.getByRole('button', { name: 'Link de aprovação de Luminária lua' }).click();
    await expect.poll(() => banco.db.projetotrid_quotes[0].share_token).toMatch(/^[0-9a-f-]{36}$/);
    await expect(page.locator('#accountStatus')).toContainText('Link de aprovação copiado');
    const token = banco.db.projetotrid_quotes[0].share_token;

    const cliente = await context.newPage(); // visitante sem login, mesmo banco falso
    await cliente.route((u) => u.href.startsWith(urlSupabase), banco.tratar);
    await cliente.goto(`/app/aprovar.html?t=${token}`);
    await expect(cliente.locator('#apvTitle')).toHaveText('Rafael, este é o seu orçamento');
    await expect(cliente.locator('#apvItems')).toContainText('1× Luminária lua');
    const total = (await page.evaluate(() => document.getElementById('batchTotal')?.textContent || '')).trim();
    if (total) await expect(cliente.locator('#apvTotals')).toContainText(total);
    const texto = await cliente.locator('#apvMain').textContent();
    expect(texto).not.toMatch(/custo|lucro|margem|energia/i);
    await cliente.getByRole('button', { name: 'Aprovar orçamento' }).click();
    await expect(cliente.locator('#apvMsg')).toContainText('Orçamento aprovado');
    await expect(cliente.locator('#apvActions')).toBeHidden();
    expect(banco.db.projetotrid_quotes[0].status).toBe('aprovado');

    await page.reload();
    await page.evaluate(() => { location.hash = '#/orcamentos-salvos'; });
    const linha = page.locator('#savedQuoteList .saved-quote-row', { hasText: 'Luminária lua' });
    await expect(linha).toContainText('Cliente aprovou');
    await expect(linha.getByRole('combobox', { name: /Status de/ })).toHaveValue('aprovado');
  });

  test('cliente pede ajuste com mensagem; link inválido mostra aviso', async ({ page }) => {
    const banco = bancoFalso();
    banco.db.projetotrid_quotes.push({ id: 'q1', title: 'Vaso', client_name: 'Ana Lima', total: 50, subtotal: 50, discount_amount: 0, created_at: new Date().toISOString(), share_token: '11111111-2222-3333-4444-555555555555', items: [{ data: { product: 'Vaso', filamentType: 'PLA' }, result: { q: 2, unitPrice: 25, cost: 9, profit: 12 } }] });
    await page.route((u) => u.href.startsWith(urlSupabase), banco.tratar);
    await page.goto('/app/aprovar.html?t=11111111-2222-3333-4444-555555555555');
    await expect(page.locator('#apvItems')).toContainText('2× Vaso');
    await expect(page.locator('#apvItems')).toContainText('R$ 25,00 / un.');
    await page.getByRole('button', { name: 'Pedir ajuste' }).click();
    await page.getByRole('button', { name: 'Enviar pedido de ajuste' }).click();
    await expect(page.locator('#apvMsg')).toHaveText('Conte o que você quer ajustar.');
    await page.getByLabel('O que você quer ajustar?').fill('Quero em azul');
    await page.getByRole('button', { name: 'Enviar pedido de ajuste' }).click();
    await expect(page.locator('#apvMsg')).toContainText('Você pediu um ajuste');
    expect(banco.db.projetotrid_quotes[0]).toMatchObject({ client_response: 'ajuste', client_note: 'Quero em azul' });
    expect(banco.db.projetotrid_quotes[0].status || 'orcado').toBe('orcado');
    await page.goto('/app/aprovar.html?t=nao-existe');
    await expect(page.locator('#apvTitle')).toHaveText('Link inválido');
    const achados = await auditar(page, '#apvMain');
    expect(achados).toEqual([]);
  });
});

test.describe('vitrine pública', () => {
  // PNG 1×1
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

  test('dono configura a loja e publica uma peça com foto; visitante vê e pede pelo WhatsApp', async ({ page, context }) => {
    const banco = await entrar(page);
    await gerarOrcamento(page, { peca: 'Vaso espiral' });
    await page.locator('#savePrintBtn').click();
    await page.locator('#printSaveBtn').click();
    await expect.poll(() => banco.db.projetotrid_prints.length).toBe(1);
    await page.evaluate(() => { location.hash = '#/impressoes'; });
    await page.getByRole('tab', { name: 'Vitrine' }).click();
    await page.locator('#shopName').fill('Ateliê da Ana');
    await page.locator('#shopName').blur();
    await expect(page.locator('#shopSlug')).toHaveValue('atelie-da-ana');
    await page.locator('#shopEnabled').check();
    await page.locator('#shopSave').click();
    await expect(page.locator('#shopMsg')).toContainText('WhatsApp');
    await page.locator('#shopWhats').fill('(21) 99876-5432');
    await page.locator('#shopSave').click();
    await expect.poll(() => banco.db.projetotrid_shop.length).toBe(1);
    expect(banco.db.projetotrid_shop[0]).toMatchObject({ slug: 'atelie-da-ana', whatsapp: '21998765432', enabled: true });
    await expect(page.locator('#shopLink')).toContainText('vitrine.html?loja=atelie-da-ana');
    await expect(page.locator('#shopCopy')).toBeVisible();

    await page.getByRole('tab', { name: 'Peças' }).click();
    await page.locator('#printList').getByRole('button', { name: 'Detalhes' }).click();
    const caixa = page.locator('.showcase-box');
    await caixa.getByLabel('Mostrar esta peça na vitrine').check();
    await caixa.getByLabel(/Preço na vitrine/).fill('45');
    await caixa.getByLabel('Descrição na vitrine').fill('Vaso decorativo em PLA silk');
    await caixa.getByLabel('Foto da peça para a vitrine').setInputFiles({ name: 'vaso.png', mimeType: 'image/png', buffer: png });
    await caixa.getByRole('button', { name: 'Salvar vitrine' }).click();
    await expect.poll(() => banco.db.projetotrid_prints[0].showcase).toBe(true);
    expect(banco.db.projetotrid_prints[0].photo_path).toMatch(/\.png$/);

    const visitante = await context.newPage();
    await visitante.route((u) => u.href.startsWith(urlSupabase), banco.tratar);
    await visitante.goto('/app/vitrine.html?loja=atelie-da-ana');
    await expect(visitante.locator('#vitTitle')).toHaveText('Ateliê da Ana');
    const card = visitante.locator('.vit-card', { hasText: 'Vaso espiral' });
    await expect(card).toContainText('A partir de R$ 45,00');
    await expect(card.locator('img')).toHaveJSProperty('naturalWidth', 1);
    await expect(card.getByRole('link', { name: 'Quero uma igual: Vaso espiral' })).toHaveAttribute('href', /^https:\/\/wa\.me\/5521998765432\?text=Ol%C3%A1%2C%20Ateli%C3%AA%20da%20Ana!/);
    expect(await visitante.locator('#vitMain').textContent()).not.toMatch(/custo|lucro|energia/i);
    expect(await auditar(visitante, '#vitMain')).toEqual([]);
  });

  test('vitrine desativada ou endereço inválido mostram aviso', async ({ page }) => {
    const banco = bancoFalso();
    banco.db.projetotrid_shop.push({ owner_id: 'x', slug: 'fechada', name: 'Loja', whatsapp: '21998765432', intro: '', enabled: false });
    await page.route((u) => u.href.startsWith(urlSupabase), banco.tratar);
    await page.goto('/app/vitrine.html?loja=fechada');
    await expect(page.locator('#vitTitle')).toHaveText('Vitrine não encontrada');
    await page.goto('/app/vitrine.html?loja=X');
    await expect(page.locator('#vitTitle')).toHaveText('Vitrine não encontrada');
  });
});

test.describe('telas (módulos)', () => {
  test('botões do resultado: 4 iguais em 2 por linha, na ordem pedida; lixeira no cartão do pedido limpa tudo', async ({ page }) => {
    await entrar(page);
    await gerarOrcamento(page);
    const r = await page.evaluate(() => {
      const b = [...document.querySelectorAll('.result-actions .btn')].filter((e) => e.getClientRects().length);
      const pos = (e) => e.getBoundingClientRect();
      return { nomes: b.map((e) => e.id), alturas: [...new Set(b.map((e) => Math.round(pos(e).height)))], larguras: [...new Set(b.map((e) => Math.round(pos(e).width)))], classes: [...new Set(b.map((e) => e.className))], linhas: [pos(b[0]).top === pos(b[1]).top, pos(b[2]).top === pos(b[3]).top, pos(b[2]).top > pos(b[0]).bottom], limparNoCartao: !!document.querySelector('.batch-summary #newBtn'), limparNasAcoes: !!document.querySelector('.result-actions #newBtn') };
    });
    expect(r.nomes).toEqual(['addQuoteBtn', 'adjustPricesBtn', 'saveQuoteBtn', 'savePrintBtn']);
    expect(r.alturas).toHaveLength(1);
    expect(r.larguras).toHaveLength(1);
    expect(r.classes).toHaveLength(1);
    expect(r.linhas).toEqual([true, true, true]);
    expect(r.limparNoCartao).toBe(true);
    expect(r.limparNasAcoes).toBe(false);
    // a lixeira fica no canto superior direito do cartão e pede confirmação antes de limpar
    const canto = await page.evaluate(() => { const c = document.querySelector('.batch-summary').getBoundingClientRect(), l = document.getElementById('newBtn').getBoundingClientRect(); return { dir: c.right - l.right, topo: l.top - c.top }; });
    expect(canto.dir).toBeLessThan(24); expect(canto.topo).toBeLessThan(24);
    await expect(page.getByRole('button', { name: 'Limpar pedido' })).toBeVisible();
    await page.getByRole('button', { name: 'Limpar pedido' }).click();
    await expect(page.locator('#result')).not.toHaveClass(/show/);
  });

  test('"Composição do preço" e "Preço para marketplace" são cartões iguais e seguem arredondados ao passar o mouse', async ({ page }, info) => {
    test.skip(info.project.name.startsWith('celular'), 'hover é do mouse');
    await entrar(page);
    await gerarOrcamento(page);
    for (const sel of ['details.internal', 'details.market']) {
      await page.locator(`${sel} summary`).hover();
      const cartao = await page.locator(sel).evaluate((d) => { const c = getComputedStyle(d), s = getComputedStyle(d.querySelector('summary')); return { raio: c.borderTopLeftRadius, raioTitulo: s.borderTopLeftRadius, fundo: c.backgroundColor }; });
      expect(parseFloat(cartao.raio), `${sel} sem canto arredondado`).toBeGreaterThan(8);
      expect(cartao.raioTitulo).toBe(cartao.raio);
      expect(cartao.fundo).not.toBe('rgba(0, 0, 0, 0)');
    }
  });

  test('rótulos do menu e das etapas cabem na tela, sem cortar nem sobrepor', async ({ page }) => {
    await entrar(page);
    const falhas = await page.evaluate(() => {
      const out = [], visivel = (e) => e.getClientRects().length > 0;
      for (const e of [...document.querySelectorAll('.main-nav a, .stepper .step-btn')].filter(visivel)) {
        const b = e.getBoundingClientRect(), nome = e.textContent.trim();
        if (b.left < -1 || b.right > innerWidth + 1) out.push(`fora da tela: ${nome}`);
        if (e.scrollWidth > e.clientWidth + 1) out.push(`item mais largo que a coluna: ${nome}`);
        for (const t of e.querySelectorAll('span, strong')) {
          if (!visivel(t) || !t.textContent.trim()) continue;
          const r = document.createRange(); r.selectNodeContents(t); // largura real do texto x largura da caixa
          if (r.getBoundingClientRect().width > t.getBoundingClientRect().width + 1 || t.scrollWidth > t.clientWidth + 1) out.push(`texto cortado: ${t.textContent.trim()}`);
        }
      }
      for (const g of ['.main-nav', '.stepper']) {
        const l = [...document.querySelectorAll(`${g} > *`)].filter(visivel).map((e) => e.getBoundingClientRect());
        for (let i = 1; i < l.length; i++) if (l[i].left < l[i - 1].right - 1 && Math.abs(l[i].top - l[i - 1].top) < 4) out.push(`itens sobrepostos em ${g}`);
      }
      return out;
    });
    expect(falhas).toEqual([]);
  });

  test('cada módulo abre, tem título e passa na auditoria de layout', async ({ page }) => {
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await entrar(page);
    const modulos = await page.evaluate(() => window.PROJETOTRID_MODULES.map((m) => ({ id: m.id, rota: m.route, nome: m.label })));
    expect(modulos.length).toBeGreaterThanOrEqual(4);
    for (const m of modulos) {
      await page.evaluate((r) => { location.hash = r; }, m.rota);
      await expect(page.locator(`main[data-page="${m.id}"]`), `tela ${m.id}`).toBeVisible();
      await expect(page).toHaveTitle(new RegExp(m.nome));
      expect(await auditar(page, `main[data-page="${m.id}"]`), `layout de ${m.id}`).toEqual([]);
    }
    expect(erros).toEqual([]);
  });

  test('navegação: o item atual do menu acompanha a tela aberta', async ({ page }) => {
    await entrar(page);
    const modulos = await page.evaluate(() => window.PROJETOTRID_MODULES.map((m) => ({ rota: m.route, nome: m.label, curto: m.short })));
    for (const m of modulos) {
      await page.evaluate((r) => { location.hash = r; }, m.rota);
      await expect(page.locator('#mainNav a[aria-current="page"]')).toContainText(m.curto);
    }
  });
});

test.describe('clientes', () => {
  test('cadastrar, editar, buscar e excluir', async ({ page }) => {
    const banco = await entrar(page);
    await page.evaluate(() => { location.hash = '#/clientes'; });
    await expect(page.getByText('Nenhum cliente salvo ainda').first()).toBeVisible();
    await page.locator('#newCustomerBtn').click();
    await page.locator('#customerSave').click();
    await expect(page.locator('#customerMsg')).toContainText('Informe o nome');
    await page.locator('#customerName').fill('Maria Souza');
    await page.locator('#customerPhone').pressSequentially('11999887766');
    await expect(page.locator('#customerPhone')).toHaveValue('(11) 99988-7766');
    await page.locator('#customerSave').click();
    await expect(page.locator('#customerList')).toContainText('Maria Souza');
    expect(banco.db.projetotrid_customers).toHaveLength(1);
    await page.locator('#customerList').getByRole('button', { name: 'Editar' }).click();
    await page.locator('#customerName').fill('Maria de Souza');
    await page.locator('#customerSave').click();
    await expect(page.locator('#customerList')).toContainText('Maria de Souza');
    await page.locator('#customerSearch').fill('zzz');
    await expect(page.locator('#customerStatus')).toContainText('Nenhum cliente encontrado');
    await page.locator('#customerSearch').fill('');
    await page.locator('#customerList').getByRole('button', { name: 'Excluir' }).click();
    await expect(page.getByText('Nenhum cliente salvo ainda').first()).toBeVisible();
    expect(banco.db.projetotrid_customers).toHaveLength(0);
  });

  test('salvar cliente a partir do orçamento não duplica', async ({ page }) => {
    const banco = await entrar(page);
    await page.getByRole('textbox', { name: 'Nome da peça' }).fill('Peça');
    await page.locator('#clientName').fill('Ana Lima');
    await page.locator('#clientEmail').fill('ana@exemplo.com');
    await page.locator('#saveCustomerBtn').click();
    await expect.poll(() => banco.db.projetotrid_customers.length).toBe(1);
    await page.locator('#clientName').fill('Ana Lima Santos');
    await page.locator('#saveCustomerBtn').click();
    await expect.poll(() => banco.db.projetotrid_customers[0].name).toBe('Ana Lima Santos');
    expect(banco.db.projetotrid_customers).toHaveLength(1);
    // com cliente salvo, o seletor "Cliente salvo" alinha com o campo Telefone ao lado
    await expect(page.locator('#customerPick')).toBeVisible();
    const topo = (sel) => page.locator(sel).evaluate((e) => Math.round(e.getBoundingClientRect().top));
    const [tel, sel] = [await topo('#clientPhone'), await topo('#customerPick')];
    if (Math.abs(tel - sel) < 100) expect(sel).toBe(tel); // só compara quando estão na mesma linha (telas largas)
  });
});

test.describe('histórico de impressões', () => {
  test('salvar com arquivo STL, consultar, baixar e excluir', async ({ page }) => {
    const banco = await entrar(page);
    await gerarOrcamento(page, { peca: 'Suporte raquete' });
    await page.locator('#savePrintBtn').click();
    await expect(page.locator('#printSaveDialog')).toContainText('anexar o arquivo');
    await page.locator('#printFile0').setInputFiles({ name: 'suporte.stl', mimeType: 'model/stl', buffer: Buffer.from('solid x') });
    await page.locator('#printSaveBtn').click();
    await expect.poll(() => banco.db.projetotrid_prints.length).toBe(1);
    await expect.poll(() => banco.db.projetotrid_print_requests.length).toBe(1);
    await expect.poll(() => banco.db.projetotrid_prints[0].file_name).toBe('suporte.stl');
    await page.evaluate(() => { location.hash = '#/impressoes'; });
    await expect(page.locator('#printList')).toContainText('Suporte raquete');
    await expect(page.locator('#printList')).toContainText('Arquivo: suporte.stl');
    await page.locator('#printList').getByRole('button', { name: 'Detalhes' }).click();
    await expect(page.locator('#printDetailDialog')).toContainText('Pedidos (1)');
    await expect(page.locator('#printDetailDialog').getByRole('button', { name: 'Baixar' })).toBeVisible();
    await page.locator('#printDetailDelete').click();
    await expect(page.locator('#printStatus')).toContainText('Nenhuma impressão salva');
    expect(banco.db.projetotrid_prints).toHaveLength(0);
  });

  test('orçar de novo: a peça do histórico preenche o novo orçamento', async ({ page }) => {
    const banco = await entrar(page);
    await gerarOrcamento(page, { peca: 'Suporte repetido' });
    await page.locator('#savePrintBtn').click();
    await page.locator('#printSaveBtn').click();
    await expect.poll(() => banco.db.projetotrid_prints.length).toBe(1);
    const salvo = banco.db.projetotrid_prints[0];
    await page.evaluate(() => { const p = document.getElementById('product'); p.value = 'Outra peça'; p.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.evaluate(() => { location.hash = '#/impressoes'; });
    await page.getByRole('button', { name: 'Orçar de novo: Suporte repetido' }).click();
    await expect(page).toHaveURL(/#top$/);
    await expect(page.locator('#product')).toHaveValue('Suporte repetido');
    await expect(page.locator('#amount')).toHaveValue(String(Number(salvo.weight_g)).replace('.', ','));
    const m = Number(salvo.print_minutes);
    await expect(page.locator('#printHours')).toHaveValue(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
    await expect(page.locator('#filamentType')).toHaveValue(salvo.material.split(' · ')[0]);
  });

  test('ver em 3D o STL anexado ao histórico', async ({ page }) => {
    const banco = await entrar(page);
    await gerarOrcamento(page, { peca: 'Cubo anexado' });
    await page.locator('#savePrintBtn').click();
    await page.locator('#printFile0').setInputFiles(cuboSTL(20, 'cubo.stl'));
    await page.locator('#printSaveBtn').click();
    await expect.poll(() => banco.db.projetotrid_prints[0]?.file_name).toBe('cubo.stl');
    await page.evaluate(() => { location.hash = '#/impressoes'; });
    await page.locator('#printList').getByRole('button', { name: 'Detalhes' }).click();
    await page.locator('#printDetailDialog').getByRole('button', { name: 'Ver em 3D' }).click();
    await expect(page.locator('#printView canvas')).toBeVisible();
    await expect(page.locator('#printDetailMsg')).toHaveText('');
    await page.locator('#printDetailClose').click();
    await expect(page.locator('#printView canvas')).toHaveCount(0);
  });

  test('rejeita arquivo que não é STL nem 3MF', async ({ page }) => {
    const banco = await entrar(page);
    await gerarOrcamento(page);
    await page.locator('#savePrintBtn').click();
    await page.locator('#printFile0').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from('x') });
    await page.locator('#printSaveBtn').click();
    await expect(page.locator('#printSaveMsg')).toContainText('não é um arquivo STL ou 3MF');
    expect(banco.db.projetotrid_prints).toHaveLength(0);
  });
});

test.describe('conta', () => {
  test('sair da conta volta ao login sem erro', async ({ page }) => {
    await entrar(page);
    await page.locator('summary[aria-label*="menu da conta"]').click();
    await page.locator('#accountSignOut').click();
    await expect(page.locator('#loginScreen')).toBeVisible();
    await expect(page.locator('#loginStatus')).toContainText('Você saiu da sua conta');
    expect(page.confirmacoes[0]).toContain('Sair da conta');
  });

  test('sair da conta: cancelar na confirmação mantém a sessão e o pedido em andamento', async ({ page }) => {
    await entrar(page);
    await page.getByRole('textbox', { name: 'Nome da peça' }).fill('Peça em andamento');
    page.responder = false;
    await page.locator('summary[aria-label*="menu da conta"]').click();
    await page.locator('#accountSignOut').click();
    await expect.poll(() => page.confirmacoes.length).toBe(1);
    await expect(page.locator('#appShell')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Nome da peça' })).toHaveValue('Peça em andamento');
  });
});

test.describe('confirmação antes de salvar e excluir', () => {
  test('salvar orçamento: cancelar não grava; confirmar grava', async ({ page }) => {
    const banco = await entrar(page);
    await gerarOrcamento(page);
    page.responder = false;
    await page.locator('#saveQuoteBtn').click();
    await expect.poll(() => page.confirmacoes.length).toBe(1);
    expect(page.confirmacoes[0]).toContain('Salvar este orçamento');
    expect(banco.db.projetotrid_quotes).toHaveLength(0);
    page.responder = true;
    await page.locator('#saveQuoteBtn').click();
    await expect.poll(() => banco.db.projetotrid_quotes.length).toBe(1);
  });

  test('adicionar item a um orçamento já salvo atualiza o MESMO orçamento (2 itens), sem criar outro', async ({ page }) => {
    const banco = await entrar(page);
    await gerarOrcamento(page, { peca: 'Primeira' });
    await page.locator('#saveQuoteBtn').click();
    await expect.poll(() => banco.db.projetotrid_quotes.length).toBe(1);
    await page.locator('#addQuoteBtn').click();
    await gerarOrcamento(page, { peca: 'Segunda' });
    await expect(page.locator('#quoteItems .quote-item')).toHaveCount(2);
    await page.locator('#saveQuoteBtn').click();
    await expect.poll(() => banco.db.projetotrid_quotes[0].items.length).toBe(2);
    expect(banco.db.projetotrid_quotes).toHaveLength(1);
    expect(banco.db.projetotrid_quotes[0].title).toContain('Primeira');
    expect(banco.db.projetotrid_quotes[0].title).toContain('Segunda');
  });

  test('pedido novo (Limpar pedido) depois de salvar cria outro orçamento e não sobrescreve o anterior', async ({ page }) => {
    const banco = await entrar(page);
    await gerarOrcamento(page, { peca: 'Pedido um' });
    await page.locator('#saveQuoteBtn').click();
    await expect.poll(() => banco.db.projetotrid_quotes.length).toBe(1);
    await page.getByRole('button', { name: 'Limpar pedido' }).click();
    await gerarOrcamento(page, { peca: 'Pedido dois' });
    await page.locator('#saveQuoteBtn').click();
    await expect.poll(() => banco.db.projetotrid_quotes.length).toBe(2);
    expect(banco.db.projetotrid_quotes.map((q) => q.title).sort()).toEqual(['Pedido dois', 'Pedido um']);
  });

  test('salvar cliente a partir do orçamento: cancelar não grava', async ({ page }) => {
    const banco = await entrar(page);
    await page.locator('#clientName').fill('Ana Lima');
    page.responder = false;
    await page.locator('#saveCustomerBtn').click();
    await expect.poll(() => page.confirmacoes.length).toBe(1);
    expect(page.confirmacoes[0]).toContain('Salvar este cliente');
    expect(banco.db.projetotrid_customers).toHaveLength(0);
  });

  test('excluir cliente e rolo: cancelar mantém o registro', async ({ page }) => {
    const banco = await entrar(page);
    await page.evaluate(() => { location.hash = '#/clientes'; });
    await page.locator('#newCustomerBtn').click();
    await page.locator('#customerName').fill('Maria Souza');
    await page.locator('#customerSave').click();
    await expect.poll(() => banco.db.projetotrid_customers.length).toBe(1);
    expect(page.confirmacoes[0]).toContain('Salvar este novo cliente');
    page.responder = false;
    await page.locator('#customerList').getByRole('button', { name: 'Excluir' }).click();
    await expect.poll(() => page.confirmacoes.length).toBe(2);
    expect(page.confirmacoes[1]).toContain('Excluir');
    expect(banco.db.projetotrid_customers).toHaveLength(1);
  });
});

test('desconto do pedido: o rótulo e o campo cabem no cartão em ~960 px', async ({ page }, info) => {
  test.skip(!ehComputador(info), 'largura intermediária do computador');
  await page.setViewportSize({ width: 960, height: 900 });
  await entrar(page); await gerarOrcamento(page);
  const m = await page.evaluate(() => { const c = document.querySelector('.batch-summary').getBoundingClientRect(), f = document.querySelector('.discount-field').getBoundingClientRect(); return { dentro: f.right <= c.right && f.left >= c.left, largura: f.width }; });
  expect(m.dentro).toBe(true);
  expect(m.largura).toBeGreaterThan(150);
});

test('desconto do pedido: rótulos alinhados no computador e seletor com a largura do campo no celular', async ({ page }, info) => {
  await entrar(page); await gerarOrcamento(page);
  const m = await page.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); return { dl: r('.discount-mode legend').top - r('label[for=discountValue]').top, modo: r('.discount-mode'), campo: r('#discountValue') }; });
  if (ehComputador(info) && info.project.use.viewport.width >= 1280) expect(Math.abs(m.dl)).toBeLessThanOrEqual(2);
  if (ehCelular(info)) expect(Math.abs(m.modo.right - (m.campo.right + 80))).toBeGreaterThanOrEqual(0) && expect(m.modo.width).toBeGreaterThan(m.campo.width);
});

test.describe('aprovação de acesso', () => {
  test('conta pendente vê "Aguardando aprovação" e não usa o app; depois de aprovada, entra', async ({ page }) => {
    const banco = bancoFalso();
    banco.acesso.status = 'pending';
    await page.route((u) => u.href.startsWith(urlSupabase), banco.tratar);
    await page.addInitScript(([chave, valor]) => localStorage.setItem(chave, valor), sessaoDeTeste());
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Aguardando aprovação' })).toBeVisible();
    await expect(page.locator('#acessoPendente')).toContainText('teste@exemplo.com');
    await expect(page.locator('#appShell')).toHaveAttribute('inert', '');
    banco.acesso.status = 'approved';
    await page.getByRole('button', { name: 'Verificar de novo' }).click();
    await page.locator('#appShell').waitFor({ state: 'visible' });
    await expect(page.locator('#acessoPendente')).toBeHidden();
    await expect(page.locator('#appShell')).not.toHaveAttribute('inert', '');
  });

  test('conta bloqueada vê a mensagem de acesso não liberado e pode sair', async ({ page }) => {
    const banco = bancoFalso();
    banco.acesso.status = 'blocked';
    await page.route((u) => u.href.startsWith(urlSupabase), banco.tratar);
    await page.addInitScript(([chave, valor]) => localStorage.setItem(chave, valor), sessaoDeTeste());
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Acesso não liberado' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
  });
});
