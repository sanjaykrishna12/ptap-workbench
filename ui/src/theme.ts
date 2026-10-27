import { createTheme } from '@mui/material/styles';

export const colors = {
  navy: '#0D3B7A',
  navyDark: '#0A2F63',
  primary: '#1F4E9E',
  ink: '#1B2433',
  muted: '#5B6577',
  line: '#E3E7EE',
  page: '#F4F6FA',
  navActive: '#E2E9F4',
  p1: { fg: '#B42318', bg: '#FDECEA', border: '#F4B7B0' },
  p2: { fg: '#8A4B08', bg: '#FBEEDD', border: '#EBC79A' },
  p3: { fg: '#475467', bg: '#EEF1F5', border: '#CBD2DD' },
  ok: '#1E7B4A',
  warn: '#C25E0A',
  crit: '#C0262D',
};

export const theme = createTheme({
  palette: {
    primary: { main: colors.primary, dark: colors.navy },
    background: { default: colors.page, paper: '#FFFFFF' },
    text: { primary: colors.ink, secondary: colors.muted },
    divider: colors.line,
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif',
    h4: { fontWeight: 600, fontSize: '1.9rem', letterSpacing: '-0.01em' },
    h5: { fontWeight: 600, fontSize: '1.35rem' },
    h6: { fontWeight: 600, fontSize: '1.08rem' },
    overline: { fontWeight: 600, letterSpacing: '0.08em', fontSize: '0.72rem', lineHeight: 1.6 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiCard: { defaultProps: { elevation: 0 }, styleOverrides: { root: { border: `1px solid ${colors.line}`, borderRadius: 14 } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiTableCell: {
      styleOverrides: {
        head: { color: colors.muted, fontWeight: 600, fontSize: '0.74rem', letterSpacing: '0.05em', textTransform: 'uppercase' },
        root: { borderColor: colors.line },
      },
    },
  },
});
