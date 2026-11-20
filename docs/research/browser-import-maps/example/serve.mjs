import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = new URL('.', import.meta.url);
export function serveExample() {
  return createServer(async (request,response) => {
    try {
      const path = new URL(request.url,'http://localhost').pathname;
      const document = ['/', '/nested/page/', '/broken/'].includes(path);
      const files = { '/main.js':'main.js', '/styles.css':'styles.css', '/lib/palette.js':'lib/palette.js' };
      if (!document && !files[path]) throw new Error('Not public');
      let body=await readFile(new URL(document ? 'index.html' : files[path],root),'utf8');
      if (path==='/broken/') body=body.replace('"/lib/palette.js"','"/lib/missing.js"');
      const headers={ 'Content-Type':document ? 'text/html' : path.endsWith('.css') ? 'text/css' : 'text/javascript' };
      if (document) {
        const map=body.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1];
        const hash=createHash('sha256').update(map).digest('base64');
        headers['Content-Security-Policy']=`default-src 'self'; script-src 'self' 'sha256-${hash}'; base-uri 'none'; object-src 'none'`;
      }
      response.writeHead(200,headers).end(body);
    } catch { response.writeHead(404).end('Not found'); }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server=serveExample();
  server.listen(0,'127.0.0.1',()=>console.log(`Palette tutorial: http://127.0.0.1:${server.address().port}`));
}
