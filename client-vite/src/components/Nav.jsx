export default function Nav({ onVerify }) {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 glass border-b border-dark-600/50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-em-500/20 flex items-center justify-center">
            <LockIcon className="w-4 h-4 text-em-400" />
          </div>
          <span className="font-semibold text-white tracking-tight">zk-calendar</span>
          <span className="text-[10px] mono bg-em-500/15 text-em-400 px-1.5 py-0.5 rounded">v0.3</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onVerify} className="text-xs text-gray-400 hover:text-white transition px-2 py-1 rounded hover:bg-dark-600">
            Verify Proof
          </button>
          <button className="flex items-center gap-2 bg-em-600 hover:bg-em-500 transition text-white text-sm font-medium px-4 py-1.5 rounded-lg">
            <BoltIcon className="w-3.5 h-3.5" />
            Connect Wallet
          </button>
        </div>
      </div>
    </nav>
  )
}

function LockIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}

function BoltIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
}