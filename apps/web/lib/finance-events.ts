export const FINANCE_DATA_CHANGED_EVENT = 'finance:data-changed';

export function notifyFinanceDataChanged() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(FINANCE_DATA_CHANGED_EVENT));
}
