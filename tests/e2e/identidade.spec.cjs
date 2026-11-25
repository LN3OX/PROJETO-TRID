// Identidade visual: logo "TRID" com o símbolo de cubos vermelhos e grafite, centralizado nos ícones.
const { test, expect } = require('@playwright/test');

// centro (vertical e horizontal) do desenho do símbolo (tudo o que difere do fundo do canto), em fração do tamanho da imagem
const medir = (page, url, largura) => page.evaluate(async ([u, w]) => {
  const img = new Image(); img.src = u; await img.decode();
  const c = document.createElement('canvas'), h = Math.round((w * img.naturalHeight) / img.naturalWidth); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, f = [d[0], d[1], d[2], d[3]]; let y0 = h, y1 = 0, x0 = w, x1 = 0;
  for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) { const k = (y * w + i) * 4, r = d[k], g = d[k + 1], b = d[k + 2]; if (Math.abs(d[k + 3] - f[3]) + Math.abs(r - f[0]) + Math.abs(g - f[1]) + Math.abs(b - f[2]) > 120) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); x0 = Math.min(x0, i); x1 = Math.max(x1, i); } }
  return { cy: (y0 + y1) / 2 / h, cx: (x0 + x1) / 2 / w };
}, [url, largura]);

test.describe('identidade visual', () => {
  for (const [arq, larg] of [['/app/icons/icon-512.png', 512], ['/app/icons/icon-192.png', 192], ['/app/icons/apple-touch-icon.png', 180], ['/app/icons/favicon.png', 64], ['/app/img/projeto-trid-mark.png', 512]]) {
    test(`o símbolo de cubos fica no centro: ${arq}`, async ({ page }) => {
      await page.goto('/app/');
      const m = await medir(page, arq, larg);
      expect(Math.abs(m.cy - 0.5), `centro vertical em ${(m.cy * 100).toFixed(1)}%`).toBeLessThan(0.04);
      expect(Math.abs(m.cx - 0.5), `centro horizontal em ${(m.cx * 100).toFixed(1)}%`).toBeLessThan(0.04);
    });
  }

  test('o símbolo é mais alto que largo e a logo com nome é horizontal', async ({ page }) => {
    await page.goto('/app/');
    const r = await page.evaluate(async () => {
      const dim = async (u) => { const i = new Image(); i.src = u; await i.decode(); return i.naturalWidth / i.naturalHeight; };
      return { simbolo: await dim('/app/img/logo-trid-simbolo.png'), claro: await dim('/app/img/logo-trid-claro.png'), escuro: await dim('/app/img/logo-trid-escuro.png') };
    });
    expect(r.simbolo).toBeLessThan(1);
    expect(r.claro).toBeGreaterThan(3);
    expect(r.escuro).toBeCloseTo(r.claro, 2);
  });
});
