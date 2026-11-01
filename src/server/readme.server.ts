import { highlightMarkdownCode } from "@/server/markdown-highlighter.server"
import { renderHtml } from "@tanstack/markdown"
import { LRUCache } from "lru-cache"
import sanitizeHtml from "sanitize-html"

const ALLOWED_TAGS = [
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "code",
  "dd",
  "del",
  "details",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "ins",
  "kbd",
  "li",
  "mark",
  "ol",
  "p",
  "pre",
  "s",
  "small",
  "span",
  "strong",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "title", "target", "rel"],
  abbr: ["title"],
  code: ["class"],
  div: ["class", "align"],
  img: ["src", "alt", "title", "width", "height", "align"],
  ol: ["start", "type"],
  pre: ["class"],
  span: ["class"],
  td: ["colspan", "rowspan", "align"],
  th: ["colspan", "rowspan", "align"],
}

export function sanitizeReadmeHtml(html: string, baseUrl?: string): string {
  const resolve = urlTransform(baseUrl)
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: {
          ...attribs,
          ...(attribs.href
            ? { href: resolve(attribs.href) ?? attribs.href }
            : {}),
          target: "_blank",
          rel: "noreferrer noopener",
        },
      }),
      img: (_tagName, attribs) => ({
        tagName: "img",
        attribs: {
          ...attribs,
          ...(attribs.src ? { src: resolve(attribs.src) ?? attribs.src } : {}),
        },
      }),
    },
  })
}

function urlTransform(baseUrl?: string) {
  return (url: string): string | null => {
    if (/^(javascript|data|vbscript):/i.test(url.trim())) return null
    if (!baseUrl || /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("#")) {
      return url
    }
    const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
    return new URL(url, base).toString()
  }
}

export function renderMarkdownToHtml(
  markdown: string,
  baseUrl?: string
): string {
  const html = renderHtml(markdown, {
    allowHtml: true,
    urlTransform: urlTransform(baseUrl),
    highlighter: highlightMarkdownCode,
  })
  return sanitizeReadmeHtml(html)
}

const cache = new LRUCache<string, string>({
  max: 100,
  ttl: 60 * 60 * 1000,
  perf: { now: () => Date.now() },
})

export function clearReadmeCache(): void {
  cache.clear()
}

export function cachedReadme(key: string, compute: () => string): string {
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const html = compute()
  cache.set(key, html)
  return html
}
