import { chromium } from 'playwright-core';
const out = process.argv[2];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
// Radar
await p.goto('http://localhost:3000/radar', { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
await p.screenshot({ path: out + '/radar.png' });
// Dashboard
await p.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' });
await p.waitForTimeout(2000);
await p.screenshot({ path: out + '/dashboard.png' });
// Click-through: heatmap tile -> radar?q= ; test the focus banner directly
await p.goto('http://localhost:3000/radar?q=NVDA', { waitUntil: 'networkidle' });
await p.waitForTimeout(2000);
await p.screenshot({ path: out + '/radar-focus.png' });
await b.close();
console.log('OK');
