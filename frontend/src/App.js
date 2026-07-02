import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import './styles/globals.css';

// Pages
import Landing from './pages/landing/Landing';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import { ForgotPassword, ResetPassword } from './pages/auth/PasswordReset';
import { VerifyEmailToken, ResendVerification } from './pages/auth/VerifyEmail';
import AuthCallback from './pages/auth/AuthCallback';
import DashboardLayout from './pages/dashboard/DashboardLayout';
import Dashboard from './pages/dashboard/Dashboard';
import StartInterview from './pages/dashboard/StartInterview';
import InterviewRoom from './pages/dashboard/InterviewRoom';
import InterviewHistory from './pages/dashboard/InterviewHistory';
import FeedbackPage from './pages/dashboard/FeedbackPage';
import FeedbackList from './pages/dashboard/FeedbackList';
import Recordings from './pages/dashboard/Recordings';
import Profile from './pages/dashboard/Profile';
import Pricing from './pages/dashboard/Pricing';
import NewInterview from './pages/NewInterview';
import Feedback from './pages/Feedback';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30 * 1000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/verify-email/:token" element={<VerifyEmailToken />} />
            <Route path="/resend-verification" element={<ResendVerification />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* AI Mock Interviews */}
            <Route path="/interview/new" element={<NewInterview />} />
            <Route path="/interview/:id/room" element={<InterviewRoom />} />
            <Route path="/interview/:id/feedback" element={<Feedback />} />

            {/* Protected Dashboard */}
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="start" element={<StartInterview />} />
              <Route path="interview/:id" element={<InterviewRoom />} />
              <Route path="history" element={<InterviewHistory />} />
              <Route path="feedback/:id" element={<FeedbackPage />} />
              <Route path="feedback" element={<FeedbackList />} />
              <Route path="recordings" element={<Recordings />} />
              <Route path="pricing" element={<Pricing />} />
              <Route path="profile" element={<Profile />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'rgba(6, 13, 13, 0.96)',
              color: '#f1f5f9',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              backdropFilter: 'blur(16px)',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#99f6e4', secondary: 'transparent' },
            },
            error: {
              iconTheme: { primary: '#f87171', secondary: 'transparent' },
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
