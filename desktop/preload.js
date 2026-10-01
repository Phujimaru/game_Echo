// เปิดคำสั่งของแอปให้เฉพาะหน้าแรก (ไฟล์ในเครื่อง) — หน้าเกมที่โหลดจากเครื่อง host ไม่ได้สิทธิ์นี้
const { contextBridge, ipcRenderer } = require("electron");

if (location.protocol === "file:") {
  contextBridge.exposeInMainWorld("echo", {
    info: () => ipcRenderer.invoke("echo:info"),
    prepareMedia: () => ipcRenderer.invoke("echo:prepareMedia"),
    onMediaProgress: (callback) => ipcRenderer.on("echo:mediaProgress", (_e, progress) => callback(progress)),
    copy: (text) => ipcRenderer.invoke("echo:copy", text),
    host: () => ipcRenderer.invoke("echo:host"),
    enterHostedRoom: () => ipcRenderer.invoke("echo:enterHostedRoom"),
    closeHostedRoom: () => ipcRenderer.invoke("echo:closeHostedRoom"),
    join: (address) => ipcRenderer.invoke("echo:join", address),
    quit: () => ipcRenderer.invoke("echo:quit"),
  });
}
