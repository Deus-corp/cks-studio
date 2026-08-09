import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
// Self-hosted variable fonts (see styles/index.css --font-display/--font-mono):
// Manrope for display/label type, JetBrains Mono for ids and technical data.
// Self-hosted rather than a Google Fonts <link> so the app renders correctly
// offline and doesn't depend on a third-party font CDN being reachable.
// import '@fontsource/manrope/variable.css'
// import '@fontsource/jetbrains-mono/variable.css'
import './styles/index.css'
import './styles/graph.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
