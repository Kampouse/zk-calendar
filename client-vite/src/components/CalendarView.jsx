import { useState } from 'react'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8) // 8am-9pm

// Your personal calendar — events you can see (nobody else can)
const MY_EVENTS = [
  { hour: 9, duration: 1, title: 'Team standup', type: 'busy' },
  { hour: 10, duration: 1, title: '1:1 with Sarah', type: 'busy' },
  { hour: 12, duration: 1, title: 'Lunch w/ investor', type: 'busy' },
  { hour: 15, duration: 1, title: 'Sprint review', type: 'busy' },
  { hour: 17, duration: 1, title: 'Design sync', type: 'busy' },
]

// Which groups you've submitted proofs for on this day
const SUBMITTED_PROOFS = [
  { group: 'Team Standup', hour: 8, duration: 1, expires: '18h 23m' },
  { group: 'Design Review', hour: 14, duration: 1, expires: '14h 45m' },
]

export default function CalendarView({ onProve }) {
  const [selectedHour, setSelectedHour] = useState(null)
  const [events, setEvents] = useState(MY_EVENTS)
  const [date] = useState(new Date())

  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  function toggleSlot(hour) {
    const existing = events.find(e => e.hour === hour)
    if (existing) {
      setEvents(events.filter(e => e.hour !== hour))
    } else {
      setEvents([...events, { hour, duration: 1, title: 'Busy', type: 'busy' }])
    }
  }

  function getSlotState(hour) {
    const event = events.find(e => hour >= e.hour && hour < e.hour + e.duration)
    const proof = SUBMITTED_PROOFS.find(p => hour >= p.hour && hour < p.hour + p.duration)
    if (event && proof) return 'both'
    if (event) return 'busy'
    if (proof) return 'proven'
    return 'free'
  }

  const busyCount = events.length
  const freeSlots = HOURS.filter(h => !events.some(e => h >= e.hour && h < e.hour + e.duration))

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">

          {/* Day header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">{dayName}, {dateStr}</h2>
              <div className="text-xs text-gray-500 mt-0.5">Your private calendar · only you see event titles</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-3 text-[10px]">
                <Legend color="bg-dark-500" label="Busy" />
                <Legend color="bg-em-500/25 border border-em-500/50" label="Free" />
                <Legend color="bg-amber-500/30 border border-amber-500/50" label="ZK proven" />
              </div>
            </div>
          </div>

          {/* Time grid */}
          <div className="glass rounded-xl p-4">
            <div className="space-y-0.5">
              {HOURS.map(hour => {
                const event = events.find(e => hour >= e.hour && hour < e.hour + e.duration)
                const proof = SUBMITTED_PROOFS.find(p => hour >= p.hour && hour < p.hour + p.duration)
                const state = getSlotState(hour)
                const isSelected = selectedHour === hour
                const timeLabel = hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour-12}pm`

                return (
                  <div key={hour}
                    className={`group/slot relative flex items-center gap-3 py-1.5 px-2 rounded-lg cursor-pointer transition ${
                      isSelected ? 'ring-1 ring-em-500/50 bg-em-500/5' : 'hover:bg-dark-700/30'
                    }`}
                    onClick={() => setSelectedHour(hour)}>
                    {/* Time label */}
                    <span className={`text-[11px] mono w-10 shrink-0 ${
                      event ? 'text-gray-500' : 'text-em-600'
                    }`}>
                      {timeLabel}
                    </span>

                    {/* Slot bar */}
                    <div className="flex-1 h-8 rounded-md overflow-hidden relative">
                      {state === 'busy' && (
                        <div className="absolute inset-0 bg-dark-500/80 flex items-center px-3">
                          <div className="w-1 h-1 rounded-full bg-gray-500 shrink-0" />
                          <span className="text-[10px] text-gray-400 blur-[3px] select-none ml-2">{event?.title}</span>
                          <span className="ml-auto text-[8px] mono text-gray-600">BUSY</span>
                        </div>
                      )}
                      {state === 'proven' && (
                        <div className="absolute inset-0 bg-amber-500/10 border border-amber-500/30 flex items-center px-3">
                          <ShieldIcon className="w-3 h-3 text-amber-500/70 shrink-0" />
                          <span className="text-[10px] text-amber-400 ml-2">Proof submitted · {proof.group}</span>
                          <span className="ml-auto text-[8px] mono text-amber-600">⚡ {proof.expires}</span>
                        </div>
                      )}
                      {state === 'both' && (
                        <div className="absolute inset-0 bg-dark-500/80 flex items-center px-3">
                          <div className="w-1 h-1 rounded-full bg-gray-500 shrink-0" />
                          <span className="text-[10px] text-gray-400 blur-[3px] select-none ml-2">{event?.title}</span>
                          <ShieldIcon className="w-3 h-3 text-amber-500/70 ml-2 shrink-0" />
                          <span className="ml-auto text-[8px] mono text-amber-600">⚡ {proof.expires}</span>
                        </div>
                      )}
                      {state === 'free' && (
                        <div className="absolute inset-0 bg-em-500/8 border border-em-500/15 flex items-center px-3 hover:bg-em-500/15 transition">
                          <div className="w-1.5 h-1.5 rounded-full bg-em-500/40 shrink-0" />
                          <span className="text-[10px] text-em-600 ml-2">Available — click to mark busy, or prove free</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="opacity-0 group-hover/slot:opacity-100 transition flex items-center gap-1 shrink-0">
                      {state === 'free' && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); toggleSlot(hour) }}
                            className="text-[9px] text-gray-500 hover:text-white bg-dark-600 hover:bg-dark-500 px-1.5 py-0.5 rounded transition">
                            Mark busy
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); onProve({ hour, duration: 1 }) }}
                            className="text-[9px] text-em-400 hover:text-em-300 bg-em-500/10 hover:bg-em-500/20 px-1.5 py-0.5 rounded transition">
                            Prove
                          </button>
                        </>
                      )}
                      {state === 'busy' && (
                        <button onClick={(e) => { e.stopPropagation(); toggleSlot(hour) }}
                          className="text-[9px] text-gray-500 hover:text-white bg-dark-600 hover:bg-dark-500 px-1.5 py-0.5 rounded transition">
                          Clear
                        </button>
                      )}
                      {state === 'proven' && (
                        <button onClick={(e) => { e.stopPropagation(); onProve({ hour, duration: 1, group: proof.group }) }}
                          className="text-[9px] text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-1.5 py-0.5 rounded transition">
                          View proof
                          </button>
                      )}
                      {state === 'both' && (
                        <button onClick={(e) => { e.stopPropagation(); onProve({ hour, duration: 1, group: proof.group }) }}
                          className="text-[9px] text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-1.5 py-0.5 rounded transition">
                          View proof
                          </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Quick summary */}
            <div className="mt-4 pt-3 border-t border-dark-600/30 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-500">{busyCount} busy</span>
                <span className="text-xs text-em-600">{freeSlots.length} free slots</span>
              </div>
              <button onClick={() => onProve({ hour: freeSlots[0], duration: 1 })}
                className="text-xs text-em-400 hover:text-em-300 bg-em-500/10 hover:bg-em-500/15 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5">
                <LockIcon className="w-3.5 h-3.5" />
                Prove next free slot
              </button>
            </div>
          </div>

          {/* Proven slots summary */}
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldIcon className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-white">Proof History</h3>
              <span className="text-[10px] mono text-gray-500 ml-auto">Today · {SUBMITTED_PROOFS.length} proofs</span>
            </div>
            <div className="space-y-2">
              {SUBMITTED_PROOFS.map((p, i) => (
                <div key={i} className="flex items-center gap-3 bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs text-white">
                      {p.hour < 12 ? `${p.hour}:00 AM` : p.hour === 12 ? '12:00 PM' : `${p.hour-12}:00 PM`}
                      <span className="text-gray-500 ml-2">→ {p.group}</span>
                    </div>
                    <div className="text-[10px] text-gray-600">ZK proof submitted · expires in {p.expires}</div>
                  </div>
                  <button onClick={() => onProve({ hour: p.hour, duration: p.duration, group: p.group })}
                    className="text-[10px] text-amber-400 hover:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded transition">
                    View
                  </button>
                </div>
              ))}
            </div>

            {/* How it connects to Groups */}
            <div className="mt-3 pt-3 border-t border-dark-600/30">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">How it works</div>
              <div className="flex items-start gap-2">
                <div className="flex flex-col items-center gap-0.5 pt-0.5">
                  <div className="w-5 h-5 rounded-full bg-dark-600 flex items-center justify-center text-[9px] text-em-400 font-bold">1</div>
                  <div className="w-px h-3 bg-dark-500" />
                  <div className="w-5 h-5 rounded-full bg-dark-600 flex items-center justify-center text-[9px] text-em-400 font-bold">2</div>
                  <div className="w-px h-3 bg-dark-500" />
                  <div className="w-5 h-5 rounded-full bg-dark-600 flex items-center justify-center text-[9px] text-em-400 font-bold">3</div>
                </div>
                <div className="space-y-2">
                  <div className="text-[11px] text-gray-400">Mark busy slots on <span className="text-white">Calendar</span> — only you see titles</div>
                  <div className="text-[11px] text-gray-400">Submit ZK proofs to <span className="text-white">Groups</span> — they learn "free/not free" only</div>
                  <div className="text-[11px] text-gray-400">Group sees <span className="text-white">aggregate counts</span> — never who, never why</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Stats */}
        <div className="lg:col-span-2 space-y-4">
          {/* Today's breakdown */}
          <div className="glass rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Today's Breakdown</h3>
            <div className="space-y-2">
              <BreakdownBar label="Busy" count={busyCount} total={HOURS.length} color="bg-dark-500" />
              <BreakdownBar label="Free (provable)" count={freeSlots.length} total={HOURS.length} color="bg-em-500/40" />
              <BreakdownBar label="Proofs submitted" count={SUBMITTED_PROOFS.length} total={HOURS.length} color="bg-amber-500/40" />
            </div>
          </div>

          {/* Privacy guarantee */}
          <div className="glass rounded-xl p-4 border border-em-500/10">
            <div className="flex items-center gap-2 mb-3">
              <LockIcon className="w-4 h-4 text-em-400" />
              <h3 className="text-sm font-semibold text-white">Privacy Guarantee</h3>
            </div>
            <div className="space-y-2">
              <PrivacyItem icon="✓" text="Event titles never leave your device" color="em" />
              <PrivacyItem icon="✓" text="Only 'free/busy' state is provable" color="em" />
              <PrivacyItem icon="✓" text="Groups see counts, not identities" color="em" />
              <PrivacyItem icon="✕" text="No one sees your actual calendar" color="em" />
              <PrivacyItem icon="✕" text="No server stores your schedule" color="em" />
            </div>
          </div>

          {/* Quick actions */}
          <div className="glass rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Quick Actions</h3>
            <div className="space-y-1.5">
              <button onClick={() => onProve({ hour: freeSlots[0], duration: 1 })}
                className="w-full bg-em-600 hover:bg-em-500 transition text-white text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-2">
                <LockIcon className="w-4 h-4" /> Prove free at {freeSlots[0] < 12 ? `${freeSlots[0]}am` : freeSlots[0] === 12 ? '12pm' : `${freeSlots[0]-12}pm`}
              </button>
              <button onClick={() => onProve({ hour: freeSlots[0], duration: 2 })}
                className="w-full bg-dark-600 hover:bg-dark-500 transition text-white text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-2">
                Prove 2h block starting {freeSlots[0] < 12 ? `${freeSlots[0]}am` : freeSlots[0] === 12 ? '12pm' : `${freeSlots[0]-12}pm`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function BreakdownBar({ label, count, total, color }) {
  const pct = Math.round((count / total) * 100)
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-gray-500">{label}</span>
        <span className="text-[10px] mono text-gray-400">{count}/{total} · {pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-dark-700 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function PrivacyItem({ icon, text, color }) {
  const isGreen = icon === '✓'
  return (
    <div className="flex items-center gap-2">
      <span className={`text-[11px] ${isGreen ? 'text-em-500' : 'text-em-600'}`}>{icon}</span>
      <span className="text-xs text-gray-400">{text}</span>
    </div>
  )
}

function Legend({ color, label }) {
  return <div className="flex items-center gap-1"><div className={`w-2 h-2 rounded ${color}`} />{label}</div>
}

function LockIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
}

function ShieldIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
}