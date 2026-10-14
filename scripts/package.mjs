import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { zipSync, unzipSync } from "fflate";
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const entries = {};
async function collect(folder, prefix = "") {
  for (const entry of (await readdir(folder, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    const name = prefix + entry.name;
    if (entry.isDirectory())
      await collect(path.join(folder, entry.name), name + "/");
    else if (entry.isFile()) {
      if (/\.env|credentials|profile|secret/i.test(name))
        throw new Error("Unexpected sensitive file in package.");
      entries[name] = [
        new Uint8Array(await readFile(path.join(folder, entry.name))),
        { mtime: new Date("2026-01-01T00:00:00Z") },
      ];
    } else throw new Error("Package contains an unsupported filesystem entry.");
  }
}
await collect("dist");
const manifest = JSON.parse(
  new TextDecoder().decode(entries["manifest.json"][0]),
);
if (manifest.version !== version)
  throw new Error("Package and extension versions differ.");
const bytes = zipSync(entries, { level: 6 });
const unpacked = unzipSync(bytes);
for (const name of Object.keys(entries))
  if (
    createHash("sha256").update(entries[name][0]).digest("hex") !==
    createHash("sha256").update(unpacked[name]).digest("hex")
  )
    throw new Error("Package verification failed: " + name);
const file = `ytmind-${version}-unpacked.zip`;
await mkdir("artifacts/releases", { recursive: true });
await writeFile(`artifacts/releases/${file}`, bytes);
const checksum = createHash("sha256").update(bytes).digest("hex");
await writeFile(`artifacts/releases/${file}.sha256`, `${checksum}  ${file}\n`);
console.log(
  JSON.stringify({
    file,
    bytes: bytes.length,
    files: Object.keys(entries).length,
    sha256: checksum,
  }),
);
