import { describe, expect, it } from 'vitest'
import { WEB_SEARCH_PROVIDER_OPTIONS } from '../src/client/web-provider-card-controller.ts'

describe('WEB_SEARCH_PROVIDER_OPTIONS', () => {
  it('lists the search pool and the pin-able leaves', () => {
    expect(WEB_SEARCH_PROVIDER_OPTIONS.map(option => option.value)).toEqual([
      '',
      'search-pool',
      'perplexity',
      'exa',
      'free',
      'deepseek-official',
    ])
  })
})
