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
    // musicTime = ตำแหน่งเพลง main5 (วินาที) ให้หน้าเกมเล่นต่อ
    enterHostedRoom: (musicTime) => ipcRenderer.invoke("echo:enterHostedRoom", musicTime),
    closeHostedRoom: () => ipcRenderer.invoke("echo:closeHostedRoom"),
    join: (address) => ipcRenderer.invoke("echo:join", address),
    enterJoinedRoom: (musicTime) => ipcRenderer.invoke("echo:enterJoinedRoom", musicTime),
    quit: () => ipcRenderer.invoke("echo:quit"),
  });
}
