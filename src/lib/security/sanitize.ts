import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize HTML content before rendering with dangerouslySetInnerHTML.
 * Strict whitelist — only basic formatting allowed.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li", "span", "h1", "h2", "h3", "h4"],
    ALLOWED_ATTR: ["href", "target", "rel"],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitize plain text — strip all HTML.
 */
export function sanitizeText(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}
