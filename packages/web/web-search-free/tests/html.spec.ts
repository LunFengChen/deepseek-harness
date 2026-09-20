import { describe, expect, it } from 'vitest'
import {
  decodeBingHref,
  decodeDdgHref,
  decodeHtmlEntities,
  isHttpUrl,
  parseBingHtml,
  parseDdgHtml,
  visibleText,
} from '../src/html.ts'

describe('HTML helpers', () => {
  it('accepts only absolute http(s) URLs', () => {
    expect(isHttpUrl('https://a.test')).toBe(true)
    expect(isHttpUrl('http://a.test')).toBe(true)
    expect(isHttpUrl('//a.test')).toBe(false)
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
  })

  it('decodes named, decimal, and hex entities', () => {
    expect(decodeHtmlEntities('A &amp; B &lt; C &quot;D&quot; &#39;E&#39; &#x2F; F')).toBe('A & B < C "D" \'E\' / F')
  })

  it('leaves unknown or invalid entities unchanged', () => {
    expect(decodeHtmlEntities('&unknown; &#x110000; &#-1;')).toBe('&unknown; &#x110000; &#-1;')
  })

  it('strips tags and collapses whitespace', () => {
    expect(visibleText('<b>Hello</b>  &nbsp; world')).toBe('Hello world')
    expect(visibleText('   <i>  </i>  ')).toBeUndefined()
  })
})

describe('Bing href recovery', () => {
  it('returns a direct non-Bing http URL', () => {
    expect(decodeBingHref('https://example.com/page')).toBe('https://example.com/page')
  })

  it('resolves a protocol-relative non-Bing href', () => {
    expect(decodeBingHref('//example.com/rel')).toBe('https://example.com/rel')
  })

  it('decodes a /ck/a tracking u= payload', () => {
    const encoded = Buffer.from('https://example.com/tracked').toString('base64')
    expect(decodeBingHref(`https://www.bing.com/ck/a?!&&p=abc&u=a1${encoded}&ntb=1`)).toBe('https://example.com/tracked')
  })


  it('decodes a tracking u= payload without the two-byte prefix', () => {
    const encoded = Buffer.from('https://example.com/noprefix').toString('base64')
    expect(decodeBingHref(`https://www.bing.com/ck/a?u=${encoded}`)).toBe('https://example.com/noprefix')
  })

  it('returns undefined when the two-byte prefix leaves an empty payload', () => {
    expect(decodeBingHref('https://www.bing.com/ck/a?u=a1')).toBeUndefined()
  })

  it('accepts a u= value that is already a URL', () => {
    expect(decodeBingHref('https://www.bing.com/ck/a?u=https://example.com/plain')).toBe('https://example.com/plain')
  })


  it('returns undefined for a malformed absolute URL', () => {
    expect(decodeBingHref('https://[')).toBeUndefined()
  })

  it('keeps a non-tracking Bing-host URL', () => {
    expect(decodeBingHref('https://bing.com/search?q=x')).toBe('https://bing.com/search?q=x')
  })

  it('returns undefined for an unusable href', () => {
    expect(decodeBingHref('not a url')).toBeUndefined()
    expect(decodeBingHref('https://www.bing.com/ck/a?u=zzz')).toBeUndefined()
  })
})

describe('DuckDuckGo href recovery', () => {
  it('decodes a uddg= redirect', () => {
    expect(decodeDdgHref('//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fddg')).toBe('https://example.com/ddg')
  })


  it('returns a DuckDuckGo URL when uddg is absent', () => {
    expect(decodeDdgHref('https://duckduckgo.com/l/?q=x')).toBe('https://duckduckgo.com/l/?q=x')
  })

  it('returns a direct non-DuckDuckGo http URL', () => {
    expect(decodeDdgHref('https://example.com/direct')).toBe('https://example.com/direct')
  })


  it('returns undefined for a malformed DuckDuckGo href', () => {
    expect(decodeDdgHref('https://[')).toBeUndefined()
  })

  it('returns undefined for an unusable href', () => {
    expect(decodeDdgHref('not a url')).toBeUndefined()
  })
})

describe('Bing HTML mapping', () => {
  it('maps title, snippet, tracking URL, and cite fallback', () => {
    const encoded = Buffer.from('https://a.test/from-bing').toString('base64')
    const html = `
      <ol id="b_results">
        <li class="b_algo">
          <h2><a href="https://www.bing.com/ck/a?u=a1${encoded}">Alpha &amp; title</a></h2>
          <div class="b_caption"><p>First snippet</p></div>
        </li>
        <li class="b_algo">
          <h2><a href="/ck/a?u=zzz">Cite only</a></h2>
          <cite>beta.test › path</cite>
          <p class="b_lineclamp2">Second snippet</p>
        </li>
        <li class="b_algo">
          <h2><a href="https://a.test/from-bing">duplicate</a></h2>
        </li>
        <li class="b_algo">
          <div>no heading</div>
        </li>
      </ol>
    `
    expect(parseBingHtml(html)).toEqual([
      { url: 'https://a.test/from-bing', title: 'Alpha & title', snippet: 'First snippet' },
      { url: 'https://beta.test', title: 'Cite only', snippet: 'Second snippet' },
    ])
  })


  it('maps a single-quoted href and an http cite fallback', () => {
    const html = `
      <li class="b_algo">
        <h2><a href='https://quoted.test/page'>Quoted</a></h2>
        <p>quoted snippet</p>
      </li>
      <li class="b_algo">
        <h2><a href="https://www.bing.com/ck/a?u=zzz">Cite http</a></h2>
        <cite>https://cite.test/from-cite</cite>
      </li>
    `
    expect(parseBingHtml(html)).toEqual([
      { url: 'https://quoted.test/page', title: 'Quoted', snippet: 'quoted snippet' },
      { url: 'https://cite.test/from-cite', title: 'Cite http' },
    ])
  })


  it('keeps a URL with empty title and drops a cite that is not a host', () => {
    const html = `
      <li class="b_algo"><h2><a href="https://empty-title.test"></a></h2></li>
      <li class="b_algo">
        <h2><a href="https://www.bing.com/ck/a?u=zzz">Nope</a></h2>
        <cite>not a host</cite>
      </li>
      <li class="b_algo"><h2><a>No href</a></h2></li>
    `
    expect(parseBingHtml(html)).toEqual([
      { url: 'https://empty-title.test' },
    ])
  })

  it('keeps a URL-only hit when the snippet is empty', () => {
    expect(parseBingHtml('<li class="b_algo"><h2><a href="https://only.test">T</a></h2></li>')).toEqual([
      { url: 'https://only.test', title: 'T' },
    ])
  })
})

describe('DuckDuckGo HTML mapping', () => {

  it('skips a result__a without href and reads a class snippet', () => {
    const html = `
      <a class="result__a">No href</a>
      <a class="result__a" href="https://c.test/three">Three</a>
      <span class="result__snippet">class snippet</span>
    `
    expect(parseDdgHtml(html)).toEqual([
      { url: 'https://c.test/three', title: 'Three', snippet: 'class snippet' },
    ])
  })

  it('maps result__a links and nearby snippets', () => {
    const html = `
      <div class="web-result">
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fa.test%2Fone">One</a>
        <a class="result__snippet" href="#">Snippet one</a>
      </div>
      <div class="web-result">
        <a rel="nofollow" class="result__a" href="https://b.test/two">Two</a>
      </div>
    `
    expect(parseDdgHtml(html)).toEqual([
      { url: 'https://a.test/one', title: 'One', snippet: 'Snippet one' },
      { url: 'https://b.test/two', title: 'Two' },
    ])
  })
})
