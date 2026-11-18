import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

const root = resolve('dist');
const headers = {
  'content-security-policy': "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; img-src 'self' https:; form-action 'self'",
  'x-content-type-options': 'nosniff',
};
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain', '.xml': 'application/xml' };

const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  let url;
  try {
    url = new URL(request.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.includes('\\') || pathname.includes('\0')) throw new Error('Invalid path');
    const path = resolve(root, '.' + pathname);
    if (path !== root && !path.startsWith(root + sep)) throw new Error('Invalid path');
    const filename = extname(pathname) ? path : join(path, 'index.html');
    const data = await readFile(filename);
    if (!extname(pathname) && !pathname.endsWith('/')) {
      response.writeHead(308, { Location: url.pathname + '/' + url.search }).end();
      return;
    }
    response.writeHead(200, { ...headers, 'content-type': mime[extname(filename)] ?? 'application/octet-stream' });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch {
    const fallback = await readFile(join(root, '404.html')).catch(() => Buffer.from('Page not found.'));
    response.writeHead(404, { ...headers, 'content-type': mime['.html'] });
    response.end(request.method === 'HEAD' ? undefined : fallback);
  }
});

server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => {
  console.log(`Local site at http://127.0.0.1:${server.address().port}/`);
});
