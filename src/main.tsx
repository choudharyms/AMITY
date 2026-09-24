import React from 'react'
import ReactDOM from 'react-dom/client'
import { SWRConfig } from 'swr'
import { Toaster } from 'sonner'
import App from './app'
import { usePilotData, useBackendHealth } from './use-pilot-data'
import './styles.css'

function Root() {
  const { data, source, refresh } = usePilotData()
  const backend = useBackendHealth()
  return <App data={data} source={source} refresh={refresh} backend={backend} />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SWRConfig value={{ shouldRetryOnError: false, revalidateOnFocus: true }}>
      <Root />
      <Toaster position="bottom-right" theme="light" richColors closeButton />
    </SWRConfig>
  </React.StrictMode>,
)
