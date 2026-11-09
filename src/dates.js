// Dates are stored as 'YYYY-MM-DD' and times as 'HH:mm', both in local time.

export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatISO(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayISO() {
  return formatISO(new Date())
}

export function addDays(iso, days) {
  const d = parseDate(iso)
  d.setDate(d.getDate() + days)
  return formatISO(d)
}

// Monday of the week containing iso.
export function startOfWeek(iso) {
  const d = parseDate(iso)
  return addDays(iso, -((d.getDay() + 6) % 7))
}

export const monthStart = (iso) => `${iso.slice(0, 7)}-01`

export function monthEnd(iso) {
  const d = parseDate(monthStart(iso))
  return formatISO(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

// Every date from start to end, inclusive.
export function dateRange(start, end) {
  const out = []
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d)
  return out
}

export const monthLabel = (ym) => parseDate(`${ym}-01`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })

// The current window a weekly or monthly goal is measured over.
export function goalPeriod(period, today = todayISO()) {
  if (period === 'monthly') return { start: monthStart(today), end: monthEnd(today), label: 'this month' }
  const start = startOfWeek(today)
  return { start, end: addDays(start, 6), label: 'this week' }
}

export const weekdayName = (iso) => parseDate(iso).toLocaleDateString('en-IN', { weekday: 'long' })

export const weekdayShort = (iso) => parseDate(iso).toLocaleDateString('en-IN', { weekday: 'short' })

export const longDate = (iso) =>
  parseDate(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

export const shortDate = (iso) => parseDate(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

// 30 -> '30 min', 90 -> '1 h 30 min', 120 -> '2 h'
export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

// '14:30' -> '2:30 pm'
export function formatTime(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h < 12 ? 'am' : 'pm'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`
}
