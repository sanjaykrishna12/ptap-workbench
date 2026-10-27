import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Chip, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, List, ListItemButton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { api, type Field } from '../api';
import { display } from '../format';
import { colors } from '../theme';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface ViewerTarget { documentId: string; title: string; fields: Field[]; focus?: string | null; demo?: boolean }

export default function DocumentViewer({ target, onClose }: { target: ViewerTarget | null; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [doc, setDoc] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setFocus(target.focus ?? null);
    const f = target.fields.find(x => x.path === target.focus);
    setPage(f?.page ?? 1);
    setDoc(null); setError(null);
    if (target.demo) return;
    let cancelled = false;
    api<Blob>(`/api/documents/${target.documentId}/content`)
      .then(b => b.arrayBuffer())
      .then(buf => pdfjs.getDocument({ data: buf }).promise)
      .then(d => { if (!cancelled) setDoc(d); })
      .catch(e => setError(e.message ?? 'Could not open the document'));
    return () => { cancelled = true; };
  }, [target]);

  useEffect(() => {
    if (!doc || !canvas.current) return;
    let task: pdfjs.RenderTask | null = null;
    doc.getPage(page).then(p => {
      const vp = p.getViewport({ scale: 1.6 });
      const c = canvas.current!;
      c.width = vp.width; c.height = vp.height;
      setSize({ w: vp.width, h: vp.height });
      task = p.render({ canvasContext: c.getContext('2d')!, viewport: vp });
    });
    return () => { task?.cancel(); };
  }, [doc, page]);

  const fields = target?.fields.filter(f => f.value !== null && f.value !== undefined && f.value !== '') ?? [];
  const focused = fields.find(f => f.path === focus);
  const boxes = fields.filter(f => f.page === page && f.bbox);

  return (
    <Dialog open={!!target} onClose={onClose} maxWidth="xl" fullWidth sx={{ zIndex: 1500 }} PaperProps={{ sx: { height: '92vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Typography variant="h6">{target?.documentId} · {target?.title}</Typography>
        {focused && <Chip label={`${focused.label}: ${display(focused.value)}`} sx={{ bgcolor: '#FFF4CC' }} />}
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={onClose} aria-label="Close document"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', gap: 2, p: 2, overflow: 'hidden' }}>
        <Box sx={{ flex: 1, overflow: 'auto', bgcolor: '#E9ECF1', borderRadius: 2, display: 'flex', justifyContent: 'center', p: 2 }}>
          {target?.demo ? (
            <Alert severity="info" sx={{ alignSelf: 'flex-start' }}>Demo case: this evidence has no source file in the MVP.</Alert>
          ) : error ? <Alert severity="error" sx={{ alignSelf: 'flex-start' }}>{error}</Alert> : !doc ? <CircularProgress sx={{ mt: 10 }} /> : (
            <Box sx={{ position: 'relative', width: size ? size.w / 1.6 * 1.25 : 'auto', boxShadow: '0 2px 12px rgba(0,0,0,.15)', bgcolor: '#fff', height: 'fit-content' }}>
              <canvas ref={canvas} style={{ width: '100%', display: 'block' }} />
              {size && boxes.map(f => {
                const [x0, y0, x1, y1] = f.bbox!;
                const active = f.path === focus;
                return (
                  <Box key={f.path} onClick={() => setFocus(f.path ?? null)} title={`${f.label}: ${display(f.value)} (${f.confidence.toFixed(2)})`}
                    sx={{ position: 'absolute', left: `${x0 * 100 - 0.4}%`, top: `${y0 * 100 - 0.3}%`, width: `${(x1 - x0) * 100 + 0.8}%`, height: `${(y1 - y0) * 100 + 0.6}%`,
                      border: active ? '2px solid #E2A100' : '1px dashed rgba(31,78,158,.45)', bgcolor: active ? 'rgba(255,214,0,.32)' : 'rgba(31,78,158,.06)',
                      borderRadius: 0.5, cursor: 'pointer', transition: 'all .15s', boxShadow: active ? '0 0 0 4px rgba(255,200,0,.25)' : 'none' }} />
                );
              })}
            </Box>
          )}
        </Box>
        <Box sx={{ width: 340, overflow: 'auto' }}>
          <Typography variant="overline" color="text.secondary">Extracted fields</Typography>
          <List dense>
            {fields.map(f => (
              <ListItemButton key={f.path} selected={f.path === focus} onClick={() => { setFocus(f.path ?? null); if (f.page) setPage(f.page); }}
                sx={{ borderRadius: 1.5, alignItems: 'flex-start', '&.Mui-selected': { bgcolor: '#FFF4CC' } }}>
                <Stack sx={{ width: '100%' }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">{f.label}</Typography>
                    <Typography variant="caption" sx={{ color: f.confidence < 0.9 ? colors.warn : 'text.secondary' }}>{f.confidence.toFixed(2)}{f.page ? ` · p${f.page}` : ''}</Typography>
                  </Stack>
                  <Typography variant="body2" fontWeight={600} sx={{ wordBreak: 'break-word' }}>{display(f.value)}</Typography>
                </Stack>
              </ListItemButton>
            ))}
          </List>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
