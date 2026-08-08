import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { GraphPage } from './pages/GraphPage'
import { SettingsPage } from './pages/SettingsPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GraphPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        {/* остальные страницы — позже */}
      </Routes>
    </BrowserRouter>
  )
}