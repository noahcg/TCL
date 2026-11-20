import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const mime = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json' };
export function serveLab({ directory = root, strict = false } = {}) {
  return createServer(async (request,response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
      const relative = pathname === '/' || pathname === '/nested/page/' ? 'index.html' : pathname.slice(1);
      if (!['index.html','main.js','styles.css','importmap.js'].includes(relative) && !relative.startsWith('client_modules/')) throw new Error('Not public');
      const file = resolve(directory,relative);
      if (!file.startsWith(resolve(directory)+sep)) throw new Error('Invalid path');
      const headers = { 'Content-Type':mime[extname(file)] || 'application/octet-stream' };
      if (strict) headers['Content-Security-Policy'] = "default-src 'self'; base-uri 'none'; object-src 'none'";
      const data = await readFile(file);
      response.writeHead(200,headers).end(data);
    } catch { response.writeHead(404).end('Not found'); }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server=serveLab();
  server.listen(0,'127.0.0.1',() => console.log(`Color desk: http://127.0.0.1:${server.address().port}`));
}
