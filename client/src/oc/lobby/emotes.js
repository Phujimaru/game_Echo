// ห้องรอ ORDEAL CALL: อีโมตปักบนลูกโลก — กดเลือกอีโมต แล้วคลิกบนโลก ทุกคนในห้องเห็น (สีของคนส่ง) ~8 วินาที
//  server ส่งต่อผ่าน event "lobbyEmote" { emoji, dir:[x,y,z], color, playerId } (server/lobby.js relayLobbyEmote)
//  รายการต้องตรงกับ LOBBY_EMOTES ฝั่ง server
import { useEffect } from "react";
import { socket } from "../../socket";

export const EMOTES = ["👋", "😂", "😮", "😡", "❤️", "🔥", "👍", "😭"];

const LIFE = 8; // วินาที
const MAX_LIVE = 24;
const MIN_GAP_MS = 650; // server รับ 1 ครั้งต่อ 600 ms

let lastSent = 0;
/** ส่งอีโมตไปปักที่ทิศ dir (ระบบผิวโลก) · คืน false ถ้ากดถี่เกิน */
export function sendEmote(emoji, dir) {
  const now = performance.now();
  if (!EMOTES.includes(emoji) || !dir || now - lastSent < MIN_GAP_MS) return false;
  lastSent = now;
  socket.emit("lobbyEmote", { emoji, dir: [dir.x, dir.y, dir.z].map((n) => Math.round(n * 1e4) / 1e4) });
  return true;
}

function emoteCanvas(emo, color) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const x = cv.getContext("2d");
  x.beginPath(); x.arc(64, 64, 54, 0, Math.PI * 2);
  x.fillStyle = "#fff"; x.fill();
  x.lineWidth = 8; x.strokeStyle = color; x.stroke();
  x.font = '62px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText(emo, 64, 70);
  return cv;
}

/** รับอีโมตจาก server แล้ววาดบนลูกโลก (ติดผิวโลก หมุนตาม) */
export function useLobbyEmotes(core) {
  useEffect(() => {
    if (!core) return undefined;
    const { THREE } = core;
    const group = new THREE.Group();
    core.spin.add(group);
    const live = [];
    const textures = new Map();
    const texFor = (emo, color) => {
      const key = `${emo}|${color}`;
      let t = textures.get(key);
      if (!t) {
        t = new THREE.CanvasTexture(emoteCanvas(emo, color));
        t.colorSpace = THREE.SRGBColorSpace;
        textures.set(key, t);
      }
      return t;
    };
    const drop = (m) => {
      group.remove(m.pin);
      m.sp.material.dispose();
      m.stem.geometry.dispose(); m.stem.material.dispose();
    };
    const onEmote = ({ emoji, dir, color } = {}) => {
      if (!EMOTES.includes(emoji) || !Array.isArray(dir) || dir.length !== 3) return;
      const v = new THREE.Vector3(+dir[0], +dir[1], +dir[2]);
      if (!(v.lengthSq() > 1e-8)) return;
      v.normalize();
      const col = /^#[0-9a-f]{6}$/i.test(color || "") ? color : "#9B4F96";
      const pin = new THREE.Group();
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texFor(emoji, col), transparent: true, depthWrite: false }));
      sp.position.copy(v).multiplyScalar(1.15);
      sp.scale.setScalar(0.001);
      const stem = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([v.clone().multiplyScalar(1.0), v.clone().multiplyScalar(1.07)]),
        new THREE.LineBasicMaterial({ color: col, transparent: true }),
      );
      pin.add(stem, sp);
      group.add(pin);
      live.push({ pin, sp, stem, age: 0 });
      if (live.length > MAX_LIVE) drop(live.shift());
    };
    socket.on("lobbyEmote", onEmote);
    const offFrame = core.onFrame((dt) => {
      for (let i = live.length - 1; i >= 0; i--) {
        const m = live[i];
        m.age += Math.max(0, dt);
        const pop = Math.min(1, m.age / 0.25);
        const out = Math.max(0, Math.min(1, (LIFE - m.age) / 0.8));
        m.sp.scale.setScalar(0.24 * pop * (1 + 0.25 * Math.max(0, 1 - m.age * 3)));
        m.sp.material.opacity = out;
        m.stem.material.opacity = out;
        if (m.age > LIFE) { drop(m); live.splice(i, 1); }
      }
    });
    return () => {
      socket.off("lobbyEmote", onEmote);
      offFrame();
      live.forEach(drop);
      core.spin.remove(group);
      textures.forEach((t) => t.dispose());
    };
  }, [core]);
}
