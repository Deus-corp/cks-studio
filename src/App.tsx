import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { GalleryPage } from './pages/GalleryPage'
import { GraphPage } from './pages/GraphPage'
import { PipelinePage } from './pages/PipelinePage'
import { SettingsPage } from './pages/SettingsPage'

function NavBar() {
  const linkClass =
    'text-xs px-2 py-1 rounded text-gray-400 hover:text-gray-200 hover:bg-gray-800'
  return (
    <nav className="flex items-center gap-1 bg-gray-950 border-b border-gray-800 px-3 py-1.5">
      <Link to="/" className={linkClass}>
        Graph
      </Link>
      <Link to="/pipeline" className={linkClass}>
        Pipeline
      </Link>
      <Link to="/gallery" className={linkClass}>
        Gallery
      </Link>
      <Link to="/settings" className={linkClass}>
        Settings
      </Link>
      {/* Agents — заглушка, добавится когда feature перестанет быть пустым файлом */}
    </nav>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <div className="h-screen flex flex-col">
        <NavBar />
        <div className="flex-1 min-h-0">
          <Routes>
            <Route path="/" element={<GraphPage />} />
            <Route path="/pipeline" element={<PipelinePage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            {/* остальные страницы — позже */}
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}
