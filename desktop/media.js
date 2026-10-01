// แคชไฟล์สื่อ (รูป/วิดีโอ/เพลง ~1.2GB) ในเครื่องผู้เล่น
//  - manifest บน R2 (updates/media-manifest.json) บอกทุกไฟล์ + ขนาด + sha256 — สร้างด้วย scripts/build-media-manifest.js
//  - sync(): โหลดเฉพาะไฟล์ที่ยังไม่มี/เปลี่ยน, ตรวจ sha256 ทุกไฟล์, ลบไฟล์ที่ถูกถอดออก
//    โหลดค้างกลางทาง (ปิดโปรแกรม/เน็ตหลุด) → เปิดใหม่โหลดต่อจากไฟล์ที่ยังไม่เสร็จ
//  - createHttpHandler(): ดักคำขอ http ของหน้าเกม — ไฟล์สื่อตอบจากแคช "ที่ origin เดิม" ของหน้าเกม
//    (ไม่ redirect ข้าม origin: โหมด ORT อ่านพิกเซลรูปผ่าน canvas getImageData ซึ่งพังถ้ารูปมาจาก origin อื่น)
//    รองรับ Range (กรอวิดีโอ/เพลง) · คำขออื่นทั้งหมด (หน้าเกม, socket.io) ส่งต่อตามปกติ
const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { Readable, Transform } = require("stream");
const { pipeline } = require("stream/promises");

const SKIP_FILES = /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini)$|\.(txt|md)$/i;
const MIME = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
  ".svg": "image/svg+xml", ".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg", ".m4a": "audio/mp4",
  ".wav": "audio/wav", ".ogg": "audio/ogg", ".json": "application/json",
};
const PARALLEL = 4;
const RETRIES = 5;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// รอก่อนลองซ้ำ — r2.dev จำกัดความถี่ (ตอบ 429) ถ้ามี Retry-After ใช้ค่านั้น ไม่งั้นรอนานขึ้นเรื่อย ๆ
function retryDelay(attempt, res) {
  const after = Number(res && res.headers.get("retry-after"));
  if (after > 0) return Math.min(after, 30) * 1000;
  return Math.min(1000 * 2 ** (attempt - 1), 15000);
}

// "/characters/kim/สกิลรอง/Card Overthrow.webp" -> ส่วนของ URL ที่ encode แล้ว
const encodePath = (rel) => rel.split("/").map(encodeURIComponent).join("/");

// ---------- manifest ----------
async function sha256File(file) {
  const hash = crypto.createHash("sha256");
  await pipeline(fs.createReadStream(file), hash);
  return hash.digest("hex");
}

async function buildManifest(publicDir, dirs) {
  const files = {};
  async function walk(dir) {
    for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { await walk(full); continue; }
      const rel = "/" + path.relative(publicDir, full).split(path.sep).join("/");
      if (SKIP_FILES.test(rel)) continue;
      files[rel] = { size: (await fsp.stat(full)).size, sha256: await sha256File(full) };
    }
  }
  for (const d of dirs) {
    if (fs.existsSync(path.join(publicDir, d))) await walk(path.join(publicDir, d));
  }
  const sorted = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
  return { generatedAt: new Date().toISOString(), files: sorted };
}

// ---------- แคช ----------
class MediaCache {
  constructor({ cacheDir, remoteBase, dirs }) {
    this.cacheDir = cacheDir;
    this.remoteBase = remoteBase;
    this.dirs = dirs;
    this.indexFile = path.join(cacheDir, "index.json");
    this.index = { files: {} };
    try {
      this.index = JSON.parse(fs.readFileSync(this.indexFile, "utf8"));
    } catch {}
  }

  // path ในแคชของไฟล์สื่อ — null ถ้า path แปลก (กัน ../ หลุดออกนอกโฟลเดอร์แคช)
  pathOf(rel) {
    const full = path.resolve(this.cacheDir, "." + rel);
    return full.startsWith(path.resolve(this.cacheDir) + path.sep) ? full : null;
  }

  // ไฟล์ที่โหลดครบแล้ว (อยู่ใน index) — null ถ้ายังไม่มี
  localFile(rel) {
    return this.index.files[rel] ? this.pathOf(rel) : null;
  }

  async saveIndex() {
    await fsp.mkdir(this.cacheDir, { recursive: true });
    const tmp = this.indexFile + ".tmp";
    await fsp.writeFile(tmp, JSON.stringify(this.index));
    await fsp.rename(tmp, this.indexFile);
  }

  async loadManifest(source) {
    let text;
    try {
      if (/^https?:\/\//.test(source)) {
        const res = await fetch(source, { signal: AbortSignal.timeout(15000), cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        text = await res.text();
      } else {
        text = await fsp.readFile(source, "utf8");
      }
      const manifest = JSON.parse(text);
      if (!manifest || typeof manifest.files !== "object") throw new Error("รูปแบบ manifest ไม่ถูกต้อง");
      return manifest;
    } catch (err) {
      throw new Error(`ตรวจรายการไฟล์เกมไม่สำเร็จ — เช็คอินเทอร์เน็ตแล้วลองใหม่ (${err.message})`);
    }
  }

  // ไฟล์ในแคชตรงกับ manifest ไหม — เชื่อ index + เช็คขนาดไฟล์จริง (ไม่ hash ซ้ำทุกครั้งที่เปิด)
  async isCurrent(rel, entry) {
    const have = this.index.files[rel];
    if (!have || have.sha256 !== entry.sha256) return false;
    try {
      return (await fsp.stat(this.pathOf(rel))).size === entry.size;
    } catch {
      return false;
    }
  }

  async removeStale(manifest) {
    for (const rel of Object.keys(this.index.files)) {
      if (manifest.files[rel]) continue;
      delete this.index.files[rel];
      const file = this.pathOf(rel);
      if (file) await fsp.rm(file, { force: true });
    }
  }

  async removePartials(dir = this.cacheDir) {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await this.removePartials(full);
      else if (e.name.endsWith(".part")) await fsp.rm(full, { force: true });
    }
  }

  async checkDiskSpace(bytesNeeded) {
    if (!fsp.statfs) return;
    const { bavail, bsize } = await fsp.statfs(this.cacheDir);
    const free = bavail * bsize;
    const margin = 200 * 1024 * 1024;
    if (free < bytesNeeded + margin) {
      const gb = (n) => (n / 1024 ** 3).toFixed(1);
      throw new Error(`พื้นที่ดิสก์ไม่พอ — ต้องใช้อีก ${gb(bytesNeeded)} GB แต่เหลือ ${gb(free)} GB`);
    }
  }

  async downloadOne(rel, entry, onBytes) {
    const dest = this.pathOf(rel);
    if (!dest) throw new Error(`path ไม่ถูกต้อง: ${rel}`);
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    const part = dest + ".part";
    let lastError;
    for (let attempt = 1; attempt <= RETRIES; attempt++) {
      let received = 0;
      let res = null;
      try {
        res = await fetch(this.remoteBase + encodePath(rel), { signal: AbortSignal.timeout(120000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const hash = crypto.createHash("sha256");
        const meter = new Transform({
          transform(chunk, _enc, done) {
            hash.update(chunk);
            received += chunk.length;
            onBytes(chunk.length);
            done(null, chunk);
          },
        });
        await pipeline(Readable.fromWeb(res.body), meter, fs.createWriteStream(part));
        if (received !== entry.size) throw new Error(`ขนาดไม่ตรง (${received}/${entry.size})`);
        if (hash.digest("hex") !== entry.sha256) throw new Error("เนื้อไฟล์ไม่ตรงกับ manifest");
        await fsp.rename(part, dest);
        this.index.files[rel] = { size: entry.size, sha256: entry.sha256 };
        return;
      } catch (err) {
        onBytes(-received); // นับใหม่ตอนลองซ้ำ
        await fsp.rm(part, { force: true });
        lastError = err;
        if (res && res.status === 404) break; // ไม่มีไฟล์บน R2 — ลองซ้ำไปก็ไม่มี
        // รอเฉพาะตอน R2 ตอบ error / เน็ตหลุด — ไฟล์เสียระหว่างทาง (hash ไม่ตรง) ลองใหม่ทันที
        if (attempt < RETRIES && !(res && res.ok)) await sleep(retryDelay(attempt, res));
      }
    }
    throw new Error(`โหลดไฟล์ไม่สำเร็จ: ${rel} (${lastError.message})`);
  }

  // โหลดให้แคชตรงกับ manifest — onProgress({ doneBytes, totalBytes, doneFiles, totalFiles })
  async sync(manifestSource, onProgress = () => {}) {
    const manifest = await this.loadManifest(manifestSource);
    await fsp.mkdir(this.cacheDir, { recursive: true });
    await this.removePartials();
    await this.removeStale(manifest);

    const todo = [];
    for (const [rel, entry] of Object.entries(manifest.files)) {
      if (!this.dirs.includes(rel.split("/")[1])) continue;
      if (!(await this.isCurrent(rel, entry))) todo.push([rel, entry]);
    }
    const progress = { doneBytes: 0, totalBytes: todo.reduce((n, [, e]) => n + e.size, 0), doneFiles: 0, totalFiles: todo.length };
    onProgress({ ...progress });
    if (!todo.length) {
      await this.saveIndex();
      return progress;
    }
    await this.checkDiskSpace(progress.totalBytes);

    let lastReport = 0;
    const report = (force) => {
      const now = Date.now();
      if (force || now - lastReport > 200) {
        lastReport = now;
        onProgress({ ...progress });
      }
    };
    let lastSave = Date.now();
    let failure = null;
    const queue = todo.slice();
    const worker = async () => {
      while (queue.length && !failure) {
        const [rel, entry] = queue.shift();
        try {
          await this.downloadOne(rel, entry, (n) => {
            progress.doneBytes += n;
            report(false);
          });
        } catch (err) {
          failure = failure || err;
          return;
        }
        progress.doneFiles++;
        report(false);
        if (Date.now() - lastSave > 2000) {
          lastSave = Date.now();
          await this.saveIndex();
        }
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    await this.saveIndex();
    report(true);
    if (failure) throw failure;
    return progress;
  }
}

// ---------- ตอบไฟล์สื่อให้หน้าเกม ----------
// source = ที่มาของไฟล์ ใส่ไว้ใน header X-Echo-Media (cache / local) ให้ตรวจได้ว่าไม่ได้โหลดจากเน็ต
async function serveFile(file, method, rangeHeader, source = "cache") {
  const { size } = await fsp.stat(file);
  const headers = {
    "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
    "Accept-Ranges": "bytes",
    "X-Echo-Media": source,
  };
  const body = (start, end) => (method === "HEAD" ? null : Readable.toWeb(fs.createReadStream(file, { start, end })));
  const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader || "");
  if (m && (m[1] || m[2])) {
    let start;
    let end;
    if (m[1] === "") {
      start = Math.max(0, size - Number(m[2]));
      end = size - 1;
    } else {
      start = Number(m[1]);
      end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
    }
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    return new Response(body(start, end), {
      status: 206,
      headers: { ...headers, "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${size}` },
    });
  }
  return new Response(body(0, Math.max(0, size - 1)), { status: 200, headers: { ...headers, "Content-Length": String(size) } });
}

// handler สำหรับ protocol.handle("http") — passThrough(request) = ส่งต่อคำขอตามปกติ
//  ลำดับหาไฟล์สื่อ: แคช → devPublicDir (ตอน dev ใช้ client/public ตรงๆ) → R2
function createHttpHandler({ cache, dirs, remoteBase, devPublicDir, passThrough, fetchRemote }) {
  return async (request) => {
    const url = new URL(request.url);
    let rel;
    try {
      rel = decodeURIComponent(url.pathname);
    } catch {
      return passThrough(request);
    }
    if (!dirs.includes(rel.split("/")[1]) || (request.method !== "GET" && request.method !== "HEAD")) {
      return passThrough(request);
    }
    const range = request.headers.get("range");
    let file = cache.localFile(rel);
    let source = "cache";
    if (!file && devPublicDir) {
      const candidate = path.resolve(devPublicDir, "." + rel);
      if (candidate.startsWith(path.resolve(devPublicDir) + path.sep) && fs.existsSync(candidate)) {
        file = candidate;
        source = "local";
      }
    }
    if (file) {
      try {
        return await serveFile(file, request.method, range, source);
      } catch {}
    }
    // ไม่มีในเครื่อง — ดึงจาก R2 ตรงๆ (เช่นไฟล์ใหม่ที่ manifest ยังไม่มี)
    return fetchRemote(remoteBase + url.pathname, { method: request.method, headers: range ? { range } : {} });
  };
}

module.exports = { MediaCache, buildManifest, createHttpHandler, serveFile, encodePath, SKIP_FILES };
