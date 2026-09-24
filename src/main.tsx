import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { SWRConfig } from 'swr'
import { Toaster } from 'sonner'
import App from './app'
import Landing from './landing'
import { usePilotData, useBackendHealth } from './use-pilot-data'
import { getSavedCityId, saveCityId } from './cities'
import './styles.css'
import './landing.css'

function Root() {
  const [showDashboard, setShowDashboard] = useState(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash
      const params = new URLSearchParams(window.location.search)
      if (params.get('view') === 'dashboard' || params.get('dashboard') === 'true' || (hash && hash !== '#' && hash !== '#landing')) {
        return true
      }
    }
    return false
  })
  const [cityId, setCityId] = useState(getSavedCityId)
  const { data, source, refresh, error } = usePilotData(cityId)
  const backend = useBackendHealth()

  React.useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash
      if (hash === '#landing') {
        setShowDashboard(false)
      } else if (hash && hash !== '#') {
        setShowDashboard(true)
      }
    }
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [])

  function changeCity(nextCityId: string) {
    saveCityId(nextCityId)
    setCityId(nextCityId)
  }

  if (!showDashboard) {
    return (
      <Landing
        onEnter={() => {
          setShowDashboard(true)
          if (!window.location.hash || window.location.hash === '#landing') {
            window.location.hash = 'overview'
          }
        }}
      />
    )
  }

  return (
    <App
      data={data}
      source={source}
      refresh={refresh}
      backend={backend}
      error={error}
      cityId={cityId}
      onCityChange={changeCity}
      onBackToLanding={() => {
        window.location.hash = 'landing'
        setShowDashboard(false)
      }}
    />
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SWRConfig value={{ shouldRetryOnError: false, revalidateOnFocus: true }}>
      <Root />
      <Toaster position="bottom-right" theme="light" richColors closeButton />
    </SWRConfig>
  </React.StrictMode>,
)
