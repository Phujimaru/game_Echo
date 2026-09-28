// ============================================================
//  ตราสัญลักษณ์ของแต่ละภูมิภาค (เส้นลายทอง) — ใช้บนแผนที่การเดินทาง และ HUD ได้
//  <JourneyEmblem icon="castle" size="3rem" color="#e3bd5c" />
//  icon: castle | flower | tree | whirl | sun | snow | flame  (ดู JOURNEY_AREAS[].icon)
// ============================================================

const PATHS = {
  castle: (
    <>
      <path d="M12 52 V30 L17 24 L22 30 V52" />
      <path d="M42 52 V30 L47 24 L52 30 V52" />
      <path d="M24 52 V22 L32 10 L40 22 V52" />
      <path d="M8 52 H56" />
      <path d="M22 36 H42" />
      <path d="M28 52 V44 A4 4 0 0 1 36 44 V52" />
      <path d="M32 10 V4 L38 6 L32 8" />
      <circle cx="32" cy="28" r="1.8" />
    </>
  ),
  flower: (
    <>
      <circle cx="32" cy="26" r="5" />
      <path d="M32 21 C28 12 36 12 32 21 Z" />
      <path d="M37 24 C44 17 48 24 37 24 Z" />
      <path d="M36 30 C44 34 38 41 36 30 Z" />
      <path d="M28 30 C26 41 20 34 28 30 Z" />
      <path d="M27 24 C16 24 20 17 27 24 Z" />
      <path d="M32 31 C31 40 33 46 32 56" />
      <path d="M32 46 C26 40 20 42 18 44 C24 46 28 47 32 46" />
      <path d="M32 50 C38 44 44 46 46 48 C40 50 36 51 32 50" />
    </>
  ),
  tree: (
    <>
      <path d="M30 56 C31 46 29 40 32 32 C34 26 30 22 28 16" />
      <path d="M34 56 C33 46 36 40 34 32" />
      <path d="M31 36 C24 34 20 28 14 28 C12 24 16 20 12 16" />
      <path d="M33 30 C40 28 42 22 48 20 C52 16 50 12 54 10" />
      <path d="M29 22 C26 16 22 14 22 8" />
      <path d="M20 29 C18 34 14 34 12 38" />
      <path d="M44 22 C46 28 50 28 52 32" />
      <path d="M22 56 C26 52 30 54 32 52 C34 54 38 52 42 56" />
      <circle cx="24" cy="42" r="1.4" />
      <circle cx="40" cy="44" r="1.4" />
    </>
  ),
  whirl: (
    <>
      <path d="M32 32 C34 30 36 32 35 34 C34 37 29 37 28 33 C27 28 33 25 37 27 C43 30 42 38 37 41 C30 45 22 40 22 33 C22 24 31 19 39 21 C48 24 51 34 47 42" />
      <path d="M8 50 Q14 45 20 50 T32 50 T44 50 T56 50" />
      <path d="M12 56 Q18 52 24 56 T36 56 T48 56" />
      <path d="M10 18 Q15 14 20 18" />
      <path d="M46 12 Q51 8 56 12" />
    </>
  ),
  sun: (
    <>
      <circle cx="32" cy="26" r="8" />
      <path d="M32 10 V14 M32 38 V42 M16 26 H20 M44 26 H48 M21 15 L24 18 M43 15 L40 18 M21 37 L24 34 M43 37 L40 34" />
      <path d="M6 50 C16 42 24 42 32 48 C40 42 50 44 58 50" />
      <path d="M10 56 C20 51 30 52 38 56 C44 53 50 53 56 56" />
    </>
  ),
  snow: (
    <>
      <path d="M32 8 V56 M11 20 L53 44 M11 44 L53 20" />
      <path d="M26 12 L32 17 L38 12 M26 52 L32 47 L38 52" />
      <path d="M12 27 L19 24 L17 16 M52 37 L45 40 L47 48" />
      <path d="M12 37 L19 40 L17 48 M52 27 L45 24 L47 16" />
      <path d="M32 26 L37 29 L37 35 L32 38 L27 35 L27 29 Z" />
    </>
  ),
  flame: (
    <>
      <path d="M32 58 C18 58 12 48 16 38 C19 30 24 28 22 18 C30 22 32 28 32 32 C34 24 38 16 36 6 C46 14 52 28 50 40 C49 50 44 58 32 58 Z" />
      <path d="M32 52 C26 52 24 46 26 42 C28 38 30 38 30 34 C35 37 38 42 38 46 C38 50 36 52 32 52 Z" />
      <path d="M8 20 L14 24 L12 30 M56 18 L50 22 L53 28" />
    </>
  ),
};

export default function JourneyEmblem({ icon = "castle", size = "3rem", color = "currentColor", strokeWidth = 2.4, className, style }) {
  return (
    <svg
      className={className}
      style={{ width: size, height: size, ...style }}
      viewBox="0 0 64 64"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[icon] || PATHS.castle}
    </svg>
  );
}
