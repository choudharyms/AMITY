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
  const [showDashboard, setShowDashboard] = useState(false)
  const [cityId, setCityId] = useState(getSavedCityId)
  const { data, source, refresh, error } = usePilotData(cityId)
  const backend = useBackendHealth()

  function changeCity(nextCityId: string) {
    saveCityId(nextCityId)
    setCityId(nextCityId)
  }

  if (!showDashboard) {
    return <Landing onEnter={() => setShowDashboard(true)} />
  }

  return <App data={data} source={source} refresh={refresh} backend={backend} error={error} cityId={cityId} onCityChange={changeCity} />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SWRConfig value={{ shouldRetryOnError: false, revalidateOnFocus: true }}>
      <Root />
      <Toaster position="bottom-right" theme="light" richColors closeButton />
    </SWRConfig>
  </React.StrictMode>,
)
