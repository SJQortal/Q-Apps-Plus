// Smoke test for the kit; run with scripts/check-theme-kit.sh <App+>.
import { renderToString } from 'react-dom/server';
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
