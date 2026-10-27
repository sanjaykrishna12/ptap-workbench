import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Avatar, Box, Button, Card, CircularProgress, List, ListItemAvatar, ListItemButton, ListItemText, Typography } from '@mui/material';
import { post, setToken } from '../api';
import { cognitoCallback, cognitoSignIn, useAuthConfig } from '../auth';
import { initials } from '../format';
import { colors } from '../theme';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: `linear-gradient(160deg, ${colors.navyDark}, ${colors.navy} 55%, #2A5DA8)`, p: 2 }}>
      <Card sx={{ p: 4, width: 480, maxWidth: '100%', borderRadius: 4 }}>
        <Typography variant="h5">Agentic Digital Workflow</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>Post-trade operations workbench</Typography>
        {children}
      </Card>
    </Box>
  );
}

export default function Login() {
  const { data: cfg, error } = useAuthConfig();
  const nav = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  if (error) return <Shell><Alert severity="error">Cannot reach the workbench service.</Alert></Shell>;
  if (!cfg) return <Shell><CircularProgress /></Shell>;
  if (cfg.mode === 'cognito') {
    return <Shell><Button fullWidth size="large" variant="contained" onClick={() => cognitoSignIn(cfg)}>Sign in</Button></Shell>;
  }
  const signIn = async (user_id: string) => {
    setBusy(user_id);
    const { token } = await post<{ token: string }>('/api/auth/local-login', { user_id });
    setToken(token);
    nav('/', { replace: true });
    location.reload();
  };
  return (
    <Shell>
      <Alert severity="info" sx={{ mb: 2 }}>Development sign-in: choose a persona. In AWS this is replaced by Cognito.</Alert>
      <List>
        {cfg.personas?.map(p => (
          <ListItemButton key={p.user_id} onClick={() => signIn(p.user_id)} disabled={!!busy} sx={{ borderRadius: 2, mb: 0.5, border: `1px solid ${colors.line}` }}>
            <ListItemAvatar><Avatar sx={{ bgcolor: '#E8EEF8', color: colors.navy, fontWeight: 700 }}>{initials(p.name)}</Avatar></ListItemAvatar>
            <ListItemText primary={p.name} secondary={`${p.title} · ${p.groups.join(', ')}`} />
            {busy === p.user_id && <CircularProgress size={18} />}
          </ListItemButton>
        ))}
      </List>
    </Shell>
  );
}

export function AuthCallback() {
  const { data: cfg } = useAuthConfig();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const code = params.get('code');
    if (!cfg || !code) return;
    cognitoCallback(cfg, code).then(() => { nav('/', { replace: true }); location.reload(); }).catch(e => setErr(e.message));
  }, [cfg, params, nav]);
  return <Shell>{err ? <Alert severity="error">{err}</Alert> : <CircularProgress />}</Shell>;
}
