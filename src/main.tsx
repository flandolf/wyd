import './css/globals.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Stats } from './components/stats/Stats'
import { ThemeProvider } from './components/ThemeProvider'
import { AuthProvider } from './components/AuthProvider'

const isStatsWindow = window.location.hash.includes('stats')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme='dark' storageKey='ui-theme'>
      <AuthProvider>
        {isStatsWindow ? <Stats /> : <App />}
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
)
