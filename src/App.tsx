import { useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { CreditsPage } from './pages/CreditsPage.tsx'
import { MenuExperience } from './pages/MenuExperience.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { PrintPage } from './pages/PrintPage.tsx'
import { buildRestaurantJsonLd } from './seo/jsonld.ts'

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
      <Routes>
        <Route path="/" element={<MenuExperience />} />
        <Route path="/menu" element={<MenuExperience />} />
        <Route path="/impression" element={<PrintPage />} />
        <Route path="/credits" element={<CreditsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
