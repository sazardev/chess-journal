import { useMemo } from "react"

interface EvalBarProps {
  score: number
  mate: number | null
  height: number
}

export default function EvalBar({ score, mate, height }: EvalBarProps) {
  const { barH, barY, label } = useMemo(() => {
    if (mate !== null) {
      const winning = mate > 0
      return {
        barH: height,
        barY: 0,
        label: `M${Math.abs(mate)}`,
      }
    }

    const clamped = Math.max(-500, Math.min(500, score))
    const fraction = (clamped + 500) / 1000
    const barH = Math.round(height * fraction)
    const barY = 0

    return {
      barH,
      barY,
      label: score > 0 ? `+${(score / 100).toFixed(1)}` : score < 0 ? `${(score / 100).toFixed(1)}` : "0.0",
    }
  }, [score, mate, height])

  return (
    <div
      className="relative shrink-0"
      style={{ width: 8, height }}
    >
      <div className="absolute inset-0 bg-gray-100" />
      <div
        className="absolute left-0 right-0 bg-black transition-all duration-150 ease-linear"
        style={{ top: barY + (height - barH), height: barH }}
      />
      {score !== 0 && (
        <div
          className="absolute left-0 right-0 flex items-center justify-center"
          style={{ top: 0, height }}
        >
          <span
            className={`font-mono text-[7px] tabular-nums leading-none ${
              score > 0 ? "text-gray-400" : "text-white"
            }`}
            style={{
              writingMode: "vertical-rl",
              textOrientation: "mixed",
              userSelect: "none",
            }}
          >
            {label}
          </span>
        </div>
      )}
    </div>
  )
}
