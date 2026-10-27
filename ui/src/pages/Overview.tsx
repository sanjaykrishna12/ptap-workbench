import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardActionArea, Chip, Grid2 as Grid, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BoltIcon from '@mui/icons-material/Bolt';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ScheduleIcon from '@mui/icons-material/Schedule';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import type { ReactNode } from 'react';
import { api, type Overview, type Stage } from '../api';
import { useMe } from '../auth';
import { PageHeader, ReadOnlyBanner } from '../components/bits';
import { pct } from '../format';
import { colors } from '../theme';

function Kpi({ icon, tint, value, label, help }: { icon: ReactNode; tint: string; value: ReactNode; label: string; help?: string }) {
  return (
    <Card sx={{ p: 3, height: '100%' }}>
      <Box sx={{ width: 52, height: 52, borderRadius: 2.5, bgcolor: tint, display: 'grid', placeItems: 'center', mb: 2.5 }}>{icon}</Box>
      <Typography sx={{ fontSize: 34, fontWeight: 600, lineHeight: 1.1 }}>{value}</Typography>
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.75 }}>
        <Typography color="text.secondary">{label}</Typography>
        {help && <Tooltip title={help}><HelpOutlineIcon sx={{ fontSize: 16, color: 'text.secondary' }} /></Tooltip>}
      </Stack>
    </Card>
  );
}

function PChips({ s }: { s: Stage }) {
  const chip = (p: string, n: number, c: { fg: string; bg: string; border: string }) =>
    <Chip size="small" label={`${p} ${n}`} sx={{ bgcolor: c.bg, color: c.fg, border: `1px solid ${c.border}`, fontWeight: 700, height: 24, fontSize: 12, '& .MuiChip-label': { px: 0.9 } }} />;
  return <Stack direction="row" gap={0.6} flexWrap="wrap">{chip('P1', s.p1, colors.p1)}{chip('P2', s.p2, colors.p2)}{chip('P3', s.p3, colors.p3)}</Stack>;
}

function StageCard({ s, onOpen }: { s: Stage; onOpen: () => void }) {
  const dot = s.health === 'critical' ? colors.crit : s.health === 'warning' ? '#E2711D' : null;
  return (
    <Card sx={{ height: '100%', position: 'relative' }}>
      <CardActionArea onClick={onOpen} sx={{ p: 2.5, height: '100%', alignItems: 'flex-start', display: 'block' }}>
        {dot && <Box sx={{ position: 'absolute', top: 16, right: 16, width: 12, height: 12, borderRadius: '50%', bgcolor: dot, boxShadow: `0 0 0 4px ${dot}22` }} />}
        <Typography variant="overline" color="text.secondary">{s.stage ? `Stage ${s.stage}` : 'Supporting team'}</Typography>
        <Typography sx={{ fontWeight: 600, fontSize: 16.5, lineHeight: 1.3, minHeight: 44 }}>{s.stage_name}</Typography>
        <Typography variant="body2" color="text.secondary">{s.team_name}</Typography>
        <Box sx={{ borderTop: `1px solid ${colors.line}`, my: 1.75 }} />
        <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
          <Box>
            <Typography sx={{ fontSize: 20, fontWeight: 600 }}>{s.cases_today.toLocaleString()}</Typography>
            <Typography variant="overline" color="text.secondary" sx={{ fontSize: 10.5 }}>Cases today</Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography sx={{ fontSize: s.stp_label ? 12.5 : 20, fontWeight: 600, maxWidth: 120 }}>{s.stp_label ?? pct(s.stp_rate)}</Typography>
            <Typography variant="overline" color="text.secondary" sx={{ fontSize: 10.5 }}>Team STP</Typography>
          </Box>
        </Stack>
        <Box sx={{ mt: 1.5 }}><PChips s={s} /></Box>
        {s.demo && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Demo data</Typography>}
      </CardActionArea>
    </Card>
  );
}

export default function OverviewPage() {
  const me = useMe();
  const nav = useNavigate();
  const { data } = useQuery({ queryKey: ['overview'], queryFn: () => api<Overview>('/api/overview'), refetchInterval: 15_000 });
  const lifecycle = data?.stages.filter(s => s.kind === 'lifecycle') ?? [];
  const supporting = data?.stages.filter(s => s.kind === 'supporting') ?? [];
  const k = data?.kpis;
  return (
    <>
      <PageHeader title="Agentic Digital Workflow" scope={me.scope} oversight={me.oversight}
        subtitle="Agentic automation across the post-execution trade lifecycle, with a shared Agent Intelligence layer." />
      {me.oversight && <Box sx={{ mb: 3 }}><ReadOnlyBanner /></Box>}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {[
          { icon: <AutoAwesomeIcon sx={{ color: '#2B5BA8' }} />, tint: '#E6EDF8', value: k?.cases_today.toLocaleString(), label: 'Cases today' },
          { icon: <BoltIcon sx={{ color: '#2E7D4F' }} />, tint: '#E5F2EA', value: pct(k?.stp_rate), label: 'STP rate', help: 'Share of today\'s cases closed with no person needed' },
          { icon: <PersonSearchIcon sx={{ color: '#C2621A' }} />, tint: '#FCEBDD', value: k?.pending_review, label: 'Pending review' },
          { icon: <ErrorOutlineIcon sx={{ color: '#C0262D' }} />, tint: '#FBE4E4', value: k?.p1_open, label: 'P1 open' },
          { icon: <ScheduleIcon sx={{ color: '#9A7B12' }} />, tint: '#FBF3D6', value: k ? `≈ ${k.analyst_hours_avoided} h` : undefined, label: 'Analyst hours avoided today', help: 'Straight-through cases × 4.9 minutes average handling time' },
        ].map(t => (
          <Grid key={t.label} size={{ xs: 12, sm: 6, lg: 2.4 }}>
            {data ? <Kpi {...t} /> : <Skeleton variant="rounded" height={170} />}
          </Grid>
        ))}
      </Grid>
      <Card sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6">Lifecycle</Typography>
          <Typography variant="body2" color="text.secondary">Click a stage to open it</Typography>
        </Stack>
        <Grid container spacing={2}>
          {lifecycle.map(s => (
            <Grid key={s.team_id} size={{ xs: 12, sm: 6, md: 3, xl: 12 / 7 }}>
              <StageCard s={s} onOpen={() => nav(`/teams/${s.team_id}`)} />
            </Grid>
          ))}
        </Grid>
        {supporting.length > 0 && (
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            {lifecycle.length > 0 && (
              <Grid size={{ xs: 12, md: 3, xl: 12 / 7 * 2 }} sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                  Supporting lane under Settlement <SubdirectoryArrowRightIcon fontSize="small" />
                </Typography>
              </Grid>
            )}
            {supporting.map(s => (
              <Grid key={s.team_id} size={{ xs: 12, sm: 6, md: 3, xl: 12 / 7 }}>
                <StageCard s={s} onOpen={() => nav(`/teams/${s.team_id}`)} />
              </Grid>
            ))}
          </Grid>
        )}
      </Card>
    </>
  );
}
