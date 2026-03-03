import { useState, useEffect, useCallback } from 'react';
import {
  PendingTransaction,
  PendingTransactionItem,
  getPendingTransactions,
  addPendingTransaction,
  getUnsyncedTransactions,
  deletePendingTransaction,
} from '@/lib/db/indexed-db';

export interface OfflineModeState {
  isOnline: boolean;
  pendingCount: number;
  pendingTransactions: PendingTransaction[];
  isSyncing: boolean;
}

export function useOfflineMode() {
  const [state, setState] = useState<OfflineModeState>({
    isOnline: typeof navigator !== 'undefined' && navigator.onLine,
    pendingCount: 0,
    pendingTransactions: [],
    isSyncing: false,
  });

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setState((prev) => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      setState((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load pending transactions on mount
  useEffect(() => {
    const loadPending = async () => {
      try {
        const pending = await getPendingTransactions();
        setState((prev) => ({
          ...prev,
          pendingTransactions: pending,
          pendingCount: pending.length,
        }));
      } catch (error) {
        console.error('Failed to load pending transactions:', error);
      }
    };

    loadPending();
  }, []);

  const addTransaction = useCallback(
    async (
      studentId: string,
      studentName: string,
      amount: number,
      feeType: string,
      notes: string,
      paymentDate: string,
      items?: PendingTransactionItem[]
    ): Promise<string> => {
      const transaction: PendingTransaction = {
        id: `${Date.now()}-${Math.random()}`,
        studentId,
        studentName,
        amount,
        feeType,
        notes,
        paymentDate,
        items: items || [],
        timestamp: Date.now(),
        synced: false,
      };

      try {
        const id = await addPendingTransaction(transaction);
        setState((prev) => ({
          ...prev,
          pendingTransactions: [...prev.pendingTransactions, transaction],
          pendingCount: prev.pendingCount + 1,
        }));
        return id;
      } catch (error) {
        console.error('Failed to add transaction:', error);
        throw error;
      }
    },
    []
  );

  const syncTransactions = useCallback(
    async (
      syncFn: (
        transactions: PendingTransaction[]
      ) => Promise<{ syncedLocalIds?: string[] } | void>
    ) => {
      setState((prev) => ({ ...prev, isSyncing: true }));
      try {
        const unsynced = await getUnsyncedTransactions();
        if (unsynced.length > 0) {
          const result = await syncFn(unsynced);
          const idsToClear = new Set(
            result?.syncedLocalIds && result.syncedLocalIds.length > 0
              ? result.syncedLocalIds
              : unsynced.map((transaction) => transaction.id)
          );

          for (const transactionId of idsToClear) {
            await deletePendingTransaction(transactionId);
          }

          setState((prev) => ({
            ...prev,
            pendingTransactions: prev.pendingTransactions.filter(
              (transaction) => !idsToClear.has(transaction.id)
            ),
            pendingCount: Math.max(0, prev.pendingCount - idsToClear.size),
          }));
        }
      } catch (error) {
        console.error('Sync failed:', error);
        throw error;
      } finally {
        setState((prev) => ({ ...prev, isSyncing: false }));
      }
    },
    []
  );

  const removeTransaction = useCallback(async (id: string) => {
    try {
      await deletePendingTransaction(id);
      setState((prev) => ({
        ...prev,
        pendingTransactions: prev.pendingTransactions.filter((t) => t.id !== id),
        pendingCount: Math.max(0, prev.pendingCount - 1),
      }));
    } catch (error) {
      console.error('Failed to remove transaction:', error);
      throw error;
    }
  }, []);

  return {
    ...state,
    addTransaction,
    syncTransactions,
    removeTransaction,
  };
}
