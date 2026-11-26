// Four-width check (V17-T07): every page at 360, 414, 960, and 1280 pixels has no sideways scroll and no console error.
// Usage: node e2e/widths.mjs [outDir]   (the Backend on :5001 and the Frontend on :3000 must be running, seeded with `flask seed-data`)
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const out = process.argv[2];
const base = process.env.BASE ?? "http://localhost:3000";
const password = process.env.PW ?? "12345678";
const WIDTHS = [360, 414, 960, 1280];
const PAGES = {
  public: ["/", "/app/login", "/app/register", "/app/verify", "/app/does-not-exist"],
  manager: ["/app/boards", "/app/dashboard", "/app/my-tasks", "/app/profile", "/app/profile?tab=security", "/app/profile?tab=notifications", "/app/b/alpha-board", "/app/b/alpha-board/list", "/app/b/alpha-board/calendar", "/app/b/alpha-board/archived"],
  admin: ["/app/users"],
  member: ["/app/boards", "/app/my-tasks"],
};
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
if (out) mkdirSync(out, { recursive: true });
let failures = 0;

async function run(user, paths) {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    if (user) {
      await page.goto(`${base}/app/login`);
      await page.fill("#identifier", `${user}@example.com`);
      await page.fill("#password", password);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/app\/(boards|dashboard)/, { timeout: 15000 });
    }
    for (const path of paths) {
      await page.goto(`${base}${path}`);
      await page.waitForLoadState("networkidle");
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const ok = over <= 0 && errors.length === 0;
      if (!ok) failures++;
      console.log(`${ok ? "PASS" : "FAIL"} ${user ?? "public"} ${width} ${path}${over > 0 ? ` (sideways scroll ${over}px)` : ""}${errors.length ? ` ${errors[0]}` : ""}`);
      if (out) await page.screenshot({ path: `${out}/${user ?? "public"}_${width}_${path.replace(/[^a-z0-9]+/gi, "_")}.png` });
      errors.length = 0;
    }
    await ctx.close();
  }
}
for (const [user, paths] of Object.entries(PAGES)) await run(user === "public" ? null : user, paths);
await browser.close();
console.log(failures ? `${failures} failing` : "all pass");
process.exit(failures ? 1 : 0);
