import { Box, Button, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import type { Case } from '../api';
import { ageText, money } from '../format';
import { Cutoff, DemoTag, PriorityChip, StateChip } from './bits';

export default function CaseTable({ cases, showTeam = true, empty = 'No cases' }: { cases: Case[]; showTeam?: boolean; empty?: string }) {
  const [params, setParams] = useSearchParams();
  const open = (id: string) => { const p = new URLSearchParams(params); p.set('case', id); setParams(p); };
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
      <Table size="medium">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            {showTeam && <TableCell>Flow</TableCell>}
            {showTeam && <TableCell>Team</TableCell>}
            <TableCell sx={{ minWidth: 260, maxWidth: 360 }}>Description</TableCell>
            <TableCell>Trade / Ref</TableCell>
            <TableCell>Value</TableCell>
            <TableCell>Priority</TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>To cut-off</TableCell>
            <TableCell sx={{ minWidth: 190, maxWidth: 240 }}>Agent diagnosis</TableCell>
            <TableCell>State</TableCell>
            <TableCell align="right">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {cases.map(c => (
            <TableRow key={c.id} hover onClick={() => open(c.id)} sx={{ cursor: 'pointer', '& td': { py: 2 } }}>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                <Typography sx={{ fontFamily: 'Consolas, "SF Mono", monospace', fontSize: 14 }}>{c.id}</Typography>
                <Typography variant="caption" color="text.secondary">{ageText(c.created_at)}</Typography>
              </TableCell>
              {showTeam && <TableCell sx={{ fontWeight: 600 }}>{c.workflow_code}</TableCell>}
              {showTeam && <TableCell sx={{ color: 'text.secondary' }}>{c.team_name}</TableCell>}
              <TableCell>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontWeight: 600, fontSize: 15 }}>{c.title}</Typography>
                  {c.is_demo && <DemoTag />}
                </Stack>
                {c.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', mt: 0.25 }}>
                    {c.description}
                  </Typography>
                )}
              </TableCell>
              <TableCell sx={{ fontFamily: 'Consolas, "SF Mono", monospace', fontSize: 13, color: 'text.secondary' }}>{c.trade_ref ?? '—'}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 500 }}>{money(c.value_amount, c.value_ccy)}</TableCell>
              <TableCell><PriorityChip p={c.priority} /></TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}><Cutoff iso={c.cutoff_at} /></TableCell>
              <TableCell>
                {c.diagnosis ? (
                  <>
                    <Typography variant="body2" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.diagnosis.title}</Typography>
                    <Typography variant="caption" color="text.secondary">conf. {c.diagnosis.confidence.toFixed(2)}</Typography>
                  </>
                ) : <Typography variant="body2" color="text.secondary">Agent is reading…</Typography>}
              </TableCell>
              <TableCell><StateChip state={c.state} /></TableCell>
              <TableCell align="right"><Button variant="outlined" size="small" onClick={e => { e.stopPropagation(); open(c.id); }}>View</Button></TableCell>
            </TableRow>
          ))}
          {cases.length === 0 && (
            <TableRow><TableCell colSpan={11}><Box sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>{empty}</Box></TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
