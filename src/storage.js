import { useCallback, useEffect, useState } from 'react'
import { api, usingSheets } from './api'

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

export const doneMinutes = (list) => list.reduce((s, t) => s + (t.done && t.minutes > 0 ? t.minutes : 0), 0)

const source = usingSheets ? 'Google Sheets' : 'this browser'

export function useStore() {
  const [todos, setTodos] = useState([])
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  const saveTodo = (t) => {
    const saved = {
      ...t,
      title: t.title.trim(),
      time: t.time || null,
      goalId: t.goalId || null,
      done: Boolean(t.done),
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
