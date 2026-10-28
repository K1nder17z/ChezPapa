import { Link } from 'react-router-dom'
import { formatEuro } from '../../lib/format.ts'
import { legend } from '../../lib/ordering/domain.ts'
import type { BoardTable } from '../../server/contracts.ts'

export function FloorPlan({ tables }: { tables: BoardTable[] }) {
  return (
    <section className="floor-room" aria-label="Plan de salle">
      <div className="floor-grid">
        {tables.map((table, index) => {
          const shape = index % 3 === 1 ? 'rect' : 'round'
          const seats = shape === 'rect' || index % 2 === 1 ? 4 : 2
          const total = table.orders.reduce((sum, order) => sum + order.totalCents, 0)
          return (
            <Link
              key={table.number}
              to={`/salle/table/${table.number}`}
              className="place"
              data-state={table.tone}
              data-shape={shape}
              data-seats={seats}
            >
              {Array.from({ length: seats }, (_, chair) => (
                <i key={chair} className="chair" aria-hidden="true" />
              ))}
              <span className="top">
                <i className="lamp" aria-hidden="true" />
                <strong>{table.number}</strong>
                <em>{table.label}</em>
                <small>{total > 0 ? formatEuro(total) : '—'}</small>
              </span>
            </Link>
          )
        })}
      </div>
      <ul className="legend floor-legend">
        {legend.map((item) => (
          <li key={item.tone}>
            <i data-tone={item.tone} />
            <span>
              {item.label}
              <small>{item.text}</small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
