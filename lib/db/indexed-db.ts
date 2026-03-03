// IndexedDB utilities for offline fee payment queue
const DB_NAME = 'school-fee-db';
const DB_VERSION = 1;
const PENDING_STORE = 'pending_transactions';

export interface PendingTransaction {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  feeType: string;
  notes: string;
  paymentDate: string;
  timestamp: number;
  synced: boolean;
}

export async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        const store = db.createObjectStore(PENDING_STORE, { keyPath: 'id' });
        store.createIndex('synced', 'synced', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

export async function addPendingTransaction(
  transaction: PendingTransaction
): Promise<string> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const store = db.transaction(PENDING_STORE, 'readwrite').objectStore(PENDING_STORE);
    const request = store.add(transaction);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as string);
  });
}

export async function getPendingTransactions(): Promise<PendingTransaction[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const store = db.transaction(PENDING_STORE, 'readonly').objectStore(PENDING_STORE);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getUnsyncedTransactions(): Promise<PendingTransaction[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const store = db.transaction(PENDING_STORE, 'readonly').objectStore(PENDING_STORE);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result.filter((tx) => !tx.synced));
  });
}

export async function markTransactionSynced(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const store = db.transaction(PENDING_STORE, 'readwrite').objectStore(PENDING_STORE);
    const request = store.get(id);
    request.onsuccess = () => {
      const transaction = request.result;
      if (transaction) {
        transaction.synced = true;
        const updateRequest = store.put(transaction);
        updateRequest.onerror = () => reject(updateRequest.error);
        updateRequest.onsuccess = () => resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deletePendingTransaction(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const store = db.transaction(PENDING_STORE, 'readwrite').objectStore(PENDING_STORE);
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function clearAllPendingTransactions(): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const store = db.transaction(PENDING_STORE, 'readwrite').objectStore(PENDING_STORE);
    const request = store.clear();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
