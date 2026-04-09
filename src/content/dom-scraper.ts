import { DOMElement } from '../shared/types';
import { MAX_DOM_ELEMENTS, MAX_TEXT_LENGTH } from '../shared/constants';

const INTERACTIVE_SELECTOR = [
  'button',
  'a[href]',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[onclick]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function isVisible(el: Element): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isInViewport(rect: DOMRect): boolean {
  return (
    rect.top < window.innerHeight &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.right > 0
  );
}

function generateSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;

  const parts: string[] = [];
  let node: Element | null = el;

  while (node && node !== document.body) {
    let part = node.tagName.toLowerCase();
    if (node.id) {
      part = `#${CSS.escape(node.id)}`;
      parts.unshift(part);
      break;
    }
    const siblings = node.parentElement
      ? Array.from(node.parentElement.children).filter(
          (s) => s.tagName === node!.tagName
        )
      : [];
    if (siblings.length > 1) {
      const idx = siblings.indexOf(node) + 1;
      part += `:nth-of-type(${idx})`;
    }
    parts.unshift(part);
    node = node.parentElement;
  }

  return parts.join(' > ');
}

function truncate(text: string): string {
  return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) + '…' : text;
}

export function scrapeDOM(mouseX = 0, mouseY = 0): DOMElement[] {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR));

  const visible = nodes
    .filter((el) => isVisible(el))
    .map((el) => {
      const rect = el.getBoundingClientRect();
      return { el, rect };
    })
    .filter(({ rect }) => isInViewport(rect))
    .sort((a, b) => {
      // Sort by distance to mouse position
      const da = Math.hypot(
        a.rect.left + a.rect.width / 2 - mouseX,
        a.rect.top + a.rect.height / 2 - mouseY
      );
      const db = Math.hypot(
        b.rect.left + b.rect.width / 2 - mouseX,
        b.rect.top + b.rect.height / 2 - mouseY
      );
      return da - db;
    })
    .slice(0, MAX_DOM_ELEMENTS);

  return visible.map(({ el, rect }, index): DOMElement => {
    const htmlEl = el as HTMLInputElement & HTMLAnchorElement;
    return {
      index,
      tag: el.tagName.toLowerCase(),
      text: truncate((el.innerText || el.textContent || '').trim()),
      ariaLabel: el.getAttribute('aria-label') ?? undefined,
      id: el.id || undefined,
      className: el.className || undefined,
      href: htmlEl.href || undefined,
      type: htmlEl.type || undefined,
      bbox: {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      },
      selector: generateSelector(el),
    };
  });
}
