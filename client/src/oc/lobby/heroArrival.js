// เข้าห้องรอจากหน้าเลือกตัว: ภาพตัวละครที่เพิ่งยืนยัน "บิน" จากตำแหน่งเดิมบนจอลงไปเป็นตราหกเหลี่ยมของเรา (FLIP)
//  หน้าเลือกตัวฝากข้อมูลไว้ด้วย setHeroHandoff (oc/heroHandoff.js) — ห้องรอรับครั้งเดียวตอน mount (takeHeroHandoff)
//  ระหว่างบิน: ภาพจริงในตราซ่อนอยู่ (data-hero-hide) จนภาพลอยลงจอดแล้วค่อยสลับ → ดูเป็นภาพเดียวกันไหลต่อเนื่อง
//  ที่นั่งของเราเปลี่ยนท่าเข้าเป็นจางเฉยๆ (data-hero) ให้ตำแหน่งปลายทางนิ่งตั้งแต่เฟรมแรก
//  ไม่มีข้อมูลส่งต่อ / ผู้ใช้ตั้งลดการเคลื่อนไหว = เข้าหน้าแบบปกติ
import { useLayoutEffect, useRef, useState } from "react";
import { takeHeroHandoff, clearHeroHandoff } from "../heroHandoff";

const HEX = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";
const RECT = "polygon(50% 0%, 100% 0%, 100% 100%, 50% 100%, 0% 100%, 0% 0%)"; // สี่เหลี่ยม 6 จุด เรียงตรงกับ HEX (ให้ clip-path ไหลเป็นเส้นตรง)
const FLY_MS = 820;
const EASE = "cubic-bezier(0.65, 0, 0.25, 1)";
const TARGET = ".ocl-view .ocl-seat.me .ocl-emb-face"; // ตราของเรา (ไม่รวมภาพผีของหน้าเก่า)

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * @param enabled เปิดหน้ามาที่ห้องรอ (หน้าเลือกโหมด/จัดทีมไม่รับภาพ — ทิ้งข้อมูลส่งต่อ)
 * @returns {{ arrival: boolean, hide: boolean }} arrival = เข้ามาด้วยภาพลอย (ค้างตลอดการ mount) · hide = ซ่อนภาพจริงในตรา
 */
export function useHeroArrival(enabled) {
  const taken = useRef(undefined); // รับครั้งเดียวต่อการ mount (StrictMode รัน effect ซ้ำ — ใช้ค่าที่รับไว้แล้ว)
  const [hero, setHero] = useState(null);
  const [arrival, setArrival] = useState(false);

  useLayoutEffect(() => {
    if (taken.current === undefined) {
      if (enabled) taken.current = takeHeroHandoff();
      else { clearHeroHandoff(); taken.current = null; }
    }
    const h = taken.current;
    if (!h || reducedMotion()) return;
    setArrival(true);
    setHero(h);
    // เปิดหน้าครั้งเดียว — enabled ที่เปลี่ยนภายหลังไม่เกี่ยว
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ตอนนี้ตราของเราวาดแบบ "ซ่อนภาพ + ไม่เลื่อน" แล้ว (ก่อนจอวาดเฟรมแรก) → วัดปลายทาง แล้วปล่อยภาพลอย
  useLayoutEffect(() => {
    if (!hero) return undefined;
    const face = document.querySelector(TARGET);
    const to = face?.getBoundingClientRect();
    const from = hero.rect;
    if (!to || to.width < 4 || !(from.width > 4 && from.height > 4)) { setHero(null); return undefined; }

    const c = getComputedStyle(face.closest(".ocl-seat-in")).getPropertyValue("--c").trim() || hero.color || "#8fc8ef";
    const fly = document.createElement("div");
    fly.setAttribute("aria-hidden", "true");
    Object.assign(fly.style, {
      position: "fixed", left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`,
      zIndex: "50", pointerEvents: "none", overflow: "hidden", clipPath: HEX,
      background: `linear-gradient(160deg, color-mix(in srgb, ${c} 30%, #fff) 0%, var(--oc-frost, #e8f1fa) 100%)`,
    });
    const img = document.createElement("img");
    img.src = hero.img;
    img.alt = "";
    img.draggable = false;
    Object.assign(img.style, { position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 16%", userSelect: "none" });
    fly.appendChild(img);
    document.body.appendChild(fly);

    const anim = fly.animate([
      { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, clipPath: RECT },
      { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px`, clipPath: HEX },
    ], { duration: FLY_MS, easing: EASE, fill: "forwards" });
    // จอดแล้ว: เลิกซ่อนภาพจริง — ภาพลอยถูกถอดใน cleanup ของ commit เดียวกัน (ก่อนจอวาด) จึงไม่มีเฟรมว่าง
    anim.onfinish = () => setHero(null);
    return () => { anim.onfinish = null; anim.cancel(); fly.remove(); };
  }, [hero]);

  return { arrival, hide: !!hero };
}
