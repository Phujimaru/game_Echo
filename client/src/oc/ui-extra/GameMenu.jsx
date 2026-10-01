import { useEffect, useState } from "react";
import { socket } from "../../socket";
import { echoApp, useMatchStarted } from "./gameMenuState";

// เมนูมุมขวาบน (ข้างปุ่มเสียง — render จาก VolumeControl ซึ่งคุมว่าแผงไหนเปิด) · ใช้ได้เฉพาะในโปรแกรม ECHO
//  ก่อนเริ่มแมตช์ (เลือกที่นั่ง/ตัวละคร/ห้องรอ/โหวตโหมด/จัดทีม) = "ออกจากห้อง" · ระหว่างแมตช์ = "ออกจากเกม" + ยืนยันในแผง
//  ผลเท่ากับกด F10: กลับหน้าแรกของโปรแกรม (คนเปิดห้องออก = ห้องปิด ทุกคนหลุด → ต้องยืนยันเสมอ + ป้าย "ห้องจะปิด")
const SESSION_KEY = "echo_session"; // ชื่อเดียวกับ App.jsx

export function MenuIcon() {
  return (
    <svg className="ocv-ico" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h9" className="ocm-ico-line" />
    </svg>
  );
}

export function GameMenuPanel() {
  const started = useMatchStarted();
  const [host, setHost] = useState(false);
  // ยืนยันไว้สำหรับช่วงไหน (ก่อน/ระหว่างแมตช์) — แมตช์เริ่ม/จบระหว่างเปิดแผง = ขั้นยืนยันเดิมหายเอง
  const [confirmFor, setConfirmFor] = useState(null);
  const [busy, setBusy] = useState(false);
  const confirming = confirmFor === started;

  useEffect(() => {
    let alive = true;
    echoApp?.isHost().then((h) => { if (alive) setHost(!!h); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const leave = async () => {
    if (busy || !echoApp) return;
    setBusy(true);
    if (!started) {
      // ก่อนเริ่มแมตช์: คืนที่นั่งทันที (ไม่ต้องรอหมดเวลารีคอนเนกต์) และไม่กลับไปนั่งที่เดิมเองตอนเข้าห้องนี้อีกครั้ง
      try { socket.emit("leave"); } catch { /* ไม่ได้ต่ออยู่ */ }
      try { localStorage.removeItem(SESSION_KEY); } catch { /* ไม่มี storage */ }
    }
    try {
      if (!(await echoApp.leaveRoom())) setBusy(false);
    } catch {
      setBusy(false);
    }
  };

  const label = started ? "ออกจากเกม" : "ออกจากห้อง";
  const needConfirm = started || host;

  return (
    <div className="ocv-panel ocm-panel" role="dialog" aria-label="เมนู">
      {confirming ? (
        <>
          <div className="ocv-head">
            <span className="ocv-label">{label}</span>
            {host && <span className="ocm-tag">ห้องจะปิด</span>}
          </div>
          <div className="ocm-row">
            <button type="button" className="ocm-item is-danger" onClick={leave} disabled={busy}>ออก</button>
            <button type="button" className="ocm-item" onClick={() => setConfirmFor(null)} disabled={busy}>ยกเลิก</button>
          </div>
        </>
      ) : (
        <>
          <span className="ocv-label">เมนู</span>
          <button
            type="button"
            className="ocm-item is-danger"
            disabled={busy}
            onClick={() => (needConfirm ? setConfirmFor(started) : leave())}
          >
            {label}
          </button>
        </>
      )}
    </div>
  );
}
