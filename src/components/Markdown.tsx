import ReactMarkdown from 'react-markdown'

// Reflections, takeaways, and next steps are stored as markdown. Keep rendering
// minimal and readable. No raw HTML is allowed through.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  )
}
