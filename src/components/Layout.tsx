import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { SettingsModal } from './SettingsModal'

export function Layout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const [showSettings, setShowSettings] = useState(false)

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          Therapy&nbsp;Notes
        </Link>
        <div className="spacer" />
        <button className="btn small" onClick={() => navigate('/new')}>
          + Add
        </button>
        <button className="btn ghost small" onClick={() => setShowSettings(true)} title="Settings">
          Settings
        </button>
        <button
          className="btn ghost small"
          onClick={toggle}
          title="Toggle theme"
          aria-label="Toggle light or dark"
        >
          {theme === 'dark' ? '☾' : '☀'}
        </button>
        <button className="btn ghost small" onClick={() => signOut()}>
          Sign out
        </button>
      </header>

      <main className="container">{children}</main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
