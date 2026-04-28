import {
  initConnection,
  fetchProducts,
  requestPurchase,
  acknowledgePurchaseAndroid,
  purchaseErrorListener,
  purchaseUpdatedListener,
  finishTransaction,
  type Purchase,
  type PurchaseError,
  ErrorCode,
} from 'react-native-iap';
import { Platform, Alert } from 'react-native';
import i18next from 'i18next';
import { QuotaService } from '../../services/quotaService';

const itemSkus = Platform.select({
  android: ['pro_monthly'],
  default: [],
}) as string[];

let purchaseUpdateSubscription: any;
let purchaseErrorSubscription: any;

export const IapService = {
  /**
   * Initialize IAP connection and setup listeners
   */
  async init(): Promise<void> {
    try {
      await initConnection();
      console.log('[IAP] Connection initialized');

      // Standard purchase update listener
      purchaseUpdateSubscription = purchaseUpdatedListener(
        async (purchase: Purchase) => {
          const token = purchase.purchaseToken;
          if (token) {
            try {
              // Acknowledge the purchase (required for Android)
              if (Platform.OS === 'android') {
                await acknowledgePurchaseAndroid(token);
              }
              await finishTransaction({ purchase, isConsumable: false });

              // Unlock Pro features
              QuotaService.setProStatus(true);
              Alert.alert(
                i18next.t('iap.approved'),
                i18next.t('iap.activeMessage'),
              );
              console.log('[IAP] Purchase acknowledged and Pro status set');
            } catch (ackErr) {
              console.warn('[IAP] Acknowledge error', ackErr);
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

  /**
   * Fetch subscription plans from Store
   */
  async getProducts() {
    try {
      if (itemSkus.length === 0) return [];
      const subscriptions = await fetchProducts({
        skus: itemSkus,
        type: 'subs',
      });
      return subscriptions;
    } catch (err) {
      console.warn('[IAP] getProducts error', err);
      return [];
    }
  },

  /**
   * Start purchase flow
   */
  async subscribe(sku: string): Promise<void> {
    try {
      await requestPurchase({
        type: 'subs',
        request: {
          google: {
            skus: [sku],
          },
        },
      });
    } catch (err) {
      console.warn('[IAP] subscribe error', err);
      throw err;
    }
  },

  /**
   * Verify if user currently has an active subscription from the Store.
   * This handles "Store-only" restoration without a backend.
   */
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

  /**
   * Explicitly request restoration of purchases (e.g., from a "Restore" button).
   */
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

  /**
   * Cleanup listeners
   */
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
