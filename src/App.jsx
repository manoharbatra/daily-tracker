import { useRef, useState } from 'react'
import Diary from './components/Diary'
import Goals from './components/Goals'
import Analysis from './components/Analysis'
import Tasks from './components/Tasks'
import { useStore } from './storage'
import { todayISO } from './dates'
import { useTheme } from './theme'

const SECTIONS = { diary: 'Diary', goals: 'Goals', analysis: 'Analysis', tasks: 'Tasks' }

export default function App() {
  const store = useStore()
  const [theme, toggleTheme] = useTheme()
  const [section, setSection] = useState('diary')
  // Day the diary opens on (null = today); set when a search result is opened.
  const [diaryDate, setDiaryDate] = useState(null)
  const [search, setSearch] = useState('')
  const openSection = (key) => {
    setDiaryDate(null)
    setSection(key)
  }
  const openTask = (t) => {
    setDiaryDate(t.date || null)
    setSection(t.date ? 'diary' : 'tasks')
  }
  const [importError, setImportError] = useState('')
  const fileRef = useRef()

  const exportJSON = () => {
    const blob = new Blob([store.exportData()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `daily-tracker-backup-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importJSON = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      store.importData(await file.text())
      setImportError('')
    } catch (err) {
      setImportError(`Import failed: ${err.message}`)
    }
    e.target.value = ''
  }

  return (
    <div className="app">
      <header>
        <h1>📒 My Daily Diary</h1>
        <div className="header-actions">
          <button
            className="tool theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button className="tool" onClick={exportJSON}>Export</button>
          <button className="tool" onClick={() => fileRef.current.click()}>Import</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={importJSON} />
        </div>
      </header>
      {importError && <p className="error">{importError}</p>}
      {store.error && (
        <p className="error">
          {store.error}{' '}
          <button className="tool small" onClick={store.clearError}>Dismiss</button>
        </p>
      )}
      {store.loading && <p className="status">Loading from {store.source}…</p>}
      {store.toast && (
        <div className="toast" role="status">
          {store.toast}
        </div>
      )}

      <nav className="section-tabs" aria-label="Sections">
        {Object.entries(SECTIONS).map(([key, label]) => (
          <button
            key={key}
            className={`section-tab ${key} ${section === key ? 'active' : ''}`}
            onClick={() => openSection(key)}
            aria-current={section === key ? 'page' : undefined}
          >
            {label}
          </button>
        ))}
      </nav>

      {section === 'diary' && (
        <Diary
          key={diaryDate || 'today'}
          initialDate={diaryDate}
          todos={store.todos}
          goals={store.goals}
          onSave={store.saveTodo}
          onToggle={store.toggleTodo}
          onDelete={store.deleteTodo}
        />
      )}
      {section === 'goals' && (
        <Goals goals={store.goals} todos={store.todos} onSave={store.saveGoal} onDelete={store.deleteGoal} />
      )}
      {section === 'analysis' && (
        <Analysis todos={store.todos} goals={store.goals} search={search} setSearch={setSearch} onOpen={openTask} />
      )}
      {section === 'tasks' && (
        <Tasks
          todos={store.todos}
          goals={store.goals}
          onSave={store.saveTodo}
          onToggle={store.toggleTodo}
          onDelete={store.deleteTodo}
        />
      )}
    </div>
  )
}
