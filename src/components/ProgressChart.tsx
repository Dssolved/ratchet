import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { MovementChart } from '../domain/stats.ts'

/**
 * График повторений во времени с полосами целевых диапазонов.
 *
 * Ряд один — МИНИМАЛЬНЫЙ рабочий подход. Он выбран не случайно: двойная прогрессия
 * требует, чтобы верха диапазона достигли ВСЕ подходы, поэтому связывающее ограничение
 * задаёт худший подход, а не лучший. Точные цифры по каждому подходу есть в истории
 * ниже — она же служит табличным представлением этих данных.
 *
 * Полоса — целевой диапазон ступени, действовавшей в это время. Когда ступень меняется,
 * полоса сдвигается вверх, и падение повторений читается как повышение сложности,
 * а не как деградация. Обычный line chart здесь бы соврал.
 */
export default function ProgressChart({ chart }: { chart: MovementChart }) {
  if (chart.points.length < 2) {
    return (
      <p className="text-body text-muted">
        Для графика нужно хотя бы две тренировки на этом упражнении.
      </p>
    )
  }

  const suffix = chart.unit === 'seconds' ? ' сек' : ''
  // границы полос: там, где сменилась ступень
  const transitions = chart.bands.slice(1).map((band) => band.from)

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chart.points} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" vertical={false} />

          {chart.bands.map((band) => (
            <ReferenceArea
              key={`${band.stepId}-${band.from}`}
              x1={band.from}
              x2={band.to}
              y1={band.repMin}
              y2={band.repMax}
              fill="var(--color-accent)"
              fillOpacity={0.12}
              stroke="none"
            />
          ))}

          {transitions.map((label) => (
            <ReferenceLine
              key={label}
              x={label}
              stroke="var(--color-accent-ink)"
              strokeOpacity={0.5}
              strokeDasharray="3 3"
            />
          ))}

          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
            stroke="var(--color-border)"
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
            stroke="var(--color-border)"
            tickLine={false}
            width={44}
            allowDecimals={false}
          />

          <Tooltip
            cursor={{ stroke: 'var(--color-muted)', strokeDasharray: '3 3' }}
            contentStyle={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 10,
              color: 'var(--color-text)',
              fontSize: 13,
            }}
            labelStyle={{ color: 'var(--color-muted)' }}
            formatter={(_value, _name, item) => {
              const point = item.payload as { min: number; max: number }
              return [
                point.min === point.max
                  ? `${point.min}${suffix}`
                  : `${point.min}–${point.max}${suffix}`,
                'подходы',
              ]
            }}
          />

          <Line
            // именно linear: monotone сглаживает и выбрасывает кривую за пределы
            // реальных значений — на редких точках это прямое враньё о результате
            type="linear"
            dataKey="min"
            stroke="var(--color-accent)"
            strokeWidth={2}
            dot={{ r: 4, fill: 'var(--color-accent)', stroke: 'var(--color-bg)', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: 'var(--color-accent)' }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
