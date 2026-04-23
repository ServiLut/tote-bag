import { extractApiConnectionErrorTargets } from './api-config';

export function extractApiErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const candidate = payload as Record<string, unknown>;

    if (Array.isArray(candidate.message)) {
      return candidate.message.join(', ');
    }

    if (typeof candidate.message === 'string') {
      return candidate.message;
    }

    if (typeof candidate.error === 'string') {
      return candidate.error;
    }

    if (
      candidate.data &&
      typeof candidate.data === 'object' &&
      !Array.isArray(candidate.data)
    ) {
      return extractApiErrorMessage(candidate.data, fallback);
    }
  }

  return fallback;
}

export function formatApiConnectionErrorMessage(
  message: string,
  contextLabel: string,
) {
  if (!message.startsWith('No fue posible conectar con la API.')) {
    return message;
  }

  const attemptedTargets = extractApiConnectionErrorTargets(message);
  if (attemptedTargets.length > 0) {
    return `No fue posible conectar con la API de ${contextLabel}. Se intento acceder a ${attemptedTargets.join(', ')}. Verifica que el backend este arriba y vuelve a cargar.`;
  }

  return `No fue posible conectar con la API de ${contextLabel}. Verifica que el backend este arriba y vuelve a cargar.`;
}

export async function getApiResponseErrorMessage(
  response: Response,
  fallback: string,
  contextLabel?: string,
) {
  const clonedResponse = response.clone();

  try {
    const payload = await clonedResponse.json();
    const message = extractApiErrorMessage(payload, fallback);
    return contextLabel
      ? formatApiConnectionErrorMessage(message, contextLabel)
      : message;
  } catch {
    try {
      const text = (await clonedResponse.text()).trim();
      if (!text) {
        return fallback;
      }

      return contextLabel
        ? formatApiConnectionErrorMessage(text, contextLabel)
        : text;
    } catch {
      return fallback;
    }
  }
}
