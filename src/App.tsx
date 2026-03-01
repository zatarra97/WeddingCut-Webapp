import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom'
import { CognitoUser, CognitoUserPool } from 'amazon-cognito-identity-js'
import { Provider, ErrorBoundary } from '@rollbar/react';
import Dashboard from './Pages/Dashboard/Dashboard'
import AdminDashboard from './Pages/Admin/AdminDashboard'
import Services from './Pages/Admin/Services/Services'
import ServiceDetail from './Pages/Admin/Services/ServiceDetail'
import NewOrder from './Pages/Orders/NewOrder'
import OrderList from './Pages/Orders/OrderList'
import OrderDetail from './Pages/Orders/OrderDetail'
import AdminOrders from './Pages/Admin/Orders/AdminOrders'
import AdminOrderDetail from './Pages/Admin/Orders/AdminOrderDetail'
import AdminMessageList from './Pages/Admin/Messages/AdminMessageList'
import AdminMessageDetail from './Pages/Admin/Messages/AdminMessageDetail'
import AdminUsers from './Pages/Admin/Users/AdminUsers'
import MessageList from './Pages/Messages/MessageList'
import MessageDetail from './Pages/Messages/MessageDetail'
import Login from './Pages/Auth/Login'
import Register from './Pages/Auth/Register'
import './App.css'
import NotFound from './Pages/NotFound/NotFound'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import Navbar from './Components/Navbar'
import UserNav from './Components/UserNav'
import AdminLayout from './Components/AdminLayout'
import ProtectedRoute from './Components/ProtectedRoute'
import { ThemeConfig } from "flowbite-react";
import { ThemeInit } from "../.flowbite-react/init";

import { LOCAL_STORAGE_KEYS, USER_ROLES, resolveRole, DEFAULT_ROUTE_BY_ROLE } from './constants'
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
  const [userRole, setUserRole] = useState<string | null>(null)
  const [user, setUser] = useState<CognitoUser | null>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [connectionError, setConnectionError] = useState(false)
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => {
    const savedState = localStorage.getItem(LOCAL_STORAGE_KEYS.SIDEBAR_EXPANDED)
    return savedState !== null ? savedState === 'true' : true
  })
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
        const groups: string[] = payload['cognito:groups'] ?? []
        const role = resolveRole(groups)
        setIsAuthenticated(true)
        setUser(cognitoUser)
        setUserRole(role)
        localStorage.setItem(LOCAL_STORAGE_KEYS.JWT_TOKEN, idToken)
        localStorage.setItem(LOCAL_STORAGE_KEYS.ID_TOKEN, idToken)
        localStorage.setItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN, session.getAccessToken().getJwtToken())
        if (email) localStorage.setItem(LOCAL_STORAGE_KEYS.USER_EMAIL, email)
        localStorage.setItem(LOCAL_STORAGE_KEYS.USER_ROLE, role)
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
    setUserRole(null)
    localStorage.removeItem(LOCAL_STORAGE_KEYS.JWT_TOKEN)
    localStorage.removeItem(LOCAL_STORAGE_KEYS.ID_TOKEN)
    localStorage.removeItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN)
    localStorage.removeItem(LOCAL_STORAGE_KEYS.USER_EMAIL)
    localStorage.removeItem(LOCAL_STORAGE_KEYS.USER_ROLE)
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
        <Routes>
          <Route path="/accesso/registrati" element={<Register />} />
          <Route path="/accesso/login" element={<Login setIsAuthenticated={setIsAuthenticated} setUser={setUser} setUserRole={setUserRole} />} />
          <Route path="*" element={<Login setIsAuthenticated={setIsAuthenticated} setUser={setUser} setUserRole={setUserRole} />} />
        </Routes>
      </>
    )
  }

  if (userRole === USER_ROLES.ADMIN) {
    return (
      <>
        <ToastContainer />
        <AdminLayout
          userEmail={localStorage.getItem(LOCAL_STORAGE_KEYS.USER_EMAIL) || ''}
          onLogout={signOut}
        >
          <Routes>
            <Route path="/admin" element={<ProtectedRoute requiredRole={USER_ROLES.ADMIN}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/services" element={<ProtectedRoute requiredRole={USER_ROLES.ADMIN}><Services /></ProtectedRoute>} />
            <Route path="/admin/services/new" element={<ProtectedRoute requiredRole={USER_ROLES.ADMIN}><ServiceDetail /></ProtectedRoute>} />
            <Route path="/admin/services/:id" element={<ProtectedRoute requiredRole={USER_ROLES.ADMIN}><ServiceDetail /></ProtectedRoute>} />
            <Route path="/admin/orders" element={<ProtectedRoute requiredRole={USER_ROLES.ADMIN}><AdminOrders /></ProtectedRoute>} />
            <Route path="/admin/orders/:publicId" element={<ProtectedRoute requiredRole={USER_ROLES.ADMIN}><AdminOrderDetail /></ProtectedRoute>} />
            <Route path="/admin/messages" element={<ProtectedRoute requiredRole={USER_ROLES.ADMIN}><AdminMessageList /></ProtectedRoute>} />
            <Route path="/admin/messages/:publicId" element={<ProtectedRoute requiredRole={USER_ROLES.ADMIN}><AdminMessageDetail /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requiredRole={USER_ROLES.ADMIN}><AdminUsers /></ProtectedRoute>} />
            <Route path="/accesso/login" element={<Login setIsAuthenticated={setIsAuthenticated} setUser={setUser} setUserRole={setUserRole} />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AdminLayout>
      </>
    )
  }

  if (userRole === USER_ROLES.USER) {
    return (
      <>
        <Navbar
          userEmail={localStorage.getItem(LOCAL_STORAGE_KEYS.USER_EMAIL) || ''}
          onLogout={signOut}
          homeRoute="/user/dashboard"
        />
        <UserNav />
        <main className="pt-26 min-h-screen bg-gray-100">
          <ToastContainer />
          <Routes>
            <Route path="/user/dashboard" element={<ProtectedRoute requiredRole={USER_ROLES.USER}><Dashboard /></ProtectedRoute>} />
            <Route path="/user/orders" element={<ProtectedRoute requiredRole={USER_ROLES.USER}><OrderList /></ProtectedRoute>} />
            <Route path="/user/orders/new" element={<ProtectedRoute requiredRole={USER_ROLES.USER}><NewOrder /></ProtectedRoute>} />
            <Route path="/user/orders/:publicId" element={<ProtectedRoute requiredRole={USER_ROLES.USER}><OrderDetail /></ProtectedRoute>} />
            <Route path="/user/messages" element={<ProtectedRoute requiredRole={USER_ROLES.USER}><MessageList /></ProtectedRoute>} />
            <Route path="/user/messages/:publicId" element={<ProtectedRoute requiredRole={USER_ROLES.USER}><MessageDetail /></ProtectedRoute>} />
            <Route path="/accesso/login" element={<Login setIsAuthenticated={setIsAuthenticated} setUser={setUser} setUserRole={setUserRole} />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </>
    )
  }

  return null
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
