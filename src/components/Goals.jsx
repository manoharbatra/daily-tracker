import { useState } from 'react'
import Book from './Book'
import { MIN_LINES } from './Diary'
import { formatDuration, goalPeriod } from '../dates'
import { doneMinutes, goalColor } from '../storage'

const PERIODS = { weekly: 'Weekly', monthly: 'Monthly' }

const toHours = (minutes) => (minutes ? String(+(minutes / 60).toFixed(2)) : '')

function GoalForm({ initial, onSave, onCancel }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [hours, setHours] = useState(toHours(initial?.targetMinutes))
  const [period, setPeriod] = useState(initial?.period || 'weekly')

  return (
    <li className="line goal-form">
      <form
        className="edit-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!title.trim()) return
          onSave({ ...initial, title, period, targetMinutes: Number(hours) > 0 ? Math.round(Number(hours) * 60) : null })
          if (!initial) {
            setTitle('')
            setHours('')
          }
        }}
      >
        <span className="margin-cell">{initial ? '' : 'New'}</span>
        <input
          className="ink-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Write a goal, e.g. Learn React"
          autoFocus={Boolean(initial)}
          aria-label="Goal"
        />
        <label className="log-time">
          Target
          <input
            type="number"
            min="0"
            step="0.5"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="—"
            aria-label="Target hours (optional)"
          />
          h
        </label>
        <select className="goal-select" value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period">
          {Object.entries(PERIODS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <span className="row-tools always">
          <button type="submit" className="pen-btn" disabled={!title.trim()}>
            {initial ? 'Save' : '+ Add'}
          </button>
          {onCancel && (
            <button type="button" className="pen-btn muted" onClick={onCancel}>
              Cancel
            </button>
          )}
        </span>
      </form>
    </li>
  )
}

function GoalItem({ goal, todos, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { start, end, label } = goalPeriod(goal.period)
  const linked = todos.filter((t) => t.goalId === goal.id)
  const inPeriod = linked.filter((t) => t.date && t.date >= start && t.date <= end)
  const minutes = doneMinutes(inPeriod)
  const doneCount = inPeriod.filter((t) => t.done).length
  const pending = linked.filter((t) => !t.done).length
  const pct = goal.targetMinutes ? Math.min(100, (minutes / goal.targetMinutes) * 100) : null
  const color = goalColor(goal)

  return (
    <li className="goal">
      <span className="margin-cell">
        <span className="swatch big" style={{ background: color }} />
      </span>
      <div className="goal-body">
        <div className="goal-title">
          {goal.title}
          <span className="goal-period">{PERIODS[goal.period]}</span>
          {pct === 100 && <span className="goal-reached">Target reached!</span>}
        </div>
        {pct != null && (
          <div
            className="progress"
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${goal.title} progress`}
          >
            <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
          </div>
        )}
        <div className="goal-meta">
          <strong>{formatDuration(minutes)}</strong>
          {goal.targetMinutes ? ` of ${formatDuration(goal.targetMinutes)}` : ''} {label}
          {pct != null && ` (${Math.round(pct)}%)`} · {doneCount} task{doneCount === 1 ? '' : 's'} done · {pending} pending ·{' '}
          {formatDuration(doneMinutes(linked))} in total
        </div>
      </div>
      <span className="row-tools">
        <button className="icon-btn" onClick={onEdit} title="Edit" aria-label="Edit goal">✎</button>
        {confirmDelete ? (
          <>
            <button className="pen-btn danger" onClick={onDelete} title="Tasks linked to this goal are kept">Delete?</button>
            <button className="pen-btn muted" onClick={() => setConfirmDelete(false)}>No</button>
          </>
        ) : (
          <button className="icon-btn" onClick={() => setConfirmDelete(true)} title="Delete" aria-label="Delete goal">✕</button>
        )}
      </span>
    </li>
  )
}

export default function Goals({ goals, todos, onSave, onDelete }) {
  const [editing, setEditing] = useState(null)
  const sorted = [...goals].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))

  return (
    <Book>
      <div className="page-head simple">
        <span />
        <div className="page-title">
          <h2>My Goals</h2>
          <div className="page-date">Link tasks to a goal in the diary. The time you log on them counts here.</div>
        </div>
      </div>

      <ul className="lines">
        {sorted.map((g) =>
          editing === g.id ? (
            <GoalForm
              key={g.id}
              initial={g}
              onSave={(x) => {
                onSave(x)
                setEditing(null)
              }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <GoalItem key={g.id} goal={g} todos={todos} onEdit={() => setEditing(g.id)} onDelete={() => onDelete(g.id)} />
          )
        )}
        <GoalForm onSave={onSave} />
        {!goals.length && (
          <li className="line hint-line">
            <span className="margin-cell" />
            <span className="pencil">No goals yet. Write one above, with an optional weekly or monthly target in hours.</span>
          </li>
        )}
        {Array.from({ length: Math.max(0, MIN_LINES - goals.length * 2 - (goals.length ? 1 : 2)) }, (_, i) => (
          <li key={`blank-${i}`} className="line blank-line" aria-hidden="true" />
        ))}
      </ul>
    </Book>
  )
}
