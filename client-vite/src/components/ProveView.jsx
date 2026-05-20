import { useState } from 'react'

export default function ProveView({ onToast, slot }) {
  // Pre-fill from slot data if passed from Groups tab
  const defaultStart = slot
    ? `2026-05-19T${String(slot.hour).padStart(2, '0')}:00:00Z`
    : '2026-05-19T14:00:00Z'
  const defaultDuration = slot && slot.duration >= 2 ? 'PT2H' : 'PT1H'
  const [claimStart, setClaimStart] = useState(defaultStart)
  const [claimDuration, setClaimDuration] = useState(defaultDuration)
  const [state, setState] = useState('idle') // idle | generating | done

  function generate() {
    setState('generating')
    setTimeout(() => setState('done'), 2800)
  }

  function copyProof() {
    navigator.clipboard?.writeText('0x3f7a8c91d2e4b6a0f1c3d5e7a9b1d3f5...c9e2d1b4')
    onToast('Proof copied to clipboard')
  }

  function shareProof() {
    onToast('Share link generated')
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          {/* Claim config */}
          <div className="glass rounded-xl p-5 mb-4 glow-em">
            <div className="flex items-center gap-2 mb-4">
              <ShieldIcon className="w-5 h-5 text-em-400" />
              <h2 className="text-base font-semibold text-white">Prove Availability</h2>
            </div>
            {slot && slot.group && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-em-500/8 border border-em-500/15 text-xs text-em-400 flex items-center gap-1.5">
                <UsersIcon className="w-3.5 h-3.5" />
                For <span className="font-medium">{slot.group}</span> · {fmtHour12(slot.hour)}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-500 block mb-1">Claim start</label>
                <input type="text" value={claimStart} onChange={e => setClaimStart(e.target.value)}
                  className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-xs mono text-white focus:border-em-500 focus:outline-none transition" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-500 block mb-1">Claim duration</label>
                <select value={claimDuration} onChange={e => setClaimDuration(e.target.value)}
                  className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-xs mono text-white focus:border-em-500 focus:outline-none transition appearance-none">
                  <option>PT30M</option><option>PT1H</option><option>PT2H</option>
                </select>
              </div>
            </div>
            <button onClick={generate} disabled={state === 'generating'}
              className={`w-full transition text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 ${state === 'generating' ? 'bg-em-700 opacity-50' : 'bg-em-600 hover:bg-em-500'}`}>
              <LockIcon className="w-4 h-4" /> Generate ZK Proof
            </button>
          </div>

          {/* Calendar strip */}
          <div className="glass rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Against Your Calendar</h3>
            <div className="relative">
              <div className="flex justify-between mb-1">
                {['8am','10am','12pm','2pm','4pm','6pm'].map(t => (
                  <span key={t} className="text-[9px] mono text-gray-600">{t}</span>
                ))}
              </div>
              <div className="h-14 rounded-lg bg-dark-700 relative overflow-hidden flex">
                <div className="w-[10%] bg-dark-600" />
                <div className="w-[5%] bg-em-900/40 border-l border-r border-dark-500" />
                <div className="w-[5%] bg-dark-600" />
                <div className="w-[8%] bg-amber-500/10 border-l border-r border-dark-500" />
                <div className="w-[4%] bg-dark-600" />
                <div className="w-[8%] bg-rose-500/10 border-l border-r border-dark-500" />
                <div className="w-[10%] bg-dark-600" />
                <div className={`w-[8%] ${state === 'done' ? 'glow-em-strong' : 'pulse-free'} bg-em-500/25 border-2 border-em-500/60 rounded relative`}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[8px] mono text-em-400 font-bold">{state === 'done' ? '✓' : 'FREE'}</span>
                  </div>
                </div>
                <div className="w-[6%] bg-dark-600" />
                <div className="w-[8%] bg-em-900/40 border-l border-r border-dark-500" />
                <div className="w-[20%] bg-dark-600" />
                <div className="w-[8%] bg-amber-500/10 border-l border-r border-dark-500" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-4 text-[10px] text-gray-500">
              <Legend color="bg-em-900/40" label="Busy" />
              <Legend color="bg-amber-500/10" label="Tentative" />
              <Legend color="bg-rose-500/10" label="Priority" />
              <Legend color="border border-em-500/60 bg-em-500/25" label="Claim" />
            </div>
          </div>
        </div>

        {/* Proof output */}
        <div className="lg:col-span-2">
          <div className="glass rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <LockIcon className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-white">Proof Output</h3>
            </div>

            {state === 'idle' && <ProofEmpty />}
            {state === 'generating' && <ProofGenerating />}
            {state === 'done' && <ProofComplete onCopy={copyProof} onShare={shareProof} />}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProofEmpty() {
  return (
    <div className="text-center py-10">
      <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-dark-600/50 flex items-center justify-center">
        <LockIcon className="w-8 h-8 text-gray-600" />
      </div>
      <div className="text-sm text-gray-500 mb-1">No proof yet</div>
      <div className="text-xs text-gray-600">Click "Generate ZK Proof" to start</div>
    </div>
  )
}

function ProofGenerating() {
  return (
    <div className="text-center py-6">
      <div className="w-12 h-12 mx-auto mb-3">
        <ShieldIcon className="w-12 h-12 text-em-400 shield-spin" />
      </div>
      <div className="text-sm text-white mb-2">Generating proof...</div>
      <div className="w-full h-1.5 bg-dark-600 rounded-full overflow-hidden mb-2">
        <div className="h-full bg-em-500 rounded-full progress-fill" />
      </div>
      <div className="text-[10px] mono text-gray-500">Noir circuit · 32 constraints</div>
    </div>
  )
}

function ProofComplete({ onCopy, onShare }) {
  return (
    <div className="slide-up">
      <div className="text-center mb-4">
        <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-em-500/15 flex items-center justify-center glow-em-strong">
          <CheckIcon className="w-7 h-7 text-em-400" />
        </div>
        <div className="text-base font-semibold text-em-400">Proof Generated</div>
      </div>
      <div className="space-y-3">
        <InfoBlock label="Claim" value="2026-05-19 · 2:00 — 3:00 PM" sub="✓ No overlap with 6 busy events" />
        <HexBlock label="Proof" value="0x3f7a8c...c9e2d1b4" />
        <HexBlock label="Verification Key" value="0xab12f9...07cc3e8a" />
        <NotRevealed />
        <ChainInfo />
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={onCopy} className="flex-1 bg-dark-600 hover:bg-dark-500 transition text-white text-xs font-medium py-2 rounded-lg flex items-center justify-center gap-1.5">
          <CopyIcon className="w-3.5 h-3.5" /> Copy
        </button>
        <button onClick={onShare} className="flex-1 bg-em-600 hover:bg-em-500 transition text-white text-xs font-medium py-2 rounded-lg flex items-center justify-center gap-1.5">
          <ShareIcon className="w-3.5 h-3.5" /> Share
        </button>
      </div>
    </div>
  )
}

function InfoBlock({ label, value, sub }) {
  return (
    <div className="bg-dark-700/50 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{label}</div>
      <div className="text-sm text-white">{value}</div>
      {sub && <div className="text-[10px] text-em-600 mt-0.5">{sub}</div>}
    </div>
  )
}

function HexBlock({ label, value }) {
  return (
    <div className="bg-dark-700/50 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{label}</div>
      <div className="mono text-[11px] text-gray-300 bg-dark-800 rounded px-2 py-1.5 break-all leading-relaxed">{value}</div>
    </div>
  )
}

function NotRevealed() {
  return (
    <div className="bg-dark-700/50 rounded-lg p-3 border border-em-500/10">
      <div className="text-[10px] uppercase tracking-wider text-em-600 mb-2">🛡 Not Revealed</div>
      <ul className="text-xs text-gray-400 space-y-1">
        <li className="flex items-center gap-1.5"><span className="text-em-600">✕</span> Event titles & descriptions</li>
        <li className="flex items-center gap-1.5"><span className="text-em-600">✕</span> Locations & attendees</li>
        <li className="flex items-center gap-1.5"><span className="text-em-600">✕</span> Other time slots</li>
        <li className="flex items-center gap-1.5"><span className="text-em-600">✕</span> Calendar contents</li>
      </ul>
    </div>
  )
}

function ChainInfo() {
  return (
    <div className="bg-dark-700/50 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Anchored on NEAR</div>
      <div className="mono text-[11px] text-gray-300">Tx: <span className="text-em-400">E3x7k...m9k2</span></div>
      <div className="mono text-[10px] text-gray-500 mt-0.5">Block #12845671 · 0.0023 NEAR</div>
    </div>
  )
}

function Legend({ color, label }) {
  return <div className="flex items-center gap-1.5"><div className={`w-2 h-2 rounded ${color}`} />{label}</div>
}

function LockIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
}
function ShieldIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944m-7.618 7.04A11.955 11.955 0 0112 2.944" /></svg>
}
function CheckIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
}
function CopyIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
}
function ShareIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
}

function fmtHour12(h) { return h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h-12}:00 PM` }

function UsersIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2a3 3 0 00-5.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
}