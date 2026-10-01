// ค่าคงที่ของโปรแกรม ECHO
//  R2 public URL = ที่เก็บไฟล์สื่อ (ราก bucket) + ไฟล์อัปเดตของโปรแกรม (โฟลเดอร์ updates/) — ไม่ใช่ความลับ
const R2_PUBLIC_URL = "https://pub-246229b6130d42e19ea95765c029663e.r2.dev";

module.exports = {
  R2_PUBLIC_URL,
  MEDIA_MANIFEST_URL: `${R2_PUBLIC_URL}/updates/media-manifest.json`,
};
