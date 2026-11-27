const O = "http://127.0.0.1:8082";
const check = (name, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) process.exit(1);
};
for (let i = 0; i < 30; i++) {
  try {
    await fetch(`${O}/app/api/health`);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}

check("health through /app/api", (await fetch(`${O}/app/api/health`)).ok);
check("the bare /api/ is closed", (await fetch(`${O}/api/health`)).status === 404);
check("API docs hidden", (await fetch(`${O}/app/api/docs`)).status === 404);
const login = await fetch(`${O}/app/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identifier: "manager", password: process.env.SEED_PASSWORD }),
});
check("login", login.ok);
const { token } = (await login.json()).data;
const auth = { Authorization: `Bearer ${token}` };
const list = (await (await fetch(`${O}/app/api/boards`, { headers: auth })).json()).data;
const board = (list.items ?? list).find((b) => b.name === "Alpha Board");
const page = await fetch(`${O}/app/b/${board.slug}`, { headers: { Cookie: `kanban_token=${token}` } });
check("server-rendered board", page.ok && (await page.text()).includes("Design new landing page"));
const expired = await fetch(`${O}/app/session-expired`, { redirect: "manual" });
check("session-expired redirect", expired.headers.get("location") === "/app/login");

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const form = new FormData();
form.append("file", new Blob([png], { type: "image/png" }), "a.png");
check("upload volume is writable", (await fetch(`${O}/app/api/users/me/avatar`, { method: "POST", headers: auth, body: form })).ok);
const big = await fetch(`${O}/app/api/users/me/avatar`, { method: "POST", headers: auth, body: Buffer.alloc(3.5 * 1024 * 1024) });
check("3 MB body limit", big.status === 413);

const landing = await fetch(`${O}/`);
const landingText = await landing.text();
check("the landing page is at /", landing.status === 200 && landingText.includes("RevoBoard") && landingText.includes("Get started"));
check("the landing page links into /app", landingText.includes('href="/app/register"'));
const loginPage = await fetch(`${O}/app/login`);
check("/app/login is the sign-in page", loginPage.status === 200 && loginPage.headers.get("x-robots-tag") === "noindex");
const legacy = await fetch(`${O}/boards`, { redirect: "manual" });
check("a V16 path answers 308 to /app", legacy.status === 308 && new URL(legacy.headers.get("location")).pathname === "/app/boards");
const unknown = await fetch(`${O}/app/xyz`);
check("an unknown /app path is the 404 page", unknown.status === 404 && (await unknown.text()).includes("Page not found"));
const oldSlug = await fetch(`${O}/app/b/no-such-board`, { headers: { Cookie: `kanban_token=${token}` } });
check("an unknown board slug is the 404 page", oldSlug.status === 404);
const guarded = await fetch(`${O}/app/boards`, { redirect: "manual" });
check("a guarded page without a cookie goes to sign in", guarded.status === 307 && new URL(guarded.headers.get("location")).pathname === "/app/login");
const robots = await (await fetch(`${O}/robots.txt`)).text();
check("robots.txt allows the landing page and names the sitemap", robots.includes("Allow: /") && robots.includes("Sitemap:") && !robots.includes("Disallow"));
const sitemap = await (await fetch(`${O}/sitemap.xml`)).text();
check("the sitemap lists / only", sitemap.includes("<loc>") && !sitemap.includes("/app"));
const attachment = (await (await fetch(`${O}/app/api/auth/me`, { headers: auth })).json());
check("API paths in payloads use the public prefix", !JSON.stringify(attachment).includes('"/api/'));
