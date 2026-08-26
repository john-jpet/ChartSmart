import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import Home from './pages/Home.tsx'
import HigherLower from './pages/HigherLower.tsx'
import AlbumBlitz from './pages/AlbumBlitz.tsx'
import NameThatTune from './pages/NameThatTune.tsx'
import NameThatMovie from './pages/NameThatMovie.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Routes>
        <Route element={<App />}>
          <Route index element={<Home />} />
          <Route path="higher-lower" element={<HigherLower />} />
          <Route path="album-blitz" element={<AlbumBlitz />} />
          <Route path="name-that-tune" element={<NameThatTune />} />
          <Route path="name-that-movie" element={<NameThatMovie />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
