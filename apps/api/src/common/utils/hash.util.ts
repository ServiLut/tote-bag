import * as crypto from 'crypto';

/**
 * Generates a deterministic short hash (8 characters, uppercase) from a JSON object.
 * Useful for decoupling technical configuration from commercial identity.
 */
export function generateConfigCode(config: Record<string, unknown>): string {
  // Sort keys to ensure determinism
  const sortedConfig = sortObjectKeys(config as JsonValue);
  const jsonString = JSON.stringify(sortedConfig);

  return crypto
    .createHash('sha256')
    .update(jsonString)
    .digest('hex')
    .substring(0, 8)
    .toUpperCase();
}

export function generateDeterministicHash(payload: Record<string, unknown>) {
  const sortedPayload = sortObjectKeys(payload as JsonValue);
  const jsonString = JSON.stringify(sortedPayload);

  return crypto.createHash('sha256').update(jsonString).digest('hex');
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

function sortObjectKeys(obj: JsonValue): JsonValue {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    if (Array.isArray(obj)) {
      return (obj as JsonValue[]).map(sortObjectKeys);
    }
    return obj;
  }

  const typedObj = obj as { [key: string]: JsonValue };

  return Object.keys(typedObj)
    .sort()
    .reduce((acc: Record<string, JsonValue>, key) => {
      acc[key] = sortObjectKeys(typedObj[key]);
      return acc;
    }, {});
}
