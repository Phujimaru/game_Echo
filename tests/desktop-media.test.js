const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { MediaCache, buildManifest, serveFile } = require('../desktop/media');

// แคชไฟล์สื่อของโปรแกรม ECHO (desktop/media.js) — โหลดตาม manifest, ตรวจ hash, ไม่โหลดซ้ำ, ตอบ Range
const DIRS = ['characters', 'image'];
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'echo-media-'));
}

function writeFiles(root, files) {
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, ...rel.split('/').filter(Boolean));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
}

// R2 จำลอง: เสิร์ฟไฟล์จาก root ตาม path ที่ decode แล้ว + นับจำนวนคำขอ
async function fakeR2(root) {
  const hits = [];
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    hits.push(rel);
    const file = path.join(root, ...rel.split('/').filter(Boolean));
    if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Length': fs.statSync(file).size });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${server.address().port}`, hits, close: () => new Promise((r) => server.close(r)) };
}

const FILES = {
  '/characters/kim/สกิลรอง/Card Overthrow.webp': Buffer.from('kim-card'),
  '/characters/ort/ort_body.jpg': crypto.randomBytes(200_000),
  '/image/background.webp': Buffer.from('bg'),
};

test('buildManifest lists media dirs with size + sha256 and skips notes', async () => {
  const pub = tmpDir();
  writeFiles(pub, { ...FILES, '/characters/shiki/README.txt': 'notes', '/other/x.png': 'not media' });
  const manifest = await buildManifest(pub, DIRS);
  assert.deepEqual(Object.keys(manifest.files).sort(), Object.keys(FILES).sort());
  const ort = manifest.files['/characters/ort/ort_body.jpg'];
  assert.equal(ort.size, 200_000);
  assert.equal(ort.sha256, sha(FILES['/characters/ort/ort_body.jpg']));
});

test('sync downloads everything once, then only what changed, and drops removed files', { timeout: 15000 }, async () => {
  const remote = tmpDir();
  writeFiles(remote, FILES);
  const r2 = await fakeR2(remote);
  const cacheDir = tmpDir();
  const manifestFile = path.join(tmpDir(), 'manifest.json');
  try {
    fs.writeFileSync(manifestFile, JSON.stringify(await buildManifest(remote, DIRS)));
    const cache = new MediaCache({ cacheDir, remoteBase: r2.base, dirs: DIRS });
    const first = await cache.sync(manifestFile);
    assert.equal(first.doneFiles, 3);
    assert.equal(first.doneBytes, first.totalBytes);
    const kim = cache.localFile('/characters/kim/สกิลรอง/Card Overthrow.webp');
    assert.equal(fs.readFileSync(kim, 'utf8'), 'kim-card');

    // เปิดใหม่ (instance ใหม่อ่าน index เดิม) — ไม่ต้องโหลดอะไรเลย
    r2.hits.length = 0;
    const again = await new MediaCache({ cacheDir, remoteBase: r2.base, dirs: DIRS }).sync(manifestFile);
    assert.equal(again.totalFiles, 0);
    assert.deepEqual(r2.hits, []);

    // อัปเดต: เปลี่ยน 1 ไฟล์ + ลบ 1 ไฟล์
    writeFiles(remote, { '/image/background.webp': 'bg-v2' });
    fs.rmSync(path.join(remote, 'characters', 'ort', 'ort_body.jpg'));
    fs.writeFileSync(manifestFile, JSON.stringify(await buildManifest(remote, DIRS)));
    const cache3 = new MediaCache({ cacheDir, remoteBase: r2.base, dirs: DIRS });
    const update = await cache3.sync(manifestFile);
    assert.equal(update.totalFiles, 1);
    assert.equal(fs.readFileSync(cache3.localFile('/image/background.webp'), 'utf8'), 'bg-v2');
    assert.equal(cache3.localFile('/characters/ort/ort_body.jpg'), null);
    assert.equal(fs.existsSync(path.join(cacheDir, 'characters', 'ort', 'ort_body.jpg')), false);
  } finally {
    await r2.close();
  }
});

test('sync rejects a file whose content does not match the manifest', { timeout: 15000 }, async () => {
  const remote = tmpDir();
  writeFiles(remote, { '/image/background.webp': 'real' });
  const r2 = await fakeR2(remote);
  const cacheDir = tmpDir();
  const manifestFile = path.join(tmpDir(), 'manifest.json');
  try {
    fs.writeFileSync(manifestFile, JSON.stringify({ files: { '/image/background.webp': { size: 4, sha256: sha('fake') } } }));
    const cache = new MediaCache({ cacheDir, remoteBase: r2.base, dirs: DIRS });
    await assert.rejects(cache.sync(manifestFile), /เนื้อไฟล์ไม่ตรงกับ manifest/);
    assert.equal(cache.localFile('/image/background.webp'), null);
    assert.equal(fs.existsSync(path.join(cacheDir, 'image', 'background.webp')), false);
    assert.equal(fs.existsSync(path.join(cacheDir, 'image', 'background.webp.part')), false);
  } finally {
    await r2.close();
  }
});

test('sync fails with a Thai message when the manifest cannot be fetched', async () => {
  const cache = new MediaCache({ cacheDir: tmpDir(), remoteBase: 'http://127.0.0.1:9', dirs: DIRS });
  await assert.rejects(cache.sync('http://127.0.0.1:9/updates/media-manifest.json'), /ตรวจรายการไฟล์เกมไม่สำเร็จ/);
});

test('cache refuses paths that escape the cache folder', () => {
  const cache = new MediaCache({ cacheDir: tmpDir(), remoteBase: '', dirs: DIRS });
  assert.equal(cache.pathOf('/../../evil.txt'), null);
  assert.notEqual(cache.pathOf('/image/a.png'), null);
});

test('serveFile answers byte ranges so videos can seek', async () => {
  const file = path.join(tmpDir(), 'clip.mp4');
  fs.writeFileSync(file, Buffer.from('0123456789'));
  const full = await serveFile(file, 'GET', null);
  assert.equal(full.status, 200);
  assert.equal(full.headers.get('content-type'), 'video/mp4');
  assert.equal(full.headers.get('accept-ranges'), 'bytes');
  assert.equal(await full.text(), '0123456789');

  const mid = await serveFile(file, 'GET', 'bytes=2-5');
  assert.equal(mid.status, 206);
  assert.equal(mid.headers.get('content-range'), 'bytes 2-5/10');
  assert.equal(await mid.text(), '2345');

  const open = await serveFile(file, 'GET', 'bytes=7-');
  assert.equal(await open.text(), '789');
  const suffix = await serveFile(file, 'GET', 'bytes=-3');
  assert.equal(suffix.headers.get('content-range'), 'bytes 7-9/10');
  assert.equal((await serveFile(file, 'GET', 'bytes=20-30')).status, 416);
  assert.equal((await serveFile(file, 'HEAD', null)).body, null);
});
