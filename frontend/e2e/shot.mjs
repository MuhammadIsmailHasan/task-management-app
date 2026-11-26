// Usage: node e2e/shot.mjs <outDir> <width> <path> [--login user] [--click "text"] ...
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const [out, width, route, ...rest] = process.argv.slice(2);
const opt = (name) => { const i = rest.indexOf(name); return i === -1 ? null : rest[i + 1]; };
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const page = await browser.newPage({ viewport: { width: Number(width), height: 900 } });
const base = process.env.BASE ?? "http://localhost:3000";
const user = opt("--login");
if (user) {
  await page.goto(`${base}/app/login`);
  await page.fill("#identifier", `${user}@example.com`);
  await page.fill("#password", process.env.PW ?? "12345678");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/app\/(boards|dashboard)/, { timeout: 15000 });
}
await page.goto(`${base}${route}`);
await page.waitForLoadState("networkidle");
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === "--click") { await page.getByRole("button", { name: rest[i + 1] }).first().click(); await page.waitForTimeout(500); }
  if (rest[i] === "--clicklink") { await page.getByRole("link", { name: rest[i + 1] }).first().click(); await page.waitForTimeout(800); }
}
const name = `${route.replace(/[^a-z0-9]+/gi, "_")}_${width}${opt("--tag") ? "_" + opt("--tag") : ""}.png`;
await page.screenshot({ path: `${out}/${name}` });
console.log(`${out}/${name}`, page.url());
await browser.close();
