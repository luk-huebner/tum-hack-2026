// Builds deploy/judge: a clean folder for the public judge site (see HOSTING.md). Nothing from .env is ever copied: the folder
// holds one bundled handler, the compiled validator, public test vectors, the standing bench refs and the web page.
//   node scripts/bundle-judge-site.mjs
import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cardano = join(here, "..");
const repo = join(cardano, "..");
const out = join(repo, "deploy", "judge");

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "api"), { recursive: true });

// 1. One CommonJS file with every dependency inside. import.meta.url (used to find the vectors and the blueprint) points at the
//    bundle's own location, so the files below sit next to it in the same relative places as in the repository.
await build({
  entryPoints: [join(cardano, "src", "judge-site.ts")],
  outfile: join(out, "cardano", "src", "judge-handler.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  logLevel: "warning",
  define: { "import.meta.url": "__importMetaUrl" },
  banner: { js: "const __importMetaUrl = require('node:url').pathToFileURL(__filename).href;" },
});

// 2. The data the handler reads at run time
const copy = (from, to) => cpSync(from, join(out, to), { recursive: true });
copy(join(repo, "aiken", "blueprint", "plutus.json"), join("aiken", "blueprint", "plutus.json"));
copy(join(cardano, "vectors"), join("cardano", "vectors"));
copy(join(cardano, "standing-policies.json"), join("cardano", "standing-policies.json"));

// 3. The page, served by the host from public/
copy(join(cardano, "web"), "public");

// 4. The function, its routing and its package file
writeFileSync(join(out, "api", "index.js"), 'const handler = require("../cardano/src/judge-handler.cjs");\nmodule.exports = handler.default || handler;\n');
writeFileSync(
  join(out, "vercel.json"),
  JSON.stringify(
    {
      functions: { "api/index.js": { maxDuration: 30, includeFiles: "{cardano,aiken}/**" } },
      rewrites: [
        { source: "/api/(.*)", destination: "/api" },
        { source: "/health", destination: "/api" },
      ],
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(join(out, "package.json"), JSON.stringify({ name: "pay-on-proof-judge", private: true, version: "1.0.0", engines: { node: "22.x" } }, null, 2) + "\n");

// 5. A last check that no secret file came along
for (const bad of [".env", "cardano/.env", ".env.local"]) {
  if (existsSync(join(out, bad))) throw new Error(`${bad} must not be in the bundle`);
}
console.log(`bundle ready: ${out}`);
