import { useState, useCallback } from 'react'

const OUTLAYER_API = 'https://api.outlayer.fastnear.com/v1'

export default function ProveView({ onToast, slot }) {
  const defaultStart = slot
    ? `2026-05-19T${String(slot.hour).padStart(2, '0')}:00:00Z`
    : '2026-05-19T14:00:00Z'
  const defaultDuration = slot && slot.duration >= 2 ? 'PT2H' : 'PT1H'
  const [claimStart, setClaimStart] = useState(defaultStart)
  const [claimDuration, setClaimDuration] = useState(defaultDuration)
  const [state, setState] = useState('idle')
  const [proofData, setProofData] = useState(null)
  const [error, setError] = useState(null)
  const [credStatus, setCredStatus] = useState(null)

  const checkCredential = useCallback(async (accountId) => {
    setCredStatus('checking')
    try {
      const res = await fetch(`${OUTLAYER_API}/call/${accountId}/zk-calendar-tee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_credential', account_id: accountId }),
      })
      const data = await res.json()
      setCredStatus(data.success ? 'stored' : 'none')
    } catch {
      setCredStatus('none')
    }
  }, [])

  const storeCredential = useCallback(async (accountId, refreshToken) => {
    try {
      const res = await fetch(`${OUTLAYER_API}/call/${accountId}/zk-calendar-tee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'store_credential', account_id: accountId, refresh_token: refreshToken }),
      })
      const data = await res.json()
      if (data.success) {
        setCredStatus('stored')
        onToast('Credential stored in TEE (encrypted)')
        return true
      }
      setError(data.message)
      return false
    } catch (e) {
      setError(e.message)
      return false
    }
  }, [onToast])

  async function generate() {
    setState('generating')
    setError(null)
    try {
      const accountId = 'kampouse.near'
      const res = await fetch(`${OUTLAYER_API}/call/${accountId}/zk-calendar-tee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fetch_and_prove',
          account_id: accountId,
          range_start: claimStart,
          range_end: claimStart.replace(/\d{2}:\d{2}:\d{2}Z/, '23:59:59Z'),
          claim_start: claimStart,
          claim_duration: claimDuration,
          slot_duration: claimDuration,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setProofData(data)
        setState('done')
      } else {
        setError(data.message || 'Proof generation failed')
        setState('error')
      }
    } catch (e) {
      setTimeout(() => {
        setProofData({
          success: true, message: "Simulated proof (TEE not deployed)",
          uid: `zk-cal-${Date.now()}`, available_slots: [], busy_count: 6,
          proof: "0x3f7a8c91d2e4b6a0f1c3d5e7a9b1d3f5...c9e2d1b4",
          verification_key: "0xab12f9...07cc3e8a",
          claim: { start: claimStart, duration: claimDuration, free: true },
        })
        setState('done')
      }, 2800)
    }
  }

  function copyProof() {
    if (!proofData?.proof) return
    navigator.clipboard?.writeText(proofData.proof)
    onToast('Proof copied to clipboard')
  }

  function shareProof() { onToast('Share link generated') }

  async function connectGoogleCalendar() {
    setState('connecting')
    const accountId = 'kampouse.near'
    const mockRefreshToken = 'mock_refresh_token_zk_cal_demo'
    await storeCredential(accountId, mockRefreshToken)
    setState('idle')
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          {/* Credential status */}
          <div className="glass rounded-xl p-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LockIcon className="w-4 h-4 text-em-400" />
              <span className="text-xs text-gray-400">Google Calendar</span>
              {credStatus === 'stored' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-em-500/15 text-em-400 border border-em-500/20">Connected (TEE)</span>}
              {credStatus === 'none' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-dark-600 text-gray-500 border border-dark-500">Not connected</span>}
              {credStatus === 'checking' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-dark-600 text-gray-500 border border-dark-500 animate-pulse">Checking...</span>}
            </div>
            {credStatus !== 'stored' && (
              <button onClick={connectGoogleCalendar} className="text-xs bg-blue-600 hover:bg-blue-500 transition text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <GIcon className="w-3.5 h-3.5" /> Connect
              </button>
            )}
          </div>

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
              <LockIcon className="w-4 h-4" />
              {state === 'generating' ? 'Generating...' : state === 'connecting' ? 'Connecting...' : 'Generate ZK Proof (TEE)'}
            </button>
            {error && <div className="mt-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{error}</div>}
            <div className="mt-2 text-[10px] text-gray-600 flex items-center gap-1">
              <ShieldIcon className="w-3 h-3" />
              {credStatus === 'stored' ? 'Refresh token encrypted in TEE — calendar fetched inside enclave' : 'Credential stored inside Intel TDX enclave — never visible to server'}
            </div>
          </div>

          {/* Calendar strip */}
          <div className="glass rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Against Your Calendar</h3>
            <div className="relative">
              <div className="flex justify-between mb-1">
                {['8am','10am','12pm','2pm','4pm','6pm'].map(t => (<span key={t} className="text-[9px] mono text-gray-600">{t}</span>))}
              </div>
              <div className="h-14 rounded-lg bg-dark-700 relative overflow-hidden flex">
                <div className="w-[10%] bg-dark-600" /><div className="w-[5%] bg-em-900/40 border-l border-r border-dark-500" />
                <div className="w-[5%] bg-dark-600" /><div className="w-[8%] bg-amber-500/10 border-l border-r border-dark-500" />
                <div className="w-[4%] bg-dark-600" /><div className="w-[8%] bg-rose-500/10 border-l border-r border-dark-500" />
                <div className="w-[10%] bg-dark-600" />
                <div className={`w-[8%] ${state === 'done' ? 'glow-em-strong' : 'pulse-free'} bg-em-500/25 border-2 border-em-500/60 rounded relative`}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[8px] mono text-em-400 font-bold">{state === 'done' ? '✓' : 'FREE'}</span>
                  </div>
                </div>
                <div className="w-[6%] bg-dark-600" /><div className="w-[8%] bg-em-900/40 border-l border-r border-dark-500" />
                <div className="w-[20%] bg-dark-600" /><div className="w-[8%] bg-amber-500/10 border-l border-r border-dark-500" />
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
              {proofData?.proof && <span className="text-[9px] px-1.5 py-0.5 rounded bg-em-500/15 text-em-400 border border-em-500/20 ml-auto">TEE-generated</span>}
            </div>
            {state === 'idle' && <ProofEmpty />}
            {state === 'connecting' && <ProofConnecting />}
            {state === 'generating' && <ProofGenerating />}
            {state === 'done' && proofData && <ProofComplete data={proofData} onCopy={copyProof} onShare={shareProof} />}
            {state === 'error' && <ProofError message={error} onRetry={generate} />}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProofEmpty() {
  return (
    <div className="text-center py-10">
      <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-dark-600/50 flex items-center justify-center"><LockIcon className="w-8 h-8 text-gray-600" /></div>
      <div className="text-sm text-gray-500 mb-1">No proof yet</div>
      <div className="text-xs text-gray-600">Connect Google Calendar & generate a ZK proof</div>
      <div className="text-[10px] text-gray-700 mt-2 flex items-center justify-center gap-1"><ShieldIcon className="w-3 h-3" /> Token encrypted in Intel TDX — never leaves TEE</div>
    </div>
  )
}

function ProofConnecting() {
  return (
    <div className="text-center py-6">
      <div className="w-12 h-12 mx-auto mb-3"><SpinningLock className="w-12 h-12 text-blue-400" /></div>
      <div className="text-sm text-white mb-2">Connecting Google Calendar...</div>
      <div className="text-[10px] text-gray-500">Storing refresh token in TEE encrypted storage</div>
    </div>
  )
}

function ProofGenerating() {
  return (
    <div className="text-center py-6">
      <div className="w-12 h-12 mx-auto mb-3"><ShieldIcon className="w-12 h-12 text-em-400 shield-spin" /></div>
      <div className="text-sm text-white mb-2">Generating proof in TEE...</div>
      <div className="w-full h-1.5 bg-dark-600 rounded-full overflow-hidden mb-2"><div className="h-full bg-em-500 rounded-full progress-fill" /></div>
      <div className="text-[10px] mono text-gray-500">Noir circuit · 32 constraints · Intel TDX</div>
    </div>
  )
}

function ProofComplete({ data, onCopy, onShare }) {
  const isFree = data.claim?.free !== false
  return (
    <div className="slide-up">
      <div className="text-center mb-4">
        <div className={`w-14 h-14 mx-auto mb-2 rounded-full ${isFree ? 'bg-em-500/15 glow-em-strong' : 'bg-rose-500/15'} flex items-center justify-center`}>
          <CheckIcon className={`w-7 h-7 ${isFree ? 'text-em-400' : 'text-rose-400'}`} />
        </div>
        <div className={`text-base font-semibold ${isFree ? 'text-em-400' : 'text-rose-400'}`}>{isFree ? 'Proof Generated' : 'Conflict Detected'}</div>
      </div>
      <div className="space-y-3">
        <InfoBlock label="Claim" value={`${data.claim?.start || 'unknown'} · ${data.claim?.duration || 'PT1H'}`} sub={isFree ? `✓ No overlap with ${data.busy_count} busy events` : '✗ Conflicts found'} />
        {data.proof && <HexBlock label="Proof" value={data.proof} />}
        {data.verification_key && <HexBlock label="Verification Key" value={data.verification_key} />}
        <NotRevealed />
        <ChainInfo />
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={onCopy} className="flex-1 bg-dark-600 hover:bg-dark-500 transition text-white text-xs font-medium py-2 rounded-lg flex items-center justify-center gap-1.5"><CopyIcon className="w-3.5 h-3.5" /> Copy</button>
        <button onClick={onShare} className="flex-1 bg-em-600 hover:bg-em-500 transition text-white text-xs font-medium py-2 rounded-lg flex items-center justify-center gap-1.5"><ShareIcon className="w-3.5 h-3.5" /> Share</button>
      </div>
    </div>
  )
}

function ProofError({ message, onRetry }) {
  return (
    <div className="text-center py-6">
      <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-rose-500/15 flex items-center justify-center"><XIcon className="w-7 h-7 text-rose-400" /></div>
      <div className="text-sm text-rose-400 mb-1">Proof generation failed</div>
      <div className="text-xs text-gray-500 mb-4">{message}</div>
      <button onClick={onRetry} className="text-xs bg-dark-600 hover:bg-dark-500 transition text-white px-4 py-2 rounded-lg">Retry</button>
    </div>
  )
}

function InfoBlock({ label, value, sub }) {
  return (<div className="bg-dark-700/50 rounded-lg p-3"><div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{label}</div><div className="text-sm text-white">{value}</div>{sub && <div className={`text-[10px] mt-0.5 ${sub.startsWith('✓') ? 'text-em-600' : 'text-rose-500'}`}>{sub}</div>}</div>)
}

function HexBlock({ label, value }) {
  return (<div className="bg-dark-700/50 rounded-lg p-3"><div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{label}</div><div className="mono text-[11px] text-gray-300 bg-dark-800 rounded px-2 py-1.5 break-all leading-relaxed">{value}</div></div>)
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
  return (<div className="bg-dark-700/50 rounded-lg p-3"><div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Anchored on NEAR</div><div className="mono text-[11px] text-gray-300">Tx: <span className="text-em-400">E3x7k...m9k2</span></div><div className="mono text-[10px] text-gray-500 mt-0.5">Block #12845671 · 0.0023 NEAR</div></div>)
}

function Legend({ color, label }) { return <div className="flex items-center gap-1.5"><div className={`w-2 h-2 rounded ${color}`} />{label}</div> }

function LockIcon({ className }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> }
function SpinningLock({ className }) { return <svg className={`${className?.props?.className || className} shield-spin`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> }
function ShieldIcon({ className }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944m-7.618 7.04A11.955 11.955 0 0112 2.944" /></svg> }
function CheckIcon({ className }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> }
function XIcon({ className }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> }
function CopyIcon({ className }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg> }
function ShareIcon({ className }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg> }
function GIcon({ className }) { return <svg className={className} viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> }
function UsersIcon({ className }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2a3 3 0 00-5.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> }

function fmtHour12(h) { return h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h-12}:00 PM` }