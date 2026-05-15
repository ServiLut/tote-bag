export interface CheckoutCartFingerprintItem {
  id: string;
  quantity: number;
}

export interface PublicOrderPaymentStatus {
  id: string;
  orderNumber: number;
  status: string;
  paymentConfirmed: boolean;
  awaitingPayment: boolean;
  paymentFailed: boolean;
}

export type ConfirmationState =
  | 'idle'
  | 'loading'
  | 'approved'
  | 'pending'
  | 'failed'
  | 'error';

type CheckoutStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type PendingCheckoutRecord = {
  orderId: string;
  cartFingerprint: string;
};

const CHECKOUT_PENDING_ORDERS_STORAGE_KEY = 'tote-pending-checkouts';

function resolveCheckoutStorage(storage?: CheckoutStorage) {
  if (storage) {
    return storage;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

function buildCartFingerprint(items: CheckoutCartFingerprintItem[]) {
  return JSON.stringify(
    items
      .map((item) => ({
        id: item.id,
        quantity: item.quantity,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  );
}

function readPendingCheckoutRecords(storage: CheckoutStorage) {
  const raw = storage.getItem(CHECKOUT_PENDING_ORDERS_STORAGE_KEY);

  if (!raw) {
    return [] as PendingCheckoutRecord[];
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (entry): entry is PendingCheckoutRecord =>
        !!entry &&
        typeof entry === 'object' &&
        typeof (entry as PendingCheckoutRecord).orderId === 'string' &&
        typeof (entry as PendingCheckoutRecord).cartFingerprint === 'string',
    );
  } catch {
    return [];
  }
}

function writePendingCheckoutRecords(
  storage: CheckoutStorage,
  records: PendingCheckoutRecord[],
) {
  if (records.length === 0) {
    storage.removeItem(CHECKOUT_PENDING_ORDERS_STORAGE_KEY);
    return;
  }

  storage.setItem(
    CHECKOUT_PENDING_ORDERS_STORAGE_KEY,
    JSON.stringify(records),
  );
}

export function rememberPendingCheckoutOrder(
  orderId: string,
  items: CheckoutCartFingerprintItem[],
  storage?: CheckoutStorage,
) {
  const targetStorage = resolveCheckoutStorage(storage);

  if (!targetStorage) {
    return;
  }

  const nextRecord: PendingCheckoutRecord = {
    orderId,
    cartFingerprint: buildCartFingerprint(items),
  };
  const existingRecords = readPendingCheckoutRecords(targetStorage).filter(
    (record) => record.orderId !== orderId,
  );

  writePendingCheckoutRecords(targetStorage, [...existingRecords, nextRecord]);
}

export function shouldClearCartForApprovedOrder(
  orderId: string,
  items: CheckoutCartFingerprintItem[],
  storage?: CheckoutStorage,
) {
  const targetStorage = resolveCheckoutStorage(storage);

  if (!targetStorage) {
    return false;
  }

  const existingRecords = readPendingCheckoutRecords(targetStorage);
  const matchingRecord = existingRecords.find((record) => record.orderId === orderId);

  if (!matchingRecord) {
    return false;
  }

  writePendingCheckoutRecords(
    targetStorage,
    existingRecords.filter((record) => record.orderId !== orderId),
  );

  return matchingRecord.cartFingerprint === buildCartFingerprint(items);
}

export function resolveConfirmationStateFromPublicStatus(
  data: PublicOrderPaymentStatus,
): ConfirmationState {
  if (data.paymentConfirmed) {
    return 'approved';
  }

  if (data.paymentFailed) {
    return 'failed';
  }

  if (data.awaitingPayment) {
    return 'pending';
  }

  return 'idle';
}

export function isTerminalConfirmationState(state: ConfirmationState) {
  return (
    state === 'approved' ||
    state === 'failed' ||
    state === 'error' ||
    state === 'idle'
  );
}
