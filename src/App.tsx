import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

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
import { PropertiesManager } from './components/properties/PropertiesManager';
import { MessageCenter } from './components/communication/MessageCenter';
import { ReportsAndMetrics } from './components/reports/ReportsAndMetrics';

export function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Dashboard Routes */}
        <Route path="/dashboard" element={<DashboardLayout /> } > 
          <Route index element={<DashboardOverview />} />
          <Route path="profile" element={<UserProfile />} />
          <Route path="properties" element={<PropertiesManager />} />
          <Route path="messages" element={<MessageCenter />} />
          <Route path="reports" element={<ReportsAndMetrics />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}