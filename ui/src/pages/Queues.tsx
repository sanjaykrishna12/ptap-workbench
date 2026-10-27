import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Box, Chip, InputAdornment, Stack, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { api, type Case } from '../api';
import { useMe } from '../auth';
import CaseTable from '../components/CaseTable';
import { PageHeader, ReadOnlyBanner } from '../components/bits';
import { colors } from '../theme';

export function TeamFilter({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const { data } = useQuery({ queryKey: ['counts'], queryFn: () => api<{ total: number; teams: { team_id: string; team_name: string; count: number }[] }>('/api/queues/counts') });
  const chip = (id: string | null, label: string, n: number) => {
    const active = value === id;
    return (
      <Chip key={id ?? 'all'} onClick={() => onChange(id)}
        label={<span>{label} <Box component="span" sx={{ ml: 0.75, px: 0.9, py: 0.15, borderRadius: 5, bgcolor: active ? 'rgba(255,255,255,0.2)' : '#E9EDF3', fontSize: 13 }}>{n}</Box></span>}
        sx={{ height: 44, px: 1, fontSize: 15, fontWeight: 600, borderRadius: 6, bgcolor: active ? colors.navy : '#fff', color: active ? '#fff' : colors.ink,
          border: `1px solid ${active ? colors.navy : colors.line}`, '&:hover': { bgcolor: active ? colors.navyDark : '#F3F5F9' } }} />
    );
  };
  return (
    <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap">
      {chip(null, 'All teams', data?.total ?? 0)}
      {(data?.teams ?? []).map(t => chip(t.team_id, t.team_name, t.count))}
    </Stack>
  );
}

export default function QueuesPage() {
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const team = params.get('team');
  const [q, setQ] = useState('');
  const { data } = useQuery({
    queryKey: ['cases', 'open', team, q],
    queryFn: () => api<Case[]>(`/api/cases?tab=open${team ? `&team=${team}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`),
    refetchInterval: 15_000,
  });
  const setTeam = (t: string | null) => { const p = new URLSearchParams(params); if (t) p.set('team', t); else p.delete('team'); setParams(p); };
  return (
    <>
      <PageHeader title="All Queues" scope={me.scope} oversight={me.oversight}
        subtitle={me.oversight ? "Every team's open cases, read-only. Filter by team." : 'Open cases in your teams.'} />
      {me.oversight && <Box sx={{ mb: 3 }}><ReadOnlyBanner /></Box>}
      <TextField placeholder="Search cases, trades or references…" value={q} onChange={e => setQ(e.target.value)}
        sx={{ mb: 2.5, width: { xs: '100%', md: 560 }, bgcolor: '#fff' }}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }} />
      <Box sx={{ mb: 3 }}><TeamFilter value={team} onChange={setTeam} /></Box>
      <CaseTable cases={data ?? []} empty="No open cases match" />
    </>
  );
}
