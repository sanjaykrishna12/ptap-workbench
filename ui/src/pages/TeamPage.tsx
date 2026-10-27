import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, Chip, Grid2 as Grid, Paper, Skeleton, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tabs, Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { api, type Case, type TeamSummary } from '../api';
import { useMe } from '../auth';
import CaseTable from '../components/CaseTable';
import { PageHeader, ReadOnlyBanner } from '../components/bits';
import { pct } from '../format';
import { colors } from '../theme';

function Tile({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: string }) {
  return (
    <Card sx={{ p: 3, height: '100%' }}>
      <Typography variant="overline" color="text.secondary">{label}</Typography>
      <Typography sx={{ fontSize: typeof value === 'string' && value.length > 8 ? 24 : 34, fontWeight: 600, lineHeight: 1.2, mt: 1, color: accent }}>{value}</Typography>
      {sub && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{sub}</Typography>}
    </Card>
  );
}

const TABS = [
  { id: 'open', label: 'Open' }, { id: 'awaiting_approval', label: 'Awaiting approval' },
  { id: 'waiting', label: 'Waiting' }, { id: 'closed_today', label: 'Closed today' },
];

export default function TeamPage() {
  const { teamId = '' } = useParams();
  const me = useMe();
  const qc = useQueryClient();
  const [tab, setTab] = useState('open');
  const file = useRef<HTMLInputElement>(null);
  const summary = useQuery({ queryKey: ['team', teamId], queryFn: () => api<TeamSummary>(`/api/teams/${teamId}/summary`), refetchInterval: 15_000 });
  const cases = useQuery({ queryKey: ['cases', tab, teamId], queryFn: () => api<Case[]>(`/api/cases?team=${teamId}&tab=${tab}`), refetchInterval: 10_000 });
  const upload = useMutation({
    mutationFn: (f: File) => { const fd = new FormData(); fd.append('file', f); fd.append('team', teamId); return api<{ envelope: { status: string; document_id: string } }>('/api/uploads', { method: 'POST', body: fd }); },
    onSuccess: () => setTimeout(() => qc.invalidateQueries({ queryKey: ['cases'] }), 1500),
  });
  const s = summary.data;
  const st = s?.stats;
  const live = s?.team.workflows.some(w => w.live);
  const canUpload = me.makers.includes(teamId);
  const count = (id: string) => id === 'open' ? st?.open : id === 'awaiting_approval' ? st?.awaiting_approval : id === 'waiting' ? st?.waiting : undefined;

  return (
    <>
      <PageHeader title={s?.team.name ?? ''} scope={me.scope} oversight={me.oversight}
        subtitle={s ? `${s.team.stage_name} — ${s.team.description}` : undefined}
        right={canUpload && (
          <>
            <input ref={file} type="file" accept="application/pdf" hidden onChange={e => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ''; }} />
            <Button variant="contained" startIcon={<UploadFileIcon />} onClick={() => file.current?.click()} disabled={upload.isPending}>
              {upload.isPending ? 'Uploading…' : 'Upload document'}
            </Button>
          </>
        )} />
      {me.oversight && <Box sx={{ mb: 3 }}><ReadOnlyBanner /></Box>}
      {upload.isSuccess && <Alert severity={upload.data.envelope.status === 'routed' ? 'success' : 'info'} sx={{ mb: 2 }}>
        {upload.data.envelope.status === 'routed' ? `${upload.data.envelope.document_id} received; the agent is reading it and a case will appear in a moment.`
          : `${upload.data.envelope.document_id}: this file was received before, so it was linked to the existing work instead of starting a new case.`}
      </Alert>}
      {upload.isError && <Alert severity="error" sx={{ mb: 2 }}>{(upload.error as Error).message}</Alert>}

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {!st ? [0, 1, 2, 3].map(i => <Grid key={i} size={{ xs: 12, sm: 6, lg: 3 }}><Skeleton variant="rounded" height={150} /></Grid>) : (
          <>
            <Grid size={{ xs: 12, sm: 6, lg: live ? 2.4 : 3 }}><Tile label="Open" value={st.open} sub={`${st.review} in review`} /></Grid>
            <Grid size={{ xs: 12, sm: 6, lg: live ? 2.4 : 3 }}><Tile label="P1 open" value={st.p1} sub="Critical priority" accent={st.p1 ? colors.crit : undefined} /></Grid>
            <Grid size={{ xs: 12, sm: 6, lg: live ? 2.4 : 3 }}><Tile label="Waiting on others" value={st.waiting} sub="Another team or a counterparty" /></Grid>
            {live ? (
              <>
                <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}><Tile label="STP today" value="Approval required by policy" sub="Every SSI change needs a call-back and four-eyes approval" /></Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}><Tile label="SSI changes open" value={s!.callbacks_mandatory} sub="Call-back mandatory on each" accent="#C2410C" /></Grid>
              </>
            ) : (
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}><Tile label="STP today" value={pct(st.stp_rate)} sub={`${st.auto_closed.toLocaleString()} auto-closed · ${st.resolved_by_reviewer.toLocaleString()} resolved by reviewer`} /></Grid>
            )}
          </>
        )}
      </Grid>

      {s && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3, mb: 3 }}>
          <Table>
            <TableHead><TableRow><TableCell>Workflow</TableCell><TableCell>Autonomy tier</TableCell><TableCell>Health</TableCell><TableCell>STP today vs target</TableCell></TableRow></TableHead>
            <TableBody>
              {s.workflows.map(w => (
                <TableRow key={w.code}>
                  <TableCell><Typography fontWeight={600}>{w.code} · {w.name}</Typography><Typography variant="body2" color="text.secondary">{w.description}</Typography></TableCell>
                  <TableCell><Chip label={w.autonomy_tier} sx={{ bgcolor: '#EEF1F5' }} /></TableCell>
                  <TableCell>{w.live ? <Chip icon={<CheckCircleIcon />} label="Running" sx={{ bgcolor: '#E7F4EC', color: colors.ok, '& .MuiChip-icon': { color: colors.ok } }} /> : <Chip label="Demo data" sx={{ bgcolor: '#F2F4F7', color: '#667085' }} />}</TableCell>
                  <TableCell sx={{ color: w.stp_target == null ? colors.primary : 'inherit', fontWeight: 600 }}>{w.stp_vs_target}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: `1px solid ${colors.line}` }}>
        {TABS.map(t => <Tab key={t.id} value={t.id} label={count(t.id) !== undefined ? `${t.label} (${count(t.id)})` : t.label} sx={{ fontSize: 15 }} />)}
      </Tabs>
      <CaseTable cases={cases.data ?? []} showTeam={false} empty={tab === 'closed_today' ? 'Nothing closed yet today' : 'Nothing here'} />
    </>
  );
}
