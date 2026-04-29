export type WompiWidgetStatus = 'loading' | 'ready' | 'unavailable';

export function isWompiWidgetConstructor(
  widgetCheckout: unknown,
): widgetCheckout is new (...args: unknown[]) => unknown {
  return typeof widgetCheckout === 'function';
}

export function resolveWompiWidgetStatus(options: {
  scriptLoaded: boolean;
  scriptFailed: boolean;
  widgetCheckout: unknown;
}): WompiWidgetStatus {
  const { scriptLoaded, scriptFailed, widgetCheckout } = options;

  if (isWompiWidgetConstructor(widgetCheckout)) {
    return 'ready';
  }

  if (scriptFailed) {
    return 'unavailable';
  }

  if (!scriptLoaded) {
    return 'loading';
  }

  return 'unavailable';
}
