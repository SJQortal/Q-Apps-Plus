import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createAppTheme, UI_THEME_IDS, type ColorMode } from '../hub-theme'
import { CLASSIC_BOOT_BACKGROUND, THEME_STORAGE_KEY, themeConfig } from './qplus-theme'

const modes: ColorMode[] = ['light', 'dark']

describe('Q-Mail+ theme config', () => {
  it('builds every theme in both host modes', () => {
    for (const id of UI_THEME_IDS) {
      for (const mode of modes) {
        const theme = createAppTheme(id, mode, themeConfig)
        expect(theme.qplus.id).toBe(id)
        expect(theme.palette.mode).toBe(id === 'black' ? 'dark' : id === 'white' ? 'light' : mode)
      }
    }
  })

  it('keeps the original Q-Mail palette as Q-Mail Classic', () => {
    const dark = createAppTheme('hub20', 'dark', themeConfig)
    const light = createAppTheme('hub20', 'light', themeConfig)
    expect(dark.palette.background.default).toBe(CLASSIC_BOOT_BACKGROUND.dark)
    expect(dark.palette.secondary.main).toBe('#39afff')
    expect(light.palette.background.default).toBe(CLASSIC_BOOT_BACKGROUND.light)
    expect(light.palette.secondary.main).toBe('#1b74c2')
    expect(themeConfig.hub20.bootBackground).toEqual(CLASSIC_BOOT_BACKGROUND)
    expect(themeConfig.hub20.name).toBe('Q-Mail Classic')
  })

  it('has a boot snippet in index.html that uses the same key and colours', () => {
    const html = readFileSync(path.join(process.cwd(), 'index.html'), 'utf8')
    expect(html).toContain(`var STORAGE_KEY = '${THEME_STORAGE_KEY}';`)
    expect(html).toContain(`var HUB20 = { light: '${CLASSIC_BOOT_BACKGROUND.light}', dark: '${CLASSIC_BOOT_BACKGROUND.dark}' };`)
    expect(html).toContain('<title>Q-Mail+</title>')
  })
})
