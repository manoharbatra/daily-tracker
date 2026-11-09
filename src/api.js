const API_URL = import.meta.env.VITE_API_URL
const API_TOKEN = import.meta.env.VITE_API_TOKEN

// Without VITE_API_URL the app keeps data in this browser's localStorage,
// so it works before the Google Sheets backend is set up.
export const usingSheets = Boolean(API_URL)

let queue = Promise.resolve()

async function post(action, data) {
  const res = await fetch(API_URL, {
    method: 'POST',
    // text/plain keeps this a "simple" request, so the browser skips the CORS
    // preflight (OPTIONS) that Apps Script cannot answer.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token: API_TOKEN, data }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (!json.ok) throw new Error(json.error)
  return json.data
}

const LOCAL_KEYS = { todos: 'dt.todos', goals: 'dt.goals' }
const read = (kind) => JSON.parse(localStorage.getItem(LOCAL_KEYS[kind]) || '[]')
const write = (kind, list) => localStorage.setItem(LOCAL_KEYS[kind], JSON.stringify(list))
const upsert = (list, item) =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]

function local(action, data) {
  switch (action) {
    case 'getAll':
      return { todos: read('todos'), goals: read('goals') }
    case 'upsertTodo':
      write('todos', upsert(read('todos'), data))
      break
    case 'deleteTodo':
      write('todos', read('todos').filter((t) => t.id !== data.id))
      break
    case 'upsertGoal':
      write('goals', upsert(read('goals'), data))
      break
    case 'deleteGoal':
      write('goals', read('goals').filter((g) => g.id !== data.id))
      break
    case 'importAll':
      write('todos', data.todos)
      write('goals', data.goals)
      break
    default:
      throw new Error(`Unknown action: ${action}`)
  }
  return null
}

// Requests run one at a time, in order, so a later change never reaches the
// sheet before an earlier one.
export function api(action, data) {
  const run = queue.then(() => (usingSheets ? post(action, data) : local(action, data)))
  queue = run.catch(() => {})
  return run
}
