import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ToastContainer } from './components/ToastContainer';
import { Layout } from './components/Layout';

import { AccountPage } from './pages/AccountPage';
import { JobDetailPage } from './pages/JobDetailPage';
import { JobsPage } from './pages/JobsPage';
import { LoginPage } from './pages/LoginPage';
import { PipelineDetailPage } from './pages/PipelineDetailPage';
import { PipelineListPage } from './pages/PipelineListPage';
import { RegisterPage } from './pages/RegisterPage';
import { StatsPage } from './pages/StatsPage';
import { TeamDetailPage } from './pages/TeamDetailPage';
import { TeamsPage } from './pages/TeamsPage';

function ProtectedRoutes() {
  const { apiKey, isReady } = useAuth();
  
  if (!isReady) return null;

  if (!apiKey) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/dashboard">
      <ToastProvider>
        <ToastContainer />
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route element={<ProtectedRoutes />}>
              <Route path="/" element={<PipelineListPage />} />
              <Route path="/pipelines/:id" element={<PipelineDetailPage />} />
              <Route path="/jobs" element={<JobsPage />} />
              <Route path="/jobs/:id" element={<JobDetailPage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/teams" element={<TeamsPage />} />
              <Route path="/teams/:id" element={<TeamDetailPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
