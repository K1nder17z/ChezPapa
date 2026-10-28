import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { CreditsPage } from './pages/CreditsPage.tsx'
import { MenuExperience } from './pages/MenuExperience.tsx'
import { MyOrderPage } from './pages/MyOrderPage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { PrintPage } from './pages/PrintPage.tsx'
import { PrintTablesPage } from './pages/PrintTablesPage.tsx'
import { BoardPage } from './pages/restaurant/BoardPage.tsx'
import { HistoryPage } from './pages/restaurant/HistoryPage.tsx'
import { OrderPage } from './pages/restaurant/OrderPage.tsx'
import { ScanPage } from './pages/restaurant/ScanPage.tsx'
import { TablePage } from './pages/restaurant/TablePage.tsx'
import { TableEntry } from './pages/TableEntry.tsx'
import { buildRestaurantJsonLd } from './seo/jsonld.ts'

function NativeSalleHome() {
  const navigate = useNavigate()
  useEffect(() => {
    const native = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    if (!native?.isNativePlatform?.()) return
    if (window.location.pathname === '/' || window.location.pathname === '/menu') {
      navigate('/salle', { replace: true })
    }
  }, [navigate])
  return null
}

export default function App() {
  useEffect(() => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.text = JSON.stringify(buildRestaurantJsonLd())
    document.head.appendChild(script)
    return () => script.remove()
  }, [])

  return (
    <BrowserRouter>
      <NativeSalleHome />
      <Routes>
        <Route path="/" element={<MenuExperience />} />
        <Route path="/menu" element={<MenuExperience />} />
        <Route path="/t/:table" element={<TableEntry />} />
        <Route path="/ma-commande" element={<MyOrderPage />} />
        <Route path="/impression" element={<PrintPage />} />
        <Route path="/impression/tables" element={<PrintTablesPage />} />
        <Route path="/salle" element={<BoardPage />} />
        <Route path="/salle/table/:table" element={<TablePage />} />
        <Route path="/salle/commande/:id" element={<OrderPage />} />
        <Route path="/salle/scanner" element={<ScanPage />} />
        <Route path="/salle/historique" element={<HistoryPage />} />
        <Route path="/credits" element={<CreditsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
