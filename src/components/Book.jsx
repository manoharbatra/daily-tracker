// The diary paper every section is written on.
export default function Book({ children }) {
  return (
    <div className="book">
      <div className="paper">{children}</div>
    </div>
  )
}
