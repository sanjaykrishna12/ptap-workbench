import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Button, Chip, CircularProgress, Fab, IconButton, Paper, Stack, Table, TableBody, TableCell, TableRow, TextField, Typography } from '@mui/material';
import ForumIcon from '@mui/icons-material/Forum';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DescriptionIcon from '@mui/icons-material/Description';
import { api, post, type AskAnswer, type Envelope, type Extraction } from '../api';
import { useMe } from '../auth';
import { display } from '../format';
import { colors } from '../theme';
import DocumentViewer, { type ViewerTarget } from './DocumentViewer';

type Msg =
  | { role: 'user'; text: string }
  | { role: 'assistant'; answer: AskAnswer }
  | { role: 'upload'; envelope: Envelope; extraction?: Extraction; error?: string; started?: boolean };

const SUGGEST_OVERSIGHT = ['Give me a summary of today', 'Where are the open P1 cases?', 'What is awaiting approval?', 'Current SSIs for Northbridge Capital'];
const SUGGEST_TEAM = ['What needs my attention?', 'What is awaiting approval?', 'Current SSIs for Northbridge Capital', 'What is waiting on others?'];

export default function AskPanel() {
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [viewer, setViewer] = useState<ViewerTarget | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);
  const now = new Date().toLocaleTimeString('en-CA', { timeZone: 'America/Toronto', hour: '2-digit', minute: '2-digit', hour12: false });

  async function ask(q: string) {
    if (!q.trim()) return;
    const history = msgs.flatMap(m => m.role === 'user' ? [{ role: 'user', content: m.text }] : m.role === 'assistant' ? [{ role: 'assistant', content: m.answer.answer }] : []);
    setMsgs(m => [...m, { role: 'user', text: q }]);
    setText(''); setBusy(true);
    try {
      const answer = await post<AskAnswer>('/api/ask', { question: q === 'What needs my attention?' ? 'Where are the open P1 cases?' : q, history, context: { case_id: params.get('case') } });
      setMsgs(m => [...m, { role: 'assistant', answer }]);
    } catch (e) {
      setMsgs(m => [...m, { role: 'assistant', answer: { answer: (e as Error).message, citations: [], mode: 'error' } }]);
    } finally { setBusy(false); }
  }

  async function upload(f: File) {
    const fd = new FormData(); fd.append('file', f);
    setMsgs(m => [...m, { role: 'user', text: `Extract ${f.name}` }]);
    setBusy(true);
    try {
      const r = await api<{ envelope: Envelope; extraction?: Extraction; extraction_error?: string }>('/api/ask/upload', { method: 'POST', body: fd });
      setMsgs(m => [...m, { role: 'upload', envelope: r.envelope, extraction: r.extraction, error: r.extraction_error }]);
    } catch (e) {
      setMsgs(m => [...m, { role: 'assistant', answer: { answer: (e as Error).message, citations: [], mode: 'error' } }]);
    } finally { setBusy(false); }
  }

  async function start(i: number, env: Envelope) {
    await post(`/api/ask/start/${env.id}`);
    setMsgs(m => m.map((x, j) => j === i && x.role === 'upload' ? { ...x, started: true } : x));
  }

  const openCase = (id: string) => { const p = new URLSearchParams(params); p.set('case', id); setParams(p); };

  return (
    <>
      {!open && (
        <Fab onClick={() => setOpen(true)} sx={{ position: 'fixed', right: 28, bottom: 28, bgcolor: colors.navy, color: '#fff', width: 64, height: 64, '&:hover': { bgcolor: colors.navyDark } }} aria-label="Ask">
          <ForumIcon />
        </Fab>
      )}
      {open && (
        <Paper elevation={12} sx={{ position: 'fixed', right: 24, bottom: 24, top: 92, width: { xs: 'calc(100% - 48px)', sm: 480 }, display: 'flex', flexDirection: 'column', borderRadius: 4, overflow: 'hidden', zIndex: 1300 }}>
          <Box sx={{ bgcolor: colors.navy, color: '#fff', px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.12)', display: 'grid', placeItems: 'center' }}><AutoAwesomeIcon /></Box>
            <Box sx={{ flex: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1}><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#F5C542' }} /><Typography fontWeight={600} fontSize={18}>Ask</Typography></Stack>
              <Typography sx={{ fontSize: 13.5, opacity: 0.9 }}>{me.name} · {me.title} · as of {now} ET</Typography>
            </Box>
            <IconButton onClick={() => setOpen(false)} sx={{ color: '#fff' }}><CloseIcon /></IconButton>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: '#F7F8FA' }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 2 }}>
              <Typography sx={{ lineHeight: 1.6 }}>
                <b>Ask about anything in Agentic Digital Workflow.</b> Answers come from the systems of record for what is true now, from the extracted facts with provenance for history and evidence, and from the document index for the exact page to quote. Nothing without a citation is shown.
              </Typography>
              <Typography sx={{ mt: 1.5, lineHeight: 1.6 }}>
                Your scope is <b>{me.oversight ? 'all teams, read-only' : me.scope}</b>. Attach a PDF to have it extracted here{me.makers.includes('static-data') ? '; you can then start an SSI change from it' : ''}.
              </Typography>
            </Paper>
            {msgs.map((m, i) => m.role === 'user' ? (
              <Box key={i} sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
                <Box sx={{ bgcolor: colors.navy, color: '#fff', px: 2, py: 1.25, borderRadius: 3, maxWidth: '85%' }}>{m.text}</Box>
              </Box>
            ) : m.role === 'assistant' ? (
              <Paper key={i} variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 1.5 }}>
                <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{m.answer.answer}</Typography>
                {m.answer.citations.length > 0 && (
                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
                    {m.answer.citations.map((c, j) => (
                      <Chip key={j} size="small" label={c.label} variant="outlined" sx={{ maxWidth: 400 }}
                        onClick={c.kind === 'case' ? () => openCase(c.ref) : c.kind === 'document' ? () => setViewer({ documentId: c.ref, title: 'Document', fields: [] }) : undefined} />
                    ))}
                  </Stack>
                )}
              </Paper>
            ) : (
              <Paper key={i} variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <DescriptionIcon fontSize="small" />
                  <Typography fontWeight={600}>{m.envelope.document_id} · {m.envelope.filename}</Typography>
                </Stack>
                {m.error && <Typography color="error">{m.error}</Typography>}
                {m.extraction && (
                  <>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {m.extraction.pack_id.replace('_', ' ')} · {m.extraction.method === 'llamacloud' ? 'LlamaParse + LlamaExtract' : 'local template'} · confidence {m.extraction.overall_confidence.toFixed(2)}
                    </Typography>
                    <Table size="small">
                      <TableBody>
                        {m.extraction.fields.filter(f => f.value !== null && f.value !== '').slice(0, 14).map(f => (
                          <TableRow key={f.path} hover sx={{ cursor: 'pointer' }} onClick={() => setViewer({ documentId: m.extraction!.document_id, title: m.envelope.filename, fields: m.extraction!.fields, focus: f.path })}>
                            <TableCell sx={{ color: 'text.secondary', py: 0.75 }}>{f.label}</TableCell>
                            <TableCell sx={{ fontWeight: 600, py: 0.75 }}>{display(f.value)}</TableCell>
                            <TableCell sx={{ py: 0.75, color: f.confidence < 0.9 ? colors.warn : 'text.secondary' }}>{f.confidence.toFixed(2)} · p{f.page ?? '?'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {m.extraction.issues.length > 0 && <Typography variant="body2" sx={{ mt: 1, color: colors.warn }}>To check: {m.extraction.issues.join('; ')}</Typography>}
                    {m.extraction.pack_id === 'ssi_letter' && me.makers.includes('static-data') && (
                      m.started ? <Typography sx={{ mt: 1.5, color: colors.ok, fontWeight: 600 }}>Started: the SSI Change Agent is opening a case in your queue.</Typography>
                        : <Button variant="contained" sx={{ mt: 1.5 }} onClick={() => start(i, m.envelope)}>Start SSI change</Button>
                    )}
                  </>
                )}
              </Paper>
            ))}
            {busy && <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary', mb: 1 }}><CircularProgress size={16} /><span>Working…</span></Stack>}
            <div ref={endRef} />
          </Box>
          <Box sx={{ px: 2, pt: 1.5, pb: 1, borderTop: `1px solid ${colors.line}`, bgcolor: '#fff' }}>
            <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 1 }}>
              {(me.oversight ? SUGGEST_OVERSIGHT : SUGGEST_TEAM).map(s => <Chip key={s} label={s} variant="outlined" onClick={() => ask(s)} sx={{ flexShrink: 0, height: 36, fontSize: 14 }} />)}
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
              <IconButton onClick={() => fileRef.current?.click()} aria-label="Attach a PDF"><AttachFileIcon /></IconButton>
              <TextField fullWidth size="small" placeholder="Ask about a case, workflow, team, document or metric" value={text}
                onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') ask(text); }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 6, bgcolor: '#F7F8FA' } }} />
              <IconButton onClick={() => ask(text)} disabled={busy} sx={{ bgcolor: colors.navy, color: '#fff', '&:hover': { bgcolor: colors.navyDark } }} aria-label="Send"><ArrowForwardIcon /></IconButton>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Every answer is scoped to your permissions and carries a citation you can open.</Typography>
          </Box>
        </Paper>
      )}
      <DocumentViewer target={viewer} onClose={() => setViewer(null)} />
    </>
  );
}
