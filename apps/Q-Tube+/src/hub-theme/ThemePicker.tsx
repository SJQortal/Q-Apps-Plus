/**
 * The four theme cards for an app's Settings page. Ported from Torq's
 * SettingsPage "Appearance" section.
 *
 *   <ThemePicker />   // inside <HubThemeProvider>
 */
import { Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useHubTheme } from './HubThemeProvider';
import { themeOptions } from './tokens';

const Grid = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: theme.spacing(1.25),
  marginTop: theme.spacing(1.5),
}));

const Card = styled('button')<{ $active?: boolean }>(({ theme, $active }) => ({
  appearance: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  color: 'inherit',
  font: 'inherit',
  borderRadius: 12,
  border: `1px solid ${$active ? theme.palette.primary.main : theme.palette.divider}`,
  background: theme.palette.background.paper,
  padding: theme.spacing(1.25),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  boxShadow: $active ? `0 0 0 1px ${theme.palette.primary.main}` : 'none',
  transition: 'border-color 150ms ease, box-shadow 150ms ease',
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

const Swatches = styled('div')({
  display: 'flex',
  gap: 4,
});

const Swatch = styled('span')({
  width: 22,
  height: 22,
  borderRadius: 6,
  border: '1px solid rgba(128, 128, 128, 0.35)',
});

export function ThemePicker() {
  const { uiTheme, setUiTheme, config } = useHubTheme();

  return (
    <Grid role="radiogroup" aria-label="Theme">
      {themeOptions(config.hub20).map((option) => {
        const active = uiTheme === option.id;
        return (
          <Card
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            $active={active}
            onClick={() => setUiTheme(option.id)}
          >
            <Swatches aria-hidden>
              {option.swatches.map((color, i) => (
                <Swatch key={`${color}-${i}`} style={{ backgroundColor: color }} />
              ))}
            </Swatches>
            <div>
              <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                {option.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {option.description}
              </Typography>
            </div>
          </Card>
        );
      })}
    </Grid>
  );
}
