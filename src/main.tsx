import React from 'react'
import ReactDOM from 'react-dom/client'
import { SWRConfig } from 'swr'
import { Toaster } from 'sonner'
import App from './app'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SWRConfig value={{ shouldRetryOnError: false, revalidateOnFocus: true }}>
      <App />
      <Toaster position="bottom-right" theme="light" richColors closeButton />
    </SWRConfig>
  </React.StrictMode>,
)
