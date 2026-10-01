// แถบเลือกอีโมตของห้องรอ (ปักบนลูกโลก — ดู emotes.js)
import { EMOTES } from "./emotes";

/** แถบเลือกอีโมต — กดซ้ำ = เลิกเลือก */
export default function EmoteDock({ armed, onArm, className = "" }) {
  return (
    <div className={`ocl-emotes ${className}`} role="group" aria-label="อีโมต">
      <span className="ocl-emotes-label">อีโมต</span>
      {EMOTES.map((e) => (
        <button
          key={e}
          type="button"
          aria-pressed={armed === e}
          aria-label={e}
          onClick={() => onArm(armed === e ? null : e)}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
