/* Gera os ícones a partir da logo "3D" (site/app/img/logo-3d-colorido.svg): ícones do site, do PWA
   e a marca em PNG. O meio do "3D" (e não o bico) fica no centro do ícone: é o que a logo nova já traz na própria caixa.
   Uso:  node scripts/gerar-icones.cjs */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const LOGO = fs.readFileSync(path.join(RAIZ, 'site/app/img/logo-3d-colorido.svg'));
const PAPEL = '#F7F0E4';
const dataUri = 'data:image/svg+xml;base64,' + LOGO.toString('base64');

// logo ocupando 62,5% da largura do ícone (como no ícone anterior); a altura acompanha a proporção da logo
const html = (t, { redondo = false, fundo = true, larg = 0.625, altura = null } = {}) => `<!doctype html><body style="margin:0;background:transparent">
<div style="width:${t}px;height:${t}px;display:grid;place-items:center;overflow:hidden;${fundo ? `background:${PAPEL};` : ''}${redondo ? 'border-radius:50%;' : ''}">
<img src="${dataUri}" style="${altura ? `height:${altura * 100}%;width:auto` : `width:${larg * 100}%;height:auto`};display:block"></div></body>`;

const ALVOS = [
  ['site/app/icons/icon-192.png', 192, {}],
  ['site/app/icons/icon-512.png', 512, {}],
  ['site/app/icons/apple-touch-icon.png', 180, {}],
  ['site/app/img/projeto-trid-mark.png', 1024, { fundo: false, altura: 1 }],
];

(async () => {
  const navegador = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
  const pagina = await navegador.newPage();
  for (const [arq, t, op] of ALVOS) {
    await pagina.setViewportSize({ width: t, height: t });
    await pagina.setContent(html(t, op));
    await pagina.waitForFunction(() => document.images[0].complete);
    fs.writeFileSync(path.join(RAIZ, arq), await pagina.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: t, height: t } }));
    console.log('ok', arq, t);
  }
  await navegador.close();
  // o ícone vetorial do site: mesma composição, logo de 320 de largura centralizada
  const svg = path.join(RAIZ, 'site/app/icons/icon.svg');
  const interno = LOGO.toString('utf8').replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const vb = LOGO.toString('utf8').match(/viewBox="([^"]+)"/)[1].split(' ').map(Number), larg = 320, alt = (larg * vb[3]) / vb[2];
  fs.writeFileSync(svg, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="116" fill="${PAPEL}"/><svg x="96" y="${((512 - alt) / 2).toFixed(1)}" width="${larg}" height="${alt.toFixed(1)}" viewBox="${vb.join(' ')}">${interno}</svg></svg>\n`);
  console.log('ok site/app/icons/icon.svg');
})();
