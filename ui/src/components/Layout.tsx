import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AppBar, Avatar, Badge, Box, ButtonBase, Chip, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon,
  ListItemText, ListSubheader, Menu, MenuItem, Stack, Toolbar, Tooltip, Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AssignmentIcon from '@mui/icons-material/Assignment';
import HistoryIcon from '@mui/icons-material/History';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import HandshakeIcon from '@mui/icons-material/Handshake';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import ViewListIcon from '@mui/icons-material/ViewList';
import ShieldIcon from '@mui/icons-material/Shield';
import RedeemIcon from '@mui/icons-material/Redeem';
import BalanceIcon from '@mui/icons-material/Balance';
import PolicyIcon from '@mui/icons-material/Policy';
import NotificationsIcon from '@mui/icons-material/Notifications';
import InboxIcon from '@mui/icons-material/Inbox';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { api, type Alert } from '../api';
import { signOut, useAuthConfig, useMe } from '../auth';
import { initials } from '../format';
import { colors } from '../theme';
import AskPanel from './AskPanel';

const TEAM_ICON: Record<string, ReactNode> = {
  'trade-support': <PlaylistAddCheckIcon />, confirmations: <HandshakeIcon />, settlements: <AccountBalanceIcon />,
  'static-data': <ViewListIcon />, collateral: <ShieldIcon />, 'asset-servicing': <RedeemIcon />,
  reconciliations: <BalanceIcon />, 'regulatory-reporting': <PolicyIcon />,
};
const STAGE_ORDER = ['trade-support', 'confirmations', 'settlements', 'static-data', 'collateral', 'asset-servicing',
  'reconciliations', 'regulatory-reporting'];

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t); }, []);
  const t = now.toLocaleTimeString('en-CA', { timeZone: 'America/Toronto', hour: '2-digit', minute: '2-digit', hour12: false });
  return (
    <Chip icon={<ScheduleIcon />} label={`As of ${t} ET`}
      sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#fff', fontWeight: 600, '& .MuiChip-icon': { color: '#fff' } }} />
  );
}

function NavItem({ to, icon, label, badge, badgeColor, open }: { to: string; icon: ReactNode; label: string; badge?: number; badgeColor?: string; open: boolean }) {
  const loc = useLocation();
  const active = loc.pathname === to || (to !== '/' && loc.pathname.startsWith(to + '/'));
  const inner = (
    <ListItemButton component={NavLink} to={to} selected={active}
      sx={{ mx: 1, my: 0.25, borderRadius: 2, minHeight: 46, px: open ? 2 : 1.5, justifyContent: open ? 'initial' : 'center',
        '&.Mui-selected': { bgcolor: colors.navActive, color: colors.navy, '& .MuiListItemIcon-root': { color: colors.navy } },
        '&.Mui-selected:hover': { bgcolor: '#D7E1F0' } }}>
      <ListItemIcon sx={{ minWidth: open ? 40 : 0, color: '#3F4A5C' }}>
        {!open && badge ? <Badge badgeContent={badge} sx={{ '& .MuiBadge-badge': { bgcolor: badgeColor ?? colors.navy, color: '#fff' } }}>{icon}</Badge> : icon}
      </ListItemIcon>
      {open && <ListItemText primary={label} primaryTypographyProps={{ fontSize: 15, fontWeight: active ? 600 : 500 }} />}
      {open && badge ? <Chip size="small" label={badge} sx={{ bgcolor: badgeColor ?? colors.navy, color: '#fff', height: 24, fontWeight: 700 }} /> : null}
    </ListItemButton>
  );
  return open ? inner : <Tooltip title={label} placement="right">{inner}</Tooltip>;
}

export default function Layout({ children }: { children: ReactNode }) {
  const me = useMe();
  const { data: cfg } = useAuthConfig();
  const [open, setOpen] = useState(true);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const counts = useQuery({ queryKey: ['counts'], queryFn: () => api<{ total: number; teams: { team_id: string; count: number }[] }>('/api/queues/counts'), refetchInterval: 15_000 });
  const alerts = useQuery({ queryKey: ['alerts'], queryFn: () => api<Alert[]>('/api/alerts'), refetchInterval: 30_000 });
  const width = open ? 300 : 76;
  const teams = [...me.nav.teams].sort((a, b) => STAGE_ORDER.indexOf(a.id) - STAGE_ORDER.indexOf(b.id));
  const sub = (t: string) => open ? <ListSubheader sx={{ bgcolor: 'transparent', fontWeight: 700, letterSpacing: '0.08em', fontSize: 12, color: '#5B6577', lineHeight: '36px', mt: 1.5 }}>{t}</ListSubheader> : <Divider sx={{ my: 1, mx: 2 }} />;
  const mine = (counts.data?.teams ?? []).filter(t => me.teams.includes(t.team_id)).reduce((a, t) => a + t.count, 0);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" elevation={0} sx={{ zIndex: t => t.zIndex.drawer + 1, background: `linear-gradient(90deg, ${colors.navyDark}, ${colors.navy} 60%, #164A93)` }}>
        <Toolbar sx={{ minHeight: 68, gap: 2 }}>
          <IconButton color="inherit" onClick={() => setOpen(o => !o)} aria-label="Toggle navigation"><MenuIcon /></IconButton>
          <Typography sx={{ fontWeight: 600, fontSize: 17, display: { xs: 'none', sm: 'block' } }}>Post-trade operations</Typography>
          <Box sx={{ flex: 1 }} />
          <Clock />
          <ButtonBase onClick={e => setMenu(e.currentTarget)} sx={{ borderRadius: 3, px: 1.5, py: 0.75, bgcolor: 'rgba(255,255,255,0.1)', color: '#fff', textAlign: 'left' }}>
            <Avatar sx={{ width: 34, height: 34, bgcolor: '#E8EEF8', color: colors.navy, fontSize: 14, fontWeight: 700, mr: 1.25 }}>{initials(me.name)}</Avatar>
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              <Typography sx={{ fontWeight: 600, fontSize: 14.5, lineHeight: 1.2 }}>{me.name}</Typography>
              <Typography sx={{ fontSize: 12.5, opacity: 0.85 }}>{me.title}</Typography>
            </Box>
            <ExpandMoreIcon sx={{ ml: 1 }} />
          </ButtonBase>
          <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
            <MenuItem disabled>{me.scope}</MenuItem>
            <MenuItem onClick={() => signOut(cfg)}>{cfg?.mode === 'local' ? 'Switch persona' : 'Sign out'}</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Drawer variant="permanent" sx={{ width, flexShrink: 0, '& .MuiDrawer-paper': { width, boxSizing: 'border-box', borderRight: `1px solid ${colors.line}`, bgcolor: '#F7F8FA', transition: 'width .15s' } }}>
        <Toolbar sx={{ minHeight: 68 }} />
        <List dense sx={{ pt: 1 }}>
          {me.oversight ? (
            <>
              {sub('OVERVIEW')}
              <NavItem open={open} to="/overview" icon={<DashboardIcon />} label="Operations Overview" />
              <NavItem open={open} to="/queues" icon={<AssignmentIcon />} label="All Queues" badge={counts.data?.total} />
              <NavItem open={open} to="/audit" icon={<HistoryIcon />} label="Audit Trail" />
              {sub('LIFECYCLE')}
              {teams.map(t => <NavItem key={t.id} open={open} to={`/teams/${t.id}`} icon={TEAM_ICON[t.id]} label={t.stage_name} />)}
            </>
          ) : (
            <>
              {sub('MY WORK')}
              <NavItem open={open} to="/my-queue" icon={<InboxIcon />} label="My Queue" badge={mine} />
              <NavItem open={open} to="/audit" icon={<HistoryIcon />} label="Audit Trail" />
              {sub('MY WORKFLOWS')}
              {me.nav.my_workflows.map(w => <NavItem key={w.code} open={open} to={`/teams/${w.team_id}`} icon={TEAM_ICON[w.team_id]} label={w.name} />)}
            </>
          )}
          <Box sx={{ mt: 2 }} />
          <NavItem open={open} to="/alerts" icon={<NotificationsIcon />} label="Alerts" badge={alerts.data?.length} badgeColor="#C2410C" />
        </List>
      </Drawer>
      <Box component="main" sx={{ flex: 1, minWidth: 0, bgcolor: 'background.default' }}>
        <Toolbar sx={{ minHeight: 68 }} />
        <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1600 }}>{children}</Box>
      </Box>
      <AskPanel />
      <Stack sx={{ display: 'none' }} />
    </Box>
  );
}
