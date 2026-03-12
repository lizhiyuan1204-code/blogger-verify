import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Home from './pages/Home'
import Progress from './pages/Progress'
import Report from './pages/Report'
import History from './pages/History'
import Share from './pages/Share'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/progress/:taskId" element={<Progress />} />
        <Route path="/report/:taskId" element={<Report />} />
        <Route path="/history" element={<History />} />
        <Route path="/share/:shareId" element={<Share />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
