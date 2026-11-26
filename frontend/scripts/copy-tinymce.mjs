// Self-hosts TinyMCE: copies the package into public/tinymce so the editor loads from our own origin, with no cloud
// API key (round 6 within V18). Runs before `dev` and `build`; public/tinymce is not committed.
import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const from = path.join(root, "node_modules", "tinymce");
const to = path.join(root, "public", "tinymce");
if (!existsSync(from)) throw new Error("tinymce is not installed: run npm install");
rmSync(to, { recursive: true, force: true });
cpSync(from, to, { recursive: true, filter: (src) => !/\.(md|json|txt)$/.test(src) || src.endsWith("package.json") });
console.log("tinymce copied to public/tinymce");
