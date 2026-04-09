import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'
import { ensureMomentCacheLoaded } from './data/momentCache.ts'

// Pre-load the moment cache so it's ready when the user starts reading
ensureMomentCacheLoaded();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
