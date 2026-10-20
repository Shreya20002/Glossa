import type { TrendPoint } from '../../core/report'

const WIDTH = 132
const HEIGHT = 32
/** Room around the line for the latest session's 8 px dot and its ring. */
const INSET = 5

/** "Oct 18", in the computer's language. */
const dayFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

/**
 * A sparkline of fillers per minute over recent sessions, oldest on the left.
 * The scale starts at zero, so the line heads down as fillers fade. The
 * latest session is the accent dot, and hovering a point shows its value.
 * Screen readers get every value from the label.
 */
export function FillerTrend({ points }: { points: readonly TrendPoint[] }) {
  const highest = Math.max(...points.map((point) => point.fillersPerMinute)) || 1
  const placed = points.map((point, index) => ({
    point,
    x: INSET + (index * (WIDTH - 2 * INSET)) / Math.max(1, points.length - 1),
    y: INSET + (1 - point.fillersPerMinute / highest) * (HEIGHT - 2 * INSET),
  }))
  const latest = placed.at(-1)
  const values = points.map((point) => point.fillersPerMinute).join(', ')

  return (
    <figure className="report-trend">
      <figcaption>Fillers per minute, last {points.length} sessions</figcaption>
      <svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Fillers per minute in your last ${points.length} sessions, oldest first: ${values}`}
      >
        <polyline className="trend-line" points={placed.map(({ x, y }) => `${x},${y}`).join(' ')} />
        {latest && <circle className="trend-latest" cx={latest.x} cy={latest.y} r={4} />}
        {placed.map(({ point, x, y }) => (
          <circle key={point.startedAtMs} className="trend-target" cx={x} cy={y} r={8}>
            <title>{`${dayFormat.format(point.startedAtMs)}: ${point.fillersPerMinute} per minute`}</title>
          </circle>
        ))}
      </svg>
    </figure>
  )
}
