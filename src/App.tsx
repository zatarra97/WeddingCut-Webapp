import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom'
import { CognitoUser, CognitoUserPool } from 'amazon-cognito-identity-js'
import { Provider, ErrorBoundary } from '@rollbar/react';
import Dashboard from './Pages/Dashboard/Dashboard'
import NewOrder from './Pages/Orders/NewOrder'
import Login from './Pages/Auth/Login'
import Register from './Pages/Auth/Register'
import './App.css'
import NotFound from './Pages/NotFound/NotFound'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import DemoModeModal from './Components/DemoModeModal'
import Navbar from './Components/Navbar'
import { ThemeConfig } from "flowbite-react";
import { ThemeInit } from "../.flowbite-react/init";

import { LOCAL_STORAGE_KEYS } from './constants'
import { ping } from './services/api-utility'


const rollbarConfig = {
  accessToken: import.meta.env.VITE_ROLLBAR_TOKEN,
  environment: import.meta.env.VITE_ENVIRONMENT || 'development',
};

const poolData = {
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID
};
const userPool = new CognitoUserPool(poolData);

const AppContent: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<CognitoUser | null>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [connectionError, setConnectionError] = useState(false)
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => {
    const savedState = localStorage.getItem(LOCAL_STORAGE_KEYS.SIDEBAR_EXPANDED)
    return savedState !== null ? savedState === 'true' : true
  })
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false)
  const navigate = useNavigate()

  const handleSidebarToggle = (isExpanded: boolean) => {
    setIsSidebarExpanded(isExpanded)
    localStorage.setItem(LOCAL_STORAGE_KEYS.SIDEBAR_EXPANDED, isExpanded.toString())
  }

  const redirectToLogin = (withReturnUrl: boolean = true) => {
    setIsAuthenticated(false)
    setUser(null)
    const currentPath = `${window.location.pathname}${window.location.search}`
    const isAlreadyLogin = window.location.pathname.startsWith('/accesso/login')
    if (withReturnUrl && !isAlreadyLogin && currentPath) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.RETURN_URL, currentPath)
    }
    const suffix = ''
    navigate(`/accesso/login${suffix}`)
  }

  useEffect(() => {
    checkAuthState();
  }, []);

  useEffect(() => {
    const handler = () => setIsDemoModalOpen(true)
    window.addEventListener('open-demo-modal', handler as EventListener)
    return () => window.removeEventListener('open-demo-modal', handler as EventListener)
  }, [])

  useEffect(() => {
    const checkConnection = async () => {
      try {
        await ping();
        setConnectionError(false);
      } catch (error) {
        setConnectionError(true);
      }
    };

    // Controllo iniziale
    checkConnection();

    // Controllo periodico ogni 30 secondi
    const intervalId = setInterval(checkConnection, 30000);

    return () => clearInterval(intervalId);
  }, []);

  const checkAuthState = async () => {
    setIsCheckingAuth(true)
    const cognitoUser = userPool.getCurrentUser()
    if (!cognitoUser) {
      setIsAuthenticated(false)
      setUser(null)
      setIsCheckingAuth(false)
      redirectToLogin(true)
      return
    }

    try {
      const session: any = await Promise.race([
        new Promise((resolve, reject) => {
          cognitoUser.getSession((err: any, session: any) => {
            if (err) reject(err)
            else resolve(session)
          })
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('AUTH_TIMEOUT')), 2500))
      ])

      if (session && session.isValid && session.isValid()) {
        const idToken = session.getIdToken().getJwtToken()
        const payload = JSON.parse(atob(idToken.split('.')[1]))
        const email = payload.email || payload['cognito:username'] || ''
        setIsAuthenticated(true)
        setUser(cognitoUser)
        localStorage.setItem(LOCAL_STORAGE_KEYS.JWT_TOKEN, idToken)
        localStorage.setItem(LOCAL_STORAGE_KEYS.ID_TOKEN, idToken)
        localStorage.setItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN, session.getAccessToken().getJwtToken())
        if (email) localStorage.setItem(LOCAL_STORAGE_KEYS.USER_EMAIL, email)
      } else {
        setIsAuthenticated(false)
        setUser(null)
        redirectToLogin(true)
      }
    } catch {
      setIsAuthenticated(false)
      setUser(null)
      localStorage.removeItem(LOCAL_STORAGE_KEYS.JWT_TOKEN)
      localStorage.removeItem(LOCAL_STORAGE_KEYS.ID_TOKEN)
      localStorage.removeItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN)
      redirectToLogin(true)
    } finally {
      setIsCheckingAuth(false)
    }
  }

  const signOut = () => {
    const cognitoUser = userPool.getCurrentUser()
    if (cognitoUser) cognitoUser.signOut()
    setIsAuthenticated(false)
    setUser(null)
    localStorage.removeItem(LOCAL_STORAGE_KEYS.JWT_TOKEN)
    localStorage.removeItem(LOCAL_STORAGE_KEYS.ID_TOKEN)
    localStorage.removeItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN)
    localStorage.removeItem(LOCAL_STORAGE_KEYS.USER_EMAIL)
    localStorage.removeItem(LOCAL_STORAGE_KEYS.RETURN_URL)
    redirectToLogin(false)
  }

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Recupero informazioni autenticazione</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <ToastContainer />
        <DemoModeModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} />
        <Routes>
          <Route path="/accesso/registrati" element={<Register />} />
          <Route path="/accesso/login" element={<Login setIsAuthenticated={setIsAuthenticated} setUser={setUser} />} />
          <Route path="*" element={<Login setIsAuthenticated={setIsAuthenticated} setUser={setUser} />} />
        </Routes>
      </>
    )
  }

  return (
    <>
      <Navbar
        userEmail={localStorage.getItem(LOCAL_STORAGE_KEYS.USER_EMAIL) || ''}
        onLogout={signOut}
      />
      <main className="pt-14 min-h-screen bg-gray-100">
        <ToastContainer />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/orders/new" element={<NewOrder />} />
          <Route path="/accesso/login" element={<Login setIsAuthenticated={setIsAuthenticated} setUser={setUser} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  )
}

const App: React.FC = () => {
  return (
    <Router>
      <ThemeInit />
      <ThemeConfig dark={false} />
      <Provider config={rollbarConfig}>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </Provider>
    </Router>
  )
}

export default App 