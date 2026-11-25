// Apoio dos testes de navegador: login simulado, Supabase falso em memória e auditoria de layout.
const fs = require('node:fs');
const path = require('node:path');

const config = fs.readFileSync(path.join(__dirname, '..', '..', 'site', 'app', 'config.js'), 'utf8');
const urlSupabase = (config.match(/https:\/\/[a-z0-9]+\.supabase\.co/) || [])[0];
const ref = new URL(urlSupabase).hostname.split('.')[0];
const USUARIO = '11111111-1111-1111-1111-111111111111';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

// Sessão válida de mentira no localStorage: o app acredita que há alguém logado.
function sessao() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USUARIO, aud: 'authenticated', role: 'authenticated', email: 'teste@exemplo.com', exp })}.assinatura`;
  return { access_token: jwt, refresh_token: 'r', expires_in: 3600, expires_at: exp, token_type: 'bearer', user: { id: USUARIO, aud: 'authenticated', email: 'teste@exemplo.com', user_metadata: {}, app_metadata: {} } };
}

// Banco falso: imita o suficiente do PostgREST e do Storage para o app funcionar sem rede.
function bancoFalso() {
  const db = { projetotrid_quotes: [], projetotrid_customers: [], projetotrid_prints: [], projetotrid_print_requests: [], projetotrid_spools: [], projetotrid_printers: [], projetotrid_shop: [] };
  const arquivos = {};
  const acesso = { status: 'approved', admin: false, contas: [] }; // aprovação de acesso: 'approved' | 'pending' | 'blocked'; admin e contas: tela "Aprovar acessos"
  let seq = 0;
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
  const json = (route, status, corpo) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(corpo) });

  async function tratar(route) {
    const req = route.request(), url = new URL(req.url()), metodo = req.method();
    if (metodo === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const unico = (req.headers().accept || '').includes('vnd.pgrst.object');
    const quer = (req.headers().prefer || '').includes('return=representation');
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const corpo = JSON.parse(req.postData() || '{}'), q = db.projetotrid_quotes.find((r) => r.share_token && r.share_token === corpo.p_token);
      if (url.pathname.endsWith('/projetotrid_request_access')) return json(route, 200, acesso.status);
      if (url.pathname.endsWith('/projetotrid_is_admin')) return json(route, 200, acesso.admin && acesso.status === 'approved');
      if (url.pathname.endsWith('/projetotrid_access_list')) return acesso.admin ? json(route, 200, acesso.contas) : json(route, 403, { message: 'apenas administradores' });
      if (url.pathname.endsWith('/projetotrid_access_set')) {
        const c = acesso.admin && acesso.contas.find((x) => x.email === String(corpo.p_email || '').trim().toLowerCase() && !x.is_me);
        if (!c) return json(route, 400, { message: 'conta não encontrada' });
        c.status = corpo.p_status; return json(route, 200, c.status);
      }
      if (url.pathname.endsWith('/projetotrid_showcase')) {
        const s = db.projetotrid_shop.find((x) => x.enabled && x.slug === String(corpo.p_slug || '').toLowerCase());
        if (!s) return json(route, 200, null);
        return json(route, 200, { name: s.name, intro: s.intro, whatsapp: s.whatsapp, items: db.projetotrid_prints.filter((p) => p.showcase).map((p) => ({ id: p.id, name: p.name, material: p.material, color: p.color, price: p.showcase_price ?? null, text: p.showcase_text || '', photo_path: p.photo_path || null })) });
      }
      if (url.pathname.endsWith('/projetotrid_quote_public')) {
        if (!q) return json(route, 200, null);
        return json(route, 200, { title: q.title, client_name: String(q.client_name || '').trim().split(' ')[0], created_at: q.created_at, status: q.status || 'orcado', client_response: q.client_response || null, client_response_at: q.client_response_at || null, subtotal: q.subtotal, discount_amount: q.discount_amount, total: q.total,
          items: (q.items || []).map((it) => ({ product: it.data?.product || 'Peça impressa em 3D', quantity: it.result?.q || it.data?.quantity || 1, material: it.data?.filamentType || '', color: it.data?.filamentColor || '', unit_price: Number(it.result?.unitPrice || 0) })) });
      }
      if (url.pathname.endsWith('/projetotrid_quote_respond')) {
        if (!q || (q.status || 'orcado') !== 'orcado' || !['aprovado', 'ajuste'].includes(corpo.p_decision)) return json(route, 400, { message: 'orçamento não encontrado ou já respondido' });
        Object.assign(q, { client_response: corpo.p_decision, client_response_at: new Date().toISOString(), client_note: corpo.p_note || '' }, corpo.p_decision === 'aprovado' ? { status: 'aprovado', status_at: new Date().toISOString() } : {});
        return json(route, 200, q.status);
      }
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      const tabela = url.pathname.split('/')[3];
      const linhas = db[tabela];
      if (!linhas) return json(route, 404, { message: 'tabela desconhecida' });
      const filtroId = (url.searchParams.get('id') || '').replace(/^eq\./, '');
      const alvo = () => (filtroId ? linhas.filter((r) => r.id === filtroId) : linhas.slice());
      const completa = (r) => (tabela === 'projetotrid_prints' ? { ...r, projetotrid_print_requests: db.projetotrid_print_requests.filter((q) => q.print_id === r.id) } : r);
      const resposta = (rs, status) => (unico ? (rs.length ? json(route, status, completa(rs[0])) : json(route, 406, { message: 'nenhuma linha' })) : json(route, status, rs.map(completa)));
      if (metodo === 'GET') return resposta(alvo(), 200);
      if (metodo === 'POST') {
        const corpo = JSON.parse(req.postData() || '{}');
        const novas = (Array.isArray(corpo) ? corpo : [corpo]).map((c) => ({ id: `id-${++seq}`, owner_id: USUARIO, created_at: new Date().toISOString(), requested_at: new Date().toISOString(), ...c }));
        linhas.push(...novas);
        return quer ? resposta(novas, 201) : route.fulfill({ status: 201, headers: cors });
      }
      if (metodo === 'PATCH') {
        const alvos = alvo();
        alvos.forEach((r) => Object.assign(r, JSON.parse(req.postData() || '{}')));
        return quer ? resposta(alvos, 200) : route.fulfill({ status: 204, headers: cors });
      }
      if (metodo === 'DELETE') {
        alvo().forEach((r) => {
          linhas.splice(linhas.indexOf(r), 1);
          if (tabela === 'projetotrid_prints') db.projetotrid_print_requests = db.projetotrid_print_requests.filter((q) => q.print_id !== r.id);
        });
        return route.fulfill({ status: 204, headers: cors });
      }
    }
    if (url.pathname.startsWith('/storage/v1/object/public/')) {
      const corpo = arquivos[url.pathname.replace('/public/', '/')];
      return corpo ? route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'image/png' }, body: corpo }) : route.fulfill({ status: 404, headers: cors });
    }
    if (url.pathname.startsWith('/storage/v1/object/sign/')) {
      const obj = url.pathname.replace('/storage/v1/object/sign/', '');
      if (metodo === 'GET') { const corpo = arquivos[`/storage/v1/object/${obj}`]; return corpo ? route.fulfill({ status: 200, headers: cors, body: corpo }) : route.fulfill({ status: 404, headers: cors }); }
      return json(route, 200, { signedURL: `/object/sign/${obj}?token=t` });
    }
    if (url.pathname.startsWith('/storage/v1/object/')) {
      if (metodo === 'POST') {
        // o Supabase real guarda só o arquivo; o supabase-js envia como formulário (multipart): extrai a parte do arquivo
        let corpo = route.request().postDataBuffer() || Buffer.alloc(0);
        const limite = (route.request().headers()['content-type'] || '').match(/boundary=(.+)$/);
        if (limite) {
          const sep = Buffer.from('--' + limite[1]), ini = corpo.indexOf('\r\n\r\n', corpo.indexOf('filename=')) + 4;
          corpo = corpo.subarray(ini, corpo.indexOf(Buffer.concat([Buffer.from('\r\n'), sep]), ini));
        }
        arquivos[url.pathname] = corpo;
        return json(route, 200, { Key: url.pathname });
      }
      if (metodo === 'DELETE') { Object.keys(arquivos).forEach((k) => delete arquivos[k]); return json(route, 200, []); }
    }
    if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ status: 204, headers: cors });
    return json(route, 404, { message: 'não simulado' });
  }
  return { db, arquivos, tratar, acesso };
}

// Abre o app já "logado", com o banco falso. Devolve o banco para os testes conferirem o que foi gravado.
async function entrar(page) {
  const banco = bancoFalso();
  await page.route((u) => u.href.startsWith(urlSupabase), banco.tratar);
  await page.addInitScript(([chave, valor]) => localStorage.setItem(chave, valor), [`sb-${ref}-auth-token`, JSON.stringify(sessao())]);
  // confirmações (window.confirm): por padrão o teste responde "OK"; page.responder = false cancela. As mensagens ficam em page.confirmacoes.
  page.confirmacoes = []; page.responder = true;
  page.on('dialog', async (d) => { if (d.type() !== 'confirm') return; page.confirmacoes.push(d.message()); await (page.responder ? d.accept() : d.dismiss()); });
  await page.goto('/app/');
  await page.locator('#appShell').waitFor({ state: 'visible' });
  return banco;
}

// Preenche as 5 etapas como o usuário e gera o orçamento (cada etapa tem o seu botão "Continuar").
async function gerarOrcamento(page, { peca = 'Suporte de teste', cliente = 'Rafael Cardoso', email = 'rafael@exemplo.com' } = {}) {
  const proximo = (i) => page.locator(`.panel[data-panel="${i}"] .btn-next`).click();
  await page.getByRole('textbox', { name: 'Nome da peça' }).fill(peca);
  await page.locator('#clientName').fill(cliente);
  await page.locator('#clientEmail').fill(email);
  await proximo(0);
  await page.locator('#amount').fill('38');
  await page.locator('#packPrice').fill('120');
  await proximo(1);
  await page.locator('#printHours').fill('0342');
  await proximo(2);
  await proximo(3);
  await proximo(4);
  await page.locator('#result.show').waitFor({ timeout: 10_000 });
}

// Mede, dentro do navegador: itens fora da tela, rolagem horizontal e botões do mesmo grupo desalinhados.
function auditar(page, seletor) {
  return page.evaluate((sel) => {
    const raiz = document.querySelector(sel);
    if (!raiz) return [`raiz não encontrada: ${sel}`];
    const larg = innerWidth, achados = [];
    const painel = raiz.classList.contains('panel');
    const pr = raiz.getBoundingClientRect();
    const E = painel ? pr.left : 0, D = painel ? pr.right : larg;
    const todos = [raiz, ...raiz.querySelectorAll('*')];
    const visivel = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width && r.height && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('[hidden]'); };
    todos.forEach((e) => {
      if (!visivel(e) || e.closest('.toast,.app-status')) return;
      if (!painel && e.closest('.panel')) return; // as etapas são auditadas uma a uma (ficam deslizando fora da tela)
      const r = e.getBoundingClientRect();
      if (r.right > D + 1 || r.left < E - 1) achados.push(`fora da tela: ${(e.id || e.className || e.tagName).toString().slice(0, 40)}`);
    });
    if (document.documentElement.scrollWidth > larg + 1) achados.push(`rolagem horizontal: ${document.documentElement.scrollWidth}px`);
    if (larg < 720) {
      const grupos = new Set(todos.filter((e) => [...e.children].filter((c) => c.matches('.btn,button,label.discount-choice') && visivel(c)).length >= 2 && !e.classList.contains('field-tools')));
      grupos.forEach((g) => {
        const bs = [...g.children].filter((c) => c.matches('.btn,button,label.discount-choice') && visivel(c));
        const linhas = [];
        bs.forEach((b) => { const r = b.getBoundingClientRect(), cy = (r.top + r.bottom) / 2; let l = linhas.find((x) => Math.abs(x.cy - cy) < 14); if (!l) linhas.push(l = { cy, rs: [] }); l.rs.push(r); });
        if (linhas.length > 1) {
          const esq = linhas.map((l) => Math.round(Math.min(...l.rs.map((r) => r.left)) - E)), dir = linhas.map((l) => Math.round(Math.max(...l.rs.map((r) => r.right)) - E));
          if (Math.max(...esq) - Math.min(...esq) > 2 || Math.max(...dir) - Math.min(...dir) > 2) achados.push(`botões desalinhados em ${(g.id || g.className || g.tagName).toString().slice(0, 30)} esq[${esq}] dir[${dir}]`);
        }
      });
    }
    return [...new Set(achados)].slice(0, 8);
  }, seletor);
}


// Cubo de lado L em STL binário (12 triângulos), como arquivo para setInputFiles.
function cuboSTL(L = 20, name = 'cubo_teste.stl') {
  const v = [[0,0,0],[L,0,0],[L,L,0],[0,L,0],[0,0,L],[L,0,L],[L,L,L],[0,L,L]];
  const f = [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];
  const b = Buffer.alloc(84 + f.length * 50); b.writeUInt32LE(f.length, 80);
  f.forEach((t, i) => t.forEach((k, j) => v[k].forEach((c, e) => b.writeFloatLE(c, 84 + i * 50 + 12 + j * 12 + e * 4))));
  return { name, mimeType: 'model/stl', buffer: b };
}

// 3MF fatiado (Bambu/Orca) com um cubo: peso 12,5 g, 1h30, PETG.
function cubo3mfFatiado(name = 'cubo_fatiado.3mf', { colorido = false } = {}) {
  const zlib = require('node:zlib');
  const v = [[0,0,0],[10,0,0],[10,10,0],[0,10,0],[0,0,10],[10,0,10],[10,10,10],[0,10,10]];
  const f = [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];
  const modelo = '<model><resources><object id="1"><mesh><vertices>' + v.map(([x, y, z]) => `<vertex x="${x}" y="${y}" z="${z}"/>`).join('') +
    '</vertices><triangles>' + f.map(([a, b, c]) => `<triangle v1="${a}" v2="${b}" v3="${c}"/>`).join('') + '</triangles></mesh></object></resources><build><item objectid="1"/></build></model>';
  const arquivos = {
    '3D/3dmodel.model': modelo,
    'Metadata/slice_info.config': '<config><plate><metadata key="prediction" value="5400"/><metadata key="weight" value="12.5"/><object identify_id="1" name="a"/><filament id="1" type="PETG" used_g="12.5"/></plate></config>',
  };
  if (colorido) { // projeto Bambu/Orca: cores dos filamentos e filamento usado pelo objeto
    arquivos['Metadata/project_settings.config'] = JSON.stringify({ filament_colour: ['#FFFFFF', '#1E5BB8'] });
    arquivos['Metadata/model_settings.config'] = '<config><object id="1"><metadata key="extruder" value="2"/></object></config>';
  }
  const locais = [], central = []; let off = 0;
  for (const [nome, txt] of Object.entries(arquivos)) {
    const n = Buffer.from(nome), dado = zlib.deflateRawSync(Buffer.from(txt));
    const l = Buffer.alloc(30); l.writeUInt32LE(0x04034b50, 0); l.writeUInt16LE(8, 8); l.writeUInt32LE(dado.length, 18); l.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(8, 10); c.writeUInt32LE(dado.length, 20); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(off, 42);
    locais.push(l, n, dado); central.push(c, n); off += 30 + n.length + dado.length;
  }
  const cd = Buffer.concat(central), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(Object.keys(arquivos).length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return { name, mimeType: 'model/3mf', buffer: Buffer.concat([...locais, cd, e]) };
}

const sessaoDeTeste = () => [`sb-${ref}-auth-token`, JSON.stringify(sessao())];
module.exports = { sessaoDeTeste, bancoFalso, cuboSTL, cubo3mfFatiado, entrar, gerarOrcamento, auditar, urlSupabase };
