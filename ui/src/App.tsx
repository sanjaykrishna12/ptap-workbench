import { Navigate, Route, Routes } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { getToken } from './api';
import { MeProvider, useCurrentUser } from './auth';
import CaseDrawer from './components/CaseDrawer';
import Layout from './components/Layout';
import AlertsPage from './pages/Alerts';
import AuditTrail from './pages/AuditTrail';
import Login, { AuthCallback } from './pages/Login';
import MyQueue from './pages/MyQueue';
import OverviewPage from './pages/Overview';
import QueuesPage from './pages/Queues';
import TeamPage from './pages/TeamPage';

function SignedIn() {
  const { data: me, isLoading } = useCurrentUser();
  if (!getToken()) return <Navigate to="/login" replace />;
  if (isLoading || !me) return <Box sx={{ display: 'grid', placeItems: 'center', height: '100vh' }}><CircularProgress /></Box>;
  return (
    <MeProvider me={me}>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to={me.oversight ? '/overview' : '/my-queue'} replace />} />
          <Route path="/overview" element={me.oversight ? <OverviewPage /> : <Navigate to="/my-queue" replace />} />
          <Route path="/queues" element={<QueuesPage />} />
          <Route path="/my-queue" element={<MyQueue />} />
          <Route path="/teams/:teamId" element={<TeamPage />} />
          <Route path="/audit" element={<AuditTrail />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <CaseDrawer />
      </Layout>
    </MeProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/*" element={<SignedIn />} />
    </Routes>
  );
}
