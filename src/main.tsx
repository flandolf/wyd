import './css/globals.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Stats } from './components/stats/Stats'
import { ThemeProvider } from './components/ThemeProvider'

const isStatsWindow = window.location.hash.includes('stats')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme='dark' storageKey='ui-theme'>
      {isStatsWindow ? <Stats /> : <App />}
    </ThemeProvider>
  </StrictMode>
)
