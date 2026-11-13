import { useCallback, useEffect, useRef, useState } from 'react'
import { api, usingSheets } from './api'
import { shortDate } from './dates'

export const uid = () => crypto.randomUUID()

// Timed tasks first, in time order; then untimed tasks in the order they were written.
export const sortTodos = (list) =>
  [...list].sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time)
    if (a.time) return -1
    if (b.time) return 1
    return (a.createdAt || '').localeCompare(b.createdAt || '')
  })

// Goals keep the color slot they were given (1-8), so colors never shift when
// another goal is added or deleted. Slot 0 means the neutral "other" color.
export const goalColor = (goal) => (goal?.slot ? `var(--series-${goal.slot})` : 'var(--series-other)')

// Two tasks clash when they have the same text (ignoring case and spaces) on the same date.
// Undated tasks (the Tasks list) are checked against each other the same way.
const sameText = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()
export const findDuplicate = (list, t) =>
  list.find((x) => x.id !== t.id && (x.date || null) === (t.date || null) && sameText(x.title, t.title))
export const duplicateMessage = (t) =>
  `"${t.title.trim()}" is already ${t.date ? `on ${shortDate(t.date)}` : 'in Tasks'}.`

export const doneMinutes = (list) => list.reduce((s, t) => s + (t.done && t.minutes > 0 ? t.minutes : 0), 0)

const source = usingSheets ? 'Google Sheets' : 'this browser'

export function useStore() {
  const [todos, setTodos] = useState([])
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const toastTimer = useRef()
  const showToast = (text) => {
    setToast(text)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 4000)
  }

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api('getAll')
      setTodos(data.todos)
      setGoals(data.goals || [])
    } catch (err) {
      setError(`Could not load data from ${source}: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // The screen is already updated; save in the background, and resync if that fails.
  const sync = (action, data) =>
    api(action, data).catch((err) => {
      setError(`Save failed: ${err.message}. Data was reloaded from ${source}.`)
      reload()
    })

  // Returns the saved task, or null when it would repeat a task on the same date.
  const saveTodo = (t) => {
    const before = t.id && todos.find((x) => x.id === t.id)
    // Only new text or a new date is checked, so tasks that already clash can still be ticked or edited.
    const moved = !before || (before.date || null) !== (t.date || null) || !sameText(before.title, t.title)
    if (moved && findDuplicate(todos, t)) {
      showToast(duplicateMessage(t))
      return null
    }
    const saved = {
      ...t,
      title: t.title.trim(),
      date: t.date || null,
      time: t.time || null,
      goalId: t.goalId || null,
      done: Boolean(t.done),
      minutes: t.done && Number(t.minutes) > 0 ? Number(t.minutes) : null,
      ...(t.id ? {} : { id: uid(), createdAt: new Date().toISOString() }),
    }
    setTodos((list) =>
      list.some((x) => x.id === saved.id) ? list.map((x) => (x.id === saved.id ? saved : x)) : [...list, saved]
    )
    sync('upsertTodo', saved)
    return saved
  }

  // Marking done records the minutes spent; marking undone clears them.
  const toggleTodo = (t, minutes) =>
    saveTodo(t.done ? { ...t, done: false, minutes: null } : { ...t, done: true, minutes })

  const deleteTodo = (id) => {
    setTodos((list) => list.filter((x) => x.id !== id))
    sync('deleteTodo', { id })
  }

  const saveGoal = (g) => {
    const used = new Set(goals.map((x) => x.slot))
    const saved = {
      ...g,
      title: g.title.trim(),
      targetMinutes: g.targetMinutes || null,
      ...(g.id
        ? {}
        : {
            id: uid(),
            createdAt: new Date().toISOString(),
            slot: [1, 2, 3, 4, 5, 6, 7, 8].find((s) => !used.has(s)) || 0,
          }),
    }
    setGoals((list) =>
      list.some((x) => x.id === saved.id) ? list.map((x) => (x.id === saved.id ? saved : x)) : [...list, saved]
    )
    sync('upsertGoal', saved)
    return saved
  }

  // Tasks linked to a deleted goal are kept; they just count as "No goal".
  const deleteGoal = (id) => {
    setGoals((list) => list.filter((x) => x.id !== id))
    sync('deleteGoal', { id })
  }

  const exportData = () => JSON.stringify({ todos, goals }, null, 2)

  const importData = (json) => {
    const data = JSON.parse(json)
    if (!Array.isArray(data.todos)) throw new Error('File must contain a "todos" array')
    // Backups made before goals existed have no "goals" array.
    const full = { todos: data.todos, goals: Array.isArray(data.goals) ? data.goals : [] }
    setTodos(full.todos)
    setGoals(full.goals)
    sync('importAll', full)
  }

  return {
    todos,
    goals,
    loading,
    error,
    source,
    toast,
    clearError: () => setError(''),
    saveTodo,
    toggleTodo,
    deleteTodo,
    saveGoal,
    deleteGoal,
    exportData,
    importData,
  }
}
