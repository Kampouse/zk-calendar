export default function Toast({ toasts }) {
  if (!toasts.length) return null
  return (
    <div className="fixed top-20 right-4 z-[60] flex flex-col gap-2">
      {toasts.map(t => (
        <div key={t.id} className="toast-in glass rounded-lg px-4 py-2 text-sm text-white flex items-center gap-2">
          <svg className="w-4 h-4 text-em-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {t.msg}
        </div>
      ))}
    </div>
  )
}