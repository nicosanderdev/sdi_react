import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeInit } from '../.flowbite-react/init';
import { ThemeProvider } from './contexts/ThemeContext';

// Public pages
import { HomePage } from './pages/public/HomePage';
import { ContactPage } from './pages/public/ContactPage';
import { ForgotPasswordPage } from './pages/public/ForgotPasswordPage';
import { LoginPage } from './pages/public/LoginPage';
import { RegisterPage } from './pages/public/RegisterPage';

// Dashboard layout and pages
import { DashboardLayout } from './components/layout/DashboardLayout';
import { DashboardOverview } from './components/dashboard/DashboardOverview';
import { UserProfile } from './components/user/UserProfile';
import { PropertiesManager } from './components/dashboard/properties/PropertiesManager';
import { MessageCenter } from './components/dashboard/MessageCenter';
import { ReportsAndMetrics } from './components/reports/ReportsAndMetrics';
import { UserSettings } from './components/user/UserSettings';
import { LogoutPage } from './components/user/LogoutPage';
import { EmailConfirmationPage } from './components/user/EmailConfirmationPage';
import { PropertyViewPage } from './components/dashboard/properties/PropertyViewPage';
import { PropertyEditPage } from './components/dashboard/properties/PropertyEditPage';

import { useDispatch } from 'react-redux';
import { fetchUserProfile } from './store/slices/userSlice';
import { AppDispatch } from './store/store';

import './config/leafletSetup';
import RouteChangeTracker from './components/reports/RouteChangeTracker';
import { TermsAndConditionsPage } from './pages/public/TermsAndConditions';
import { NotFoundPage } from './pages/public/NotFoundPage';


export function App() {
  const dispatch = useDispatch<AppDispatch>();
  useEffect(() => {
    dispatch(fetchUserProfile());
  }, [dispatch]);

  return (
    <ThemeProvider>
      <ThemeInit />
      <Router>
        <RouteChangeTracker />
        <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/email-confirmation" element={<EmailConfirmationPage />} />
        <Route path="/terms" element={<TermsAndConditionsPage />} />
        <Route path="/notfound" element={<NotFoundPage />} />

        {/* Dashboard Routes */}
        <Route path="/dashboard" element={<DashboardLayout /> } > 
          <Route index element={<DashboardOverview />} />
          <Route path="profile" element={<UserProfile />} />
          <Route path="properties" element={<PropertiesManager />} />
          <Route path="messages" element={<MessageCenter />} />
          <Route path="reports" element={<ReportsAndMetrics />} />
          <Route path="settings" element={<UserSettings />} />
          <Route path="logout" element={<LogoutPage />} />
          <Route path="property/:propertyId" element={<PropertyViewPage />} />
          <Route path="property/:propertyId/edit" element={<PropertyEditPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/notfound" />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}