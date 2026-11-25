// Identidade visual: o meio das letras "3D" (e não o bico) é o centro da logo e dos ícones.
const { test, expect } = require('@playwright/test');

// centro vertical das letras coloridas (o bico é grafite/papel, sem cor), em fração da altura da imagem
const medir = (page, url, largura) => page.evaluate(async ([u, w]) => {
  const img = new Image(); img.src = u; await img.decode();
  const c = document.createElement('canvas'), h = Math.round((w * img.naturalHeight) / img.naturalWidth); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data; let min = h, max = 0;
  for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) { const k = (y * w + i) * 4, r = d[k], g = d[k + 1], b = d[k + 2]; if (d[k + 3] > 200 && Math.max(r, g, b) - Math.min(r, g, b) > 80) { if (y < min) min = y; if (y > max) max = y; } }
  return { centro: (min + max) / 2 / h, topo: min / h, base: max / h };
}, [url, largura]);

test.describe('identidade visual', () => {
  for (const [arq, larg] of [['/app/img/logo-3d-colorido.svg', 600], ['/app/img/logo-3d-escuro.svg', 600], ['/app/icons/icon-512.png', 512], ['/app/icons/icon-192.png', 192], ['/app/icons/apple-touch-icon.png', 180], ['/app/img/projeto-trid-mark.png', 512]]) {
    test(`o meio do "3D" é o centro: ${arq}`, async ({ page }) => {
      await page.goto('/app/');
      const m = await medir(page, arq, larg);
      expect(Math.abs(m.centro - 0.5), `meio do 3D em ${(m.centro * 100).toFixed(1)}%`).toBeLessThan(0.025);
    });
  }

  test('ícone do site (SVG) tem o meio do "3D" no centro', async ({ page }) => {
    await page.goto('/app/');
    const m = await medir(page, '/app/icons/icon.svg', 512);
    expect(Math.abs(m.centro - 0.5)).toBeLessThan(0.025);
  });

  test('as logos 3D têm a proporção nova (mais altas que largas) e as de nome seguem iguais', async ({ page }) => {
    await page.goto('/app/');
    const r = await page.evaluate(async () => {
      const dim = async (u) => { const i = new Image(); i.src = u; await i.decode(); return i.naturalWidth / i.naturalHeight; };
      return { tres: await dim('/app/img/logo-3d-colorido.svg'), nome: await dim('/app/img/logo-projeto-trid-colorido.svg') };
    });
    expect(r.tres).toBeLessThan(1);
    expect(r.nome).toBeGreaterThan(4);
  });
});
