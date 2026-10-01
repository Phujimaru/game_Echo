import { useEffect, useRef, useState } from "react";
import { getMasterVolume, setMasterVolume, onVolumeChange, clickSound } from "../audio";
import "../oc/ui-extra/volume.css";

// ปุ่มเสียงมุมขวาบน (ทุกหน้า รวมกระดานเกมสีเข้ม) — ธีม ORDEAL CALL
//  ปุ่มเล็ก = ไอคอนลำโพง + แท่งระดับ 5 ขั้น · กดแล้วเปิดแผงกระจก: หลอดเลื่อน + ปุ่มปิดเสียง
const BARS = 5;

function SpeakerIcon({ muted }) {
  return (
    <svg className="ocv-ico" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 7.5h3.2L10.5 4v12L6.2 12.5H3z" className="ocv-ico-body" />
      {muted ? (
        <path d="M13.2 7.6l4.6 4.8M17.8 7.6l-4.6 4.8" className="ocv-ico-x" />
      ) : (
        <>
          <path d="M13 7.3a3.6 3.6 0 0 1 0 5.4" className="ocv-ico-wave" />
          <path d="M15.3 5.2a6.6 6.6 0 0 1 0 9.6" className="ocv-ico-wave" />
        </>
      )}
    </svg>
  );
}

export default function VolumeControl() {
  const [open, setOpen] = useState(false);
  const [vol, setVol] = useState(getMasterVolume());
  const lastOnRef = useRef(getMasterVolume() > 0 ? getMasterVolume() : 0.8); // ระดับก่อนกดปิดเสียง (กดอีกครั้งคืนค่านี้)
  const rootRef = useRef(null);

  // ค่าหลอดอาจถูกเปลี่ยนจากที่อื่น (หรือคืนค่าจาก localStorage) — ต้องตามให้ทัน
  useEffect(() => onVolumeChange((v) => {
    setVol(v);
    if (v > 0) lastOnRef.current = v;
  }), []);

  // คลิกนอกแผง / กด Esc = ปิดแผง
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const change = (v) => {
    const nv = Math.max(0, Math.min(1, v));
    setVol(nv);
    setMasterVolume(nv);
    if (nv > 0) lastOnRef.current = nv;
  };
  const muted = vol <= 0;
  const pct = Math.round(vol * 100);
  const lit = muted ? 0 : Math.max(1, Math.ceil(vol * BARS - 0.001));
  const toggleMute = () => {
    clickSound();
    change(muted ? (lastOnRef.current > 0 ? lastOnRef.current : 0.8) : 0);
  };

  return (
    <div className="ocv" ref={rootRef}>
      <button
        type="button"
        className={`ocv-btn${open ? " is-open" : ""}${muted ? " is-muted" : ""}`}
        onClick={() => { clickSound(); setOpen((o) => !o); }}
        aria-expanded={open}
        aria-label="เสียง"
        title="เสียง"
      >
        <SpeakerIcon muted={muted} />
        <span className="ocv-bars" aria-hidden="true">
          {Array.from({ length: BARS }, (_, i) => <i key={i} className={i < lit ? "on" : ""} />)}
        </span>
      </button>

      {open && (
        <div className="ocv-panel" role="dialog" aria-label="เสียง">
          <div className="ocv-head">
            <span className="ocv-label">เสียง</span>
            <span className={`ocv-pct${muted ? " is-muted" : ""}`}>{pct}<small>%</small></span>
          </div>

          <div className="ocv-slider" style={{ "--fill": `${pct}%` }}>
            <span className="ocv-track" aria-hidden="true">
              <i className="ocv-fill" />
              {Array.from({ length: 11 }, (_, i) => <b key={i} style={{ left: `${i * 10}%` }} className={i * 10 <= pct ? "on" : ""} />)}
            </span>
            <span className="ocv-thumb" aria-hidden="true" />
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={pct}
              onChange={(e) => change(Number(e.target.value) / 100)}
              aria-label="เสียง"
              aria-valuetext={`${pct}%`}
            />
          </div>

          <button type="button" className={`ocv-mute${muted ? " is-on" : ""}`} aria-pressed={muted} onClick={toggleMute}>
            <SpeakerIcon muted />
            ปิดเสียง
          </button>
        </div>
      )}
    </div>
  );
}
