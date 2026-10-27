import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer,
  IconButton, Link, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FlagIcon from '@mui/icons-material/Flag';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PersonIcon from '@mui/icons-material/Person';
import PaymentsIcon from '@mui/icons-material/Payments';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { api, post, type Case, type Check, type Evidence, type Field } from '../api';
import { useMe } from '../auth';
import { agoText, display, etDateTime, etTime, money, untilText } from '../format';
import { colors } from '../theme';
import { ConfidenceBar, PriorityChip, ReadOnlyBanner, StateChip } from './bits';
import DocumentViewer, { type ViewerTarget } from './DocumentViewer';

const CHECK_ICON: Record<Check['status'], React.ReactNode> = {
  passed: <CheckCircleIcon sx={{ color: colors.ok }} />, failed: <CancelIcon sx={{ color: colors.crit }} />,
  warning: <WarningAmberIcon sx={{ color: colors.warn }} />, placeholder: <HelpOutlineIcon sx={{ color: '#A16207' }} />,
  pending: <HourglassEmptyIcon sx={{ color: '#5B6577' }} />,
};

const FIELD_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  extracted: { label: 'Extracted', bg: '#E5EDFA', fg: '#1F4E9E' }, check: { label: 'Check', bg: '#FEF0E1', fg: '#B54708' },
  failed: { label: 'Failed rule', bg: '#FDECEA', fg: '#B42318' }, missing: { label: 'Missing', bg: '#FDECEA', fg: '#B42318' },
  corrected: { label: 'Corrected', bg: '#E7F4EC', fg: '#1E7B4A' },
};

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card sx={{ p: 3, mb: 2.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pb: 1.5, mb: 2, borderBottom: `1px solid ${colors.line}` }}>
        <Typography variant="h6">{title}</Typography>
        {right}
      </Stack>
      {children}
    </Card>
  );
}

function EvidenceBlock({ ev, editable, onOpen, onEdit }: { ev: Evidence; editable: boolean; onOpen: (focus?: string) => void; onEdit: (f: Field) => void }) {
  const accepted = ev.fields.filter(f => f.status === 'extracted' || f.status === 'corrected').length;
  return (
    <Box sx={{ border: `1px solid ${colors.line}`, borderRadius: 2.5, overflow: 'hidden', mb: 2 }}>
      <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ p: 2, bgcolor: '#FAFBFC' }}>
        <DescriptionIcon sx={{ color: '#3F4A5C', mt: 0.25 }} />
        <Box sx={{ flex: 1 }}>
          <Typography fontWeight={600}>{ev.document_id} · {ev.title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {ev.summary ?? ''}{ev.received_at ? ` · received ${agoText(ev.received_at)}` : ''}{ev.method ? ` · ${ev.method === 'llamacloud' ? 'LlamaParse + LlamaExtract' : 'local template'} (${ev.pack})` : ''}
            {!ev.summary && ` · ${accepted}/${ev.fields.length} fields auto-accepted`}
          </Typography>
        </Box>
        <Button variant="outlined" onClick={() => onOpen()}>Open evidence</Button>
      </Stack>
      <Table size="small">
        <TableHead><TableRow><TableCell>Field</TableCell><TableCell>Value</TableCell><TableCell>Confidence</TableCell><TableCell>Status</TableCell><TableCell>Where</TableCell></TableRow></TableHead>
        <TableBody>
          {ev.fields.map((f, i) => {
            const st = FIELD_STATUS[f.status] ?? FIELD_STATUS.extracted;
            const failed = f.rules?.find(r => !r.passed);
            return (
              <TableRow key={f.path ?? i} hover onClick={() => onOpen(f.path)} sx={{ cursor: 'pointer', '& td': { py: 1.2 } }}>
                <TableCell sx={{ color: 'text.secondary', width: '26%' }}>{f.label}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <span>{display(f.value)}</span>
                    {f.corrected_by && <Tooltip title={`Was ${display(f.original)}; corrected by ${f.corrected_by}`}><EditOutlinedIcon sx={{ fontSize: 15, color: colors.ok }} /></Tooltip>}
                    {editable && f.path && typeof f.value !== 'boolean' && (
                      <IconButton size="small" onClick={e => { e.stopPropagation(); onEdit(f); }} aria-label={`Correct ${f.label}`}><EditOutlinedIcon sx={{ fontSize: 16 }} /></IconButton>
                    )}
                  </Stack>
                  {failed && <Typography variant="caption" sx={{ color: colors.crit }}>{failed.message}</Typography>}
                </TableCell>
                <TableCell sx={{ color: f.confidence < 0.9 ? colors.warn : 'inherit', fontWeight: f.confidence < 0.9 ? 700 : 400 }}>{f.confidence ? f.confidence.toFixed(2) : '—'}</TableCell>
                <TableCell><Chip size="small" label={st.label} sx={{ bgcolor: st.bg, color: st.fg, height: 22 }} /></TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{f.where ?? (f.page ? `p${f.page}` : '')}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}

function ReasonDialog({ open, title, label, onClose, onConfirm }: { open: boolean; title: string; label: string; onClose: () => void; onConfirm: (r: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent><TextField autoFocus fullWidth multiline minRows={3} label={label} value={reason} onChange={e => setReason(e.target.value)} sx={{ mt: 1 }} /></DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" disabled={!reason.trim()} onClick={() => { onConfirm(reason); setReason(''); }}>Confirm</Button></DialogActions>
    </Dialog>
  );
}

export default function CaseDrawer() {
  const [params, setParams] = useSearchParams();
  const id = params.get('case');
  const me = useMe();
  const qc = useQueryClient();
  const [viewer, setViewer] = useState<ViewerTarget | null>(null);
  const [editing, setEditing] = useState<Field | null>(null);
  const [editValue, setEditValue] = useState('');
  const [dialog, setDialog] = useState<null | 'decline' | 'send_back' | 'reject'>(null);
  const [cb, setCb] = useState({ number_called: '', contact_name: '', outcome: 'confirmed', notes: '' });
  const close = () => { const p = new URLSearchParams(params); p.delete('case'); setParams(p); };
  const { data: c, error } = useQuery({ queryKey: ['case', id], queryFn: () => api<Case>(`/api/cases/${id}`), enabled: !!id, refetchInterval: 5000 });

  useEffect(() => {
    if (c?.payload?.callback) setCb(v => ({ ...v, number_called: c.payload!.callback!.phone_on_file ?? '', contact_name: c.payload!.callback!.contact?.split(',')[0] ?? '' }));
  }, [c?.id, c?.payload?.callback?.phone_on_file]);

  const act = useMutation({
    mutationFn: ({ action, body }: { action: string; body?: unknown }) => post<Case>(`/api/cases/${id}/${action}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['case', id] }); qc.invalidateQueries({ queryKey: ['cases'] }); qc.invalidateQueries({ queryKey: ['counts'] }); qc.invalidateQueries({ queryKey: ['team'] }); },
  });

  const can = c?.can;
  const callbackOk = c?.callback?.outcome === 'confirmed' && c.callback.payload_version === c.payload_version;
  const drafts = (c?.events ?? []).filter(e => e.kind === 'agent.draft_message');
  const open = (ev: Evidence, focus?: string) => setViewer({ documentId: ev.document_id, title: ev.title, fields: ev.fields, focus, demo: ev.demo });

  return (
    <Drawer anchor="right" open={!!id} onClose={close} sx={{ zIndex: t => t.zIndex.drawer + 2 }} PaperProps={{ sx: { width: { xs: '100%', md: '72%', xl: '62%' }, bgcolor: '#F4F6FA' } }}>
      {!c ? (
        <Box sx={{ p: 6, textAlign: 'center' }}>{error ? <Alert severity="error">{(error as Error).message}</Alert> : <CircularProgress />}</Box>
      ) : (
        <Box>
          <Box sx={{ bgcolor: '#fff', px: 4, pt: 3, pb: 2.5, borderBottom: `1px solid ${colors.line}`, position: 'sticky', top: 0, zIndex: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Typography variant="h5" sx={{ fontFamily: 'Consolas, "SF Mono", monospace', fontWeight: 600 }}>{c.id}</Typography>
              <PriorityChip p={c.priority} size="medium" />
              {c.is_demo && <Chip label="Demo data" size="small" />}
              <Box sx={{ flex: 1 }} />
              <IconButton onClick={close} aria-label="Close"><CloseIcon /></IconButton>
            </Stack>
            <Typography sx={{ mt: 0.5, color: colors.muted, fontSize: 16 }}>{c.workflow_code} · {c.workflow_name} — {c.title}</Typography>
            <Stack direction="row" spacing={3} alignItems="center" sx={{ mt: 1.5, color: colors.ink, flexWrap: 'wrap', rowGap: 1 }}>
              <Stack direction="row" spacing={0.75} alignItems="center"><FlagIcon fontSize="small" sx={{ color: '#3F4A5C' }} /><span>{c.priority}: {c.priority_reason ?? '—'}</span></Stack>
              {c.cutoff_at && <Stack direction="row" spacing={0.75} alignItems="center"><ScheduleIcon fontSize="small" sx={{ color: '#3F4A5C' }} /><span>cut-off {etTime(c.cutoff_at)} · {untilText(c.cutoff_at)}</span></Stack>}
              <StateChip state={c.state} />
              <Stack direction="row" spacing={0.75} alignItems="center"><PersonIcon fontSize="small" sx={{ color: '#3F4A5C' }} /><span>{c.assignee_name ?? c.maker_name ?? 'Unassigned'}</span></Stack>
              <Stack direction="row" spacing={0.75} alignItems="center"><PaymentsIcon fontSize="small" sx={{ color: '#3F4A5C' }} /><span>{c.value_amount ? money(c.value_amount, c.value_ccy) : 'No case value'}</span></Stack>
            </Stack>
          </Box>

          <Box sx={{ p: 3.5 }}>
            {can?.read_only && <Box sx={{ mb: 2.5 }}><ReadOnlyBanner /></Box>}
            {act.isError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => act.reset()}>{(act.error as Error).message}</Alert>}

            {c.diagnosis && (
              <Section title="Agent diagnosis" right={<Typography color="text.secondary">{c.diagnosis.agent}</Typography>}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 17, mb: 1 }}>{c.diagnosis.title}</Typography>
                    <Typography sx={{ color: '#3B4555', lineHeight: 1.65 }}>{c.diagnosis.summary}</Typography>
                    {c.proposed_action && (
                      <Stack direction="row" spacing={3} sx={{ mt: 2.5 }}>
                        <Typography color="text.secondary" sx={{ minWidth: 80 }}>Proposed action</Typography>
                        <Typography fontWeight={600}>{c.proposed_action.text}</Typography>
                      </Stack>
                    )}
                  </Box>
                  <Box sx={{ width: { md: 300 } }}><ConfidenceBar value={c.diagnosis.confidence} threshold={c.diagnosis.threshold} /></Box>
                </Stack>
              </Section>
            )}

            {c.checks.length > 0 && (
              <Section title="Checks" right={<Typography variant="body2" color="text.secondary">Placeholders are internal checks not yet built</Typography>}>
                <Stack divider={<Divider />} spacing={1.25}>
                  {c.checks.map(ch => (
                    <Stack key={ch.id} direction="row" spacing={1.5} alignItems="flex-start">
                      {CHECK_ICON[ch.status]}
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography fontWeight={600}>{ch.label}</Typography>
                          {ch.status === 'placeholder' && <Chip size="small" label="Not yet validated" sx={{ height: 20, bgcolor: '#FEF3C7', color: '#92400E' }} />}
                        </Stack>
                        <Typography variant="body2" color="text.secondary">{ch.detail}</Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">{ch.source}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Section>
            )}

            {c.payload?.diffs && c.payload.diffs.length > 0 && (
              <Section title="Change to the SSI" right={<Typography color="text.secondary">Effective {c.payload.effective_date}</Typography>}>
                {c.payload.diffs.map((d, i) => (
                  <Box key={i} sx={{ mb: 1 }}>
                    <Typography fontWeight={600} sx={{ mb: 1 }}>{d.currency} {display(d.asset_class)} {d.is_new ? <Chip size="small" label="New instruction" sx={{ ml: 1 }} /> : <Typography component="span" variant="body2" color="text.secondary">· replaces {d.current_record_id}</Typography>}</Typography>
                    <Table size="small">
                      <TableHead><TableRow><TableCell /><TableCell>Current (SSI hub)</TableCell><TableCell>Proposed (letter)</TableCell></TableRow></TableHead>
                      <TableBody>
                        {d.rows.map(r => (
                          <TableRow key={r.field} sx={{ bgcolor: r.changed ? '#FFFBEB' : undefined }}>
                            <TableCell sx={{ color: 'text.secondary' }}>{r.label}</TableCell>
                            <TableCell sx={{ textDecoration: r.changed && r.current ? 'line-through' : 'none', color: r.changed ? 'text.secondary' : 'inherit' }}>{r.current ?? '—'}</TableCell>
                            <TableCell sx={{ fontWeight: r.changed ? 700 : 400 }}>{r.proposed ?? '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                ))}
              </Section>
            )}

            <Section title="Evidence" right={<Typography variant="body2" color="text.secondary">Click a field to open the document with that region highlighted</Typography>}>
              {c.evidence.length === 0 ? <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>No source documents attached to this case.</Typography>
                : c.evidence.map(ev => <EvidenceBlock key={ev.document_id} ev={ev} editable={!!can?.act} onOpen={f => open(ev, f)}
                    onEdit={f => { setEditing(f); setEditValue(String(f.value ?? '')); }} />)}
            </Section>

            {!c.is_demo && c.workflow_code === 'SD-1' && (can?.act || can?.approve || c.state !== 'in_review') && (
              <Section title={c.state === 'awaiting_approval' ? 'Approval' : c.state === 'executing' || c.state === 'closed' ? 'Outcome' : 'Call-back and submit'}>
                {c.callback && (
                  <Alert severity={callbackOk ? 'success' : 'warning'} icon={<PhoneInTalkIcon />} sx={{ mb: 2 }}>
                    Call-back {c.callback.outcome.replace('_', ' ')}: {c.callback.by_name} called {c.callback.contact_name} on {c.callback.number_called} at {etTime(c.callback.at)}
                    {c.callback.notes ? ` — ${c.callback.notes}` : ''}{!callbackOk && c.callback.outcome === 'confirmed' ? ' (fields changed since: call again)' : ''}
                  </Alert>
                )}
                {can?.act && c.state !== 'awaiting_approval' && (
                  <>
                    {c.payload?.callback?.phone_on_file && (
                      <Typography sx={{ mb: 2 }}>
                        Number on file: <b>{c.payload.callback.phone_on_file}</b> ({c.payload.callback.contact}).{' '}
                        {c.payload.callback.phone_in_letter && <Typography component="span" color="text.secondary">The letter gives {c.payload.callback.phone_in_letter}; never call a number from the document.</Typography>}
                      </Typography>
                    )}
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
                      <TextField label="Number called" value={cb.number_called} onChange={e => setCb({ ...cb, number_called: e.target.value })} size="small" />
                      <TextField label="Spoke to" value={cb.contact_name} onChange={e => setCb({ ...cb, contact_name: e.target.value })} size="small" />
                      <TextField select label="Outcome" value={cb.outcome} onChange={e => setCb({ ...cb, outcome: e.target.value })} size="small" sx={{ minWidth: 200 }}>
                        <MenuItem value="confirmed">Confirmed the instructions</MenuItem>
                        <MenuItem value="no_answer">No answer</MenuItem>
                        <MenuItem value="mismatch">Details did not match</MenuItem>
                      </TextField>
                      <TextField label="Notes" value={cb.notes} onChange={e => setCb({ ...cb, notes: e.target.value })} size="small" sx={{ flex: 1 }} />
                      <Button variant="outlined" startIcon={<PhoneInTalkIcon />} disabled={act.isPending} onClick={() => act.mutate({ action: 'callback', body: cb })}>Record call-back</Button>
                    </Stack>
                    <Stack direction="row" spacing={1.5}>
                      <Tooltip title={callbackOk ? '' : 'Record a confirmed call-back to the number on file first'}>
                        <span><Button variant="contained" size="large" disabled={!can.submit || !callbackOk || act.isPending} onClick={() => act.mutate({ action: 'submit' })}>Submit for approval</Button></span>
                      </Tooltip>
                      <Button color="error" variant="text" disabled={!can.decline} onClick={() => setDialog('decline')}>Decline request</Button>
                    </Stack>
                  </>
                )}
                {c.state === 'awaiting_approval' && (
                  <>
                    <Typography sx={{ mb: 2 }}>Submitted by <b>{c.maker_name}</b> {c.submitted_at && `at ${etTime(c.submitted_at)}`}. A different person must approve.</Typography>
                    {can?.approve ? (
                      <Stack direction="row" spacing={1.5}>
                        <Button variant="contained" size="large" color="success" disabled={act.isPending} onClick={() => act.mutate({ action: 'approve', body: { reason: '' } })}>Approve and update SSI hub</Button>
                        <Button variant="outlined" onClick={() => setDialog('send_back')}>Send back</Button>
                        <Button color="error" onClick={() => setDialog('reject')}>Reject</Button>
                      </Stack>
                    ) : <Typography color="text.secondary">{me.checkers.includes(c.team_id) ? 'You submitted this case, so you cannot approve it.' : 'Waiting for a checker.'}</Typography>}
                  </>
                )}
                {(c.state === 'executing' || c.state === 'closed') && (
                  <Typography>
                    {c.checker_name && <>Approved by <b>{c.checker_name}</b> at {c.decided_at && etTime(c.decided_at)} (maker {c.maker_name}). </>}
                    {c.sor_result?.created && <>SSI hub created {c.sor_result.created.join(', ')}{c.sor_result.end_dated?.length ? `, end-dated ${c.sor_result.end_dated.join(', ')}` : ''}, effective {c.sor_result.effective_date}. </>}
                    {c.sor_result?.error && <Typography component="span" color="error">Hub update failed: {c.sor_result.error}</Typography>}
                    {c.state === 'executing' && !c.sor_result?.error && 'Waiting for the hub to confirm…'}
                    {c.state === 'closed' && <>Closed: <b>{c.outcome}</b>.</>}
                  </Typography>
                )}
              </Section>
            )}

            {drafts.map(d => (
              <Section key={d.id} title="Draft message to the counterparty" right={<Chip icon={<MailOutlineIcon />} label="Communication agent · draft" size="small" />}>
                <Typography fontWeight={600}>{String(d.detail.subject ?? '')}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>To {String(d.detail.to ?? '')}</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap', bgcolor: '#FAFBFC', p: 2, borderRadius: 2, border: `1px solid ${colors.line}` }}>{String(d.detail.body ?? '')}</Typography>
                <Button startIcon={<ContentCopyIcon />} sx={{ mt: 1 }} onClick={() => navigator.clipboard?.writeText(String(d.detail.body ?? ''))}>Copy</Button>
              </Section>
            ))}

            <Section title="Case timeline" right={<Link component={RouterLink} to={`/audit?case_id=${c.id}`}>Open in Audit Trail</Link>}>
              <Stack spacing={1.5}>
                {(c.events ?? []).map(e => (
                  <Stack key={e.id} direction="row" spacing={2}>
                    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 110 }}>{etDateTime(e.at)}</Typography>
                    <Chip size="small" label={e.actor_type === 'user' ? 'Person' : e.actor_type === 'agent' ? 'Agent' : 'System'}
                      sx={{ height: 22, bgcolor: e.actor_type === 'user' ? '#E5EDFA' : e.actor_type === 'agent' ? '#EEE8FB' : '#EEF1F5' }} />
                    <Typography variant="body2" sx={{ flex: 1 }}>{e.summary}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Section>
          </Box>
        </Box>
      )}
      <DocumentViewer target={viewer} onClose={() => setViewer(null)} />
      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
        <DialogTitle>Correct {editing?.label}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Extracted as {display(editing?.value)} ({editing?.confidence.toFixed(2)}). The correction is recorded and the call-back must be repeated.</Typography>
          <TextField autoFocus fullWidth label="Value" value={editValue} onChange={e => setEditValue(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => { act.mutate({ action: 'fields', body: { path: editing!.path, value: editValue, reason: 'Corrected against the document' } }); setEditing(null); }}>Save correction</Button>
        </DialogActions>
      </Dialog>
      <ReasonDialog open={dialog === 'decline'} title="Decline this request" label="Reason (kept on the timeline)" onClose={() => setDialog(null)}
        onConfirm={r => { act.mutate({ action: 'decline', body: { reason: r } }); setDialog(null); }} />
      <ReasonDialog open={dialog === 'send_back'} title="Send back to the maker" label="What needs fixing" onClose={() => setDialog(null)}
        onConfirm={r => { act.mutate({ action: 'reject', body: { reason: r, mode: 'send_back' } }); setDialog(null); }} />
      <ReasonDialog open={dialog === 'reject'} title="Reject this change" label="Reason" onClose={() => setDialog(null)}
        onConfirm={r => { act.mutate({ action: 'reject', body: { reason: r, mode: 'reject' } }); setDialog(null); }} />
    </Drawer>
  );
}
