import { Box, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import { colors } from '../theme';
import { STATE_LABEL, etTime, untilText } from '../format';

export function ScopeChip({ scope, oversight }: { scope: string; oversight: boolean }) {
  return (
    <Chip
      icon={oversight ? <VisibilityOutlinedIcon /> : <GroupsOutlinedIcon />}
      label={`Scope: ${scope}`}
      variant="outlined"
      sx={{ fontWeight: 500, bgcolor: oversight ? '#F3F5F8' : '#EEF3FB', borderColor: oversight ? '#D5DBE5' : '#B9CBEA',
        color: oversight ? colors.ink : colors.primary, '& .MuiChip-icon': { color: 'inherit' } }}
    />
  );
}

export function ReadOnlyBanner({ text = 'Read-only: oversight view' }: { text?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 1.5, borderRadius: 2, border: `1px solid ${colors.line}`,
      borderLeft: `4px solid #6B7686`, bgcolor: '#F6F7F9', color: colors.ink, fontWeight: 500 }}>
      <VisibilityOutlinedIcon fontSize="small" sx={{ color: '#4A5465' }} /> {text}
    </Box>
  );
}

export function PriorityChip({ p, size = 'small' }: { p: 'P1' | 'P2' | 'P3'; size?: 'small' | 'medium' }) {
  const c = p === 'P1' ? colors.p1 : p === 'P2' ? colors.p2 : colors.p3;
  return <Chip size={size} label={p} sx={{ bgcolor: c.bg, color: c.fg, border: `1px solid ${c.border}`, fontWeight: 700, minWidth: 40 }} />;
}

export function StateChip({ state }: { state: string }) {
  const map: Record<string, { fg: string; bg: string }> = {
    in_review: { fg: '#B54708', bg: '#FEF0E1' }, awaiting_approval: { fg: '#1F4E9E', bg: '#E5EDFA' },
    waiting: { fg: '#6941C6', bg: '#F1ECFB' }, executing: { fg: '#0E7490', bg: '#E2F4F7' },
    closed: { fg: '#1E7B4A', bg: '#E5F4EC' }, open: { fg: colors.muted, bg: '#EEF1F5' },
  };
  const c = map[state] ?? map.open;
  return <Chip size="small" label={STATE_LABEL[state] ?? state} sx={{ bgcolor: c.bg, color: c.fg, fontWeight: 600 }} />;
}

export function Cutoff({ iso }: { iso: string | null }) {
  if (!iso) return <Typography variant="body2" color="text.secondary">No cut-off<br />today</Typography>;
  const urgent = new Date(iso).getTime() - Date.now() < 4 * 3600_000;
  return (
    <Box>
      <Typography variant="body2" sx={{ color: urgent ? colors.crit : colors.ink, fontWeight: urgent ? 600 : 500 }}>{untilText(iso)}</Typography>
      <Typography variant="caption" color="text.secondary">{etTime(iso)}</Typography>
    </Box>
  );
}

export function ConfidenceBar({ value, threshold }: { value: number; threshold: number }) {
  const ok = value >= threshold;
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline">
        <Typography variant="body2" color="text.secondary">Agent confidence</Typography>
        <Typography variant="body2" fontWeight={700}>{Math.round(value * 100)}%</Typography>
      </Stack>
      <Box sx={{ position: 'relative', mt: 0.75 }}>
        <LinearProgress variant="determinate" value={value * 100}
          sx={{ height: 8, borderRadius: 4, bgcolor: '#E6E9EF',
            '& .MuiLinearProgress-bar': { borderRadius: 4, background: ok ? 'linear-gradient(90deg,#1E6B48,#1F4E9E)' : 'linear-gradient(90deg,#C25E0A,#D9822B)' } }} />
        <Box sx={{ position: 'absolute', top: -3, bottom: -3, left: `${threshold * 100}%`, width: 2, bgcolor: '#4A5465', borderRadius: 1 }} />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
        Threshold for this workflow: {threshold.toFixed(2)}{ok ? '' : ' — below threshold, review closely'}
      </Typography>
    </Box>
  );
}

export function DemoTag() {
  return <Chip size="small" label="Demo data" sx={{ height: 20, fontSize: 11, bgcolor: '#F2F4F7', color: '#667085', fontWeight: 600 }} />;
}

export function PageHeader({ title, scope, oversight, subtitle, right }: { title: string; scope: string; oversight: boolean; subtitle?: string; right?: React.ReactNode }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap" useFlexGap>
        <Typography variant="h4">{title}</Typography>
        <ScopeChip scope={scope} oversight={oversight} />
        <Box sx={{ flex: 1 }} />
        {right}
      </Stack>
      {subtitle && <Typography sx={{ mt: 1, color: colors.muted, fontSize: '1.02rem' }}>{subtitle}</Typography>}
    </Box>
  );
}
