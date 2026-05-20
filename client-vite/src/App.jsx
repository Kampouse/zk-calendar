import { useState, useCallback } from 'react'
import Nav from './components/Nav'
import CalendarView from './components/CalendarView'
import FindFreeView from './components/FindFreeView'
import ProveView from './components/ProveView'
import VerifyOverlay from './components/VerifyOverlay'
import Toast from './components/Toast'

export default function App() {
  const [tab, setTab] = useState('find')
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [toasts, setToasts] = useState([])
  const [proveSlot, setProveSlot] = useState(null) // { hour, duration, group }

  const addToast = useCallback((msg) => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])

  function handleProve(slot) {
    if (slot && typeof slot === 'object') {
      setProveSlot(slot)
    } else {
      setProveSlot(null)
    }
    setTab('prove')
  }

  return (
    <div className="min-h-screen">
      <Nav onVerify={() => setVerifyOpen(true)} />
      <div className="pt-14">
        {/* Tabs */}
        <div className="border-b border-dark-600/50 bg-dark-800/50">
          <div className="max-w-7xl mx-auto px-4 flex gap-1">
            {['calendar', 'find', 'prove'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-sm px-4 py-3 border-b-2 transition ${
                  tab === t
                    ? 'border-em-500 text-em-400'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}>
                {t === 'calendar' ? 'Calendar' : t === 'find' ? 'Groups' : 'Prove'}
              </button>
            ))}
          </div>
        </div>

        {tab === 'calendar' && <CalendarView onProve={handleProve} />}
        {tab === 'find' && <FindFreeView onProve={handleProve} />}
        {tab === 'prove' && <ProveView onToast={addToast} slot={proveSlot} />}
      </div>

      {verifyOpen && <VerifyOverlay onClose={() => setVerifyOpen(false)} />}
      <Toast toasts={toasts} />
    </div>
  )
}