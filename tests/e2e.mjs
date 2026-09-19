import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

// Kleiner statischer Server, damit der Test ohne weitere Abhängigkeiten läuft.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
};

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const file = join(ROOT, path === '/' ? 'index.html' : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const PORT = server.address().port;

const errors = [];
const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const ctx = await browser.newContext({ ...devices['iPhone 14'] });
const page = await ctx.newPage();
page.setDefaultTimeout(6000);
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const BASE = `http://127.0.0.1:${PORT}/index.html`;
await page.goto(BASE);
await page.waitForSelector('#view .btn');

const step = async (label, fn) => {
  try { await fn(); console.log('✓', label); }
  catch (e) { console.log('✗', label, '→', e.message.split('\n')[0]); errors.push(label + ': ' + e.message.split('\n')[0]); }
};

await step('Leeres Training starten', async () => {
  await page.getByRole('link', { name: /Neues Training starten/ }).click();
  await page.getByRole('button', { name: 'Leeres Training starten' }).click();
  await page.waitForSelector('input[placeholder="Maschine hinzufügen …"]');
});

await step('Trainingsnamen setzen', async () => {
  const name = page.locator('label:has-text("Training") input[type=text]').first();
  await name.fill('Oberkörper A');
});

await step('Zwei Maschinen hinzufügen', async () => {
  const add = page.locator('input[placeholder="Maschine hinzufügen …"]');
  await add.fill('Beinpresse');
  await page.getByRole('button', { name: 'Hinzufügen' }).click();
  await add.fill('Latzug');
  await page.getByRole('button', { name: 'Hinzufügen' }).click();
  const count = await page.locator('.exercise').count();
  if (count !== 2) throw new Error('erwartet 2 Übungen, gefunden ' + count);
});

await step('Gewicht über Stepper erhöhen', async () => {
  const first = page.locator('.exercise').first();
  const plus = first.locator('.setrow').first().locator('.stepper').first().getByRole('button', { name: 'Gewicht erhöhen' });
  await plus.click(); await plus.click(); await plus.click();
  const val = await first.locator('.setrow').first().locator('.stepper input').first().inputValue();
  if (Number(val) !== 7.5) throw new Error('erwartet 7.5, bekam ' + val);
});

await step('Gewicht direkt eintippen', async () => {
  const input = page.locator('.exercise').first().locator('.setrow').first().locator('.stepper input').first();
  await input.fill('80'); await input.blur();
  const val = await input.inputValue();
  if (Number(val) !== 80) throw new Error('bekam ' + val);
});

await step('Wiederholungen ändern', async () => {
  const reps = page.locator('.exercise').first().locator('.setrow').first().locator('.stepper').nth(1).locator('input');
  await reps.fill('12'); await reps.blur();
  if (Number(await reps.inputValue()) !== 12) throw new Error('reps falsch');
});

await step('Sätze hinzufügen (übernimmt letzten Satz)', async () => {
  const first = page.locator('.exercise').first();
  await first.getByRole('button', { name: '＋ Satz' }).click();
  await first.getByRole('button', { name: '＋ Satz' }).click();
  const rows = await first.locator('.setrow').count();
  if (rows !== 3) throw new Error('erwartet 3 Sätze, gefunden ' + rows);
  const w = await first.locator('.setrow').nth(2).locator('.stepper input').first().inputValue();
  if (Number(w) !== 80) throw new Error('neuer Satz sollte 80 kg erben, hat ' + w);
});

await step('Sätze abhaken', async () => {
  const first = page.locator('.exercise').first();
  for (let i = 0; i < 3; i++) await first.locator('.setrow').nth(i).locator('.setdone').click();
  const pressed = await first.locator('.setdone[aria-pressed="true"]').count();
  if (pressed !== 3) throw new Error('abgehakt: ' + pressed);
});

await step('Gefühl je Satz durchschalten', async () => {
  const first = page.locator('.exercise').first();
  const btn = first.locator('.setrow').first().locator('.seteffort');
  if (await btn.textContent() !== '·') throw new Error('Startzustand nicht leer');
  await btn.click();
  if (await btn.getAttribute('data-effort') !== 'limit') throw new Error('erster Klick nicht "am Limit"');
  if (await btn.textContent() !== '−') throw new Error('Zeichen für Limit falsch');
  await btn.click();
  if (await btn.getAttribute('data-effort') !== 'reserve') throw new Error('zweiter Klick nicht "Reserven"');
  if (await btn.textContent() !== '+') throw new Error('Zeichen für Reserven falsch');
  await btn.click();
  if (await btn.getAttribute('data-effort')) throw new Error('dritter Klick setzt nicht zurück');
  await btn.click(); // auf "am Limit" stehen lassen
});

await step('Volumen in der Zusammenfassung stimmt', async () => {
  const text = await page.locator('#view .card').last().textContent().catch(() => '');
  const summary = await page.locator('#view').textContent();
  if (!summary.includes('3 / 4') && !summary.includes('3 /')) throw new Error('Satzzähler fehlt: ' + summary.slice(0, 80));
  if (!summary.includes('2880 kg')) throw new Error('Volumen 80*12*3=2880 fehlt');
});

await step('Training abschließen', async () => {
  await page.getByRole('button', { name: '✓ Training abschließen' }).click();
  await page.waitForSelector('text=Verlauf');
});

await step('Neues Training aus altem als Vorlage', async () => {
  await page.locator('.tabbar a[href="#/neu"]').click();
  await page.waitForSelector('text=Letztes Training wiederholen');
  await page.locator('button.card--tap').first().click();
  await page.waitForSelector('input[placeholder="Maschine hinzufügen …"]');
  const exCount = await page.locator('.exercise').count();
  if (exCount !== 2) throw new Error('Vorlage übernahm ' + exCount + ' statt 2 Übungen');
  const w = await page.locator('.exercise').first().locator('.setrow').first().locator('.stepper input').first().inputValue();
  if (Number(w) !== 80) throw new Error('Gewicht nicht übernommen: ' + w);
  const done = await page.locator('.setdone[aria-pressed="true"]').count();
  if (done !== 0) throw new Error('Haken hätten zurückgesetzt sein müssen');
  const marked = await page.locator('.seteffort[data-effort="limit"], .seteffort[data-effort="reserve"]').count();
  if (marked !== 0) throw new Error('Beurteilung gehört zur alten Leistung, darf nicht mitkopiert werden');
});

await step('Gefühl bleibt nach Neuladen erhalten', async () => {
  const hint = await page.locator('.exercise__hint').first().textContent();
  if (!hint.includes('−')) throw new Error('"letztes Mal" zeigt die Markierung nicht: ' + hint);
});

await step('"Letztes Mal"-Hinweis erscheint', async () => {
  const hint = await page.locator('.exercise__hint').first().textContent();
  if (!/Letztes Mal/.test(hint)) throw new Error('kein Hinweis: ' + hint);
});

await step('Gewicht anpassen und abschließen', async () => {
  const input = page.locator('.exercise').first().locator('.setrow').first().locator('.stepper input').first();
  await input.fill('85'); await input.blur();
  await page.getByRole('button', { name: '✓ Training abschließen' }).click();
  await page.waitForFunction(() => location.hash === '#/' || location.hash === '');
  await page.waitForSelector('#view a.card--tap');
  const cards = await page.locator('#view a.card--tap').count();
  if (cards !== 2) throw new Error('erwartet 2 Trainings im Verlauf, gefunden ' + cards);
});

await step('Übungs-Fortschritt zeigt Bestwert', async () => {
  await page.locator('.tabbar a[href="#/uebungen"]').click();
  await page.waitForSelector('text=Beinpresse');
  await page.getByRole('link', { name: /Beinpresse/ }).click();
  const txt = await page.locator('#view').textContent();
  if (!txt.includes('85 kg')) throw new Error('Bestwert 85 kg fehlt');
});

await step('Textimport', async () => {
  await page.locator('.tabbar a[href="#/daten"]').click();
  await page.waitForSelector('textarea');
  page.once('dialog', (d) => d.accept());
  await page.locator('textarea').fill([
    'Training Fitko',
    '21.05.2026',
    'Abductor Leg Extension Oberschenkel',
    '45 kg x 15',
    '55 kg x 15',
    '65 kg x 15 -',
    '',
    'Triceps hoch',
    '15 kg x 15',
    '20 kg x 13',
  ].join('\n'));
  await page.getByRole('button', { name: 'Text einlesen' }).click();
  await page.waitForTimeout(300);
  const txt = await page.locator('#view').textContent();
  if (!txt.includes('1 Trainings importiert')) throw new Error('Import-Report fehlt: ' + txt.slice(0, 200));
  if (txt.includes('⚠︎')) throw new Error('unerwartete Hinweise: ' + txt.slice(0, 300));
  const efforts = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('fitko.state.v1'));
    const w = state.workouts.find((x) => x.name === 'Training Fitko');
    return w.exercises.map((e) => e.sets.map((s) => s.effort));
  });
  const expected = JSON.stringify([[null, null, 'limit'], [null, null]]);
  if (JSON.stringify(efforts) !== expected) {
    throw new Error('Markierungen falsch importiert: ' + JSON.stringify(efforts));
  }
});

await step('Import landet im Verlauf', async () => {
  await page.locator('.tabbar a[href="#/"]').click();
  await page.waitForSelector('#view a.card--tap');
  const txt = await page.locator('#view').textContent();
  if (!txt.includes('Training Fitko')) throw new Error('importiertes Training fehlt');
  if (!txt.includes('21.05.2026')) throw new Error('Datum nicht übernommen');
  if (!txt.includes('2 Übungen · 5/5 Sätze')) throw new Error('Übungen/Sätze falsch: ' + txt.slice(0, 300));
});

await step('importierte Übung erscheint im Fortschritt', async () => {
  await page.locator('.tabbar a[href="#/uebungen"]').click();
  await page.waitForSelector('text=Triceps hoch');
  await page.getByRole('link', { name: /Triceps hoch/ }).click();
  const txt = await page.locator('#view').textContent();
  if (!txt.includes('20 kg')) throw new Error('Bestwert 20 kg fehlt: ' + txt.slice(0, 200));
});

await step('Neustart behält Daten (localStorage)', async () => {
  await page.goto(BASE + '#/');
  await page.reload();
  await page.waitForSelector('#view .card, #view .btn');
  const txt = await page.locator('#view').textContent();
  if (!txt.includes('Oberkörper A')) throw new Error('Daten nach Reload weg');
});

await step('Übung verschieben und löschen', async () => {
  const names = () => page.locator('.exercise input[list]');
  await page.goto(BASE + '#/neu'); await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Leeres Training starten' }).click();
  const add = page.locator('input[placeholder="Maschine hinzufügen …"]');
  for (const n of ['Rudern', 'Butterfly', 'Beinbeuger']) {
    await add.fill(n); await page.getByRole('button', { name: 'Hinzufügen' }).click();
  }
  await page.locator('.exercise').nth(2).getByRole('button', { name: 'Nach oben schieben' }).click();
  let order = await names().evaluateAll((els) => els.map((e) => e.value));
  if (order.join() !== 'Rudern,Beinbeuger,Butterfly') throw new Error('Reihenfolge: ' + order.join());
  page.once('dialog', (d) => d.accept());
  await page.locator('.exercise').nth(0).getByRole('button', { name: 'Übung entfernen' }).click();
  await page.waitForTimeout(150);
  order = await names().evaluateAll((els) => els.map((e) => e.value));
  if (order.join() !== 'Beinbeuger,Butterfly') throw new Error('nach Löschen: ' + order.join());
  const upDisabled = await page.locator('.exercise').nth(0).getByRole('button', { name: 'Nach oben schieben' }).isDisabled();
  if (!upDisabled) throw new Error('erste Übung darf nicht nach oben');
});

await browser.close();
server.close();
console.log(`\n--- ${errors.length} Fehler`);
errors.forEach((e) => console.log('  ', e));
process.exit(errors.length ? 1 : 0);
