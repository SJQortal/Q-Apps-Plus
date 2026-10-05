import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { store } from '../../state/store'
import { mockQortalAction } from '../../test/setup'
import { ShowMessage } from './ShowMessageWithoutModal'

describe('ShowMessage (a group thread post)', () => {
  beforeEach(() => {
    mockQortalAction('GET_QDN_RESOURCE_URL', '')
  })

  it('renders legacy htmlContent through the app sanitiser: no style, form, input or relative link', () => {
    const { container } = render(
      <Provider store={store}>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <ShowMessage
            message={{
              name: 'eve',
              created: 1,
              htmlContent:
                '<p>hello</p><style>body{display:none}</style><form action="/render/APP/Evil"><input name="password"></form><a href="/render/APP/Evil">invoice</a>',
            }}
          />
        </HubThemeProvider>
      </Provider>
    )
    expect(screen.getByText('hello')).toBeTruthy()
    const article = container.querySelector('article')!
    expect(article.querySelector('style, form, input')).toBeNull()
    expect(article.querySelector('a[href="/render/APP/Evil"]')).toBeNull()
  })
})
