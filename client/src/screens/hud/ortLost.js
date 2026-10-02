import { createContext } from "react";

// ORT สกิลติดตัว 1 (โหมด Type Mercury): ช่องสกิลของเราที่ "ข้อมูลสูญหาย" เทิร์นนี้ — ส่งผ่าน context
//  แทนการไล่เติม prop ให้ทุกจุดที่วาง SkillSlot (server กันการกดอยู่แล้ว ฝั่งนี้แค่ปิดปุ่ม + ขึ้นป้าย)
export const OrtLostTierContext = createContext(null);
