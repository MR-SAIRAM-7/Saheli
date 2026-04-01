import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Buffer } from 'buffer'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext'
import { LanguageProvider } from './contexts/LanguageContext'

declare global {
  interface Window {
    global?: typeof globalThis;
    Buffer?: typeof Buffer;
  }
}

if (!window.global) {
  window.global = globalThis;
}

if (!window.Buffer) {
  window.Buffer = Buffer;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
    </LanguageProvider>
  </StrictMode>,
)
