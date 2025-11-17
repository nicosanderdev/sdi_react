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

// New public user pages
import { PublicWelcomePage } from './pages/public/PublicWelcomePage';
import { PublicUserProfilePage } from './pages/public/PublicUserProfilePage';
import { PublicUserMessagesPage } from './pages/public/PublicUserMessagesPage';
import { PublicUserFavoritesPage } from './pages/public/PublicUserFavoritesPage';
import { UpgradeToManagerPage } from './pages/public/UpgradeToManagerPage';

// Dashboard layout and pages
import { DashboardLayout } from './components/layout/DashboardLayout';
import { DashboardOverview } from './pages/dashboard/DashboardOverview';
import { UserProfile } from './components/user/UserProfile';
import { PropertiesManager } from './components/dashboard/properties/PropertiesManager';
import { MessageCenter } from './components/dashboard/MessageCenter';
import { ReportsAndMetrics } from './components/reports/ReportsAndMetrics';
import { UserSettings } from './components/user/UserSettings';
import { LogoutPage } from './components/user/LogoutPage';
import { EmailConfirmationPage } from './components/user/EmailConfirmationPage';
import { PropertyViewPage } from './components/dashboard/properties/PropertyViewPage';
import { PropertyEditPage } from './components/dashboard/properties/PropertyEditPage';
import { ManagerSubscriptionPage } from './pages/dashboard/subscription/ManagerSubscriptionPage';

// Subscription pages
import { ChangeSubscriptionPage } from './pages/dashboard/subscription/ChangeSubscriptionPage';
import { CancelSubscriptionPage } from './pages/dashboard/subscription/CancelSubscriptionPage';
import { SubscriptionSuccessPage } from './pages/dashboard/subscription/SubscriptionSuccessPage';
import { BillingHistoryPage } from './pages/dashboard/subscription/BillingHistoryPage';

// Company pages
import { CompanySubscriptionPage } from './pages/company/CompanySubscriptionPage';

// Admin pages
import { AdminSubscriptionsPage } from './pages/dashboard/admin/AdminSubscriptionsPage';
import { AdminInvoicesPage } from './pages/dashboard/admin/AdminInvoicesPage';

// Auth components
import { ManagerOnlyRoute, PublicUserOnlyRoute, PublicRoute, AdminOnlyRoute } from './components/auth/ProtectedRoute';

import { useDispatch, useSelector } from 'react-redux';
import { fetchUserProfile } from './store/slices/userSlice';
import { fetchFavoriteProperties } from './store/slices/favoritesSlice';
import { AppDispatch, RootState } from './store/store';

import './config/leafletSetup';
import RouteChangeTracker from './components/reports/RouteChangeTracker';
import { TermsAndConditionsPage } from './pages/public/TermsAndConditions';
import { NotFoundPage } from './pages/public/NotFoundPage';
import PropertiesResultsPage from './pages/public/PropertiesResultsPage';
import SearchPage from './components/public/SearchPage';
import PublicPropertyViewPage from './pages/public/PublicPropertyViewPage';
import FavoritesPage from './pages/dashboard/FavoritesPage';
import MapSearchPage from './pages/public/MapSearchPage';


export function App() {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.user.profile);

  useEffect(() => {
    dispatch(fetchUserProfile());
  }, [dispatch]);

  useEffect(() => {
    if (user && user.id) {
      dispatch(fetchFavoriteProperties());
    }
  }, [dispatch, user]);

  return (
    <ThemeProvider>
      <ThemeInit />
      <Router>
        <RouteChangeTracker />
        <Routes>

          {/* Public Routes (No Authentication Required) */}
          <Route path="/" element={<PublicRoute><HomePage /></PublicRoute>} />
          <Route path="/contact" element={<PublicRoute><ContactPage /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/email-confirmation" element={<PublicRoute><EmailConfirmationPage /></PublicRoute>} />
          <Route path="/terms" element={<PublicRoute><TermsAndConditionsPage /></PublicRoute>} />
          <Route path="/notfound" element={<PublicRoute><NotFoundPage /></PublicRoute>} />
          <Route path="/search" element={<PublicRoute><SearchPage /></PublicRoute>} />
          <Route path="/properties" element={<PublicRoute><PropertiesResultsPage /></PublicRoute>} />
          <Route path="/properties/view/:propertyId" element={<PublicRoute><PublicPropertyViewPage /></PublicRoute>} />
          <Route path="/map-search" element={<PublicRoute><MapSearchPage /></PublicRoute>} />

          {/* Public User Routes (Authentication Required, Public Users Only) */}
          <Route path="/welcome" element={<PublicUserOnlyRoute><PublicWelcomePage /></PublicUserOnlyRoute>} />
          <Route path="/profile" element={<PublicUserOnlyRoute><PublicUserProfilePage /></PublicUserOnlyRoute>} />
          <Route path="/messages" element={<PublicUserOnlyRoute><PublicUserMessagesPage /></PublicUserOnlyRoute>} />
          <Route path="/favorites" element={<PublicUserOnlyRoute><PublicUserFavoritesPage /></PublicUserOnlyRoute>} />
          <Route path="/upgrade" element={<PublicUserOnlyRoute><UpgradeToManagerPage /></PublicUserOnlyRoute>} />

          {/* Manager Dashboard Routes (Authentication Required, Managers Only) */}
          <Route path="/dashboard" element={<ManagerOnlyRoute><DashboardLayout /></ManagerOnlyRoute>} > 
            <Route index element={<DashboardOverview />} />
            <Route path="profile" element={<UserProfile />} />
            <Route path="properties" element={<PropertiesManager />} />
            <Route path="favorites" element={<FavoritesPage />} />
            <Route path="messages" element={<MessageCenter />} />
            <Route path="reports" element={<ReportsAndMetrics />} />
            <Route path="settings" element={<UserSettings />} />
            <Route path="subscription" element={<ManagerSubscriptionPage />} />
            <Route path="subscription/change" element={<ChangeSubscriptionPage />} />
            <Route path="subscription/cancel" element={<CancelSubscriptionPage />} />
            <Route path="subscription/success" element={<SubscriptionSuccessPage />} />
            <Route path="subscription/billing-history" element={<BillingHistoryPage />} />
            <Route path="logout" element={<LogoutPage />} />
            <Route path="property/:propertyId" element={<PropertyViewPage />} />
            <Route path="property/:propertyId/edit" element={<PropertyEditPage />} />
            
            {/* Admin Routes */}
            <Route path="admin/subscriptions" element={<AdminOnlyRoute><AdminSubscriptionsPage /></AdminOnlyRoute>} />
            <Route path="admin/invoices" element={<AdminOnlyRoute><AdminInvoicesPage /></AdminOnlyRoute>} />
          </Route>

          {/* Company Routes */}
          <Route path="/company/:id/subscription" element={<ManagerOnlyRoute><CompanySubscriptionPage /></ManagerOnlyRoute>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/notfound" />} />
          
        </Routes>
      </Router>
    </ThemeProvider>
  );
}