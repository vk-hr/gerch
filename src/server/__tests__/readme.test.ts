import {
  cachedReadme,
  clearReadmeCache,
  renderMarkdownToHtml,
  sanitizeReadmeHtml,
} from "@/server/readme.server"
import { describe, expect, it } from "vitest"

describe("sanitizeReadmeHtml", () => {
  it("strips scripts and event handlers but keeps readme markup", () => {
    const html = sanitizeReadmeHtml(
      `<h2>Title</h2><script>alert(1)</script><p onclick="evil()">text</p><img src="x.png" alt="x">`
    )
    expect(html).not.toContain("<script>")
    expect(html).not.toContain("onclick")
    expect(html).toContain("<h2>Title</h2>")
    expect(html).toContain("<p>text</p>")
    expect(html).toContain('<img src="x.png" alt="x"')
  })

  it("opens links in a new tab with a safe rel", () => {
    const html = sanitizeReadmeHtml('<a href="https://example.com">link</a>')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noreferrer noopener"')
  })

  it("drops javascript: urls", () => {
    const html = sanitizeReadmeHtml('<a href="javascript:alert(1)">x</a>')
    expect(html).not.toContain("javascript:")
  })
})

describe("renderMarkdownToHtml", () => {
  it("renders markdown with allowHtml and resolves relative links", () => {
    const html = renderMarkdownToHtml(
      "# Title\n\n[docs](./docs)\n\n<div>raw html</div>",
      "https://github.com/owner/repo"
    )
    expect(html).toContain("<h1")
    expect(html).toContain('href="https://github.com/owner/repo/docs"')
    expect(html).toContain("<div>raw html</div>")
  })

  it("turns bare URLs into links but leaves code spans alone", () => {
    const html = renderMarkdownToHtml(
      "See https://react.dev/\n\n`https://example.com`"
    )

    expect(html).toContain('href="https://react.dev/"')
    expect(html).toContain(">https://react.dev/</a>")
    expect(html).toContain("<code>https://example.com</code>")
  })

  it("highlights fenced code with semantic classes and no inline colors", () => {
    const html = renderMarkdownToHtml("```ts\nconst answer: number = 42\n```")

    expect(html).toContain("th-keyword")
    expect(html).toContain('class="tm-code"')
    expect(html).toContain("const")
    expect(html).toContain("number")
    expect(html).not.toContain("style=")
  })

  it("sanitizes the rendered output", () => {
    const html = renderMarkdownToHtml("<script>alert(1)</script>\n\nhello")
    expect(html).not.toContain("<script>")
    expect(html).toContain("hello")
  })
})

describe("cachedReadme", () => {
  it("computes once per key", () => {
    clearReadmeCache()
    let calls = 0
    const compute = () => {
      calls += 1
      return "html"
    }
    expect(cachedReadme("k", compute)).toBe("html")
    expect(cachedReadme("k", compute)).toBe("html")
    expect(calls).toBe(1)
  })
})
