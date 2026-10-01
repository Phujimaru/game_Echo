// ด่านที่ 1: ตรวจเวอร์ชันกับ R2 ทุกครั้งที่เปิดโปรแกรม (electron-updater, generic provider → updates/latest.yml)
//  - ตรวจไม่ได้ = ไม่ให้เข้า (หน้าแรกมีปุ่มลองใหม่)
//  - เวอร์ชันบน R2 ต่างจากเครื่องนี้ (ใหม่กว่า หรือเก่ากว่าเพราะถอยเวอร์ชัน) = โหลดแล้วติดตั้งเงียบ ๆ เปิดใหม่ให้เอง
//    ทุกเครื่องจึงใช้เวอร์ชันเดียวกับ R2 เสมอ (ด่านที่ 3 ตอนเข้าห้องต้องตรงทุกตัวเลข)
//  - ตรวจเฉพาะตอนเปิด ไม่มีการอัปเดตกลางแมตช์
const { autoUpdater } = require("electron-updater");

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.allowDowngrade = true;
autoUpdater.logger = null;

let running = null;

// onStatus({ phase: "checking" | "downloading" | "restarting", version?, percent? })
// คืน { ok: true } = ใช้ต่อได้ · { ok: false, error } = เข้าไม่ได้ · ถ้ามีอัปเดต โปรแกรมจะปิดแล้วติดตั้งเอง (ไม่คืนค่า)
function checkForUpdate({ feedUrl, onStatus }) {
  if (running) return running;
  running = (async () => {
    autoUpdater.setFeedURL({ provider: "generic", url: feedUrl });
    onStatus({ phase: "checking" });
    let result;
    try {
      result = await autoUpdater.checkForUpdates();
    } catch (err) {
      return { ok: false, error: `ตรวจเวอร์ชันไม่สำเร็จ — เช็คอินเทอร์เน็ตแล้วลองใหม่ (${shortError(err)})` };
    }
    if (!result || !result.isUpdateAvailable) return { ok: true };

    const version = result.updateInfo.version;
    onStatus({ phase: "downloading", version, percent: 0 });
    const onProgress = (p) => onStatus({ phase: "downloading", version, percent: p.percent });
    autoUpdater.on("download-progress", onProgress);
    try {
      await autoUpdater.downloadUpdate();
    } catch (err) {
      return { ok: false, error: `โหลดเวอร์ชัน ${version} ไม่สำเร็จ — ลองใหม่อีกครั้ง (${shortError(err)})` };
    } finally {
      autoUpdater.off("download-progress", onProgress);
    }
    onStatus({ phase: "restarting", version });
    // ค้างข้อความไว้ให้ผู้เล่นเห็นแวบหนึ่งก่อนปิดไปติดตั้ง
    await new Promise((r) => setTimeout(r, 1500));
    autoUpdater.quitAndInstall(true, true); // ติดตั้งเงียบ + เปิดโปรแกรมใหม่ให้เอง
    return new Promise(() => {});
  })().finally(() => {
    running = null;
  });
  return running;
}

function shortError(err) {
  return String((err && err.message) || err).split("\n")[0].slice(0, 120);
}

module.exports = { checkForUpdate };
