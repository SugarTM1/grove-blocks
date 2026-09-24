import { mkdir, cp, rm, readdir, stat } from "node:fs/promises";
import path from "node:path";
const root = process.cwd(),
  dest = path.join(root, "dist");
if (path.dirname(dest) !== root || path.basename(dest) !== "dist")
  throw new Error("Invalid output path");
await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
for (const file of ["index.html", "src", "public"])
  await cp(path.join(root, file), path.join(dest, file), { recursive: true });
let bytes = 0,
  files = 0;
async function count(dir) {
  for (const f of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) await count(p);
    else {
      bytes += (await stat(p)).size;
      files++;
    }
  }
}
await count(dest);
console.log(`Built ${files} files, ${(bytes / 1024).toFixed(1)} KB → dist/`);
