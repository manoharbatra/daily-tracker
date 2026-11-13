import Book from './Book'
import TodoRow from './TodoRow'
import { MIN_LINES, NewTodo } from './Diary'
import { todayISO } from '../dates'
import { sortTodos } from '../storage'

// Tasks with no date yet. Giving one a date moves it into the diary on that day.
export default function Tasks({ todos, goals, onSave, onToggle, onDelete }) {
  const today = todayISO()
  const list = sortTodos(todos.filter((t) => !t.date))

  return (
    <Book>
      <div className="page-head simple">
        <span />
        <div className="page-title">
          <h2>Tasks</h2>
          <div className="page-date">Tasks without a date. Cut one to a day to move it into the diary, or copy it to keep it here too.</div>
        </div>
      </div>

      <ul className="lines">
        {list.map((t) => (
          <TodoRow
            key={t.id}
            todo={t}
            goals={goals}
            // Time spent is logged today, so a ticked task is filed under today.
            onToggle={(minutes) => onToggle({ ...t, date: today }, minutes)}
            onSave={onSave}
            onDelete={() => onDelete(t.id)}
            // Cut moves the task to that day; copy leaves it here and adds a fresh, unticked copy on that day.
            onPlace={(mode, date) =>
              mode === 'cut'
                ? onSave({ ...t, date })
                : onSave({ title: t.title, time: t.time, goalId: t.goalId, date, done: false })
            }
          />
        ))}
        <NewTodo date={null} goals={goals} onSave={onSave} />
        {!list.length && (
          <li className="line hint-line">
            <span className="margin-cell" />
            <span className="pencil">No tasks waiting. Write one above, then move it to a day when you plan it.</span>
          </li>
        )}
        {Array.from({ length: Math.max(0, MIN_LINES - list.length - (list.length ? 1 : 2)) }, (_, i) => (
          <li key={`blank-${i}`} className="line blank-line" aria-hidden="true" />
        ))}
      </ul>
    </Book>
  )
}
