import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import App from './App.tsx'
import { LanguageProvider } from './utils/i18n.tsx'
import { StandaloneEmbedTodayView } from './components/EmbedTodayWidget.tsx'

const isEmbedToday =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === 'today'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isEmbedToday ? (
      <StandaloneEmbedTodayView />
    ) : (
      <LanguageProvider>
        <App />
      </LanguageProvider>
    )}
  </StrictMode>,
)
