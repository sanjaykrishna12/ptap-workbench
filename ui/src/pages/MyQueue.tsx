import { useQuery } from '@tanstack/react-query';
import { Box, Typography } from '@mui/material';
import { api, type Case } from '../api';
import { useMe } from '../auth';
import CaseTable from '../components/CaseTable';
import { PageHeader } from '../components/bits';

export default function MyQueue() {
  const me = useMe();
  const { data } = useQuery({ queryKey: ['cases', 'open', 'mine'], queryFn: () => api<Case[]>('/api/cases?tab=open'), refetchInterval: 10_000 });
  const mine = (data ?? []).filter(c => me.teams.includes(c.team_id));
  const approvals = mine.filter(c => c.state === 'awaiting_approval');
  const isChecker = me.checkers.length > 0;
  return (
    <>
      <PageHeader title="My Queue" scope={me.scope} oversight={me.oversight}
        subtitle={isChecker ? 'Cases waiting for your approval come first.' : 'Open cases for your team, most urgent first.'} />
      {isChecker && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>Awaiting your approval ({approvals.length})</Typography>
          <CaseTable cases={approvals} showTeam={false} empty="Nothing waiting for approval" />
        </Box>
      )}
      <Typography variant="h6" sx={{ mb: 1.5 }}>{isChecker ? 'All open' : 'Open'} ({mine.length})</Typography>
      <CaseTable cases={mine} showTeam={false} empty="Your queue is clear" />
    </>
  );
}
