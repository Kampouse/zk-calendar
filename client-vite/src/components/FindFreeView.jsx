import { useState, useMemo } from 'react'

const HOURS_BUSINESS = Array.from({ length: 14 }, (_, i) => i + 8) // 8am-9pm
const HOURS_FULL = Array.from({ length: 24 }, (_, i) => i)

const MOCK_GROUPS = [
  { id: 'team-standup', name: 'Team Standup', members: 5, submitted: 3, yourRole: 'member' },
  { id: 'design-review', name: 'Design Review', members: 3, submitted: 1, yourRole: 'member' },
  { id: 'sprint-plan', name: 'Sprint Planning', members: 8, submitted: 6, yourRole: 'admin' },
]

const MOCK_AVAILABILITY = {
  'team-standup': [1,1,0,0,0,0,1,3,5,5,4,3,1,1,0,0,0,0,1,2,4,4,5,5],
  'design-review': [0,0,0,0,0,0,0,1,2,3,3,3,3,2,1,1,0,0,0,0,0,0,0,0],
  'sprint-plan': [1,1,0,0,0,0,0,1,3,5,7,8,8,7,6,5,3,2,1,0,0,0,0,1],
}

const YOUR_BUSY = [9,10,12,13,15,16,17]
const PROOF_EXPIRY_HOURS = 24

function getTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch { return 'UTC' }
}

function fmtHour(h) { return h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h-12}pm` }
function fmtHour12(h) { return h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h-12}:00 PM` }

export default function FindFreeView({ onProve }) {
  const [joinedGroups, setJoinedGroups] = useState(['team-standup'])
  const [activeGroup, setActiveGroup] = useState('team-standup')
  const [showJoin, setShowJoin] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [availData, setAvailData] = useState(null)
  const [showFullDay, setShowFullDay] = useState(false)
  const [threshold, setThreshold] = useState(1)
  const [proofExpiry, setProofExpiry] = useState(null) // timestamp when proof expires
  const [timeLeft, setTimeLeft] = useState(null) // string like "18h 23m"
  const [customGroups, setCustomGroups] = useState([])

  const group = [...MOCK_GROUPS, ...customGroups].find(g => g.id === activeGroup)
  const hours = showFullDay ? HOURS_FULL : HOURS_BUSINESS
  const tz = useMemo(() => getTimezone(), [])

  // Countdown timer
  useState(() => {
    if (!proofExpiry) return
    const interval = setInterval(() => {
      const diff = proofExpiry - Date.now()
      if (diff <= 0) {
        setProofExpiry(null)
        setTimeLeft('Expired')
        clearInterval(interval)
        return
      }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setTimeLeft(`${h}h ${m}m`)
    }, 10000) // update every 10s
    return () => clearInterval(interval)
  }, [proofExpiry])

  function handleSubmitAvailability() {
    setSubmitted(true)
    setProofExpiry(Date.now() + PROOF_EXPIRY_HOURS * 3600000)
    setTimeLeft(`${PROOF_EXPIRY_HOURS}h 0m`)
    const baseAvail = MOCK_AVAILABILITY[activeGroup] || HOURS_FULL.map(() => Math.floor(Math.random() * (group?.members || 3)))
    setAvailData(baseAvail)
  }

  function handleJoinGroup(groupId) {
    if (!joinedGroups.includes(groupId)) {
      setJoinedGroups([...joinedGroups, groupId])
    }
    setActiveGroup(groupId)
    setSubmitted(false)
    setAvailData(null)
    setShowJoin(false)
  }

  function handleLeaveGroup(groupId) {
    if (groupId === activeGroup) {
      const remaining = joinedGroups.filter(g => g !== groupId)
      setActiveGroup(remaining[0] || '')
      setAvailData(null)
      setSubmitted(false)
    }
    setJoinedGroups(joinedGroups.filter(g => g !== groupId))
  }

  function handleCreateGroup() {
    if (!createName.trim()) return
    const id = 'grp-' + createName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const newGroup = { id, name: createName.trim(), members: 1, submitted: 1, yourRole: 'admin' }
    setCustomGroups([...customGroups, newGroup])
    setJoinedGroups([...joinedGroups, id])
    setActiveGroup(id)
    setCreateName('')
    setShowCreate(false)
    setShowJoin(false)
    setSubmitted(false)
    setAvailData(null)
  }

  function handleSlotClick(hour) {
    if (YOUR_BUSY.includes(hour)) return
    onProve({ hour, duration: 1, group: group?.name })
  }

  const maxAvail = availData ? Math.max(...availData) : 0
  const totalMembers = group?.members || 1

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">

          {/* Group Selector */}
          <div className="glass rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">Your Groups</h2>
              <div className="flex gap-2">
                <button onClick={() => setShowCreate(!showCreate)}
                  className="text-xs text-em-400 hover:text-em-300 transition px-2 py-1 rounded hover:bg-em-500/10">
                  + New Group
                </button>
                <button onClick={() => setShowJoin(!showJoin)}
                  className="text-xs text-gray-400 hover:text-white transition px-2 py-1 rounded hover:bg-dark-600">
                  Join
                </button>
              </div>
            </div>

            {/* Create Group */}
            {showCreate && (
              <div className="mb-4 bg-dark-700/50 rounded-lg p-3 slide-up">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Create a Group</div>
                <div className="flex gap-2">
                  <input type="text" value={createName} onChange={e => setCreateName(e.target.value)}
                    placeholder="Group name..."
                    className="flex-1 bg-dark-800 border border-dark-500 rounded-lg px-3 py-1.5 text-sm text-white focus:border-em-500 focus:outline-none transition placeholder:text-gray-600"
                    onKeyDown={e => e.key === 'Enter' && handleCreateGroup()} />
                  <button onClick={handleCreateGroup}
                    className="bg-em-600 hover:bg-em-500 transition text-white text-xs font-medium px-4 py-1.5 rounded-lg">
                    Create
                  </button>
                </div>
                <div className="text-[10px] text-gray-500 mt-1.5">You'll be admin. Share the invite link with others.</div>
              </div>
            )}

            {/* Join Group */}
            {showJoin && (
              <div className="mb-4 bg-dark-700/50 rounded-lg p-3 slide-up">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Available Groups</div>
                <div className="space-y-1.5">
                  {[...MOCK_GROUPS, ...customGroups].filter(g => !joinedGroups.includes(g.id)).map(g => (
                    <div key={g.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-dark-600/50 transition">
                      <div>
                        <span className="text-sm text-white">{g.name}</span>
                        <span className="text-[10px] mono text-gray-500 ml-2">{g.members} members</span>
                      </div>
                      <button onClick={() => handleJoinGroup(g.id)}
                        className="text-[10px] text-em-400 hover:text-em-300 bg-em-500/10 px-2 py-0.5 rounded transition">
                        Join
                      </button>
                    </div>
                  ))}
                  {[...MOCK_GROUPS, ...customGroups].filter(g => !joinedGroups.includes(g.id)).length === 0 && (
                    <div className="text-xs text-gray-500 py-2">No more groups to join</div>
                  )}
                </div>
              </div>
            )}

            {/* Joined Groups */}
            <div className="space-y-1.5">
              {joinedGroups.map(gid => {
                const g = [...MOCK_GROUPS, ...customGroups].find(x => x.id === gid)
                if (!g) return null
                const isActive = gid === activeGroup
                return (
                  <div key={gid}
                    onClick={() => { setActiveGroup(gid); setSubmitted(false); setAvailData(null) }}
                    className={`flex items-center justify-between py-2.5 px-3 rounded-lg cursor-pointer transition ${
                      isActive ? 'bg-em-500/10 border border-em-500/20' : 'bg-dark-700/30 border border-transparent hover:bg-dark-600/30'
                    }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        isActive ? 'bg-em-500/20 text-em-400' : 'bg-dark-600 text-gray-400'
                      }`}>
                        <UsersIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className={`text-sm font-medium ${isActive ? 'text-em-400' : 'text-white'}`}>{g.name}</div>
                        <div className="text-[10px] mono text-gray-500">{g.members} members · {g.yourRole}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Anonymous proof status dots */}
                      <div className="flex -space-x-1">
                        {Array.from({ length: Math.min(g.members, 6) }).map((_, i) => (
                          <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 border-dark-900 ${
                            i < g.submitted ? 'bg-em-500' : 'bg-dark-500'
                          }`} title={i < g.submitted ? 'Submitted' : 'Pending'} />
                        ))}
                        {g.members > 6 && <span className="text-[8px] mono text-gray-600 ml-1">+{g.members - 6}</span>}
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleLeaveGroup(gid) }}
                        className="text-[10px] text-gray-500 hover:text-rose-400 transition px-1">
                        Leave
                      </button>
                    </div>
                  </div>
                )
              })}
              {joinedGroups.length === 0 && (
                <div className="text-center py-6 text-gray-500 text-sm">
                  No groups joined yet. Create or join a group to see availability.
                </div>
              )}
            </div>
          </div>

          {/* Submit Availability or Proof Expiry */}
          {activeGroup && !submitted && (
            <div className="glass rounded-xl p-5 glow-em">
              <div className="flex items-center gap-2 mb-3">
                <ShieldIcon className="w-5 h-5 text-em-400" />
                <h3 className="text-sm font-semibold text-white">Submit Your Availability</h3>
              </div>
              <p className="text-xs text-gray-400 mb-4">
                Your calendar data stays private. A ZK proof is submitted to the group — members only learn which slots you're free, not what you're busy with or why.
              </p>
              <div className="bg-dark-700/50 rounded-lg p-3 mb-4">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Your calendar (local only) · <TZLabel tz={tz} /></div>
                <div className="flex gap-px">
                  {hours.map(h => {
                    const isBusy = YOUR_BUSY.includes(h)
                    return (
                      <div key={h} className="flex-1 flex flex-col items-center gap-0.5">
                        <div className={`w-full h-6 rounded-sm ${isBusy ? 'bg-dark-500' : 'bg-em-500/20'}`}
                          title={`${fmtHour(h)}: ${isBusy ? 'Busy' : 'Free'}`} />
                        {h % 2 === 0 && <span className="text-[7px] mono text-gray-600">{h}</span>}
                      </div>
                    )
                  })}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-em-500/20" /><span className="text-[8px] text-gray-500">Free</span></div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-dark-500" /><span className="text-[8px] text-gray-500">Busy</span></div>
                </div>
              </div>
              <button onClick={handleSubmitAvailability}
                className="w-full bg-em-600 hover:bg-em-500 transition text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2">
                <LockIcon className="w-4 h-4" /> Submit ZK Availability
              </button>
              <div className="text-[10px] text-gray-600 text-center mt-2">Proof valid for {PROOF_EXPIRY_HOURS}h · Renewable anytime</div>
            </div>
          )}

          {/* Proof expiry badge */}
          {submitted && timeLeft && (
            <div className="flex items-center justify-between bg-dark-700/50 rounded-lg px-4 py-2.5 mb-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-em-500 animate-pulse" />
                <span className="text-xs text-em-400 font-medium">Proof submitted</span>
              </div>
              <button onClick={() => { setSubmitted(false); setAvailData(null); setProofExpiry(null) }}
                className="text-[10px] text-gray-500 hover:text-white transition">
                Re-submit
              </button>
              <div className="text-xs mono text-gray-400">
                Expires in <span className="text-white">{timeLeft}</span>
              </div>
            </div>
          )}

          {/* Stacked Availability Heatmap */}
          {availData && (
            <div className="glass rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Group Availability</h3>
                <div className="flex items-center gap-3">
                  <TZLabel tz={tz} />
                  <button onClick={() => setShowFullDay(!showFullDay)}
                    className="text-[10px] text-gray-500 hover:text-white transition px-2 py-0.5 rounded hover:bg-dark-600">
                    {showFullDay ? 'Business hours' : 'Full day'}
                  </button>
                </div>
              </div>

              {/* Proof status per member */}
              <div className="flex items-center gap-3 mb-3 pb-3 border-b border-dark-600/30">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-500">Status:</span>
                  <span className="text-xs text-white font-medium">{group?.submitted}/{group?.members}</span>
                  <span className="text-[10px] text-gray-500">submitted</span>
                </div>
                <div className="flex -space-x-1">
                  {Array.from({ length: Math.min(group?.members || 0, 8) }).map((_, i) => (
                    <div key={i} className={`w-4 h-4 rounded-full border-2 border-dark-900 ${
                      i < (group?.submitted || 0) ? 'bg-em-500' : 'bg-dark-500'
                    }`} />
                  ))}
                  {group?.members > 8 && <span className="text-[9px] mono text-gray-500 ml-1">+{group.members - 8}</span>}
                </div>
                <span className="text-[10px] text-gray-600 ml-auto">Identities hidden</span>
              </div>

              {/* Threshold slider */}
              <div className="mb-4 pb-3 border-b border-dark-600/30">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-gray-500">Min. quorum</span>
                  <span className="text-xs mono text-em-400">{threshold}/{totalMembers} members</span>
                </div>
                <input type="range" min={1} max={totalMembers} value={threshold}
                  onChange={e => setThreshold(Number(e.target.value))}
                  className="w-full h-1.5 bg-dark-600 rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-em-500 [&::-webkit-slider-thumb]:border-2
                    [&::-webkit-slider-thumb]:border-dark-900 [&::-webkit-slider-thumb]:cursor-pointer" />
              </div>

              {/* Heatmap */}
              <div className="bg-dark-700/50 rounded-lg p-3 mb-3">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Members available per hour</div>
                <div className="flex gap-px">
                  {hours.map(h => {
                    const count = availData[h] || 0
                    const isYourBusy = YOUR_BUSY.includes(h)
                    const intensity = maxAvail > 0 ? count / maxAvail : 0
                    const meetsThreshold = count >= threshold
                    const pct = Math.round(intensity * 100)
                    return (
                      <div key={h} className="flex-1 flex flex-col items-center gap-0.5 group/slot relative">
                        <div className={`w-full cursor-pointer rounded-sm transition-all hover:scale-y-110 ${
                          isYourBusy ? 'opacity-40' : ''
                        } ${!meetsThreshold && !isYourBusy ? 'opacity-30' : ''}`}
                          style={{
                            height: `${20 + pct * 0.8}px`,
                            background: meetsThreshold
                              ? `linear-gradient(to top, rgba(16,185,129,${0.15 + intensity * 0.55}), rgba(16,185,129,${intensity * 0.85}))`
                              : `linear-gradient(to top, rgba(46,52,72,${0.3 + intensity * 0.3}), rgba(46,52,72,${0.3 + intensity * 0.3}))`,
                          }}
                          onClick={() => handleSlotClick(h)}
                        >
                          {count === maxAvail && count > 0 && meetsThreshold && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[7px] mono text-em-400">★</div>
                          )}
                        </div>
                        {h % (showFullDay ? 3 : 2) === 0 && <span className="text-[7px] mono text-gray-600">{h}</span>}
                        {/* Tooltip */}
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-dark-800 border border-dark-500 rounded px-1.5 py-0.5 text-[8px] mono text-white opacity-0 group-hover/slot:opacity-100 transition pointer-events-none whitespace-nowrap z-10">
                          {fmtHour(h)}: {count}/{totalMembers} free{isYourBusy ? ' (busy)' : ''}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-2 rounded-sm" style={{background: 'linear-gradient(to right, rgba(16,185,129,0.15), rgba(16,185,129,0.8))'}} />
                      <span className="text-[8px] text-gray-500">Few → Many free</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-2 rounded-sm bg-dark-600 opacity-30" style={{opacity: 0.5}} />
                      <span className="text-[8px] text-gray-500">Below threshold</span>
                    </div>
                  </div>
                  <span className="text-[8px] text-gray-500">You don't see who — only how many</span>
                </div>
              </div>

              {/* Privacy notice */}
              <div className="bg-dark-700/30 rounded-lg p-3 border border-em-500/10">
                <div className="text-[10px] uppercase tracking-wider text-em-600 mb-1.5">🛡 Zero-Knowledge Guarantee</div>
                <ul className="space-y-1 text-xs text-gray-400">
                  <li className="flex items-center gap-1.5"><span className="text-em-600">✕</span> No member identities revealed</li>
                  <li className="flex items-center gap-1.5"><span className="text-em-600">✕</span> No calendar contents exposed</li>
                  <li className="flex items-center gap-1.5"><span className="text-em-600">✕</span> Only aggregate counts shown</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Right: Best Slots */}
        <div className="lg:col-span-2">
          <div className="glass rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Best Slots</h3>
              <span className="text-[10px] mono text-gray-500">
                {availData ? (threshold > 1 ? `≥${threshold} members` : 'All free') : 'Submit first'}
              </span>
            </div>

            {!availData ? (
              <div className="text-center py-12">
                <UsersIcon className="w-10 h-10 text-dark-500 mx-auto mb-3" />
                <div className="text-sm text-gray-500 mb-1">Join a group & submit availability</div>
                <div className="text-[10px] text-gray-600">See when everyone is free — without knowing who</div>
              </div>
            ) : (
              <div className="space-y-2">
                {getBestSlots(availData, YOUR_BUSY, totalMembers, threshold).map((slot, i) => (
                  <div key={i}
                    className={`rounded-lg p-3 transition slide-up ${
                      slot.yourBusy
                        ? 'bg-dark-700/30 border border-dark-500/30 opacity-60 cursor-default'
                        : 'bg-em-500/8 border border-em-500/15 hover:bg-em-500/12 cursor-pointer'
                    }`}
                    onClick={() => !slot.yourBusy && handleSlotClick(slot.hour)}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`text-sm font-medium ${slot.yourBusy ? 'text-gray-500 line-through' : 'text-em-400'}`}>
                          {fmtHour12(slot.hour)}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex -space-x-0.5">
                            {Array.from({ length: Math.min(slot.count, 6) }).map((_, j) => (
                              <div key={j} className={`w-3.5 h-3.5 rounded-full border-2 border-dark-900 ${
                                slot.meetsThreshold ? 'bg-em-500' : 'bg-dark-500'
                              }`} />
                            ))}
                            {slot.count > 6 && <span className="text-[8px] mono text-gray-500 ml-0.5">+{slot.count - 6}</span>}
                          </div>
                          <span className={`text-[10px] mono ${slot.meetsThreshold ? 'text-em-400' : 'text-gray-500'}`}>
                            {slot.count}/{totalMembers} free
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {slot.yourBusy && <span className="text-[9px] mono text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded">YOUR BUSY</span>}
                        {!slot.yourBusy && slot.meetsThreshold && slot.count === maxAvail && (
                          <span className="text-[9px] mono text-em-400 bg-em-500/10 px-1.5 py-0.5 rounded">★ BEST</span>
                        )}
                        {!slot.yourBusy && slot.meetsThreshold && <ChevronRight />}
                      </div>
                    </div>
                    {/* Mini bar */}
                    <div className="mt-2 h-1 rounded-full bg-dark-600 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${
                        slot.meetsThreshold ? 'bg-em-500/50' : 'bg-dark-500/50'
                      }`} style={{ width: `${(slot.count / totalMembers) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function getBestSlots(availData, yourBusy, totalMembers, threshold) {
  return availData
    .map((count, hour) => ({
      hour, count, yourBusy: yourBusy.includes(hour), meetsThreshold: count >= threshold
    }))
    .filter(s => s.count > 0)
    .sort((a, b) => {
      // Meetings-threshold + not-your-busy first, then by count desc
      if (a.meetsThreshold !== b.meetsThreshold) return a.meetsThreshold ? -1 : 1
      if (a.yourBusy !== b.yourBusy) return a.yourBusy ? 1 : -1
      return b.count - a.count
    })
    .slice(0, 12)
}

function TZLabel({ tz }) {
  const short = tz.split('/').pop().replace(/_/g, ' ')
  return <span className="text-[10px] mono text-gray-500">🕐 {short}</span>
}

function UsersIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2a3 3 0 00-5.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function ShieldIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

function LockIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}

function ChevronRight() {
  return <svg className="w-3.5 h-3.5 text-em-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
}