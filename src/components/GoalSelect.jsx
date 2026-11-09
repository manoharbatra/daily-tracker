// Optional goal picker shown on a diary line; hidden until a goal exists.
export default function GoalSelect({ goals, value, onChange }) {
  if (!goals.length) return null
  return (
    <select className="goal-select" value={value || ''} onChange={onChange} aria-label="Goal (optional)">
      <option value="">No goal</option>
      {goals.map((g) => (
        <option key={g.id} value={g.id}>
          {g.title}
        </option>
      ))}
    </select>
  )
}
