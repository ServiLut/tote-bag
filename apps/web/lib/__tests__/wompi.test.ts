import { resolveWompiWidgetStatus } from '../wompi';

describe('wompi widget status', () => {
  it('reports ready when the constructor is available', () => {
    expect(
      resolveWompiWidgetStatus({
        scriptLoaded: false,
        scriptFailed: false,
        widgetCheckout: function WidgetCheckout() {},
      }),
    ).toBe('ready');
  });

  it('reports loading while the script is still pending', () => {
    expect(
      resolveWompiWidgetStatus({
        scriptLoaded: false,
        scriptFailed: false,
        widgetCheckout: undefined,
      }),
    ).toBe('loading');
  });

  it('reports unavailable when the script failed or loaded without constructor', () => {
    expect(
      resolveWompiWidgetStatus({
        scriptLoaded: false,
        scriptFailed: true,
        widgetCheckout: undefined,
      }),
    ).toBe('unavailable');

    expect(
      resolveWompiWidgetStatus({
        scriptLoaded: true,
        scriptFailed: false,
        widgetCheckout: undefined,
      }),
    ).toBe('unavailable');
  });
});
