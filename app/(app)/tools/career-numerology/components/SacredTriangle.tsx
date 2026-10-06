import type {
  NumerologyNumber,
  SacredTrianglePosition,
  SacredTriangleValue,
} from "@/lib/career-numerology";

const positionCoordinates: Record<SacredTrianglePosition, { x: number; y: number }> = {
  主运: { x: 70, y: 365 },
  家族: { x: 150, y: 260 },
  朋友: { x: 230, y: 155 },
  事业: { x: 320, y: 50 },
  转机: { x: 410, y: 155 },
  感情: { x: 490, y: 260 },
  危机: { x: 570, y: 365 },
  钱财: { x: 430, y: 365 },
  信念: { x: 285, y: 365 },
};

export function SacredTriangle({
  values,
  lifeNumber,
}: {
  values: SacredTriangleValue[];
  lifeNumber: NumerologyNumber;
}) {
  const sequencePoints = values
    .map(({ position }) => positionCoordinates[position])
    .map(({ x, y }) => `${x},${y}`)
    .join(" ");

  return (
    <div className="overflow-x-auto rounded-[24px] border border-[var(--falcon-soft-border)] bg-[#fdfcf9] p-3 sm:p-5">
      <svg
        viewBox="0 0 640 430"
        role="img"
        aria-label={`圣三角：中心生涯运数 ${lifeNumber}；${values.map((item) => `${item.position} ${item.value}`).join("，")}`}
        className="mx-auto h-auto w-full min-w-[540px] max-w-3xl"
      >
        <path d="M320 50 L70 365 L570 365 Z" fill="none" stroke="#d8c48e" strokeWidth="3" />
        <polyline points={sequencePoints} fill="none" stroke="#b8924a" strokeDasharray="5 7" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.55" strokeWidth="2" />

        <g transform="translate(320 245)">
          <circle r="48" fill="#171717" stroke="#b8924a" strokeWidth="3" />
          <text y="-2" textAnchor="middle" fontSize="28" fontWeight="700" fill="#ffffff">{lifeNumber}</text>
          <text y="20" textAnchor="middle" fontSize="12" fontWeight="600" fill="#e7d5a8">生涯运数</text>
        </g>

        {values.map((item) => {
          const point = positionCoordinates[item.position];
          const isMain = item.position === "主运";
          return (
            <g key={item.position} transform={`translate(${point.x} ${point.y})`}>
              <circle r="28" fill={isMain ? "#b8924a" : "#ffffff"} stroke={isMain ? "#8f6e35" : "#b8924a"} strokeWidth="2" />
              <text y="6" textAnchor="middle" fontSize="21" fontWeight="700" fill={isMain ? "#ffffff" : "#171717"}>{item.value}</text>
              <text y={item.position === "事业" ? -37 : 45} textAnchor="middle" fontSize="14" fontWeight="700" fill="#555552">{item.position}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
