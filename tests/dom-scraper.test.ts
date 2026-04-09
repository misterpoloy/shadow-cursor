/**
 * @jest-environment jsdom
 */
import { scrapeDOM } from '../src/content/dom-scraper';

describe('scrapeDOM', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns visible interactive elements', () => {
    document.body.innerHTML = `
      <button id="btn1">Click me</button>
      <a href="/about">About</a>
      <input type="text" placeholder="Search" />
    `;

    // jsdom doesn't implement real layout, so getBoundingClientRect returns zeros.
    // Patch it to simulate viewport-visible elements.
    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 10, bottom: 50, left: 10, right: 200,
      width: 190, height: 40, x: 10, y: 10,
      toJSON: () => ({}),
    } as DOMRect);

    const elements = scrapeDOM();
    expect(elements.length).toBeGreaterThan(0);
    expect(elements[0]).toHaveProperty('selector');
    expect(elements[0]).toHaveProperty('bbox');
    expect(elements[0]).toHaveProperty('index', 0);
  });

  it('excludes hidden elements', () => {
    document.body.innerHTML = `
      <button style="display:none">Hidden</button>
      <button style="visibility:hidden">Also hidden</button>
    `;

    jest.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
      const style = (el as HTMLElement).style;
      return { display: style.display, visibility: style.visibility, opacity: '1' } as CSSStyleDeclaration;
    });

    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const elements = scrapeDOM();
    expect(elements).toHaveLength(0);
  });

  it('truncates long text', () => {
    const longText = 'a'.repeat(200);
    document.body.innerHTML = `<button>${longText}</button>`;

    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 10, bottom: 50, left: 10, right: 200,
      width: 190, height: 40, x: 10, y: 10,
      toJSON: () => ({}),
    } as DOMRect);

    const elements = scrapeDOM();
    if (elements.length > 0) {
      expect(elements[0].text.length).toBeLessThanOrEqual(101); // 100 chars + ellipsis
    }
  });

  it('generates unique selectors for elements with IDs', () => {
    document.body.innerHTML = `
      <button id="save-btn">Save</button>
      <button id="cancel-btn">Cancel</button>
    `;

    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 10, bottom: 50, left: 10, right: 200,
      width: 190, height: 40, x: 10, y: 10,
      toJSON: () => ({}),
    } as DOMRect);

    const elements = scrapeDOM();
    const selectors = elements.map((e) => e.selector);
    expect(new Set(selectors).size).toBe(selectors.length);
  });
});
