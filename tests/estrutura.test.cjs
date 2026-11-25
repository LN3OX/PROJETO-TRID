// Testes de estrutura: pegam o tipo de quebra que acontece quando o sistema cresce
// (id que sumiu do HTML, ícone sem desenho, tela sem rota, tabela sem RLS, cache sem versão nova...).
// Sem dependências: rodam em segundos com `npm test` e também no GitHub Actions antes de publicar.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const site = path.join(root, 'site', 'app');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const html = read('site/app/index.html');
const listFiles = (dir, ext) => fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith(ext)).map((f) => `${dir}/${f}`);
const ownJs = listFiles('site/app/js', '.js').filter((f) => !/qrcode-generator/.test(f));
const ownCss = [...listFiles('site/app/css', '.css'), ...listFiles('site/app/css/modules', '.css')];
// ids de todas as páginas (index e páginas públicas como aprovar.html)
const paginas = listFiles('site/app', '.html').map(read);
const ids = paginas.flatMap((h) => [...h.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const idSet = new Set(ids);
const sprite = new Set([...html.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));
const git = (cmd) => execSync(`git ${cmd}`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString();

function carregarModulos() {
  const ctx = { window: {} };
  vm.runInNewContext(read('site/app/js/modules.js'), ctx);
  return ctx.window.PROJETOTRID_MODULES;
}

test('HTML: ids são únicos', () => {
  const repetidos = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual([...new Set(repetidos)], []);
});

test('JS: todo id usado nos scripts existe no HTML', () => {
  // ids criados em tempo de execução (ex.: campos de arquivo por item) ficam aqui, com motivo.
  const dinamicos = new Set(['printView', 'acessosBadge']); // printView: caixa do 3D criada ao abrir o modelo no histórico; acessosBadge: criado com o item "Aprovar acessos" (acessos.js)
  const faltando = [];
  for (const f of ownJs) {
    const src = read(f);
    const usados = [...src.matchAll(/(?:\$|getElementById)\(\s*'([A-Za-z][\w-]*)'\s*\)/g)].map((m) => m[1]);
    for (const id of usados) if (!idSet.has(id) && !dinamicos.has(id)) faltando.push(`${f}: #${id}`);
  }
  assert.deepEqual([...new Set(faltando)], [], 'ids usados no JS que não existem no index.html');
});

test('JS: todos os scripts próprios têm sintaxe válida', () => {
  for (const f of ownJs) assert.doesNotThrow(() => new vm.Script(read(f), { filename: f }), f);
});

test('módulos: cada módulo tem página, rota única e ícones desenhados', () => {
  const mods = carregarModulos();
  assert.ok(mods.length >= 1);
  const paginas = [...html.matchAll(/<main[^>]*data-page="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...paginas].sort(), Array.from(mods, (m) => m.id).sort(), 'páginas (data-page) e módulos precisam coincidir');
  const rotas = mods.map((m) => m.route);
  assert.equal(new Set(rotas).size, rotas.length, 'rotas repetidas');
  rotas.forEach((r) => assert.match(r, /^#/));
  assert.equal(mods.filter((m) => m.default).length, 1, 'exatamente um módulo padrão');
  for (const m of mods) {
    for (const ic of [m.icon, m.iconActive].filter(Boolean)) assert.ok(sprite.has(ic), `${m.id}: ícone ${ic} não existe no sprite`);
    assert.ok(m.short && m.short.length <= 12, `${m.id}: rótulo curto vazio ou maior que 12 caracteres`);
  }
});

test('módulos: cabem na barra inferior do celular (até 5)', () => {
  assert.ok(carregarModulos().filter((m) => !m.hidden).length <= 5, 'acima de 5, agrupe os menos usados em "Mais" (ver MODULOS.md)');
});

test('ícones: todo <use href="#i-..."> aponta para um símbolo do sprite', () => {
  const usados = [...html.matchAll(/<use href="#([^"]+)"/g)].map((m) => m[1]);
  const faltando = [...new Set(usados.filter((u) => !sprite.has(u)))];
  assert.deepEqual(faltando, []);
});

test('arquivos: tudo que o index.html carrega existe', () => {
  const refs = [...html.matchAll(/(?:href|src)="(\.\/[^"#?]+)"/g)].map((m) => m[1]);
  const faltando = [...new Set(refs)].filter((r) => !fs.existsSync(path.join(site, r)));
  assert.deepEqual(faltando, []);
});

test('service worker: pré-carrega todo CSS/JS do index.html e os arquivos existem', () => {
  const sw = read('site/app/sw.js');
  const shell = [...sw.matchAll(/'(\.\/[^']+)'/g)].map((m) => m[1]);
  const carregados = [...html.matchAll(/(?:href|src)="(\.\/[^"#?]+\.(?:css|js))"/g)].map((m) => m[1]);
  const fora = carregados.filter((c) => !shell.includes(c));
  assert.deepEqual(fora, [], 'adicione ao APP_SHELL de sw.js');
  const inexistentes = shell.filter((s) => s !== './' && !fs.existsSync(path.join(site, s)));
  assert.deepEqual(inexistentes, []);
  assert.match(sw, /CACHE_NAME\s*=\s*'projetotrid-v\d+'/);
});

test('service worker: quem altera o site sobe a versão do cache', (t) => {
  // Com alterações não commitadas, compara com o último commit; com a árvore limpa (CI), compara o último commit com o anterior.
  let faixa, alterados;
  try {
    const linhas = (cmd) => git(cmd).split(/\r?\n/).filter(Boolean);
    const sujo = linhas('diff --name-only HEAD');
    faixa = sujo.length ? 'HEAD' : 'HEAD~1 HEAD';
    alterados = sujo.length ? sujo : linhas('diff --name-only HEAD~1 HEAD');
  } catch { return t.skip('sem histórico git disponível'); }
  if (!alterados.some((f) => f.startsWith('site/app/') && f !== 'site/app/sw.js')) return;
  const diff = git(`diff ${faixa} -- site/app/sw.js`);
  assert.match(diff, /^[+-].*CACHE_NAME/m, 'arquivos do site mudaram: suba o CACHE_NAME em site/sw.js');
});

test('acessibilidade: rótulos apontam para campos existentes e todo campo tem nome', () => {
  const rotulosFor = [...html.matchAll(/<label[^>]*\sfor="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(rotulosFor.filter((f) => !idSet.has(f)), [], 'label for= sem campo');
  const semNome = [];
  for (const m of html.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
    const attrs = m[2];
    if (/type="(hidden|radio|checkbox)"/.test(attrs)) continue;
    const id = (attrs.match(/\sid="([^"]+)"/) || [])[1];
    const temNome = /aria-label=|aria-labelledby=/.test(attrs) || (id && rotulosFor.includes(id));
    if (!temNome) semNome.push(id || m[0].slice(0, 60));
  }
  assert.deepEqual(semNome, [], 'campos sem label nem aria-label');
});

test('acessibilidade: botões só com ícone têm aria-label e diálogos têm título', () => {
  const semNome = [];
  for (const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    const texto = m[2].replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').trim();
    if (!texto && !/aria-label=|aria-labelledby=|\btitle=/.test(m[1])) semNome.push((m[1].match(/id="([^"]+)"/) || [, m[1].slice(0, 40)])[1]);
  }
  assert.deepEqual(semNome, [], 'botão sem texto e sem aria-label');
  for (const m of html.matchAll(/<dialog\b([^>]*)>/g)) {
    const lab = (m[1].match(/aria-labelledby="([^"]+)"/) || [])[1];
    assert.ok(lab && idSet.has(lab), `diálogo sem título acessível: ${m[1].slice(0, 60)}`);
  }
});

test('acessibilidade: botões que abrem menu apontam para o menu e iniciam fechados', () => {
  for (const m of html.matchAll(/<button\b([^>]*aria-haspopup="[^"]+"[^>]*)>/g)) {
    const alvo = (m[1].match(/aria-controls="([^"]+)"/) || [])[1];
    assert.ok(alvo && idSet.has(alvo), `menu sem aria-controls válido: ${m[1].slice(0, 60)}`);
    assert.match(m[1], /aria-expanded="false"/, 'menu deve iniciar fechado');
  }
});

test('cliente: texto, imagem e PDF compartilhados nunca trazem custos nem lucro', () => {
  const src = read('site/app/js/app.js');
  for (const proibido of ['sharedCosts', "'detailed'", 'DETALHAMENTO', 'COMPOSIÇÃO DO VALOR']) {
    assert.ok(!src.includes(proibido), `app.js não pode ter "${proibido}": custos e lucro ficam só na visão interna`);
  }
  assert.ok(!html.includes('name="shareMode"'), 'não há mais escolha de detalhamento para o envio');
  assert.ok(html.includes('id="profitValue"'), 'a visão interna (Composição do preço) continua com o lucro');
});

test('CSS: sem cores soltas fora dos tokens (módulos, componentes e shell)', () => {
  const permitido = new Set(['site/app/css/tokens.css', 'site/app/css/print.css']);
  const achados = [];
  for (const f of ownCss.filter((x) => !permitido.has(x))) {
    const src = read(f).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of src.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) achados.push(`${f}: ${m[0]}`);
  }
  assert.deepEqual(achados, [], 'use var(--md-sys-color-*) em vez de cores soltas');
});

test('CSS: bordas arredondadas usam os tokens de forma', () => {
  const achados = [];
  for (const f of ownCss.filter((x) => !/tokens\.css|print\.css/.test(x))) {
    const src = read(f).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of src.matchAll(/border-radius:\s*([^;}]+)/g)) {
      const v = m[1].trim();
      const ok = /^(0|50%|inherit)$/.test(v) || /^var\(--(shape-|md-sys-shape-|radius)/.test(v) || /^(var\(--[\w-]+\)|0)(\s+(var\(--[\w-]+\)|0))*$/.test(v) || /^2px$/.test(v);
      if (!ok) achados.push(`${f}: ${v}`);
    }
  }
  assert.deepEqual(achados, [], 'use --shape-surface/nested/field/control (ver tokens.css)');
});

test('banco: toda tabela criada tem RLS e nenhuma é aberta ao anon', () => {
  const sql = listFiles('supabase/migrations', '.sql').map(read).join('\n');
  const tabelas = [...sql.matchAll(/create table(?: if not exists)?\s+public\.(\w+)/gi)].map((m) => m[1]);
  assert.ok(tabelas.length >= 1);
  for (const t of tabelas) assert.match(sql, new RegExp(`alter table public\\.${t}\\s+enable row level security`, 'i'), `${t}: sem RLS`);
  assert.doesNotMatch(sql, /grant[^;]*\bon\s+(?:table\s+)?public\.\w+[^;]*\bto\s+[^;]*\banon\b/i, 'nenhuma tabela aberta ao anon');
  // funções liberadas ao anon (link de aprovação, vitrine): security definer, search_path fixo e nada de custo ou lucro
  for (const [, nome] of sql.matchAll(/grant execute on function public\.(\w+)\([^)]*\)[^;]*\banon\b/gi)) {
    const corpo = (sql.match(new RegExp(`create or replace function public\\.${nome}\\b[\\s\\S]*?\\$\\$[\\s\\S]*?\\$\\$`, 'i')) || [''])[0];
    assert.match(corpo, /security definer/i, `${nome}: precisa ser security definer`);
    assert.match(corpo, /set search_path = ''/i, `${nome}: search_path fixo`);
    assert.doesNotMatch(corpo, /cost|profit|fees|packPrice|margin|laborRate|material_cost|print_cost/i, `${nome}: não pode expor custos ou lucro`);
  }
});

test('banco: migrações têm nomes ordenáveis e sem repetição', () => {
  const nomes = listFiles('supabase/migrations', '.sql').map((f) => path.basename(f));
  nomes.forEach((n) => assert.match(n, /^\d{14}_[a-z0-9_]+\.sql$/));
  assert.equal(new Set(nomes.map((n) => n.slice(0, 14))).size, nomes.length, 'prefixo de data repetido');
});

test('modelo do WhatsApp: cópias iguais e versão codificada em dia', () => {
  const a = fs.readFileSync(path.join(site, 'whatsapp-template.html'));
  const b = fs.readFileSync(path.join(site, 'templates/whatsapp-template.html'));
  assert.ok(a.equals(b), 'site/app/whatsapp-template.html e site/templates/whatsapp-template.html divergem');
  const b64 = fs.readFileSync(path.join(site, 'templates/whatsapp-template.b64'), 'utf8').trim();
  // compara sem depender das quebras de linha da cópia local (no Windows o git entrega CRLF; no repositório é LF)
  assert.equal(b64, Buffer.from(a.toString('utf8').replace(/\r\n/g, '\n')).toString('base64'), 'rode: python scripts/build-template.py');
});

test('segredos: nenhum arquivo de chave de assinatura no repositório', () => {
  let rastreados;
  try { rastreados = git('ls-files').split('\n'); } catch { return; }
  const proibidos = rastreados.filter((f) => /\.(jks|keystore|p12|pfx)$|keystore\.b64|LEIA-ME\.txt/i.test(f));
  assert.deepEqual(proibidos, []);
});
