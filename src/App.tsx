import { Route, Routes } from 'react-router-dom'
import { getSupabaseConfig } from './lib/config'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Setup } from './components/Setup'
import { Login } from './components/Login'
import { Layout } from './components/Layout'
import { SessionListPage } from './components/SessionList'
import { SessionDetailPage } from './components/SessionDetail'
import { ManualAddPage } from './components/ManualAdd'

function AuthedApp() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="center-screen">
        <span className="spinner" />
      </div>
    )
  }

  if (!user) return <Login />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<SessionListPage />} />
        <Route path="/new" element={<ManualAddPage />} />
        <Route path="/session/:id" element={<SessionDetailPage />} />
        <Route path="*" element={<SessionListPage />} />
      </Routes>
    </Layout>
  )
}

export function App() {
  // No Supabase connection yet → show the one-time setup screen.
  if (!getSupabaseConfig()) return <Setup />

  return (
    <AuthProvider>
      <AuthedApp />
    </AuthProvider>
  )
}
