import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Box, Chip, InputAdornment, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { api, type Activity } from '../api';
import { useMe } from '../auth';
import { PageHeader } from '../components/bits';
import { etDateTime } from '../format';

const ACTOR: Record<string, { label: string; bg: string; fg: string }> = {
  agent: { label: 'Agent', bg: '#EEE8FB', fg: '#5B3BB0' }, user: { label: 'Person', bg: '#E5EDFA', fg: '#1F4E9E' },
  service: { label: 'Service', bg: '#EEF1F5', fg: '#475467' }, system: { label: 'System', bg: '#EEF1F5', fg: '#475467' },
};

export default function AuditTrail() {
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const caseId = params.get('case_id');
  const { data } = useQuery({
    queryKey: ['audit', q, caseId],
    queryFn: () => api<Activity[]>(`/api/audit?limit=300${q ? `&q=${encodeURIComponent(q)}` : ''}${caseId ? `&case_id=${caseId}` : ''}`),
    refetchInterval: 10_000,
  });
  return (
    <>
      <PageHeader title="Audit Trail" scope={me.scope} oversight={me.oversight}
        subtitle="Everything that happened — every document, tool call, decision and system write — whether or not it became a case." />
      <TextField placeholder="Search by case, document, action or words…" value={q} onChange={e => setQ(e.target.value)}
        sx={{ mb: 2.5, width: { xs: '100%', md: 560 }, bgcolor: '#fff' }}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }} />
      {caseId && <Chip label={`Case ${caseId}`} onDelete={() => { const p = new URLSearchParams(params); p.delete('case_id'); setParams(p); }} sx={{ ml: 2, mb: 2.5 }} />}
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>When (ET)</TableCell><TableCell>Who</TableCell><TableCell>Action</TableCell>
            <TableCell sx={{ minWidth: 380 }}>What happened</TableCell><TableCell>Case</TableCell><TableCell>Outcome</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {(data ?? []).map(a => {
              const actor = ACTOR[a.actor_type] ?? ACTOR.service;
              return (
                <TableRow key={a.activity_id} hover sx={{ '& td': { py: 1.25 } }}>
                  <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{etDateTime(a.at)}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Chip size="small" label={actor.label} sx={{ bgcolor: actor.bg, color: actor.fg, mr: 1, height: 22 }} />
                    <Typography component="span" variant="body2">{a.actor}</Typography>
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'Consolas, monospace', fontSize: 12.5 }}>{a.action}</TableCell>
                  <TableCell><Typography variant="body2">{a.summary}</Typography></TableCell>
                  <TableCell sx={{ fontFamily: 'Consolas, monospace', fontSize: 13 }}>{a.case_id ?? a.item_id ?? ''}</TableCell>
                  <TableCell>
                    <Chip size="small" label={a.outcome} sx={{ height: 22, bgcolor: a.outcome === 'ok' ? '#E7F4EC' : a.outcome === 'placeholder' ? '#FEF3C7' : a.outcome === 'failed' ? '#FDECEA' : '#EEF1F5',
                      color: a.outcome === 'ok' ? '#1E7B4A' : a.outcome === 'placeholder' ? '#92400E' : a.outcome === 'failed' ? '#B42318' : '#475467' }} />
                  </TableCell>
                </TableRow>
              );
            })}
            {data && data.length === 0 && <TableRow><TableCell colSpan={6}><Box sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>No activity yet</Box></TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}
