import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AccountProvider } from './context/AccountContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Onboarding from './pages/Onboarding'
import OAuthCallback from './pages/OAuthCallback'
import Dashboard from './pages/Dashboard'
import CreativeStudio from './pages/CreativeStudio'
import CampaignManager from './pages/CampaignManager'
import Performance from './pages/Performance'
import Optimizer from './pages/Optimizer'
import CompetitorIntel from './pages/CompetitorIntel'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import AIAssistant from './pages/AIAssistant'
import AICampaignBuilder from './pages/AICampaignBuilder'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AccountProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* Public: receives OAuth popup result and posts message to opener */}
          <Route path="/oauth-callback" element={<OAuthCallback />} />
          {/* Onboarding: protected but no sidebar */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            }
          />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/creative" element={<CreativeStudio />} />
                    <Route path="/campaigns" element={<CampaignManager />} />
                    <Route path="/campaigns/ai-build" element={<AICampaignBuilder />} />
                    <Route path="/performance" element={<Performance />} />
                    <Route path="/optimizer" element={<Optimizer />} />
                    <Route path="/competitors" element={<CompetitorIntel />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/ai" element={<AIAssistant />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
      </AccountProvider>
    </BrowserRouter>
  )
}
