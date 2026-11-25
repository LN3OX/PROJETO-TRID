/* Peça de demonstração em 3D: o símbolo "3D" da ProjetoTrid como um chaveiro impresso (placa + símbolo em relevo, uma cor por parte,
   com linhas de camada). A geometria sai do SVG da logo (/app/img/logo-3d-colorido.svg) e usa o three.js que já vem com o app.
   Mesma interface da peça anterior: criarPeca(host, { interativo, paleta, velocidade }) → { paleta(nome), fechar() } ou null. */
let tres = null;
const carregar = () => (tres ??= Promise.all([
  import('/app/vendor/three/three.module.min.js'),
  import('/app/vendor/three/OrbitControls.js'),
]));

// cores por filamento: placa, e as quatro partes do símbolo na ordem do SVG (vermelho, azul, verde, bico)
export const PALETAS = {
  marca: { placa: '#F4ECDF', partes: ['#E63B2E', '#1F5FD6', '#0F9D4B', '#1B1B1B'] },
  // símbolo numa cor só, sobre a placa creme
  vermelho: { placa: '#F4ECDF', partes: ['#C8261B', '#C8261B', '#C8261B', '#C8261B'] },
  azul: { placa: '#F4ECDF', partes: ['#1F5FD6', '#1F5FD6', '#1F5FD6', '#1F5FD6'] },
  verde: { placa: '#F4ECDF', partes: ['#0F9D4B', '#0F9D4B', '#0F9D4B', '#0F9D4B'] },
};
// nomes antigos (natal, oceano) continuam funcionando
const ALIAS = { natal: 'marca', oceano: 'azul', grafite: 'verde' };

// lê os caminhos do SVG (só usa M, L, H, V, Q e Z, em coordenadas absolutas)
function lerCaminhos(T, svg) {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  return [...doc.querySelectorAll('path')].map((p) => {
    const sp = new T.ShapePath(), tk = p.getAttribute('d').match(/[MLHVQZ]|-?\d*\.?\d+/g);
    let i = 0, x = 0, y = 0, cmd = '';
    const n = () => parseFloat(tk[i++]);
    while (i < tk.length) {
      if (/[MLHVQZ]/.test(tk[i])) cmd = tk[i++];
      if (cmd === 'M') { x = n(); y = n(); sp.moveTo(x, y); cmd = 'L'; }
      else if (cmd === 'L') { x = n(); y = n(); sp.lineTo(x, y); }
      else if (cmd === 'H') { x = n(); sp.lineTo(x, y); }
      else if (cmd === 'V') { y = n(); sp.lineTo(x, y); }
      else if (cmd === 'Q') { const cx = n(), cy = n(); x = n(); y = n(); sp.quadraticCurveTo(cx, cy, x, y); }
      else if (cmd === 'Z') { cmd = ''; }
      else i++;
    }
    return sp;
  }).concat([...doc.querySelectorAll('polygon')].map((pg) => {
    // o bico (triângulo com contorno arredondado): engorda o triângulo pela metade do contorno
    const pts = pg.getAttribute('points').trim().split(/\s+/).map((s) => s.split(',').map(Number));
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    const meia = (parseFloat(pg.getAttribute('stroke-width')) || 0) / 2, sp = new T.ShapePath();
    pts.forEach(([x, y], k) => { const d = Math.hypot(x - cx, y - cy) || 1, f = (d + meia) / d; sp[k ? 'lineTo' : 'moveTo'](cx + (x - cx) * f, cy + (y - cy) * f); });
    return sp;
  }));
}

// linhas de camada: empurra as paredes laterais para fora e para dentro conforme a altura de impressão (o eixo da espessura)
function camadas(T, geo, passo, amp) {
  geo.computeVertexNormals();
  const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal');
  for (let i = 0; i < pos.count; i++) {
    const nz = nor.getZ(i);
    if (Math.abs(nz) > 0.5) continue; // faces de cima e de baixo ficam lisas
    const s = Math.cos((pos.getZ(i) / passo) * Math.PI * 2) * amp;
    pos.setXYZ(i, pos.getX(i) + nor.getX(i) * s, pos.getY(i) + nor.getY(i) * s, pos.getZ(i));
  }
  pos.needsUpdate = true; geo.computeVertexNormals();
  return geo;
}

async function montar(T) {
  const svg = await (await fetch('/app/img/logo-3d-colorido.svg')).text();
  const caminhos = lerCaminhos(T, svg);
  // limites do símbolo (unidades do SVG)
  const caixa = new T.Box2();
  caminhos.forEach((sp) => sp.subPaths.forEach((s) => s.getPoints(8).forEach((p) => caixa.expandByPoint(p))));
  const tam = caixa.getSize(new T.Vector2()), centro = caixa.getCenter(new T.Vector2());
  const esc = 1 / tam.y; // a peça fica com 1 de altura
  const PLACA = 0.07, RELEVO = 0.07, CAMADA = 0.0125;

  // placa redonda e o furo do chaveiro perto da borda, em cima à esquerda
  const R = 0.5 * Math.hypot(tam.x * esc, 1) + 0.07, h = 2 * R;
  const placa = new T.Shape(); placa.absarc(0, 0, R, 0, Math.PI * 2, false);
  const ang = (125 * Math.PI) / 180, furo = new T.Path(); furo.absarc(Math.cos(ang) * (R - 0.1), Math.sin(ang) * (R - 0.1), 0.05, 0, Math.PI * 2, true); placa.holes.push(furo);
  const geoPlaca = camadas(T, new T.ExtrudeGeometry(placa, { depth: PLACA, steps: 8, bevelEnabled: false, curveSegments: 64 }), CAMADA, 0.0016);

  // símbolo em relevo, uma malha por cor (vermelho, azul, verde, bico)
  const geoPartes = caminhos.map((sp) => {
    let formas = T.ShapeUtils.isClockWise(sp.subPaths[0].getPoints()) ? sp.toShapes(true) : sp.toShapes(false);
    if (!formas.length) formas = sp.toShapes(false);
    if (sp.subPaths.length === 1) formas = [new T.Shape(sp.subPaths[0].getPoints(10))]; // uma forma só (o bico): sem a regra de furos
    const g = new T.ExtrudeGeometry(formas, { depth: RELEVO / esc, steps: 8, bevelEnabled: false, curveSegments: 10 });
    g.translate(-centro.x, -centro.y, 0); g.scale(esc, esc, esc); g.translate(0, 0, PLACA);
    return camadas(T, g, CAMADA, 0.0016);
  });
  return { geoPlaca, geoPartes, altura: h, espessura: PLACA + RELEVO };
}

/* host: elemento que recebe o canvas. interativo: arrastar gira. Devolve null se o WebGL não estiver disponível. */
export async function criarPeca(host, { interativo = false, paleta = 'marca', velocidade = 2 } = {}) {
  const [T, { OrbitControls }] = await carregar();
  let renderer;
  try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); } catch { return null; }
  const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  const canvas = renderer.domElement;
  host.replaceChildren(canvas);

  const { geoPlaca, geoPartes, altura, espessura } = await montar(T);
  const cena = new T.Scene(), peca = new T.Group();
  const matPlaca = new T.MeshStandardMaterial({ roughness: 0.6, metalness: 0.02 });
  const matPartes = geoPartes.map(() => new T.MeshStandardMaterial({ roughness: 0.5, metalness: 0.02 }));
  peca.add(new T.Mesh(geoPlaca, matPlaca), ...geoPartes.map((g, i) => new T.Mesh(g, matPartes[i])));
  // em pé, apoiada na base, centralizada na espessura
  peca.position.set(0, altura / 2, -espessura / 2);
  const suporte = new T.Group(); suporte.add(peca); cena.add(suporte);

  // sombra de contato (um disco com gradiente, sem mapa de sombra)
  const c2 = document.createElement('canvas'); c2.width = c2.height = 128;
  const x2 = c2.getContext('2d'), gr = x2.createRadialGradient(64, 64, 6, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,.34)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x2.fillStyle = gr; x2.fillRect(0, 0, 128, 128);
  const sombra = new T.Mesh(new T.PlaneGeometry(1.8, 0.7), new T.MeshBasicMaterial({ map: new T.CanvasTexture(c2), transparent: true, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2; sombra.position.y = -0.002;
  cena.add(sombra);
  cena.add(new T.HemisphereLight(0xffffff, 0x8a7f6a, 1.6));
  const sol = new T.DirectionalLight(0xffffff, 2.2); sol.position.set(1.6, 2.6, 2.6); cena.add(sol);
  const contra = new T.DirectionalLight(0xffffff, 0.8); contra.position.set(-2, 1.2, -1.5); cena.add(contra);

  const camera = new T.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0.75, altura * 0.72, 3.1);
  const ctrl = new OrbitControls(camera, canvas);
  ctrl.target.set(0, altura / 2, 0);
  ctrl.enablePan = false; ctrl.enableZoom = false; ctrl.enableDamping = !reduzir;
  ctrl.minPolarAngle = 0.6; ctrl.maxPolarAngle = 1.6;
  ctrl.autoRotate = !reduzir; ctrl.autoRotateSpeed = velocidade;
  ctrl.enableRotate = interativo;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.touchAction = interativo ? 'pan-y' : 'auto'; // no celular, rolar a página com o dedo sobre a peça continua funcionando
  ctrl.update();

  function aplicarPaleta(nome) {
    const p = PALETAS[ALIAS[nome] || nome] || PALETAS.marca;
    matPlaca.color.set(p.placa); matPartes.forEach((m, i) => m.color.set(p.partes[i] || p.partes[0]));
    pedir();
  }

  let vivo = true, visivel = true, pendente = false;
  function quadro() { pendente = false; if (!vivo || !visivel) return; const mudou = ctrl.update(); renderer.render(cena, camera); if (mudou || ctrl.autoRotate) pedir(); }
  function pedir() { if (pendente || !vivo) return; pendente = true; requestAnimationFrame(quadro); }
  ctrl.addEventListener('change', pedir);
  // enquadra a peça inteira: a distância acompanha a proporção do quadro (num quadro estreito a placa não sai pelos lados)
  const medir = () => {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    const tg = Math.tan((camera.fov * Math.PI) / 360), largura = altura;
    const dist = Math.max((altura / 2) / tg, (largura / 2) / (tg * camera.aspect)) * 1.45;
    const dir = camera.position.clone().sub(ctrl.target).normalize();
    camera.position.copy(ctrl.target).addScaledVector(dir, dist);
    camera.updateProjectionMatrix(); ctrl.update(); renderer.render(cena, camera); pedir();
  };
  const ro = new ResizeObserver(medir); ro.observe(host);
  const io = new IntersectionObserver(([e]) => { visivel = e.isIntersecting; if (visivel) pedir(); }); io.observe(host);
  if (interativo) { // teclado: as setas giram a peça
    host.tabIndex = 0;
    host.addEventListener('keydown', (e) => { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.preventDefault(); ctrl.autoRotate = false; suporte.rotation.y += (e.key === 'ArrowLeft' ? -1 : 1) * 0.3; pedir(); });
  }
  aplicarPaleta(paleta); medir();

  return {
    paleta: aplicarPaleta,
    fechar() { vivo = false; ro.disconnect(); io.disconnect(); ctrl.dispose(); geoPlaca.dispose(); geoPartes.forEach((g) => g.dispose()); matPlaca.dispose(); matPartes.forEach((m) => m.dispose()); renderer.dispose(); host.replaceChildren(); },
  };
}
