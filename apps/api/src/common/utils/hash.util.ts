import * as crypto from 'crypto';

/**
 * Generates a deterministic short hash (8 characters, uppercase) from a JSON object.
 * Useful for decoupling technical configuration from commercial identity.
 */
export function generateConfigCode(config: Record<string, any>): string {
  // Sort keys to ensure determinism
  const sortedConfig = sortObjectKeys(config);
  const jsonString = JSON.stringify(sortedConfig);
  
  return crypto
    .createHash('sha256')
    .update(jsonString)
    .digest('hex')
    .substring(0, 8)
    .toUpperCase();
}

function sortObjectKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    if (Array.isArray(obj)) {
      return obj.map(sortObjectKeys);
    }
    return obj;
  }

  return Object.keys(obj)
    .sort()
    .reduce((acc: any, key) => {
      acc[key] = sortObjectKeys(obj[key]);
      return acc;
    }, {});
}
