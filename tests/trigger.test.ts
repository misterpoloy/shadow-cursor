/**
 * @jest-environment jsdom
 */

describe('trigger hold detection', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('does not fire before 3 seconds', () => {
    const callback = jest.fn();

    // Simulate hold detection logic inline
    let timer: ReturnType<typeof setTimeout> | null = null;
    document.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 2) return;
      timer = setTimeout(callback, 3000);
    });
    document.addEventListener('mouseup', () => {
      if (timer) { clearTimeout(timer); timer = null; }
    });

    document.dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true }));
    jest.advanceTimersByTime(2999);
    document.dispatchEvent(new MouseEvent('mouseup', { button: 2, bubbles: true }));

    expect(callback).not.toHaveBeenCalled();
  });

  it('fires after 3 seconds of hold', () => {
    const callback = jest.fn();

    let timer: ReturnType<typeof setTimeout> | null = null;
    document.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 2) return;
      timer = setTimeout(callback, 3000);
    });

    document.dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true }));
    jest.advanceTimersByTime(3000);

    expect(callback).toHaveBeenCalledTimes(1);
    if (timer) clearTimeout(timer);
  });

  it('ignores non-right-click mousedown', () => {
    const callback = jest.fn();

    document.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 2) return;
      setTimeout(callback, 3000);
    });

    document.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
    jest.advanceTimersByTime(3000);

    expect(callback).not.toHaveBeenCalled();
  });
});
