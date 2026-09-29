// Smoke test for the kit; run with scripts/check-theme-kit.sh <App+>.
import { renderToString } from 'react-dom/server';
import { Button } from '@mui/material';
import { createAppTheme, tokensFromTheme, HubThemeProvider, ThemePicker, cssVariables, UI_THEME_IDS, type AppThemeConfig } from './index';

const config: AppThemeConfig = {
  hub20: { description: 'Original look', swatches: ['#111', '#222', '#39f', '#eee'], bootBackground: { light: '#fafafa', dark: '#121212' } },
  hub20Options: (mode) => ({ palette: { mode, primary: { main: '#3399ff' } } }),
};
for (const id of UI_THEME_IDS) for (const mode of ['light', 'dark'] as const) {
  const t = createAppTheme(id, mode, config);
  const v = cssVariables(tokensFromTheme(t));
  if (!v['--qp-bg'] || !t.qplus.chrome) throw new Error(`missing tokens for ${id}/${mode}`);
  console.log(`${id.padEnd(5)} ${mode.padEnd(5)} shown=${t.palette.mode.padEnd(5)} bg=${v['--qp-bg'].padEnd(8)} primary=${v['--qp-primary'].padEnd(8)} chrome=${t.qplus.chrome}`);
}
const html = renderToString(<HubThemeProvider storageKey="smoke-ui-theme" config={config}><ThemePicker /></HubThemeProvider>);
const cards = (html.match(/role="radio"/g) || []).length;
console.log(`SSR ok: ${cards} theme cards, checked=${(html.match(/aria-checked="true"/g) || []).length}`);

// The Hub 3.0 contained primary button must get the blue gradient (a style callback on ownerState).
const buttonHtml = renderToString(
  <HubThemeProvider storageKey="smoke-ui-theme" config={config}><Button variant="contained">Go</Button><Button>Text</Button></HubThemeProvider>
);
const gradients = (buttonHtml.match(/linear-gradient\(180deg, #8FB8F3/g) || []).length;
if (gradients < 1) throw new Error('Hub 3.0 contained button is missing its gradient');
console.log(`Button styles ok: gradient on contained primary (${gradients} style rules)`);
