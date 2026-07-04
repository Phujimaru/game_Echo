// การ์ดเลข 1-10 (การ์ดสวยๆ) — back = คว่ำ
export default function Card({ value, back, size = "md" }) {
  const dim = size === "sm" ? "w-9 h-12" : "w-12 h-16";
  if (back) {
    return (
      <div className={`card-deal inline-grid place-items-center ${dim} m-1 rounded-lg text-2xl text-echo-purplelight bg-gradient-to-br from-echo-purple to-echo-navy shadow-lg border border-white/20`}>
        ✦
      </div>
    );
  }
  return (
    <div className={`card-deal relative inline-grid place-items-center ${dim} m-1 rounded-lg bg-gradient-to-br from-white to-gray-200 text-gray-900 shadow-lg border-2 border-echo-purple/50`}>
      <span className="text-2xl font-black">{value}</span>
      <span className="absolute top-0.5 left-1 text-[10px] font-bold text-echo-purpledark">{value}</span>
      <span className="absolute bottom-0.5 right-1 text-[10px] font-bold text-echo-purpledark rotate-180">{value}</span>
    </div>
  );
}
