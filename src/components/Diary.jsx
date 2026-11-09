import { useRef, useState } from 'react'
import Book from './Book'
import GoalSelect from './GoalSelect'
import TodoRow from './TodoRow'
import { addDays, formatDuration, longDate, startOfWeek, todayISO, weekdayName, weekdayShort } from '../dates'
import { sortTodos } from '../storage'

// Every page shows at least this many ruled lines, like a real diary page.
export const MIN_LINES = 10

function WeekTabs({ date, setDate, todos }) {
  const monday = startOfWeek(date)
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const today = todayISO()
  return (
    <nav className="week-tabs" aria-label="Days of this week">
      {days.map((d) => {
        const list = todos.filter((t) => t.date === d)
        const done = list.filter((t) => t.done).length
        return (
          <button
            key={d}
            className={`week-tab ${d === date ? 'active' : ''} ${d === today ? 'is-today' : ''}`}
            onClick={() => setDate(d)}
            aria-current={d === date ? 'date' : undefined}
          >
            <span className="wt-day">{weekdayShort(d)}</span>
            <span className="wt-num">{Number(d.slice(8))}</span>
            <span className="wt-count">{list.length ? `${done}/${list.length}` : ' '}</span>
          </button>
        )
      })}
    </nav>
  )
}

function NewTodo({ date, goals, onSave }) {
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [goalId, setGoalId] = useState('')
  return (
    <li className="line new-line">
      <form
        className="edit-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!title.trim()) return
          // The goal stays selected for quick repeated entries.
          onSave({ date, time, title, goalId, done: false })
          setTitle('')
          setTime('')
        }}
      >
        <input type="time" className="margin-cell" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time (optional)" />
        <input
          className="ink-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Write a new task…"
          aria-label="New task"
        />
        <GoalSelect goals={goals} value={goalId} onChange={(e) => setGoalId(e.target.value)} />
        <span className="row-tools always">
          <button type="submit" className="pen-btn" disabled={!title.trim()}>+ Add</button>
        </span>
      </form>
    </li>
  )
}

export default function Diary({ todos, goals, onSave, onToggle, onDelete }) {
  const [date, setDate] = useState(todayISO())
  const pickerRef = useRef()
  const openPicker = () => {
    const el = pickerRef.current
    if (el.showPicker) el.showPicker()
    else el.focus()
  }
  const today = todayISO()
  const page = sortTodos(todos.filter((t) => t.date === date))
  const done = page.filter((t) => t.done).length
  const logged = page.reduce((s, t) => s + (t.done && t.minutes > 0 ? t.minutes : 0), 0)
  // Unfinished tasks from earlier days, shown on today's page so nothing gets lost.
  const carried =
    date === today ? sortTodos(todos.filter((t) => !t.done && t.date < today)).sort((a, b) => a.date.localeCompare(b.date)) : []

  const rowProps = (t) => ({
    todo: t,
    goals,
    onToggle: (minutes) => onToggle(t, minutes),
    onSave,
    onDelete: () => onDelete(t.id),
  })

  return (
    <Book>
        <WeekTabs date={date} setDate={setDate} todos={todos} />

        <div className="page-head">
          <button className="turn" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">‹</button>
          <div className="page-title">
            <h2>{weekdayName(date)}</h2>
            <div className="page-date">
              <span>{longDate(date)}</span>
              <input
                ref={pickerRef}
                type="date"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                tabIndex={-1}
                aria-hidden="true"
              />
              <button className="cal-btn" onClick={openPicker} title="Pick a date" aria-label="Pick a date">📅</button>
            </div>
          </div>
          <button className="turn" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">›</button>
          {date !== today && (
            <button className="ribbon" onClick={() => setDate(today)}>Today</button>
          )}
        </div>

        <ul className="lines">
          {page.map((t) => (
            <TodoRow key={t.id} {...rowProps(t)} />
          ))}
          <NewTodo key={date} date={date} goals={goals} onSave={onSave} />
          {!page.length && (
            <li className="line hint-line">
              <span className="margin-cell" />
              <span className="pencil">Nothing written for this day yet.</span>
            </li>
          )}
          {Array.from({ length: Math.max(0, MIN_LINES - page.length - (page.length ? 1 : 2)) }, (_, i) => (
            <li key={`blank-${i}`} className="line blank-line" aria-hidden="true" />
          ))}
        </ul>

        {carried.length > 0 && (
          <>
            <h3 className="section-title">Unfinished from earlier days</h3>
            <ul className="lines">
              {carried.map((t) => (
                <TodoRow key={t.id} {...rowProps(t)} showDate onMove={() => onSave({ ...t, date: today })} />
              ))}
            </ul>
          </>
        )}

        {page.length > 0 && (
          <div className={`stamp ${done === page.length ? 'complete' : ''}`}>
            {done === page.length ? 'All done!' : `${done} / ${page.length} done`}
            {logged > 0 && <span className="stamp-time">{formatDuration(logged)} logged</span>}
          </div>
        )}
    </Book>
  )
}
