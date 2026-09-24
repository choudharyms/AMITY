import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { SWRConfig } from 'swr'
import { Toaster } from 'sonner'
import App from './app'
import Landing from './landing'
import { RegisterPage } from './pages/register-page'
import { LoginPage } from './pages/login-page'
import { usePilotData, useBackendHealth } from './use-pilot-data'
import { getSavedCityId, saveCityId } from './cities'
import { registerSW } from 'virtual:pwa-register'
import { ErrorBoundary } from '@/components/error-boundary'
import './styles.css'
import './landing.css'

registerSW({ immediate: true })

export type AppView = 'landing' | 'register' | 'login' | 'dashboard'

function parseViewFromLocation(): AppView {
  if (typeof window === 'undefined') return 'landing'
  const hash = window.location.hash.toLowerCase()
  const params = new URLSearchParams(window.location.search)

  if (
    hash === '#register' ||
    hash === '#signup' ||
    hash === '#join' ||
    hash === '#joinus' ||
    params.get('page') === 'register' ||
    params.get('page') === 'signup' ||
    params.get('page') === 'join'
  ) {
    return 'register'
  }

  if (
    hash === '#login' ||
    hash === '#signin' ||
    params.get('page') === 'login' ||
    params.get('page') === 'signin'
  ) {
    return 'login'
  }

  if (
    params.get('view') === 'dashboard' ||
    params.get('dashboard') === 'true' ||
    (hash && hash !== '#' && hash !== '#landing')
  ) {
    return 'dashboard'
  }

  return 'landing'
}


function Root() {
  const [view, setView] = useState<AppView>(parseViewFromLocation)
  const [cityId, setCityId] = useState(getSavedCityId)
  const { data, source, refresh, error } = usePilotData(cityId)
  const backend = useBackendHealth()

  useEffect(() => {
    const handleLocationChange = () => {
      setView(parseViewFromLocation())
    }
    window.addEventListener('hashchange', handleLocationChange)
    window.addEventListener('popstate', handleLocationChange)
    return () => {
      window.removeEventListener('hashchange', handleLocationChange)
      window.removeEventListener('popstate', handleLocationChange)
    }
  }, [])

  function changeCity(nextCityId: string) {
    saveCityId(nextCityId)
    setCityId(nextCityId)
  }

  function navigateToLanding() {
    window.location.hash = 'landing'
    setView('landing')
  }

  function navigateToRegister() {
    window.location.hash = 'register'
    setView('register')
  }

  function navigateToLogin() {
    window.location.hash = 'login'
    setView('login')
  }

  function navigateToDashboard(targetSection: string = 'overview') {
    window.location.hash = targetSection
    setView('dashboard')
  }

  // 1. Dedicated Registration Page
  if (view === 'register') {
    return (
      <RegisterPage
        initialCityId={cityId}
        onNavigateToLogin={navigateToLogin}
        onNavigateToLanding={navigateToLanding}
        onSuccess={() => navigateToDashboard('overview')}
      />
    )
  }

  // 2. Dedicated Login Page
  if (view === 'login') {
    return (
      <LoginPage
        initialCityId={cityId}
        onNavigateToRegister={navigateToRegister}
        onNavigateToLanding={navigateToLanding}
        onSuccess={() => navigateToDashboard('overview')}
      />
    )
  }

  // 3. Cinematic Landing Page
  if (view === 'landing') {
    return (
      <Landing
        onEnter={() => navigateToDashboard('overview')}
        onJoinUs={navigateToRegister}
        onLogin={navigateToLogin}
      />
    )
  }

  // 4. Live Workspace Dashboard
  return (
    <App
      data={data}
      source={source}
      refresh={refresh}
      backend={backend}
      error={error}
      cityId={cityId}
      onCityChange={changeCity}
      onBackToLanding={navigateToLanding}
    />
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <SWRConfig value={{ shouldRetryOnError: false, revalidateOnFocus: true }}>
        <Root />
        <Toaster position="bottom-right" theme="light" richColors closeButton />
      </SWRConfig>
    </ErrorBoundary>
  </React.StrictMode>,
)

