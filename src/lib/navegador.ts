import { chromium, type Browser, type Page } from 'playwright-core';

export const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function abrirNavegador(oculto = false): Promise<Browser> {
  for (const channel of ['chrome', 'msedge']) {
    try {
      const b = await chromium.launch({ channel, headless: oculto });
      console.log(`navegador: ${channel}${oculto ? ' (oculto)' : ''}`);
      return b;
    } catch {}
  }
  throw new Error('No encuentro Chrome ni Edge instalados en este equipo');
}

export async function cargar(page: Page, url: string): Promise<boolean> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
    console.log(`  no carga ${url}: ${(e as Error).message.split('\n')[0]}`);
    return false;
  }
  for (let i = 0; i < 20; i++) {
    const titulo = await page.title().catch(() => '');
    if (!/being redirected/i.test(titulo)) break;
    await esperar(1000);
  }
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  const titulo = await page.title().catch(() => '');
  if (/being redirected|access denied|blocked/i.test(titulo)) {
    console.log(`  la pagina sigue bloqueada: ${titulo}`);
    return false;
  }
  return true;
}

export async function enlaces(page: Page): Promise<{ texto: string; href: string }[]> {
  return page.$$eval('a[href]', as => as.map(a => ({
    texto: (a.textContent ?? '').replace(/\s+/g, ' ').trim(),
    href: (a as HTMLAnchorElement).href
  })));
}

export async function lineas(page: Page): Promise<string[]> {
  const texto = await page.evaluate(() => document.body?.innerText ?? '');
  return texto.split('\n').map(l => l.trim()).filter(Boolean);
}

export async function bajarPdf(page: Page, url: string): Promise<Buffer | null> {
  try {
    const res = await page.context().request.get(url, { timeout: 90000 });
    if (!res.ok()) return null;
    const buf = Buffer.from(await res.body());
    return buf.subarray(0, 4).toString() === '%PDF' ? buf : null;
  } catch {
    return null;
  }
}
