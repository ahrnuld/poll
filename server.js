// Tiny live poll for the lecture. Zero dependencies: node server.js
//   GET  /         voting page (phones)
//   GET  /stream   live results (Server-Sent Events), used by the slide
//   POST /vote     {voter, q, v}  v = "agree" | "disagree"
//   POST /reset    header x-admin-key: $ADMIN_KEY
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const DATA = process.env.DATA_FILE || path.join(__dirname, 'data', 'votes.json');
const QUESTIONS = [
  'In the past month, an AI agent wrote most of the code I committed.',
  'I understand every line of code my agent writes for our app.',
  'Our app would clearly be better with an AI feature built in.'
];

let votes = {}; // voter -> { [q]: 'agree' | 'disagree' }
try { votes = JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch {}
let saveT = null;
const save = () => {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    fs.mkdirSync(path.dirname(DATA), { recursive: true });
    fs.writeFile(DATA, JSON.stringify(votes), () => {});
  }, 500);
};

const tally = () => ({
  voters: Object.keys(votes).length,
  results: QUESTIONS.map((text, q) => {
    let agree = 0, disagree = 0;
    for (const v of Object.values(votes)) { if (v[q] === 'agree') agree++; else if (v[q] === 'disagree') disagree++; }
    return { text, agree, disagree };
  })
});

const clients = new Set();
let pushT = null;
const push = () => {
  // coalesce bursts of votes into one update
  if (pushT) return;
  pushT = setTimeout(() => {
    pushT = null;
    const msg = `data: ${JSON.stringify(tally())}\n\n`;
    clients.forEach(res => res.write(msg));
  }, 150);
};

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, x-admin-key' };
const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { ...CORS, 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};
const readBody = req => new Promise(ok => {
  let b = '';
  req.on('data', c => { b += c; if (b.length > 2000) req.destroy(); });
  req.on('end', () => { try { ok(JSON.parse(b)); } catch { ok({}); } });
});

const PAGE = fs.readFileSync(path.join(__dirname, 'vote.html'), 'utf8')
  .replace('/*QUESTIONS*/[]', JSON.stringify(QUESTIONS));

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') return send(res, 204, '');

  if (req.method === 'GET' && url.pathname === '/') return send(res, 200, PAGE, 'text/html; charset=utf-8');
  if (req.method === 'GET' && url.pathname === '/results') return send(res, 200, tally());

  if (req.method === 'GET' && url.pathname === '/stream') {
    res.writeHead(200, { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`retry: 2000\ndata: ${JSON.stringify(tally())}\n\n`);
    clients.add(res);
    const ka = setInterval(() => res.write(': ka\n\n'), 20000); // keep proxies from closing the stream
    req.on('close', () => { clearInterval(ka); clients.delete(res); });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/vote') {
    const { voter, q, v } = await readBody(req);
    if (typeof voter !== 'string' || !/^[\w-]{8,64}$/.test(voter) || !QUESTIONS[q] || !['agree', 'disagree', null].includes(v)) return send(res, 400, { error: 'bad vote' });
    if (!votes[voter] && Object.keys(votes).length > 5000) return send(res, 429, { error: 'full' });
    votes[voter] = votes[voter] || {};
    if (v === null) delete votes[voter][q]; else votes[voter][q] = v;
    save(); push();
    return send(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/reset') {
    if (!ADMIN_KEY || req.headers['x-admin-key'] !== ADMIN_KEY) return send(res, 403, { error: 'forbidden' });
    votes = {};
    save(); push();
    return send(res, 200, { ok: true });
  }

  send(res, 404, { error: 'not found' });
}).listen(PORT, () => console.log(`poll on :${PORT}`));
