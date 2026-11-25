/* Visualizador 3D: mostra a peça (triângulos já lidos do STL/3MF) num <canvas>, com girar, zoom e sombra.
   three.js (site/vendor/three, MIT) só é baixado na primeira vez que algo é mostrado.
   Uso: const v = await ProjetoTridVisualizador.mostrar(caixa, tri, { cor, nome }); v.cor('#hex'); v.fechar(); */
(() => {
  let three = null;
  const carregar = () => (three ??= Promise.all([
    import(new URL('vendor/three/three.module.min.js', document.baseURI).href),
    import(new URL('vendor/three/OrbitControls.js', document.baseURI).href),
  ]));

  // nomes de cor comuns em filamentos -> cor de exibição; o resto usa a cor primária do tema
  const CORES = { preto: '#2b2b2b', branco: '#f2f2f2', cinza: '#9a9a9a', prata: '#c0c0c0', vermelho: '#c62828', azul: '#1e5bb8', verde: '#2e7d32', amarelo: '#f2c230', laranja: '#ef7d22', roxo: '#6a3fa0', rosa: '#e47aa8', marrom: '#7a4a2a', dourado: '#c9a227', bege: '#d9c8a5', transparente: '#cfe8f2' };
  function corDe(texto) {
    const t = String(texto || '').toLowerCase();
    const k = Object.keys(CORES).find((c) => t.includes(c));
    return k ? CORES[k] : getComputedStyle(document.documentElement).getPropertyValue('--md-sys-color-primary').trim() || '#8a5a00';
  }

  /* GIF animado sem biblioteca: paleta única (median cut) + LZW. quadros: Uint8ClampedArray RGBA de L×A. */
  function paleta(quadros) {
    const amostra = [];
    for (const q of [quadros[0], quadros[quadros.length >> 2], quadros[quadros.length >> 1], quadros[(quadros.length * 3) >> 2]])
      for (let i = 0; i < q.length; i += 28) amostra.push([q[i], q[i + 1], q[i + 2]]);
    let caixas = [amostra];
    while (caixas.length < 256) {
      let k = -1, melhor = 0, canal = 0;
      caixas.forEach((c, i) => { if (c.length < 2) return; for (let ch = 0; ch < 3; ch++) { let lo = 255, hi = 0; for (const p of c) { if (p[ch] < lo) lo = p[ch]; if (p[ch] > hi) hi = p[ch]; } const v = (hi - lo) * c.length; if (v > melhor) { melhor = v; k = i; canal = ch; } } });
      if (k < 0) break;
      const c = caixas[k].sort((a, b) => a[canal] - b[canal]), m = c.length >> 1;
      caixas.splice(k, 1, c.slice(0, m), c.slice(m));
    }
    return caixas.map((c) => [0, 1, 2].map((ch) => Math.round(c.reduce((t, p) => t + p[ch], 0) / c.length)));
  }
  function lzw(idx) {
    const out = [], dic = new Int16Array(4096 * 256);
    let bits = 9, prox = 258, buf = 0, n = 0;
    const emitir = (cod) => { buf |= cod << n; n += bits; while (n >= 8) { out.push(buf & 255); buf >>>= 8; n -= 8; } };
    emitir(256);
    let pre = idx[0];
    for (let i = 1; i < idx.length; i++) {
      const k = idx[i], chave = pre * 256 + k;
      if (dic[chave]) { pre = dic[chave]; continue; }
      emitir(pre);
      if (prox < 4096) { dic[chave] = prox++; if (prox > (1 << bits) && bits < 12) bits++; }
      else { emitir(256); dic.fill(0); prox = 258; bits = 9; }
      pre = k;
    }
    emitir(pre); emitir(257);
    if (n) out.push(buf & 255);
    return out;
  }
  function gif(quadros, L, A, atraso) {
    const pal = paleta(quadros), cache = new Int16Array(1 << 18).fill(-1);
    const perto = (r, g, b) => { const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2); let v = cache[key]; if (v < 0) { let d = 1e9; for (let i = 0; i < pal.length; i++) { const e = (pal[i][0] - r) ** 2 + (pal[i][1] - g) ** 2 + (pal[i][2] - b) ** 2; if (e < d) { d = e; v = i; } } cache[key] = v; } return v; };
    const w16 = (v) => [v & 255, v >> 8];
    const b = [...'GIF89a'].map((c) => c.charCodeAt(0)).concat(w16(L), w16(A), [0xf7, 0, 0]);
    for (let i = 0; i < 256; i++) b.push(...(pal[i] || [0, 0, 0]));
    b.push(0x21, 0xff, 11, ...[...'NETSCAPE2.0'].map((c) => c.charCodeAt(0)), 3, 1, 0, 0, 0);
    for (const q of quadros) {
      const idx = new Uint8Array(L * A);
      for (let i = 0, j = 0; j < idx.length; i += 4, j++) idx[j] = perto(q[i], q[i + 1], q[i + 2]);
      b.push(0x21, 0xf9, 4, 4, ...w16(atraso), 0, 0, 0x2c, 0, 0, 0, 0, ...w16(L), ...w16(A), 0, 8);
      const d = lzw(idx);
      for (let i = 0; i < d.length; i += 255) { const f = d.slice(i, i + 255); b.push(f.length, ...f); }
      b.push(0);
    }
    b.push(0x3b);
    return new Blob([new Uint8Array(b)], { type: 'image/gif' });
  }

  async function mostrar(caixa, tri, { cor = '', nome = 'peça', aoTrocarCor = null, coresOriginais = null } = {}) {
    let vivo = true, pendente = false, visivel = true; // desenho sob demanda: só redesenha quando algo muda (gira, zoom, cor, tamanho)
    const temProjeto = !!coresOriginais && coresOriginais.length === tri.length; // cor por vértice (sRGB 0–1), lida do 3MF do projeto
    const [T, { OrbitControls }] = await carregar();
    caixa.replaceChildren();
    const larg = caixa.clientWidth || 320, alt = caixa.clientHeight || 240;
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    renderer.setSize(larg, alt);
    renderer.shadowMap.enabled = true;
    const canvas = renderer.domElement;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `Visualização 3D de ${nome}. Arraste para girar e use a roda ou dois dedos para aproximar.`);
    caixa.append(canvas);
    // três ícones sobre o 3D: tela cheia (topo direito), cores (base esquerda) e compartilhar (base direita)
    const ICONES = {
      tela: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
      cor: '<path d="M12 3a9 9 0 0 0 0 18c1.4 0 2-.9 2-1.8 0-1.3-1-1.5-1-2.7 0-1 .8-1.5 1.8-1.5H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8Z"/><circle cx="7.5" cy="11.5" r="1" fill="currentColor"/><circle cx="10.5" cy="7.5" r="1" fill="currentColor"/><circle cx="15.5" cy="8" r="1" fill="currentColor"/>',
      enviar: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14"/>',
    };
    const icone = (tipo, rotulo, pos) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = `model-icone model-icone-${pos}`; b.title = rotulo; b.setAttribute('aria-label', rotulo);
      b.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[tipo]}</svg>`;
      return b;
    };
    const painel = (classe, rotulo) => { const d = document.createElement('div'); d.className = `model-painel ${classe}`; d.hidden = true; d.setAttribute('role', 'group'); d.setAttribute('aria-label', rotulo); return d; };
    const alternar = (gatilho, alvo) => { gatilho.setAttribute('aria-expanded', 'false'); gatilho.addEventListener('click', () => { const abrir = alvo.hidden; fecharPaineis(); alvo.hidden = !abrir; gatilho.setAttribute('aria-expanded', String(abrir)); }); };
    const fecharPaineis = () => { for (const [g, a] of pares) { a.hidden = true; g.setAttribute('aria-expanded', 'false'); } };
    const pares = [];
    const cores = painel('model-cores', 'Cor da peça');
    const acoes = painel('model-acoes', 'Compartilhar peça');
    const gCor = icone('cor', 'Escolher cor', 'esq'), gEnviar = icone('enviar', 'Compartilhar peça', 'dir');
    pares.push([gCor, cores], [gEnviar, acoes]); alternar(gCor, cores); alternar(gEnviar, acoes);
    const gTela = icone('tela', 'Tela cheia', 'topo');
    if (caixa.requestFullscreen) {
      gTela.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else caixa.requestFullscreen().catch(() => {}); });
      caixa.append(gTela);
    }
    const fora = (e) => { if (!caixa.contains(e.target) || !e.target.closest('.model-painel, .model-icone')) fecharPaineis(); };
    document.addEventListener('pointerdown', fora);
    caixa.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharPaineis(); });
    const botoes = Object.entries(CORES).map(([k, hex]) => {
      const b = document.createElement('button'), rotulo = k[0].toUpperCase() + k.slice(1);
      b.type = 'button'; b.className = 'model-cor'; b.style.background = hex; b.title = rotulo; b.setAttribute('aria-label', rotulo); b.dataset.cor = rotulo;
      b.addEventListener('click', () => { marcar(k); usarProjeto(false); material.color.set(hex); pedir(); aoTrocarCor?.(rotulo); });
      cores.append(b); return [k, b];
    });
    const marcar = (texto) => { const t = String(texto || '').toLowerCase(), k = Object.keys(CORES).find((c) => t.includes(c)); for (const [c, b] of botoes) b.setAttribute('aria-pressed', String(c === k)); bProjeto?.setAttribute('aria-pressed', 'false'); };
    // "Cores do projeto": as cores originais do 3MF (filamentos do Bambu/Orca), sem fatiar
    let bProjeto = null;
    if (temProjeto) {
      const unicas = [], visto = new Set();
      for (let i = 0; i < coresOriginais.length && unicas.length < 6; i += 9) { const h = [0, 1, 2].map((k) => Math.round(coresOriginais[i + k] * 255)).join(','); if (!visto.has(h)) { visto.add(h); unicas.push(`rgb(${h})`); } }
      const passo = 360 / unicas.length;
      bProjeto = document.createElement('button');
      bProjeto.type = 'button'; bProjeto.className = 'model-cor model-cor-projeto'; bProjeto.title = 'Cores do projeto'; bProjeto.setAttribute('aria-label', 'Cores do projeto');
      bProjeto.style.background = unicas.length > 1 ? `conic-gradient(${unicas.map((c, i) => `${c} ${Math.round(i * passo)}deg ${Math.round((i + 1) * passo)}deg`).join(',')})` : unicas[0];
      bProjeto.addEventListener('click', () => { marcar(''); usarProjeto(true); });
      cores.prepend(bProjeto);
    }
    const botao = (texto) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'model-item'; b.textContent = texto; acoes.append(b); return b; };
    const enviar = botao('Compartilhar imagem'), enviarGif = botao('Compartilhar GIF');
    caixa.append(cores, acoes, gCor, gEnviar);

    const cena = new T.Scene();
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(tri.slice(), 3)); // cópia: a original segue para o fatiamento
    geo.rotateX(-Math.PI / 2); // impressão usa Z para cima; three.js usa Y
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    const caixaGeo = geo.boundingBox, centro = new T.Vector3();
    caixaGeo.getCenter(centro);
    geo.translate(-centro.x, -caixaGeo.min.y, -centro.z); // apoiada na mesa, centralizada
    const tam = caixaGeo.getSize(new T.Vector3()), raio = Math.max(tam.x, tam.y, tam.z) || 10;

    if (temProjeto) { // cores por vértice em espaço linear, como o three.js espera
      const lin = new Float32Array(coresOriginais.length), c = new T.Color();
      for (let i = 0; i < lin.length; i += 3) { c.setRGB(coresOriginais[i], coresOriginais[i + 1], coresOriginais[i + 2], T.SRGBColorSpace); lin[i] = c.r; lin[i + 1] = c.g; lin[i + 2] = c.b; }
      geo.setAttribute('color', new T.BufferAttribute(lin, 3));
    }
    const material = new T.MeshStandardMaterial({ color: corDe(cor), roughness: 0.55, metalness: 0.05 });
    function usarProjeto(sim) { material.vertexColors = sim; if (sim) material.color.set(0xffffff); material.needsUpdate = true; bProjeto?.setAttribute('aria-pressed', String(sim)); pedir(); }
    if (temProjeto) usarProjeto(true); else marcar(cor);
    const malha = new T.Mesh(geo, material);
    malha.castShadow = true;
    cena.add(malha);
    const chao = new T.Mesh(new T.PlaneGeometry(raio * 6, raio * 6), new T.ShadowMaterial({ opacity: 0.18 }));
    chao.rotateX(-Math.PI / 2); chao.receiveShadow = true;
    cena.add(chao);
    cena.add(new T.HemisphereLight(0xffffff, 0x666666, 2.2));
    const sol = new T.DirectionalLight(0xffffff, 1.6);
    sol.position.set(raio, raio * 2, raio);
    sol.castShadow = true;
    Object.assign(sol.shadow.camera, { left: -raio * 2, right: raio * 2, top: raio * 2, bottom: -raio * 2, far: raio * 8 });
    sol.shadow.mapSize.set(1024, 1024);
    cena.add(sol);

    const camera = new T.PerspectiveCamera(35, larg / alt, raio / 100, raio * 50);
    // enquadra a peça inteira (esfera que a contém) para a proporção da caixa, em qualquer tela
    const dir = new T.Vector3(1.6, 1.2, 1.9).normalize(), R = tam.length() / 2;
    const fov = Math.min(35, (2 * Math.atan(Math.tan((35 * Math.PI) / 360) * camera.aspect) * 180) / Math.PI) * (Math.PI / 180);
    camera.position.copy(dir.multiplyScalar((R * 1.15) / Math.sin(fov / 2))).add(new T.Vector3(0, tam.y / 2, 0));
    const ctrl = new OrbitControls(camera, canvas);
    ctrl.target.set(0, tam.y / 2, 0);
    ctrl.enableDamping = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    ctrl.update();

    // imagem 1200×900 com fundo claro (PNG transparente fica preto no WhatsApp)
    function imagem() {
      const L = 1200, A = 900, w = renderer.domElement.width, h = renderer.domElement.height, pr = renderer.getPixelRatio();
      renderer.setPixelRatio(1); renderer.setSize(L, A, false); camera.aspect = L / A; camera.updateProjectionMatrix();
      renderer.render(cena, camera);
      const c = document.createElement('canvas'); c.width = L; c.height = A;
      const x = c.getContext('2d'); x.fillStyle = '#f4f2ee'; x.fillRect(0, 0, L, A); x.drawImage(renderer.domElement, 0, 0);
      renderer.setPixelRatio(pr); renderer.setSize(w / pr, h / pr, false); camera.aspect = w / h; camera.updateProjectionMatrix(); pedir();
      return new Promise((ok) => c.toBlob(ok, 'image/png'));
    }
    const base = String(nome).trim().replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase() || 'peca';
    async function compartilhar(blob, ext) {
      const arq = new File([blob], `${base}.${ext}`, { type: blob.type });
      if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [arq] })) { try { await navigator.share({ files: [arq], title: nome }); } catch { /* cancelou */ } return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(arq); a.download = arq.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    enviar.addEventListener('click', async () => compartilhar(await imagem(), 'png'));
    // peça girando uma volta (72 quadros de 400×300 a 10 por segundo, ~7 s); a câmera fica parada e a peça gira, como num prato giratório
    // GIF da peça girando uma volta (72 quadros de 400×300 a 10 por segundo, ~7 s). A câmera fica parada e a peça gira.
    // Os pixels vêm direto do WebGL (render target + readPixels), sem passar por canvas 2D: em alguns celulares o drawImage do WebGL saía em branco.
    const LUT = Uint8Array.from({ length: 256 }, (_, i) => { const v = i / 255; return Math.round((v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055) * 255); }); // linear -> sRGB
    async function gerarGif(progresso = () => {}) {
      const L = 400, A = 300, N = 72, FUNDO = [0xf4, 0xf2, 0xee], giro = malha.rotation.y, cam = camera.clone(); // câmera própria: a tela não deforma durante a geração
      const alvo = new T.WebGLRenderTarget(L, A, { samples: 4 }), buf = new Uint8Array(L * A * 4), quadros = [];
      try {
        cam.aspect = L / A; cam.updateProjectionMatrix();
        for (let i = 0; i < N; i++) {
          malha.rotation.y = giro + (i / N) * 2 * Math.PI;
          renderer.setRenderTarget(alvo); renderer.render(cena, cam); renderer.readRenderTargetPixels(alvo, 0, 0, L, A, buf); renderer.setRenderTarget(null);
          const q = new Uint8ClampedArray(L * A * 4);
          for (let y = 0; y < A; y++) for (let x = 0, o = y * L * 4, e = (A - 1 - y) * L * 4; x < L; x++, o += 4, e += 4) { // WebGL lê de baixo para cima; cor sobre o fundo claro
            const a = buf[e + 3] / 255;
            q[o] = LUT[buf[e]] + FUNDO[0] * (1 - a); q[o + 1] = LUT[buf[e + 1]] + FUNDO[1] * (1 - a); q[o + 2] = LUT[buf[e + 2]] + FUNDO[2] * (1 - a); q[o + 3] = 255;
          }
          if (i === 0) { let peca = 0; for (let k = 0; k < q.length; k += 4) if (Math.abs(q[k] - FUNDO[0]) + Math.abs(q[k + 1] - FUNDO[1]) + Math.abs(q[k + 2] - FUNDO[2]) > 30) peca++; if (peca < 50) throw new Error('quadro vazio'); }
          quadros.push(q);
          progresso(Math.round(((i + 1) / N) * 100));
          await new Promise((ok) => setTimeout(ok));
        }
        return gif(quadros, L, A, 10);
      } finally {
        malha.rotation.y = giro; renderer.setRenderTarget(null); alvo.dispose(); pedir();
      }
    }
    enviarGif.addEventListener('click', async () => {
      const texto = enviarGif.textContent;
      acoes.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      try {
        const arquivo = await gerarGif((p) => { enviarGif.textContent = `Gerando… ${p}%`; });
        enviarGif.textContent = 'Montando…'; await new Promise((ok) => setTimeout(ok));
        await compartilhar(arquivo, 'gif');
      } catch { enviarGif.textContent = 'Não foi possível gerar o GIF'; await new Promise((ok) => setTimeout(ok, 3000)); }
      finally { enviarGif.textContent = texto; acoes.querySelectorAll('button').forEach((b) => { b.disabled = false; }); }
    });

    function desenhar() { pendente = false; if (!vivo || !visivel) return; const mudou = ctrl.update(); renderer.render(cena, camera); if (mudou) pedir(); } // mudou = ainda girando (inércia)
    function pedir() { if (pendente || !vivo) return; pendente = true; requestAnimationFrame(desenhar); }
    ctrl.addEventListener('change', pedir);
    const aparece = new IntersectionObserver(([e]) => { visivel = e.isIntersecting; if (visivel) pedir(); }); // fora da tela (etapa oculta, rolou): não desenha
    aparece.observe(canvas);
    pedir();
    const ajuste = new ResizeObserver(() => { const w = caixa.clientWidth, h = caixa.clientHeight; if (!w || !h) return; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); pedir(); });
    ajuste.observe(caixa);

    return {
      imagem,
      gif: gerarGif,
      cor: (c) => { marcar(c); usarProjeto(false); material.color.set(corDe(c)); pedir(); },
      fechar: () => { vivo = false; document.removeEventListener('pointerdown', fora); ajuste.disconnect(); aparece.disconnect(); ctrl.dispose(); geo.dispose(); material.dispose(); renderer.dispose(); caixa.replaceChildren(); },
    };
  }

  window.ProjetoTridVisualizador = { mostrar, corDe };
})();
