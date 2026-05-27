import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, createReadStream } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';

const root = resolve('dist');
const dataFile = resolve('data/messages.json');
const port = Number(process.env.PORT ?? 4173);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

async function readJson() {
  if (!existsSync(dataFile)) return [];
  return JSON.parse(await readFile(dataFile, 'utf8'));
}

async function writeJson(rows) {
  await mkdir(dirname(dataFile), { recursive: true });
  await writeFile(dataFile, JSON.stringify(rows, null, 2), 'utf8');
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function publicLetter(message) {
  return {
    id: message.id,
    body: message.body,
    sig: message.sig || '— 소박이',
    createdAt: message.createdAt,
    target: message.target,
  };
}

async function handleApi(req, res, url) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (url.pathname === '/api/messages' && req.method === 'GET') {
    sendJson(res, 200, { messages: await readJson() });
    return;
  }

  if (url.pathname === '/api/messages' && req.method === 'POST') {
    const body = await readBody(req);
    const title = String(body.title ?? '').trim();
    const letterBody = String(body.body ?? '').trim();
    const target = body.target === 'user' ? 'user' : 'all';
    const targetUserId = target === 'user' ? String(body.targetUserId ?? '').trim() : undefined;

    if (!title || !letterBody) {
      sendJson(res, 400, { error: 'title and body are required' });
      return;
    }
    if (target === 'user' && !targetUserId) {
      sendJson(res, 400, { error: 'targetUserId is required for user target' });
      return;
    }

    const now = new Date().toISOString();
    const message = {
      id: `admin-letter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      body: letterBody,
      sig: String(body.sig ?? '— 소박이').trim() || '— 소박이',
      target,
      targetUserId,
      createdAt: now,
      updatedAt: now,
    };
    const rows = await readJson();
    await writeJson([message, ...rows]);
    sendJson(res, 201, { message });
    return;
  }

  if (url.pathname.startsWith('/api/messages/') && req.method === 'DELETE') {
    const id = decodeURIComponent(url.pathname.replace('/api/messages/', ''));
    const rows = await readJson();
    await writeJson(rows.filter((message) => message.id !== id));
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/letters' && req.method === 'GET') {
    const userId = url.searchParams.get('userId') ?? '';
    const rows = await readJson();
    const letters = rows
      .filter((message) => message.target === 'all' || (message.target === 'user' && message.targetUserId === userId))
      .map(publicLetter);
    sendJson(res, 200, { userId, letters });
    return;
  }

  sendJson(res, 404, { error: 'not found' });
}

function serveStatic(req, res, url) {
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = resolve(join(root, pathname));
  if (!file.startsWith(root) || !existsSync(file)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': contentTypes[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch((error) => sendJson(res, 500, { error: error.message }));
    return;
  }
  serveStatic(req, res, url);
}).listen(port, '0.0.0.0', () => {
  console.log(`Sobagi admin server running at http://127.0.0.1:${port}`);
});
