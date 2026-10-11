import React from 'react';
import { Route, Routes } from 'react-router';
import { AuthProvider } from './lib/auth';
import { rolesFor, rolesWith } from './lib/permissions';
import { RequireAuth } from './components/RequireAuth';
import { Layout } from './components/Layout';
import LoginPage from './pages/LoginPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import DashboardPage from './pages/DashboardPage';
import NotFoundPage from './pages/NotFoundPage';
import StaffPage from './pages/StaffPage';
import ActivityPage from './pages/ActivityPage';
import AccountPage from './pages/AccountPage';
import EventsPage from './pages/EventsPage';
import SeriesPage from './pages/SeriesPage';
import EditionPage from './pages/EditionPage';
import EditionProgrammePage from './pages/EditionProgrammePage';
import EditionDelegatesPage from './pages/EditionDelegatesPage';
import EditionTasksPage from './pages/EditionTasksPage';
import EditionBudgetPage from './pages/EditionBudgetPage';
import PublishPage from './pages/PublishPage';
import EnquiriesPage from './pages/EnquiriesPage';
import EnquiryPage from './pages/EnquiryPage';
import SponsorsPage from './pages/SponsorsPage';
import SponsorPage from './pages/SponsorPage';
import DealsPage from './pages/DealsPage';
import DealPage from './pages/DealPage';
import ReportsPage from './pages/ReportsPage';

export function AdminRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/staff" element={<RequireAuth roles={rolesFor('staff')}><StaffPage /></RequireAuth>} />
            <Route path="/activity" element={<RequireAuth roles={rolesFor('activity')}><ActivityPage /></RequireAuth>} />
            <Route path="/account" element={<AccountPage />} />
            <Route element={<RequireAuth roles={rolesFor('events')} />}>
              <Route path="/events" element={<EventsPage />} />
              <Route path="/events/editions/:id" element={<EditionPage />} />
              <Route path="/events/editions/:id/programme" element={<EditionProgrammePage />} />
              <Route path="/events/editions/:id/tasks" element={<EditionTasksPage />} />
              <Route path="/events/editions/:id/delegates" element={<RequireAuth roles={rolesWith('delegates.read')}><EditionDelegatesPage /></RequireAuth>} />
              <Route path="/events/editions/:id/budget" element={<RequireAuth roles={rolesWith('expenses.read')}><EditionBudgetPage /></RequireAuth>} />
              <Route path="/events/:seriesId/editions/new" element={<EditionPage />} />
              <Route path="/events/:id" element={<SeriesPage />} />
            </Route>
            <Route element={<RequireAuth roles={rolesFor('enquiries')} />}>
              <Route path="/enquiries" element={<EnquiriesPage />} />
              <Route path="/enquiries/:id" element={<EnquiryPage />} />
            </Route>
            <Route element={<RequireAuth roles={rolesFor('sponsors')} />}>
              <Route path="/sponsors" element={<SponsorsPage />} />
              <Route path="/sponsors/:id" element={<SponsorPage />} />
            </Route>
            <Route element={<RequireAuth roles={rolesFor('deals')} />}>
              <Route path="/deals" element={<DealsPage />} />
              <Route path="/deals/:id" element={<DealPage />} />
            </Route>
            <Route path="/reports" element={<RequireAuth roles={rolesFor('reports')}><ReportsPage /></RequireAuth>} />
            <Route path="/publish" element={<RequireAuth roles={rolesFor('publish')}><PublishPage /></RequireAuth>} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
