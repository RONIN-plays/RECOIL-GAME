// Opens the game in headless Chrome, optionally runs some JS, saves screenshots and reports console errors.
// usage: node tools/shot.mjs "<query string>" <name> <waitMs> ["<js to eval>" <waitMs> ...]
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const [query = '', name = 'shot', wait = '2500', ...rest] = process.argv.slice(2);
const port = process.env.PORT ?? '5173';
fs.mkdirSync('tools/shots', { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: (process.env.SOFT ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=d3d11', '--enable-gpu']).concat(['--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding']),
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack ?? ''}`));

await page.goto(`http://localhost:${port}/${query ? '?' + query : ''}`);
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: `tools/shots/${name}.png` });
let n = 1;
for (let i = 0; i < rest.length; i += 2) {
  const js = rest[i];
  const w = Number(rest[i + 1] ?? 500);
  try {
    const r = await page.evaluate(js);
    if (r !== undefined) console.log(`eval ${n}:`, JSON.stringify(r));
  } catch (e) {
    errors.push(`[eval ${n}] ${e.message}`);
  }
  await page.waitForTimeout(w);
  await page.screenshot({ path: `tools/shots/${name}_${n}.png` });
  n++;
}
console.log(errors.length ? `ERRORS (${errors.length}):\n${[...new Set(errors)].slice(0, 15).join('\n')}` : 'no console errors');
await browser.close();
