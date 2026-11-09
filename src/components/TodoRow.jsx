import { useState } from 'react'
import { formatDuration, formatTime, shortDate } from '../dates'
import { goalColor } from '../storage'
import GoalSelect from './GoalSelect'

const DEFAULT_MINUTES = 30

// One ruled line of the diary: time in the margin, checkbox and task on the line.
export default function TodoRow({ todo, goals, onToggle, onSave, onDelete, onMove, showDate }) {
  const goal = goals.find((g) => g.id === todo.goalId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(todo)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [logging, setLogging] = useState(false)
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES)
  const set = (field) => (e) => setDraft({ ...draft, [field]: e.target.value })

  // Ticking asks for the time spent first; unticking happens straight away.
  const onCheck = () => {
    if (todo.done) return onToggle(null)
    setMinutes(DEFAULT_MINUTES)
    setLogging(true)
  }

  if (logging) {
    return (
      <li className="line logging">
        <form
          className="edit-form"
          onSubmit={(e) => {
            e.preventDefault()
            const m = Number(minutes)
            if (!(m > 0)) return
            onToggle(m)
            setLogging(false)
          }}
        >
          <span className="margin-cell">{todo.time ? formatTime(todo.time) : ''}</span>
          <span className="task">
            <span className="box" aria-hidden="true" />
            <span className="title">{todo.title}</span>
          </span>
          <label className="log-time">
            Time spent
            <input
              type="number"
              min="1"
              step="5"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              required
              autoFocus
              aria-label="Minutes spent"
            />
            min
          </label>
          <span className="row-tools always">
            <button type="submit" className="pen-btn">✓ Done</button>
            <button type="button" className="pen-btn muted" onClick={() => setLogging(false)}>
              Cancel
            </button>
          </span>
        </form>
      </li>
    )
  }

  if (editing) {
    return (
      <li className="line editing">
        <form
          className="edit-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!draft.title.trim() || !draft.date) return
            onSave(draft)
            setEditing(false)
          }}
        >
          <input type="time" className="margin-cell" value={draft.time || ''} onChange={set('time')} aria-label="Time (optional)" />
          <input className="ink-input" value={draft.title} onChange={set('title')} required autoFocus aria-label="Task" />
          <GoalSelect goals={goals} value={draft.goalId} onChange={set('goalId')} />
          <input type="date" className="date-input" value={draft.date} onChange={set('date')} required aria-label="Date" />
          <span className="row-tools always">
            <button type="submit" className="pen-btn">Save</button>
            <button type="button" className="pen-btn muted" onClick={() => { setDraft(todo); setEditing(false) }}>
              Cancel
            </button>
          </span>
        </form>
      </li>
    )
  }

  return (
    <li className={`line ${todo.done ? 'done' : ''}`}>
      <span className="margin-cell">{todo.time ? formatTime(todo.time) : ''}</span>
      <label className="task">
        <input type="checkbox" checked={todo.done} onChange={onCheck} />
        <span className="box" aria-hidden="true" />
        <span className="title">{todo.title}</span>
        {goal && (
          <span className="goal-tag">
            <span className="swatch" style={{ background: goalColor(goal) }} />
            {goal.title}
          </span>
        )}
        {todo.done && todo.minutes > 0 && <span className="logged">{formatDuration(todo.minutes)}</span>}
        {showDate && <span className="from-date">({shortDate(todo.date)})</span>}
      </label>
      <span className="row-tools">
        {onMove && (
          <button className="pen-btn" onClick={onMove} title="Move to today">→ today</button>
        )}
        <button className="icon-btn" onClick={() => { setDraft(todo); setEditing(true) }} title="Edit" aria-label="Edit task">✎</button>
        {confirmDelete ? (
          <>
            <button className="pen-btn danger" onClick={onDelete}>Delete?</button>
            <button className="pen-btn muted" onClick={() => setConfirmDelete(false)}>No</button>
          </>
        ) : (
          <button className="icon-btn" onClick={() => setConfirmDelete(true)} title="Delete" aria-label="Delete task">✕</button>
        )}
      </span>
    </li>
  )
}
