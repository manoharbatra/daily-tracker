import { useState } from 'react'
import Book from './Book'
import {
  addDays,
  dateRange,
  formatDuration,
  monthEnd,
  monthLabel,
  monthStart,
  shortDate,
  startOfWeek,
  todayISO,
  weekdayName,
  weekdayShort,
} from '../dates'
import { doneMinutes, goalColor } from '../storage'

const PERIODS = { week: 'This week', month: 'This month', last30: 'Last 30 days', all: 'All time' }

function rangeFor(period, todos) {
  const today = todayISO()
  if (period === 'week') return { start: startOfWeek(today), end: addDays(startOfWeek(today), 6) }
  if (period === 'month') return { start: monthStart(today), end: monthEnd(today) }
  if (period === 'last30') return { start: addDays(today, -29), end: today }
  const first = todos.reduce((min, t) => (t.date && t.date < min ? t.date : min), today)
  return { start: first, end: today }
}

const MAX_RESULTS = 50

function Highlight({ text, query }) {
  const i = query ? text.toLowerCase().indexOf(query) : -1
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  )
}

// Finds tasks by title or goal name across every date, not just the chosen period.
function TaskSearch({ todos, goals, search, setSearch, onOpen }) {
  const q = search.trim().toLowerCase()
  const goalById = Object.fromEntries(goals.map((g) => [g.id, g]))
  const matches = q
    ? todos
        .filter((t) => t.title.toLowerCase().includes(q) || goalById[t.goalId]?.title.toLowerCase().includes(q))
        // Undated tasks first, then newest day first.
        .sort((a, b) => (b.date || '9999').localeCompare(a.date || '9999') || (a.time || '').localeCompare(b.time || ''))
    : []

  return (
    <div className="search">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Search all tasks…"
        aria-label="Search tasks"
      />
      {q && (
        <>
          <p className="search-count">
            {matches.length
              ? `${matches.length} task${matches.length === 1 ? '' : 's'} found${
                  matches.length > MAX_RESULTS ? `, showing the newest ${MAX_RESULTS}` : ''
                }`
              : 'No tasks match.'}
          </p>
          <ul className="lines results">
            {matches.slice(0, MAX_RESULTS).map((t) => {
              const goal = goalById[t.goalId]
              return (
                <li key={t.id} className={`line result ${t.done ? 'done' : ''}`} onClick={() => onOpen(t)}>
                  <span className="margin-cell">{t.date ? shortDate(t.date) : 'No date'}</span>
                  <span className="task">
                    <span className="status" aria-label={t.done ? 'Done' : 'Not done'}>
                      {t.done ? '✓' : '○'}
                    </span>
                    <span className="title">
                      <Highlight text={t.title} query={q} />
                    </span>
                    {goal && (
                      <span className="goal-tag">
                        <span className="swatch" style={{ background: goalColor(goal) }} />
                        <Highlight text={goal.title} query={q} />
                      </span>
                    )}
                    {t.done && t.minutes > 0 && <span className="logged">{formatDuration(t.minutes)}</span>}
                  </span>
                  <span className="row-tools always">
                    <button className="pen-btn" title={t.date ? 'Open this day in the diary' : 'Open the Tasks list'}>
                      Open →
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

const pct = (v, total) => (total ? `${Math.round((v / total) * 100)}%` : '0%')

function slicePath(cx, cy, r, a0, a1) {
  const x0 = cx + r * Math.cos(a0)
  const y0 = cy + r * Math.sin(a0)
  const x1 = cx + r * Math.cos(a1)
  const y1 = cy + r * Math.sin(a1)
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} Z`
}

function PieChart({ slices, total, focus, setHover, onSelect }) {
  const [tip, setTip] = useState(null)
  const size = 220
  const c = size / 2
  const r = c - 4
  let angle = -Math.PI / 2

  return (
    <div className="pie-wrap" onMouseLeave={() => { setTip(null); setHover(null) }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="pie" role="img" aria-label="Time logged by goal">
        {slices.map((s) => {
          const a0 = angle
          const a1 = angle + (s.value / total) * Math.PI * 2
          angle = a1
          const common = {
            fill: s.color,
            stroke: 'var(--paper)',
            strokeWidth: 2,
            opacity: focus && focus !== s.key ? 0.35 : 1,
            onClick: () => onSelect(s.key),
            onMouseMove: (e) => {
              const box = e.currentTarget.ownerSVGElement.parentNode.getBoundingClientRect()
              setTip({ x: e.clientX - box.left, y: e.clientY - box.top, s })
              setHover(s.key)
            },
          }
          return slices.length === 1 ? (
            <circle key={s.key} cx={c} cy={c} r={r} {...common} />
          ) : (
            <path key={s.key} d={slicePath(c, c, r, a0, a1)} {...common} />
          )
        })}
      </svg>
      {tip && (
        <div className="tooltip" style={{ left: tip.x + 12, top: tip.y + 12 }}>
          <span className="swatch" style={{ background: tip.s.color }} /> <strong>{tip.s.label}</strong>
          <div>
            {formatDuration(tip.s.value)} · {pct(tip.s.value, total)}
          </div>
        </div>
      )}
    </div>
  )
}

// One column per day (or per month for "All time"), one hue; hover shows the value.
function Columns({ buckets }) {
  const max = Math.max(...buckets.map((b) => b.value), 1)
  return (
    <div className="columns-wrap">
      <div className="columns" style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(10px, 1fr))` }}>
        {buckets.map((b) => (
          <div key={b.key} className="col" title={`${b.title}: ${formatDuration(b.value)}`}>
            <div className="col-bar" style={{ height: `${(b.value / max) * 100}%` }} />
            <span className="col-label">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Analysis({ todos, goals, search, setSearch, onOpen }) {
  const [period, setPeriod] = useState('week')
  const [hover, setHover] = useState(null)
  const [selected, setSelected] = useState(null)
  const toggle = (key) => setSelected((cur) => (cur === key ? null : key))

  const { start, end } = rangeFor(period, todos)
  const today = todayISO()
  const rows = todos.filter((t) => t.date && t.date >= start && t.date <= end)
  const done = rows.filter((t) => t.done)
  const minutes = doneMinutes(rows)

  // Time per day, used for the average and the busiest day.
  const perDay = done.reduce((acc, t) => {
    if (t.minutes > 0) acc[t.date] = (acc[t.date] || 0) + t.minutes
    return acc
  }, {})
  const activeDays = Object.keys(perDay).length
  const busiest = Object.entries(perDay).sort((a, b) => b[1] - a[1])[0]

  // Pie: time by goal, in each goal's fixed slot order; unlinked tasks are "No goal".
  const goalIds = new Set(goals.map((g) => g.id))
  const keyOf = (t) => (goalIds.has(t.goalId) ? t.goalId : 'none')
  const byGoal = done.reduce((acc, t) => {
    if (t.minutes > 0) acc[keyOf(t)] = (acc[keyOf(t)] || 0) + t.minutes
    return acc
  }, {})
  const slices = [
    ...[...goals]
      .sort((a, b) => (a.slot || 99) - (b.slot || 99))
      .filter((g) => byGoal[g.id])
      .map((g) => ({ key: g.id, label: g.title, value: byGoal[g.id], color: goalColor(g) })),
    ...(byGoal.none ? [{ key: 'none', label: 'No goal', value: byGoal.none, color: 'var(--series-other)' }] : []),
  ]

  // A clicked goal filters the column chart; drop it if this period doesn't have it.
  const filter = slices.some((s) => s.key === selected) ? selected : null
  const focus = hover || filter
  const colRows = filter ? done.filter((t) => keyOf(t) === filter) : done
  const filterLabel = slices.find((s) => s.key === filter)?.label

  let buckets
  if (period === 'all') {
    const months = [...new Set(dateRange(monthStart(start), end).map((d) => d.slice(0, 7)))]
    buckets = months.map((m) => ({
      key: m,
      label: monthLabel(m).split(' ')[0],
      title: monthLabel(m),
      value: doneMinutes(colRows.filter((t) => t.date.startsWith(m))),
    }))
  } else {
    buckets = dateRange(start, end).map((d, i) => ({
      key: d,
      label: period === 'week' ? weekdayShort(d) : i % 5 === 0 ? String(Number(d.slice(8))) : '',
      title: `${weekdayShort(d)} ${shortDate(d)}`,
      value: doneMinutes(colRows.filter((t) => t.date === d)),
    }))
  }

  const overdue = rows.filter((t) => !t.done && t.date < today).length

  return (
    <Book>
      <div className="page-head simple">
        <span />
        <div className="page-title">
          <h2>Analysis</h2>
          <div className="page-date">
            <select className="goal-select period-select" value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period">
              {Object.entries(PERIODS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <span>
              {shortDate(start)} – {shortDate(end)}
            </span>
          </div>
        </div>
      </div>

      <TaskSearch todos={todos} goals={goals} search={search} setSearch={setSearch} onOpen={onOpen} />

      {!rows.length ? (
        <p className="pencil page-empty">Nothing written in this period yet.</p>
      ) : (
        <div className="analysis">
          <div className="notes">
            <div className="note">
              <span>Tasks done</span>
              <strong>
                {done.length} / {rows.length}
              </strong>
              <small>{pct(done.length, rows.length)} completed{overdue ? ` · ${overdue} overdue` : ''}</small>
            </div>
            <div className="note">
              <span>Time logged</span>
              <strong>{formatDuration(minutes)}</strong>
              <small>on {done.length} finished task{done.length === 1 ? '' : 's'}</small>
            </div>
            <div className="note">
              <span>Daily average</span>
              <strong>{formatDuration(activeDays ? minutes / activeDays : 0)}</strong>
              <small>
                over {activeDays} active day{activeDays === 1 ? '' : 's'}
              </small>
            </div>
            <div className="note">
              <span>Busiest day</span>
              <strong>{busiest ? formatDuration(busiest[1]) : '—'}</strong>
              <small>{busiest ? `${weekdayName(busiest[0])}, ${shortDate(busiest[0])}` : 'no time logged yet'}</small>
            </div>
          </div>

          {minutes === 0 ? (
            <p className="pencil page-empty">No time logged yet. Tick a task in the diary to log time.</p>
          ) : (
            <>
              <h3 className="section-title">Time by goal</h3>
              <div className="chart-block pie-layout">
                <PieChart slices={slices} total={minutes} focus={focus} setHover={setHover} onSelect={toggle} />
                <ul className="legend">
                  {slices.map((s) => (
                    <li
                      key={s.key}
                      className={`${focus && focus !== s.key ? 'dim' : ''} ${filter === s.key ? 'selected' : ''}`}
                      onClick={() => toggle(s.key)}
                      onMouseEnter={() => setHover(s.key)}
                      onMouseLeave={() => setHover(null)}
                    >
                      <span className="swatch" style={{ background: s.color }} />
                      <span className="legend-name">{s.label}</span>
                      <span className="legend-pct">{pct(s.value, minutes)}</span>
                      <span className="legend-amt">{formatDuration(s.value)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <h3 className="section-title with-action">
                <span>
                  {period === 'all' ? 'Time per month' : 'Time per day'}
                  {filterLabel && <span className="filter-tag">{filterLabel}</span>}
                </span>
                <button className="pen-btn" onClick={() => setSelected(null)} disabled={!filter}>
                  Show all
                </button>
              </h3>
              <div className="chart-block">
                <Columns buckets={buckets} />
              </div>
            </>
          )}
        </div>
      )}
    </Book>
  )
}
