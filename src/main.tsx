import './css/globals.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Stats } from './components/stats/Stats'
import { ThemeProvider } from './components/ThemeProvider'
import { AuthProvider } from './components/AuthProvider'
import { Toaster } from './components/ui/sonner'

const isStatsWindow = window.location.hash.includes('stats')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme='dark' storageKey='ui-theme'>
      <AuthProvider>
        {isStatsWindow ? <Stats /> : <App />}
        <Toaster position="bottom-center" richColors closeButton />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
)
