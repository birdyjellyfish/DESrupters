import { copyFile, mkdir, readFile } from "node:fs/promises";

// MapLibre 6 workers are ES modules outside Next.js's bundle graph.
// Copy both modules from the installed package so their versions always match.
const root = new URL("../", import.meta.url);
const dist = new URL("node_modules/maplibre-gl/dist/", root);
const { version } = JSON.parse(await readFile(new URL("node_modules/maplibre-gl/package.json", root), "utf8"));
const output = new URL(`public/vendor/maplibre/${version}/`, root);
await mkdir(output, { recursive: true });
for (const name of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  await copyFile(new URL(name, dist), new URL(name, output));
}
console.log(`Prepared MapLibre ${version} worker modules.`);
