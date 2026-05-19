// scripts/vercel-build.mjs
// Post-build script: transforms dist/ into .vercel/output/ (Build Output API v3)
import { cpSync, mkdirSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const out = join(root, '.vercel/output');

console.log('Creating Vercel Build Output API structure...');

mkdirSync(`${out}/static/assets`, { recursive: true });
mkdirSync(`${out}/functions/index.func`, { recursive: true });

// Copy static client files
const clientDir = `${root}/dist/client`;
if (existsSync(clientDir)) {
  for (const entry of readdirSync(clientDir)) {
    const src = `${clientDir}/${entry}`;
    const dest = entry === 'assets' ? `${out}/static/assets` : `${out}/static/${entry}`;
    if (statSync(src).isDirectory()) { cpSync(src, dest, { recursive: true }); }
    else { cpSync(src, dest); }
  }
  console.log('\u2713 Copied client files');
}

// Bundle server into single self-contained file using esbuild
const serverEntry = `${root}/dist/server/server.js`;
if (existsSync(serverEntry)) {
  const esbuildBin = `${root}/node_modules/.bin/esbuild`;
  const bundleOut = `${out}/functions/index.func/server-bundle.js`;
  execSync(
    `"${esbuildBin}" "${serverEntry}" --bundle --platform=node --format=esm --outfile="${bundleOut}"`,
    { stdio: 'inherit', cwd: root }
  );
  console.log('\u2713 Bundled server with esbuild');
}

// Mark function directory as ESM
writeFileSync(`${out}/functions/index.func/package.json`, JSON.stringify({ type: 'module' }));
console.log('\u2713 Created package.json (ESM)');

// Create Vercel Node.js handler wrapper
const handlerCode = `import server from './server-bundle.js';

export default async function handler(req, res) {
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const url = \`\${proto}://\${host}\${req.url}\`;
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = chunks.length ? Buffer.concat(chunks) : null;
    const webReq = new Request(url, {
      method: req.method,
      headers: req.headers,
      ...(body ? { body, duplex: 'half' } : {}),
    });
    const resp = await server.fetch(webReq, {}, {
      waitUntil: () => {},
      passThroughOnException: () => {},
    });
    res.status(resp.status);
    const setCookies =
      typeof resp.headers.getSetCookie === 'function'
        ? resp.headers.getSetCookie()
        : [resp.headers.get('set-cookie')].filter(Boolean);
    for (const [k, v] of resp.headers.entries()) {
      const lower = k.toLowerCase();
      if (lower === 'set-cookie' || lower === 'content-encoding') continue;
      res.setHeader(k, v);
    }
    if (setCookies.length) res.setHeader('set-cookie', setCookies);
    const buf = await resp.arrayBuffer();
    res.end(Buffer.from(buf));
  } catch (err) {
    console.error('SSR error:', err);
    res.status(500).end('Internal Server Error');
  }
}
`;

writeFileSync(`${out}/functions/index.func/index.js`, handlerCode);
console.log('\u2713 Created handler wrapper');

writeFileSync(`${out}/functions/index.func/.vc-config.json`, JSON.stringify({
  runtime: 'nodejs22.x',
  handler: 'index.js',
  maxDuration: 30,
}));
console.log('\u2713 Created .vc-config.json');

writeFileSync(`${out}/config.json`, JSON.stringify({
  version: 3,
  routes: [
    { src: '^/assets/(.+)$', dest: '/assets/$1' },
    { handle: 'filesystem' },
    { src: '^/(.*)', dest: '/index' },
  ],
}));
console.log('\u2713 Created config.json');
console.log('\u2705 Vercel output ready at .vercel/output/');
