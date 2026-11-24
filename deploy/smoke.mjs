const O = "http://127.0.0.1:8082";
const check = (name, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) process.exit(1);
};
for (let i = 0; i < 30; i++) {
  try {
    await fetch(`${O}/api/health`);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}

check("health", (await fetch(`${O}/api/health`)).ok);
check("API docs hidden", (await fetch(`${O}/api/docs`)).status === 404);
const login = await fetch(`${O}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identifier: "manager", password: process.env.SEED_PASSWORD }),
});
check("login", login.ok);
const { token } = (await login.json()).data;
const auth = { Authorization: `Bearer ${token}` };
const list = (await (await fetch(`${O}/api/boards`, { headers: auth })).json()).data;
const board = (list.items ?? list).find((b) => b.name === "Alpha Board");
const page = await fetch(`${O}/boards/${board.id}`, { headers: { Cookie: `kanban_token=${token}` } });
check("server-rendered board", page.ok && (await page.text()).includes("Design new landing page"));
const expired = await fetch(`${O}/session-expired`, { redirect: "manual" });
check("session-expired redirect", expired.headers.get("location") === "/login");

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const form = new FormData();
form.append("file", new Blob([png], { type: "image/png" }), "a.png");
check("upload volume is writable", (await fetch(`${O}/api/users/me/avatar`, { method: "POST", headers: auth, body: form })).ok);
const big = await fetch(`${O}/api/users/me/avatar`, { method: "POST", headers: auth, body: Buffer.alloc(3.5 * 1024 * 1024) });
check("3 MB body limit", big.status === 413);

// Two hosts (Requirement 42, HOST-13): the same Nginx port, told apart only by the Host header.
import http from "node:http";
const SITE = "revoboard.belajardeploy.web.id:8082";
const APP = "app.revoboard.belajardeploy.web.id:8082";
const hit = (host, path) =>
  new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port: 8082, path, headers: { Host: host } }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
      })
      .on("error", reject);
  });
const landing = await hit(SITE, "/");
check("site host serves the landing page", landing.status === 200 && landing.body.includes("RevoBoard") && landing.body.includes("Get started"));
const siteLogin = await hit(SITE, "/login");
check("site host sends /login to the app host", siteLogin.status === 308 && siteLogin.headers.location === `http://app.revoboard.belajardeploy.web.id:8082/login`);
check("site host has no API", (await hit(SITE, "/api/health")).status === 404);
check("site host hides /site", (await hit(SITE, "/site")).status === 404);
const appHome = await hit(APP, "/");
check("app host redirects / to /boards", [307, 308].includes(appHome.status) && String(appHome.headers.location).endsWith("/boards"));
check("app host hides /site", (await hit(APP, "/site")).status === 404);
const robots = await hit(APP, "/robots.txt");
check("app host disallows all crawlers", robots.status === 200 && robots.body.includes("Disallow: /"));
check("app host API is healthy", (await hit(APP, "/api/health")).status === 200);
check("the server IP behaves as the app host", (await hit("127.0.0.1:8082", "/site")).status === 404);
