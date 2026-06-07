import {
  initConnection,
  fetchProducts,
  requestPurchase,
  purchaseErrorListener,
  purchaseUpdatedListener,
  finishTransaction,
  type Purchase,
  type PurchaseError,
  type ProductSubscription,
  type ProductSubscriptionAndroid,
  type Product,
  ErrorCode,
} from 'react-native-iap';
import { Platform, Alert } from 'react-native';
import i18next from 'i18next';
import { QuotaService } from './quotaService';

export const SKUS = {
  MONTHLY: 'pro_monthly',
  YEARLY: 'pro_yearly',
  LIFETIME: 'pro_lifetime',
} as const;

const subscriptionSkus = Platform.select({
  android: [SKUS.MONTHLY, SKUS.YEARLY],
  default: [],
}) as string[];

const oneTimeSkus = Platform.select({
  android: [SKUS.LIFETIME],
  default: [],
}) as string[];

const allSkus = new Set([...subscriptionSkus, ...oneTimeSkus]);

let purchaseUpdateSubscription: ReturnType<typeof purchaseUpdatedListener> | null = null;
let purchaseErrorSubscription: ReturnType<typeof purchaseErrorListener> | null = null;
let cachedProducts: (ProductSubscription | Product)[] = [];

export const IapService = {
  async init(): Promise<void> {
    try {
      await initConnection();
      console.log('[IAP] Connection initialized');

      purchaseUpdateSubscription = purchaseUpdatedListener(
        async (purchase: Purchase) => {
          const token = purchase.purchaseToken;
          if (token) {
            try {
              await finishTransaction({ purchase, isConsumable: false });

              QuotaService.setProStatus(true);
              Alert.alert(
                i18next.t('iap.approved'),
                i18next.t('iap.activeMessage'),
              );
              console.log('[IAP] Purchase finished and Pro status set');
            } catch (ackErr) {
              console.warn('[IAP] finishTransaction error', ackErr);
            }
          }
        },
      );

      purchaseErrorSubscription = purchaseErrorListener(
        (error: PurchaseError) => {
          console.warn('[IAP] Purchase error', error);
          const errorCode = error.code as string;
          if (
            errorCode !== ErrorCode.UserCancelled &&
            errorCode !== 'E_USER_CANCELLED' &&
            errorCode !== 'user-cancelled'
          ) {
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

      if (oneTimeSkus.length > 0) {
        const inapp = await fetchProducts({ skus: oneTimeSkus, type: 'in-app' }) as Product[];
        results.push(...inapp);
      }

      cachedProducts = results;
      return results;
    } catch (err) {
      console.warn('[IAP] getProducts error', err);
      return [];
    }
  },

  async subscribe(sku: string): Promise<void> {
    try {
      if (sku === SKUS.LIFETIME) {
        await requestPurchase({
          type: 'in-app',
          request: { google: { skus: [sku] } },
        });
        return;
      }

      const subscription = cachedProducts.find(s => s.id === sku) as ProductSubscriptionAndroid | undefined;
      const subscriptionOffers = subscription?.subscriptionOffers
        ?.filter(offer => offer.offerTokenAndroid)
        .map(offer => ({ sku, offerToken: offer.offerTokenAndroid! })) ?? [];

      await requestPurchase({
        type: 'subs',
        request: {
          google: {
            skus: [sku],
            ...(subscriptionOffers.length > 0 && { subscriptionOffers }),
          },
        },
      });
    } catch (err) {
      console.warn('[IAP] subscribe error', err);
      throw err;
    }
  },

  async checkSubscriptionStatus(): Promise<boolean> {
    // Force non-pro in dev to test subscription/quota screens
    const DEV_FORCE_NON_PRO = true;
    if (__DEV__ && DEV_FORCE_NON_PRO) {
      QuotaService.setProStatus(false);
      return false;
    }
    try {
      const { getAvailablePurchases } = await import('react-native-iap');
      const purchases = await getAvailablePurchases();

      const isActive = purchases.some(p => allSkus.has(p.productId));
      QuotaService.setProStatus(isActive);
      return isActive;
    } catch (err) {
      console.warn('[IAP] checkSubscriptionStatus error', err);
      return false;
    }
  },

  async restorePurchases(): Promise<boolean> {
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
    }
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
