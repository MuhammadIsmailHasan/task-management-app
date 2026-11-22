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
