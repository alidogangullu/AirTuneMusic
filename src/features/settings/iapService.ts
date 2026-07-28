import {
  initConnection,
  fetchProducts,
  requestPurchase,
  purchaseErrorListener,
  purchaseUpdatedListener,
  finishTransaction,
  type Purchase,
  type PurchaseAndroid,
  type PurchaseError,
  type ProductSubscription,
  type Product,
  ErrorCode,
} from 'react-native-iap';
import { Alert } from 'react-native';
import i18next from 'i18next';
import { QuotaService } from './quotaService';

export const SKUS = {
  MONTHLY: 'pro_monthly',
  YEARLY: 'pro_yearly',
  LIFETIME: 'pro_lifetime',
} as const;

const subscriptionSkus = [SKUS.MONTHLY, SKUS.YEARLY];
const lifetimeSkus = [SKUS.LIFETIME];

let purchaseUpdateSubscription: ReturnType<typeof purchaseUpdatedListener> | null = null;
let purchaseErrorSubscription: ReturnType<typeof purchaseErrorListener> | null = null;
const purchaseSuccessListeners: Set<() => void> = new Set();
const subscriptionStatusListeners: Set<() => void> = new Set();
let lastErrorAlertAt = 0;
let isRestoring = false;

export const IapService = {
  async init(): Promise<void> {
    try {
      await initConnection();

      purchaseUpdateSubscription = purchaseUpdatedListener(
        async (purchase: Purchase) => {
          try {
            await finishTransaction({ purchase, isConsumable: false });
            if (purchase.productId === SKUS.LIFETIME) {
              QuotaService.setHasLifetime(true);
              const activeSku = QuotaService.getActiveSubSku();
              const isRenewing = QuotaService.getActiveSubAutoRenewing();
              QuotaService.setNeedsCancelSubscription(!!(activeSku && isRenewing));
            } else {
              QuotaService.setActiveSubSku(purchase.productId);
              QuotaService.setActiveSubToken(purchase.purchaseToken ?? undefined);
              QuotaService.setActiveSubAutoRenewing(true);
            }
            QuotaService.setProStatus(true);
            purchaseSuccessListeners.forEach(cb => cb());
          } catch (ackErr) {
            console.warn('[IAP] finishTransaction error', ackErr);
          }
        },
      );

      purchaseErrorSubscription = purchaseErrorListener(
        (error: PurchaseError) => {
          console.warn('[IAP] Purchase error — code:', error.code, '| message:', error.message, '| debugMessage:', (error as any).debugMessage ?? '');
          const errorCode = error.code as string;
          if (
            errorCode !== ErrorCode.UserCancelled &&
            errorCode !== 'E_USER_CANCELLED' &&
            errorCode !== 'user-cancelled'
          ) {
            const now = Date.now();
            if (now - lastErrorAlertAt < 2000) return;
            lastErrorAlertAt = now;
            Alert.alert(
              i18next.t('iap.declined'),
              i18next.t('iap.declinedMessage'),
            );
          }
        },
      );
    } catch (err) {
      console.warn('[IAP] Init error', err);
    }
  },

  async getProducts(): Promise<(ProductSubscription | Product)[]> {
    try {
      const results: (ProductSubscription | Product)[] = [];

      if (subscriptionSkus.length > 0) {
        const subs = await fetchProducts({ skus: subscriptionSkus, type: 'subs' }) as ProductSubscription[];
        results.push(...subs);
      }

      if (lifetimeSkus.length > 0) {
        const inapp = await fetchProducts({ skus: lifetimeSkus, type: 'in-app' }) as Product[];
        results.push(...inapp);
      }

      return results;
    } catch (err) {
      console.warn('[IAP] getProducts error', err);
      return [];
    }
  },

  async subscribe(sku: string): Promise<'purchase_initiated' | 'cancel_required'> {
    try {
      const existingSku = QuotaService.getActiveSubSku();
      const isStillRenewing = QuotaService.getActiveSubAutoRenewing();
      const hasDifferentActiveSub =
        existingSku &&
        existingSku !== sku &&
        existingSku !== SKUS.LIFETIME &&
        isStillRenewing;

      if (hasDifferentActiveSub) {
        Alert.alert(
          i18next.t('iap.cancelFirst'),
          i18next.t('iap.cancelFirstMessage'),
        );
        return 'cancel_required';
      }

      if (sku === SKUS.LIFETIME) {
        await requestPurchase({
          type: 'in-app',
          request: { google: { skus: [sku] } },
        });
      } else {
        await requestPurchase({
          type: 'subs',
          request: { google: { skus: [sku] } },
        });
      }
      return 'purchase_initiated';
    } catch (err) {
      console.warn('[IAP] subscribe error', err);
      throw err;
    }
  },

  async checkSubscriptionStatus(): Promise<boolean> {
    try {
      const { getAvailablePurchases } = await import('react-native-iap');
      const purchases = await getAvailablePurchases();
      const lifetimePurchase = purchases.find(p => p.productId === SKUS.LIFETIME);
      const subPurchases = purchases.filter(
        p => p.productId === SKUS.MONTHLY || p.productId === SKUS.YEARLY,
      );
      const activeSub =
        subPurchases.find(p => (p as PurchaseAndroid).autoRenewingAndroid !== false && p.productId === SKUS.YEARLY) ??
        subPurchases.find(p => (p as PurchaseAndroid).autoRenewingAndroid !== false && p.productId === SKUS.MONTHLY) ??
        subPurchases.find(p => p.productId === SKUS.YEARLY) ??
        subPurchases.find(p => p.productId === SKUS.MONTHLY);

      const subStillRenewing = activeSub && (activeSub as PurchaseAndroid).autoRenewingAndroid !== false;

      const normalizedSku = activeSub?.productId;

      const isActive = !!lifetimePurchase || !!activeSub;
      QuotaService.setProStatus(isActive);
      QuotaService.setHasLifetime(!!lifetimePurchase);
      QuotaService.setActiveSubSku(normalizedSku);
      QuotaService.setActiveSubToken(activeSub?.purchaseToken ?? undefined);
      QuotaService.setActiveSubAutoRenewing(!!subStillRenewing);
      QuotaService.setNeedsCancelSubscription(!!lifetimePurchase && !!subStillRenewing);
      subscriptionStatusListeners.forEach(cb => cb());
      return isActive;
    } catch (err) {
      console.warn('[IAP] checkSubscriptionStatus error', err);
      return false;
    }
  },

  async restorePurchases(): Promise<boolean> {
    if (isRestoring) return false;
    isRestoring = true;
    try {
      const isActive = await this.checkSubscriptionStatus();
      if (isActive) {
        Alert.alert(
          i18next.t('iap.restored'),
          i18next.t('iap.restoredMessage'),
        );
      } else {
        Alert.alert(
          i18next.t('iap.notFound'),
          i18next.t('iap.notFoundMessage'),
        );
      }
      return isActive;
    } catch (err) {
      console.warn('[IAP] restorePurchases error', err);
      Alert.alert(
        i18next.t('iap.error'),
        i18next.t('iap.errorMessage'),
      );
      return false;
    } finally {
      isRestoring = false;
    }
  },

  addPurchaseSuccessListener(cb: () => void): () => void {
    purchaseSuccessListeners.add(cb);
    return () => purchaseSuccessListeners.delete(cb);
  },

  addSubscriptionStatusListener(cb: () => void): () => void {
    subscriptionStatusListeners.add(cb);
    return () => subscriptionStatusListeners.delete(cb);
  },

  end(): void {
    if (purchaseUpdateSubscription) {
      purchaseUpdateSubscription.remove();
      purchaseUpdateSubscription = null;
    }
    if (purchaseErrorSubscription) {
      purchaseErrorSubscription.remove();
      purchaseErrorSubscription = null;
    }
  },
};
