import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Box, Card, Chip, Stack, Typography } from '@mui/material';
import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { api, type Alert } from '../api';
import { useMe } from '../auth';
import { DemoTag, PageHeader } from '../components/bits';
import { agoText } from '../format';

const ICON = { critical: <ErrorIcon sx={{ color: '#C0262D' }} />, warning: <WarningAmberIcon sx={{ color: '#C2621A' }} />, info: <InfoOutlinedIcon sx={{ color: '#2B5BA8' }} /> };

export default function AlertsPage() {
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const { data } = useQuery({ queryKey: ['alerts'], queryFn: () => api<Alert[]>('/api/alerts'), refetchInterval: 15_000 });
  return (
    <>
      <PageHeader title="Alerts" scope={me.scope} oversight={me.oversight} subtitle="Cut-offs, failed checks and call-backs that need someone now." />
      <Stack spacing={1.5}>
        {(data ?? []).map(a => (
          <Card key={a.id} sx={{ p: 2.25, display: 'flex', gap: 2, alignItems: 'center', cursor: a.case_id ? 'pointer' : 'default' }}
            onClick={() => { if (a.case_id) { const p = new URLSearchParams(params); p.set('case', a.case_id); setParams(p); } }}>
            {ICON[a.severity as keyof typeof ICON] ?? ICON.info}
            <Box sx={{ flex: 1 }}>
              <Typography fontWeight={600}>{a.title}</Typography>
              <Typography variant="body2" color="text.secondary">{a.team_id.replace(/-/g, ' ')} · {agoText(a.created_at)}</Typography>
            </Box>
            {a.is_demo && <DemoTag />}
            {a.case_id && <Chip label={a.case_id} variant="outlined" />}
          </Card>
        ))}
        {data && data.length === 0 && <Typography color="text.secondary">No alerts.</Typography>}
      </Stack>
    </>
  );
}
