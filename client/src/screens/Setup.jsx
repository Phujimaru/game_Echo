import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { socket } from "../socket";
import { clickSound } from "../audio";
import { POSITIONS, POSITION_COLORS } from "../data/positions";
import { hexToHsv, hsvToHex } from "../components/ColorForge";
import GlobeCanvas from "../globe/GlobeCanvas";
import { OcScreen, OcPanel, OcButton } from "../oc/ui";
import { createSeatRing } from "../oc/seat/seatRing";
import "../oc/seat/seat.css";

// หน้าเลือกลำดับผู้เล่น (ORDEAL CALL): ลูกโลก + วงแหวนที่นั่ง P1–P7
//  ยังไม่เลือกที่นั่ง = โลกใหญ่กลางจอ ไม่มีแผง · เลือกแล้ว = โลกย่อเลื่อนไปซ้าย แผงชื่อ/สีเลื่อนเข้ามาทางขวา
const LAYOUT_BIG = { x: 0, y: -0.08, s: 1.22 };
const LAYOUT = { x: -0.55, y: -0.05, s: 0.92 };
const NAME_MAX = 12;
const SWATCHES = [...POSITIONS.map((n) => POSITION_COLORS[n]), "#6E2C7A", "#3D8BD9", "#1C3F6E"].map((c) => c.toUpperCase());

// สีต้องเป็น #RRGGBB (server/lobby.js normalizeColor) — ผ่าน HSV เพื่อกันสีมืดเกินแบบเดียวกับตัวเลือกสีเดิม
function cleanHex(c) {
  const hsv = hexToHsv(c);
  return hsvToHex(hsv.h, hsv.s, hsv.v);
}

export default function Setup({ taken, initialName = "", initialPos = null, initialColor = null, onNext }) {
  const [name, setName] = useState(initialName);
  const [pos, setPos] = useState(initialPos);
  const [color, setColor] = useState(() => cleanHex(initialColor || POSITION_COLORS[initialPos] || "#9B4F96"));
  // เลือกสีเองแล้ว = เปลี่ยนที่นั่งทีหลังสีไม่เปลี่ยนตาม
  const userColor = useRef(!!initialColor && cleanHex(initialColor) !== cleanHex(POSITION_COLORS[initialPos] || "#9B4F96"));
  const ringRef = useRef(null);
  const tagRefs = useRef([]);
  const ctlRef = useRef(null);
  const pickRef = useRef(null);

  useEffect(() => {
    if (pos && taken.includes(pos)) {
      setPos(null);
      alert("ที่นั่งนี้เพิ่งถูกคนอื่นเลือกไป ลองเลือกใหม่นะ");
    }
  }, [taken, pos]);

  useEffect(() => { ringRef.current?.setState({ pos, taken, color }); }, [pos, taken, color]);

  const pick = (n) => {
    ringRef.current?.toFront(n);
    if (taken.includes(n) && n !== pos) return;
    clickSound();
    setPos(n);
    if (!userColor.current) setColor(cleanHex(POSITION_COLORS[n] || "#9B4F96"));
    socket.emit("reserve", { position: n });
  };
  useLayoutEffect(() => { pickRef.current = pick; });

  const onReady = (core) => {
    const ring = createSeatRing(core, { onSeat: (s) => pickRef.current(s) });
    ring.setTags(tagRefs.current);
    ring.setControls(ctlRef.current);
    ring.setState({ pos, taken, color });
    if (initialPos) ring.toFront(initialPos, true);
    ringRef.current = ring;
    return () => { ring.dispose(); ringRef.current = null; };
  };

  const chooseColor = (c) => {
    userColor.current = true;
    setColor(cleanHex(c));
  };

  const submit = () => {
    if (!name.trim()) return alert("กรุณาใส่ชื่อก่อนนะ");
    if (!pos) return alert("เลือกที่นั่งก่อนนะ");
    onNext(name.trim(), pos, color);
  };

  const ready = !!(name.trim() && pos);
  const custom = !SWATCHES.includes(color);

  return (
    <OcScreen className="seat-screen">
      <GlobeCanvas layout={pos ? LAYOUT : LAYOUT_BIG} drag={false} onReady={onReady} />

      <div className="seat-title oc-enter">
        <h1 className="oc-h2">เลือกลำดับผู้เล่นที่ต้องการ</h1>
      </div>

      <div className="seat-tags">
        {POSITIONS.map((n, i) => {
          const mine = pos === n;
          const other = !mine && taken.includes(n);
          return (
            <button
              key={n}
              type="button"
              ref={(el) => { tagRefs.current[i] = el; }}
              className={`oc-tag seat-tag${mine ? " on" : ""}${other ? " taken" : ""}`}
              aria-label={`ที่นั่ง ${n} ${mine ? "ของคุณ" : other ? "ถูกจอง" : "ว่าง"}`}
              aria-disabled={other || undefined}
              onClick={() => pick(n)}
            >
              <span className="num">P{n}</span>
              <small>{mine ? name.trim() || "คุณ" : other ? "ถูกจอง" : "ว่าง"}</small>
              <span className="sw" style={{ background: mine ? color : "transparent" }} />
            </button>
          );
        })}
      </div>

      <div className="seat-ctl" ref={ctlRef}>
        <button type="button" aria-label="หมุนซ้าย" onClick={() => ringRef.current?.turn(-1)}>‹</button>
        <button type="button" aria-label="หมุนขวา" onClick={() => ringRef.current?.turn(1)}>›</button>
      </div>

      <div className={`seat-side${pos ? " open" : ""}`} aria-hidden={!pos}>
        <OcPanel as="form" onSubmit={(e) => { e.preventDefault(); if (ready) submit(); }}>
          <div className="seat-pick">
            <span className={`big${pos ? "" : " none"}`}>{pos ? `P${pos}` : "P–"}</span>
            {pos && <span className="oc-muted">ลำดับที่ {pos}</span>}
          </div>

          <div className="seat-field">
            <div className="seat-field-head">
              <label className="oc-label" htmlFor="seat-name">ชื่อ</label>
              <span className={`seat-count${name.length >= NAME_MAX ? " full" : ""}`}>{name.length} / {NAME_MAX}</span>
            </div>
            <input
              id="seat-name"
              className="oc-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={NAME_MAX}
              placeholder="ชื่อของคุณ"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="seat-field">
            <span className="oc-label">สี</span>
            <div className="seat-swatches" role="group" aria-label="สี">
              {SWATCHES.map((c) => (
                <button key={c} type="button" style={{ background: c }} aria-label={`สี ${c}`} aria-pressed={color === c} onClick={() => chooseColor(c)} />
              ))}
              <label className={`seat-custom${custom ? " on" : " rainbow"}`} style={custom ? { background: color } : undefined} title="สีอื่น">
                <input type="color" value={color.toLowerCase()} aria-label="สีอื่น" onChange={(e) => chooseColor(e.target.value)} />
                <span aria-hidden="true">+</span>
              </label>
            </div>
          </div>

          <OcButton variant="primary" type="submit" disabled={!ready}>ยืนยัน</OcButton>
        </OcPanel>
      </div>
    </OcScreen>
  );
}
