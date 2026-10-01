// ปล่อยเวอร์ชันใหม่ของโปรแกรม ECHO ขึ้น Cloudflare R2
//  ก่อนรัน: แก้ "version" ใน desktop/package.json (ทุกเครื่องต้องเลขตรงกันถึงเข้าห้องกันได้)
//           ใส่กุญแจ R2 ใน .env ที่ราก repo (ดู .env.example) — ห้าม commit / ห้ามส่งในแชต
//
//  npm run release                 build exe แล้วอัปทุกอย่าง
//  npm run release -- --dry-run    ดูอย่างเดียวว่าจะอัป/ลบอะไร (ไม่ต้องมีกุญแจ ยกเว้น --prune)
//  npm run release -- --skip-build ใช้ exe ใน desktop/dist ที่ build ไว้แล้ว
//  npm run release -- --prune      ลบไฟล์สื่อบน R2 ที่ไม่อยู่ใน manifest แล้ว (ตัวละครที่ถูกถอด ฯลฯ)
//  npm run release -- --prune-only ลบไฟล์สื่อเก่าอย่างเดียว ไม่ build/ไม่อัปอะไร (ใช้ได้กับเวอร์ชันที่ปล่อยไปแล้ว)
//
//  ลำดับอัป (สำคัญ): ไฟล์สื่อ → media-manifest.json → exe + blockmap → latest.yml เป็นอย่างสุดท้าย
//  เครื่องผู้เล่นเห็นเวอร์ชันใหม่ก็ต่อเมื่อไฟล์ทุกอย่างพร้อมแล้ว
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { buildManifest, encodePath } = require("../media");
const { R2_PUBLIC_URL } = require("../config");
const MEDIA_DIRS = require("../../server/mediaDirs");

const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry-run");
const SKIP_BUILD = args.has("--skip-build");
const PRUNE_ONLY = args.has("--prune-only");
const PRUNE = args.has("--prune") || PRUNE_ONLY;

const desktop = path.resolve(__dirname, "..");
const repo = path.resolve(desktop, "..");
const dist = path.join(desktop, "dist");
const publicDir = path.join(repo, "client", "public");
const version = require("../package.json").version;

const MIME = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
  ".svg": "image/svg+xml", ".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg", ".m4a": "audio/mp4",
  ".wav": "audio/wav", ".ogg": "audio/ogg", ".json": "application/json", ".yml": "text/yaml",
};
const mb = (n) => (n / 1024 ** 2).toFixed(1);

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

async function fetchPublic(key) {
  const res = await fetch(`${R2_PUBLIC_URL}/${key}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${key}: HTTP ${res.status}`);
  return res.text();
}

// รายชื่อไฟล์สื่อบน R2 ที่ไม่อยู่ใน manifest (เฉพาะโฟลเดอร์สื่อ — โฟลเดอร์อื่นใน bucket ไม่แตะ)
async function staleMedia(r2, manifest) {
  const keys = (await Promise.all(MEDIA_DIRS.map((d) => r2.list(`${d}/`)))).flat();
  const stale = keys.filter((k) => !manifest.files["/" + k]);
  console.log(`• ไฟล์สื่อบน R2 ที่ไม่ใช้แล้ว (จะลบ): ${stale.length} ไฟล์`);
  for (const k of stale.slice(0, 30)) console.log(`    - ${k}`);
  if (stale.length > 30) console.log(`    … อีก ${stale.length - 30} ไฟล์`);
  return stale;
}

// ---------- R2 (S3 API) ----------
function r2Client() {
  const envFile = path.join(repo, ".env");
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
  const need = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"];
  const missing = need.filter((k) => !process.env[k]);
  if (missing.length) fail(`ไม่มีค่า ${missing.join(", ")} ใน .env ที่ราก repo (ดูตัวอย่างใน .env.example)`);
  const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } = require("@aws-sdk/client-s3");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
  });
  const Bucket = process.env.R2_BUCKET;
  return {
    async put(key, file, { noCache = false } = {}) {
      await client.send(new PutObjectCommand({
        Bucket,
        Key: key,
        Body: fs.createReadStream(file),
        ContentLength: fs.statSync(file).size,
        ContentType: MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
        CacheControl: noCache ? "no-cache" : undefined,
      }));
    },
    async list(prefix) {
      const keys = [];
      let ContinuationToken;
      do {
        const page = await client.send(new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken }));
        for (const o of page.Contents || []) keys.push(o.Key);
        ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (ContinuationToken);
      return keys;
    },
    async remove(keys) {
      for (let i = 0; i < keys.length; i += 1000) {
        await client.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })) } }));
      }
    },
  };
}

// ไฟล์สื่อที่ต้องอัป: เทียบกับ manifest บน R2 (sha256) · ยังไม่เคยมี manifest = เทียบขนาดไฟล์บน R2 แทน
async function mediaToUpload(manifest) {
  const remoteText = await fetchPublic("updates/media-manifest.json");
  const entries = Object.entries(manifest.files);
  if (remoteText) {
    const remote = JSON.parse(remoteText).files || {};
    return entries.filter(([rel, e]) => !remote[rel] || remote[rel].sha256 !== e.sha256);
  }
  console.log("  (R2 ยังไม่มี media-manifest — เทียบขนาดไฟล์บน R2 ทีละไฟล์แทน)");
  const todo = [];
  let i = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < entries.length) {
      const [rel, e] = entries[i++];
      const res = await headWithRetry(R2_PUBLIC_URL + encodePath(rel));
      if (res.status === 404 || Number(res.headers.get("content-length")) !== e.size) todo.push([rel, e]);
    }
  }));
  return todo;
}

// r2.dev จำกัดความถี่ (429) — รอแล้วลองใหม่ · ตอบอย่างอื่นที่ไม่ใช่ 200/404 ซ้ำ ๆ = หยุด
async function headWithRetry(url) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch(url, { method: "HEAD" });
    if (res.ok || res.status === 404) return res;
    if (attempt === 6) throw new Error(`HEAD ${url}: HTTP ${res.status}`);
    const after = Number(res.headers.get("retry-after"));
    await new Promise((r) => setTimeout(r, after > 0 ? after * 1000 : 1000 * 2 ** attempt));
  }
}

function readLatestYml(text) {
  const get = (key) => (text.match(new RegExp(`^${key}:\\s*'?([^'\\n]+)'?`, "m")) || [])[1];
  return { version: get("version"), path: get("path") };
}

(async () => {
  console.log(`ECHO ${version} — ปล่อยขึ้น R2${DRY ? " (dry-run: ไม่อัปจริง)" : ""}\n`);

  if (PRUNE_ONLY) {
    const manifest = await buildManifest(publicDir, MEDIA_DIRS);
    const r2 = r2Client();
    const stale = await staleMedia(r2, manifest);
    if (DRY || !stale.length) return console.log(DRY ? "\ndry-run จบ — ยังไม่ได้ลบอะไร" : "ไม่มีอะไรต้องลบ");
    await r2.remove(stale);
    return console.log(`\n✔ ลบไฟล์สื่อเก่า ${stale.length} ไฟล์แล้ว`);
  }

  // 0) เวอร์ชันนี้ต้องยังไม่เคยปล่อย — เครื่องเพื่อนที่มี 5.x.y อยู่แล้วจะไม่รู้ว่าไฟล์เปลี่ยน
  const remoteLatest = await fetchPublic("updates/latest.yml");
  const releasedVersion = remoteLatest ? readLatestYml(remoteLatest).version : null;
  console.log(`• เวอร์ชันบน R2 ตอนนี้: ${releasedVersion || "(ยังไม่เคยปล่อย)"}`);
  if (releasedVersion === version) fail(`เวอร์ชัน ${version} ปล่อยไปแล้ว — แก้ "version" ใน desktop/package.json ก่อน (เช่น 5.0.1)`);

  // 1) manifest ไฟล์สื่อจาก client/public
  const manifest = await buildManifest(publicDir, MEDIA_DIRS);
  const manifestFile = path.join(dist, "updates", "media-manifest.json");
  fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 1));
  const allMedia = Object.values(manifest.files);
  console.log(`• ไฟล์สื่อ: ${allMedia.length} ไฟล์ · ${mb(allMedia.reduce((n, e) => n + e.size, 0))} MB`);

  const upload = await mediaToUpload(manifest);
  console.log(`• ไฟล์สื่อที่ต้องอัป: ${upload.length} ไฟล์ · ${mb(upload.reduce((n, [, e]) => n + e.size, 0))} MB`);
  for (const [rel] of upload.slice(0, 20)) console.log(`    + ${rel}`);
  if (upload.length > 20) console.log(`    … อีก ${upload.length - 20} ไฟล์`);

  // 2) build exe
  if (!SKIP_BUILD) {
    console.log("• build exe (npm run dist)…");
    execSync("npm run dist", { cwd: desktop, stdio: "inherit" });
  }
  const latestFile = path.join(dist, "latest.yml");
  if (!fs.existsSync(latestFile)) fail("ไม่มี desktop/dist/latest.yml — รันโดยไม่ใส่ --skip-build");
  const latest = readLatestYml(fs.readFileSync(latestFile, "utf8"));
  if (latest.version !== version) fail(`exe ใน dist เป็นเวอร์ชัน ${latest.version} ไม่ใช่ ${version} — build ใหม่ (ไม่ใส่ --skip-build)`);
  const setup = path.join(dist, latest.path);
  const blockmap = setup + ".blockmap";
  for (const f of [setup, blockmap]) if (!fs.existsSync(f)) fail(`ไม่มีไฟล์ ${f}`);
  console.log(`• exe: ${latest.path} · ${mb(fs.statSync(setup).size)} MB`);

  // 3) ลบไฟล์สื่อเก่า (เฉพาะเมื่อสั่ง --prune)
  let stale = [];
  if (PRUNE) stale = await staleMedia(r2Client(), manifest);

  if (DRY) {
    console.log("\ndry-run จบ — ยังไม่ได้อัป/ลบอะไร");
    return;
  }

  // 4) อัปตามลำดับ
  const r2 = r2Client();
  let done = 0;
  for (const [rel] of upload) {
    await r2.put(rel.slice(1), path.join(publicDir, ...rel.split("/").filter(Boolean)));
    done++;
    if (done % 25 === 0 || done === upload.length) console.log(`  อัปไฟล์สื่อ ${done}/${upload.length}`);
  }
  await r2.put("updates/media-manifest.json", manifestFile, { noCache: true });
  console.log("  อัป media-manifest.json แล้ว");
  await r2.put(`updates/${latest.path}`, setup);
  await r2.put(`updates/${latest.path}.blockmap`, blockmap);
  console.log(`  อัป ${latest.path} แล้ว`);
  await r2.put("updates/latest.yml", latestFile, { noCache: true });
  console.log("  อัป latest.yml แล้ว — เครื่องผู้เล่นจะอัปเดตตอนเปิดโปรแกรมครั้งถัดไป");
  if (stale.length) {
    await r2.remove(stale);
    console.log(`  ลบไฟล์สื่อเก่า ${stale.length} ไฟล์แล้ว`);
  }

  // 5) ตรวจผลจากฝั่งผู้เล่น (public URL)
  const check = await fetchPublic("updates/latest.yml");
  if (!check || readLatestYml(check).version !== version) fail("ตรวจ latest.yml ผ่าน public URL ไม่ตรง — เช็คชื่อ bucket ใน .env");
  console.log(`\n✔ ปล่อย ECHO ${version} แล้ว · ลิงก์ให้เพื่อนโหลดครั้งแรก: ${R2_PUBLIC_URL}/updates/${encodeURIComponent(latest.path)}`);
})().catch((err) => fail(err.stack || err.message));
