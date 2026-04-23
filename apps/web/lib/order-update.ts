export function buildOrderStatusUpdatePayload(
  status: string,
  trackingNumber?: string | null,
) {
  const payload: {
    status: string;
    trackingNumber?: string | null;
  } = { status };

  if (trackingNumber !== undefined) {
    payload.trackingNumber =
      trackingNumber && trackingNumber.trim() !== ''
        ? trackingNumber.trim()
        : null;
  }

  return payload;
}
