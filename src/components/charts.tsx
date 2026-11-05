import { useState } from 'react'

/* ------------------------------------------------------------------ */
/* Donut chart — annular sectors, each outlined like a brutalist tile   */
/* ------------------------------------------------------------------ */

export interface DonutSlice {
  key: string
  label: string
  value: number
  color: string
  emoji?: string
}

const CX = 110
const CY = 110
const R_OUT = 92
const R_IN = 54

const polar = (r: number, a: number) => [CX + r * Math.cos(a), CY + r * Math.sin(a)]

function sector(a0: number, a1: number): string {
  const [x0, y0] = polar(R_OUT, a0)
  const [x1, y1] = polar(R_OUT, a1)
  const [x2, y2] = polar(R_IN, a1)
  const [x3, y3] = polar(R_IN, a0)
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M${x0} ${y0}A${R_OUT} ${R_OUT} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${R_IN} ${R_IN} 0 ${large} 0 ${x3} ${y3}Z`
}

export function DonutChart({
  slices,
  centerTop,
  centerBottom,
  format,
}: {
  slices: DonutSlice[]
  centerTop: string
  centerBottom: string
  format: (v: number) => string
}) {
  const [active, setActive] = useState<string | null>(null)
  const total = slices.reduce((a, s) => a + s.value, 0)
  const current = slices.find((s) => s.key === active)

  let angle = -Math.PI / 2
  const arcs = slices.map((s) => {
    const sweep = total > 0 ? (s.value / total) * Math.PI * 2 : 0
    const arc = { slice: s, a0: angle, a1: angle + sweep, full: slices.length === 1 }
    angle += sweep
    return arc
  })

  return (
    <div className="donut">
      <svg viewBox="0 0 220 220" role="img" aria-label="Spending by category">
        {total === 0 && <circle cx={CX} cy={CY} r={(R_OUT + R_IN) / 2} className="donut-empty" strokeWidth={R_OUT - R_IN} />}
        {arcs.map(({ slice, a0, a1, full }) => {
          const mid = (a0 + a1) / 2
          const lift = active === slice.key ? 7 : 0
          const dx = Math.cos(mid) * lift
          const dy = Math.sin(mid) * lift
          return (
            <g
              key={slice.key}
              transform={`translate(${dx} ${dy})`}
              onClick={() => setActive(active === slice.key ? null : slice.key)}
              className="donut-slice"
            >
              {full ? (
                <>
                  <circle cx={CX} cy={CY} r={(R_OUT + R_IN) / 2} fill="none" stroke={slice.color} strokeWidth={R_OUT - R_IN} />
                  <circle cx={CX} cy={CY} r={R_OUT} className="donut-line" />
                  <circle cx={CX} cy={CY} r={R_IN} className="donut-line" />
                </>
              ) : (
                <path d={sector(a0, a1)} fill={slice.color} className="donut-line" />
              )}
            </g>
          )
        })}
      </svg>
      <div className="donut-center">
        <span className="donut-top">{current ? current.label : centerTop}</span>
        <strong>{current ? format(current.value) : centerBottom}</strong>
        {current && total > 0 && <span className="donut-top">{Math.round((current.value / total) * 100)}%</span>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Bar chart — capsule tracks that fill up, tap one to read its value   */
/* ------------------------------------------------------------------ */

export interface BarDatum {
  label: string
  value: number
}

export function BarChart({
  data,
  format,
  name,
}: {
  data: BarDatum[]
  format: (v: number) => string
  name: string
}) {
  const [picked, setPicked] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.value))
  const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? 0) ? i : best), 0)
  const shown = picked ?? (data[peak]?.value ? peak : null)
  const dense = data.length > 8

  return (
    <div className={`bars ${dense ? 'dense' : ''}`}>
      {data.map((d, i) => {
        const on = shown === i
        return (
          <button
            key={`${d.label}-${i}`}
            className={`bar-col ${on ? 'on' : ''}`}
            onClick={() => setPicked(picked === i ? null : i)}
            aria-label={`${d.label}: ${name} ${format(d.value)}`}
          >
            <span className="bar-tip" aria-hidden={!on}>
              {on ? format(d.value) : ''}
            </span>
            <span className="bar-track">
              <span className="bar-fill" style={{ height: `${(d.value / max) * 100}%` }} />
            </span>
            <span className="bar-label">{d.label}</span>
          </button>
        )
      })}
    </div>
  )
}
