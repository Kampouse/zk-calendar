import { useState } from 'react'

export default function VerifyOverlay({ onClose }) {
  const [input, setInput] = useState('')
  const [state, setState] = useState('idle') // idle | verifying | done

  function verify() {
    setState('verifying')
    setTimeout(() => setState('done'), 1500)
  }

  return (
    <div className="fixed inset-0 z-50 fade-in">
      <div className="absolute inset-0 bg-dark-900/90 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-6 max-w-md w-full glow-em-strong slide-up">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-white">Verify Proof</h2>
            <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-dark-600 flex items-center justify-center text-gray-400 hover:text-white transition">
              <CloseIcon />
            </button>
          </div>

          <div className="mb-4">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 block mb-1">Paste proof or link</label>
            <textarea rows={3} value={input} onChange={e => setInput(e.target.value)}
              className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-xs mono text-white focus:border-em-500 focus:outline-none transition resize-none"
              placeholder="0x3f7a8c...c9e2d1b4 or https://..." />
          </div>

          <button onClick={verify} disabled={state === 'verifying'}
            className={`w-full transition text-white text-sm font-medium py-2.5 rounded-lg mb-4 ${state === 'verifying' ? 'bg-em-700 opacity-50' : 'bg-em-600 hover:bg-em-500'}`}>
            {state === 'verifying' ? 'Verifying...' : 'Verify'}
          </button>

          {state === 'done' && (
            <div className="slide-up">
              <div className="text-center mb-4">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-em-500/15 flex items-center justify-center glow-em-strong">
                  <CheckIcon className="w-8 h-8 text-em-400" />
                </div>
                <div className="text-xl font-bold text-em-400">✓ VALID</div>
              </div>
              <div className="space-y-2">
                <div className="bg-dark-700/50 rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Claimed Free Slot</div>
                  <div className="text-sm text-white">Mon May 19 · 2:00 — 3:00 PM</div>
                </div>
                <div className="bg-dark-700/50 rounded-lg p-3 border border-em-500/10">
                  <div className="text-[10px] uppercase tracking-wider text-em-600 mb-2">🛡 What was NOT revealed</div>
                  <ul className="text-xs text-gray-400 space-y-1">
                    <li>✕ Number of events on calendar</li>
                    <li>✕ Event titles, locations, attendees</li>
                    <li>✕ Any other time slots</li>
                  </ul>
                </div>
                <div className="bg-dark-700/50 rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Verified by</div>
                  <div className="mono text-xs text-em-400">outlayer.kampouse.near</div>
                  <div className="mono text-[10px] text-gray-500 mt-0.5">Prover: kampouse.near</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CloseIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
}
function CheckIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
}