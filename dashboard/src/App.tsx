import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ToastContainer } from './components/ToastContainer';
import { Layout } from './components/Layout';

import { LoginPage } from './pages/LoginPage';
import { PipelineListPage } from './pages/PipelineListPage';
import { PipelineDetailPage } from './pages/PipelineDetailPage';
import { JobDetailPage } from './pages/JobDetailPage';
import { JobsPage } from './pages/JobsPage';
import { AccountPage } from './pages/AccountPage';

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
            <Route element={<ProtectedRoutes />}>
              <Route path="/" element={<PipelineListPage />} />
              <Route path="/pipelines/:id" element={<PipelineDetailPage />} />
              <Route path="/jobs" element={<JobsPage />} />
              <Route path="/jobs/:id" element={<JobDetailPage />} />
              <Route path="/account" element={<AccountPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
