export function redactEmail(email: string | null | undefined): string {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) {
    return 'unknown';
  }

  const atIndex = normalizedEmail.indexOf('@');
  if (atIndex <= 0 || atIndex === normalizedEmail.length - 1) {
    return '[redacted-email]';
  }

  const localPart = normalizedEmail.slice(0, atIndex);
  const domain = normalizedEmail.slice(atIndex + 1);
  const visibleLocal = localPart.slice(0, Math.min(2, localPart.length));

  return `${visibleLocal}***@${domain}`;
}

export function sanitizeRequestUrlForLogs(url: string): string {
  const [pathname] = url.split('?');
  return pathname || '/';
}

export function sanitizeIpForLogs(
  ipAddress: string | null | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string | undefined {
  const normalizedIp = ipAddress?.trim();

  if (!normalizedIp) {
    return undefined;
  }

  if (nodeEnv !== 'production') {
    return normalizedIp;
  }

  return '[redacted-ip]';
}

export function sanitizeUserAgentForLogs(
  userAgent: string | null | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string | undefined {
  const normalizedUserAgent = userAgent?.trim();

  if (!normalizedUserAgent) {
    return undefined;
  }

  if (nodeEnv !== 'production') {
    return normalizedUserAgent;
  }

  return '[redacted-user-agent]';
}
