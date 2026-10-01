// ฉากเริ่มการเดินทาง (ต่อจากฉากเปิดตัวผู้เล่น): ซูมเข้าจุดเริ่มต้นบนลูกโลก แล้วเปลี่ยนฉากเข้าพื้นที่เกม
//  ชั่วคราว: ใช้ฉากแผนที่เดิมไปก่อน (agent งาน Intro จะแทนที่ไฟล์นี้)
import JourneyMap from "../../journey/JourneyMap";

export default function GlobeDive(props) {
  return <JourneyMap mode="start" {...props} />;
}
