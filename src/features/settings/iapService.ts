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
  ErrorCode,
} from 'react-native-iap';
import { Platform, Alert } from 'react-native';
import i18next from 'i18next';
import { QuotaService } from './quotaService';

const itemSkus = Platform.select({
  android: ['pro_monthly'],
  default: [],
}) as string[];

let purchaseUpdateSubscription: ReturnType<typeof purchaseUpdatedListener> | null = null;
let purchaseErrorSubscription: ReturnType<typeof purchaseErrorListener> | null = null;
let cachedSubscriptions: ProductSubscription[] = [];

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
              // finishTransaction handles acknowledgment automatically for non-consumables
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

  async getProducts(): Promise<ProductSubscription[]> {
    try {
      if (itemSkus.length === 0) return [];
      const subscriptions = await fetchProducts({
        skus: itemSkus,
        type: 'subs',
      }) as ProductSubscription[];
      cachedSubscriptions = subscriptions;
      return subscriptions;
    } catch (err) {
      console.warn('[IAP] getProducts error', err);
      return [];
    }
  },

  async subscribe(sku: string): Promise<void> {
    try {
      const subscription = cachedSubscriptions.find(s => s.id === sku) as ProductSubscriptionAndroid | undefined;
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
    try {
      const { getAvailablePurchases } = await import('react-native-iap');
      const purchases = await getAvailablePurchases();

      const isActive = purchases.some(p => itemSkus.includes(p.productId));
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
