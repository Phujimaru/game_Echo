// เปิดคำสั่งของแอปให้เฉพาะหน้าแรก (ไฟล์ในเครื่อง) — หน้าเกมที่โหลดจากเครื่อง host ไม่ได้สิทธิ์นี้
const { contextBridge, ipcRenderer } = require("electron");

if (location.protocol === "file:") {
  contextBridge.exposeInMainWorld("echo", {
    info: () => ipcRenderer.invoke("echo:info"),
    checkUpdate: () => ipcRenderer.invoke("echo:checkUpdate"),
    onUpdateStatus: (callback) => ipcRenderer.on("echo:updateStatus", (_e, status) => callback(status)),
    prepareMedia: () => ipcRenderer.invoke("echo:prepareMedia"),
    onMediaProgress: (callback) => ipcRenderer.on("echo:mediaProgress", (_e, progress) => callback(progress)),
    copy: (text) => ipcRenderer.invoke("echo:copy", text),
    host: () => ipcRenderer.invoke("echo:host"),
    // musicTime = ตำแหน่งเพลง main5 (วินาที) · volume = ระดับเสียงหน้าแรก (0–1) → หน้าเกมเริ่มที่ระดับเดียวกัน
    enterHostedRoom: (musicTime, volume) => ipcRenderer.invoke("echo:enterHostedRoom", musicTime, volume),
    closeHostedRoom: () => ipcRenderer.invoke("echo:closeHostedRoom"),
    join: (address) => ipcRenderer.invoke("echo:join", address),
    enterJoinedRoom: (musicTime, volume) => ipcRenderer.invoke("echo:enterJoinedRoom", musicTime, volume),
    quit: () => ipcRenderer.invoke("echo:quit"),
  });
} else if (location.protocol === "http:") {
  // หน้าเกม (มาจากเครื่อง host — เชื่อไม่ได้เต็มที่) ได้แค่ 2 อย่างนี้: ออกจากห้องกลับหน้าแรก (เหมือน F10 แต่ไม่ถามซ้ำ
  //  เพราะเมนูในเกมยืนยันแล้ว) และถามว่าเครื่องนี้เป็นคนเปิดห้องไหม — main.js ตรวจอีกชั้นว่าอยู่ในห้องจริง
  contextBridge.exposeInMainWorld("echoApp", {
    leaveRoom: () => ipcRenderer.invoke("echoApp:leaveRoom"),
    isHost: () => ipcRenderer.invoke("echoApp:isHost"),
  });
}
