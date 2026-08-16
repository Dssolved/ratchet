import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { formatDateShort } from '../domain/dates.ts'
import type { Measurement } from '../domain/types.ts'

/**
 * Вес во времени.
 *
 * Ни целевой линии, ни «нормы», ни зон — вес показывается как факт, а не как оценка
 * (Д-30). Ось Y без нуля: колебания веса измеряются килограммами на фоне восьмидесяти,
 * и шкала от нуля превратила бы график в прямую.
 *
 * Линия прямая между точками по той же причине, что и в графике повторений: `monotone`
 * на редких точках выбрасывает кривую за пределы реальных значений, то есть врёт.
 */
export default function WeightChart({ points }: { points: Measurement[] }) {
  if (points.length < 2) {
    return <p className="text-body text-muted">Для графика нужно хотя бы два замера.</p>
  }

  const data = points.map((m) => ({ label: formatDateShort(m.date), value: m.value }))

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {/* левый отступ не отрицательный, в отличие от графика повторений: там подписи
            оси целые и двузначные, а здесь «81.7» — четыре знака, и они обрезались */}
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" vertical={false} />

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
            domain={['dataMin - 1', 'dataMax + 1']}
            tickFormatter={(value: number) => value.toFixed(1)}
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
            formatter={(value) => [`${Number(value).toFixed(1)} кг`, 'вес']}
          />

          <Line
            type="linear"
            dataKey="value"
            stroke="var(--color-accent)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--color-accent)', stroke: 'var(--color-bg)', strokeWidth: 2 }}
            activeDot={{ r: 5, fill: 'var(--color-accent)' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
