import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type OfferSource = {
  retailer: string;
  host: string;
  listingUrl: string;
  lastCheckedAt?: string;
};

type Offer = {
  id: string;
  sellerName: string;
  price: number;
  verified: boolean;
  shipping: string;
  eta: string;
  sellerRating: number;
  source?: OfferSource;
};

type Listing = {
  id: string;
  title: string;
  brand: string;
  category: string;
  condition: string;
  price: number;
  priceHigh: number;
  offerCount: number;
  savingsMax: number;
  currency: string;
  rating: number;
  verifiedSeller: boolean;
  offers: Offer[];
  specs?: Record<string, number | undefined>;
};

const palette = {
  bg: '#050810',
  bgElevated: '#0c1222',
  surface: '#121a2b',
  surface2: '#1a2438',
  border: 'rgba(148, 163, 184, 0.1)',
  borderGlow: 'rgba(56, 189, 248, 0.35)',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  textDim: '#64748b',
  accent: '#22d3ee',
  accentSoft: 'rgba(34, 211, 238, 0.15)',
  violet: '#c4b5fd',
  violetDeep: '#8b5cf6',
  rose: '#fb7185',
  gold: '#fcd34d',
  success: '#4ade80',
  successBg: 'rgba(74, 222, 128, 0.12)',
  chipBg: 'rgba(26, 36, 56, 0.95)',
  chipActive: 'rgba(34, 211, 238, 0.12)',
  chipBorderActive: 'rgba(34, 211, 238, 0.4)',
  star: '#fbbf24',
  modalOverlay: 'rgba(2, 6, 23, 0.82)',
};

const CATEGORIES = [
  'All',
  'Smartphones',
  'Headphones',
  'Chargers',
  'Smartwatches',
  'Accessories',
] as const;
type CategoryFilter = (typeof CATEGORIES)[number];
const CONDITIONS = ['All', 'New', 'Used'] as const;
type ConditionFilter = (typeof CONDITIONS)[number];

const SESSION_KEY = 'smarthub_session_id';

function apiBase(): string {
  if (Platform.OS === 'android') return 'http://10.0.2.2:3001';
  return 'http://localhost:3001';
}

function newSessionId() {
  return `sh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

async function apiJson(
  path: string,
  sessionId: string | null,
  init?: RequestInit,
): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init?.headers as Record<string, string>),
  };
  if (sessionId) headers['X-Session-Id'] = sessionId;
  if (init?.body != null) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${apiBase()}${path}`, { ...init, headers });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg =
      typeof data === 'object' && data && 'error' in data
        ? String((data as { error: string }).error)
        : res.statusText;
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return data;
}

function categoryIcon(category: string) {
  const c = category.toLowerCase();
  if (c.includes('headphone')) return 'headset-outline';
  if (c.includes('charger')) return 'battery-charging-outline';
  if (c.includes('watch')) return 'watch-outline';
  if (c.includes('accessor')) return 'cube-outline';
  return 'phone-portrait-outline';
}

function formatPrice(currency: string, price: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function thumbGradient(category: string): [string, string] {
  const c = category.toLowerCase();
  if (c.includes('headphone')) return ['rgba(196, 181, 253, 0.25)', 'rgba(139, 92, 246, 0.12)'];
  if (c.includes('charger')) return ['rgba(251, 113, 133, 0.2)', 'rgba(251, 191, 36, 0.1)'];
  if (c.includes('watch')) return ['rgba(34, 211, 238, 0.22)', 'rgba(56, 189, 248, 0.08)'];
  if (c.includes('accessor')) return ['rgba(148, 163, 184, 0.2)', 'rgba(100, 116, 139, 0.1)'];
  return ['rgba(34, 211, 238, 0.2)', 'rgba(167, 139, 250, 0.12)'];
}

type CompareSheetProps = {
  product: Listing | null;
  onClose: () => void;
  sessionReady: boolean;
  onAddToCart: (productId: string, offerId: string) => Promise<void>;
};

function ComparePricesSheet({
  product,
  onClose,
  sessionReady,
  onAddToCart,
}: CompareSheetProps) {
  const insets = useSafeAreaInsets();
  const [addingId, setAddingId] = useState<string | null>(null);
  const sorted = useMemo(() => {
    if (!product?.offers?.length) return [];
    return [...product.offers].sort((a, b) => a.price - b.price);
  }, [product]);

  if (!product) return null;

  const worstPrice = sorted[sorted.length - 1]?.price ?? sorted[0]?.price ?? 0;
  const bestOfferId = sorted[0]?.id;

  const openListing = (url: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() => {
      Alert.alert('Could not open link', 'Copy the URL from your browser if needed.');
    });
  };

  const addOffer = async (offerId: string) => {
    if (!sessionReady) {
      Alert.alert('Basket', 'Session is still starting — try again in a second.');
      return;
    }
    setAddingId(offerId);
    try {
      await onAddToCart(product.id, offerId);
      Alert.alert('Added to basket', 'Open your basket to reserve or checkout.');
    } catch (e) {
      Alert.alert('Basket', e instanceof Error ? e.message : 'Could not add item');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.sheetHandleWrap}>
            <View style={styles.sheetHandle} />
          </View>

          <LinearGradient
            colors={['rgba(34, 211, 238, 0.12)', 'transparent']}
            style={styles.sheetHero}
          >
            <View style={styles.sheetHeroRow}>
              <View style={styles.sheetIconWrap}>
                <LinearGradient colors={thumbGradient(product.category)} style={styles.sheetIconGrad}>
                  <Ionicons name={categoryIcon(product.category)} size={26} color={palette.accent} />
                </LinearGradient>
              </View>
              <View style={styles.sheetHeroText}>
                <Text style={styles.sheetTitle} numberOfLines={2}>
                  {product.title}
                </Text>
                <Text style={styles.sheetSub}>
                  Prices aggregated across partner sites · from {formatPrice(product.currency, product.price)}
                </Text>
              </View>
              <Pressable onPress={onClose} style={styles.sheetClose} hitSlop={12}>
                <Ionicons name="close" size={24} color={palette.textMuted} />
              </Pressable>
            </View>
            {product.savingsMax > 0 ? (
              <View style={styles.saveBanner}>
                <Ionicons name="trending-down" size={18} color={palette.gold} />
                <Text style={styles.saveBannerText}>
                  Save up to {formatPrice(product.currency, product.savingsMax)} by picking the right site
                </Text>
              </View>
            ) : null}
          </LinearGradient>

          <Text style={styles.sheetSectionLabel}>Ranked by price · tap site to open listing</Text>
          <ScrollView style={styles.offerScroll} showsVerticalScrollIndicator={false}>
            {sorted.map((offer, index) => {
              const isBest = index === 0;
              const saveVsTop = worstPrice - offer.price;
              const src = offer.source;
              return (
                <View
                  key={offer.id}
                  style={[styles.offerRow, isBest && styles.offerRowBest]}
                >
                  {isBest ? (
                    <LinearGradient
                      colors={['rgba(34, 211, 238, 0.25)', 'rgba(139, 92, 246, 0.12)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                  ) : null}
                  <View style={styles.offerRowInner}>
                    <View style={styles.offerLeft}>
                      <View style={[styles.rankBadge, isBest && styles.rankBadgeBest]}>
                        <Text style={[styles.rankText, isBest && styles.rankTextBest]}>#{index + 1}</Text>
                      </View>
                      <View style={styles.offerSellerBlock}>
                        <View style={styles.offerSellerRow}>
                          <Text style={styles.offerSeller} numberOfLines={1}>
                            {offer.sellerName}
                          </Text>
                          {offer.verified ? (
                            <View style={styles.miniVerified}>
                              <Ionicons name="shield-checkmark" size={11} color={palette.success} />
                              <Text style={styles.miniVerifiedText}>Verified</Text>
                            </View>
                          ) : null}
                        </View>
                        {src ? (
                          <Pressable
                            onPress={() => openListing(src.listingUrl)}
                            style={styles.webSourceRow}
                          >
                            <Ionicons name="globe-outline" size={14} color={palette.violet} />
                            <Text style={styles.webSourceText} numberOfLines={1}>
                              {src.retailer} · {src.host}
                            </Text>
                            <Ionicons name="open-outline" size={14} color={palette.textDim} />
                          </Pressable>
                        ) : null}
                        <View style={styles.offerMetaRow}>
                          <Ionicons name="car-outline" size={13} color={palette.textDim} />
                          <Text style={styles.offerMeta}>{offer.shipping} · {offer.eta}</Text>
                        </View>
                        <View style={styles.sellerStars}>
                          <Ionicons name="star" size={12} color={palette.star} />
                          <Text style={styles.sellerRatingText}>{offer.sellerRating.toFixed(1)} seller</Text>
                        </View>
                        <Pressable
                          onPress={() => addOffer(offer.id)}
                          disabled={addingId !== null}
                          style={({ pressed }) => [
                            styles.addBasketBtn,
                            pressed && styles.pressed,
                            addingId === offer.id && styles.addBasketBtnBusy,
                          ]}
                        >
                          {addingId === offer.id ? (
                            <ActivityIndicator color={palette.bg} size="small" />
                          ) : (
                            <>
                              <Ionicons name="bag-add-outline" size={16} color={palette.bg} />
                              <Text style={styles.addBasketBtnText}>Add to basket</Text>
                            </>
                          )}
                        </Pressable>
                      </View>
                    </View>
                    <View style={styles.offerRight}>
                      <Text style={[styles.offerPrice, isBest && styles.offerPriceBest]}>
                        {formatPrice(product.currency, offer.price)}
                      </Text>
                      {saveVsTop > 0 ? (
                        <Text style={styles.offerSaveHint}>
                          {isBest ? 'Best deal' : `−${formatPrice(product.currency, saveVsTop)} vs max`}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <Pressable
            style={({ pressed }) => [styles.ctaWide, pressed && styles.pressed]}
            onPress={() => bestOfferId && addOffer(bestOfferId)}
            disabled={!bestOfferId || addingId !== null}
          >
            <LinearGradient
              colors={['#22d3ee', '#8b5cf6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaWideGrad}
            >
              <Text style={styles.ctaWideText}>Add best price to basket</Text>
              <Ionicons name="bag-check-outline" size={18} color="#0f172a" />
            </LinearGradient>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

type CartLine = {
  lineId: string;
  productId: string;
  offerId: string;
  quantity: number;
  title: string;
  brand: string;
  currency: string;
  unitPrice: number;
  sellerName: string;
  retailer: string;
  host: string;
  listingUrl: string;
};

type CartState = {
  lines: CartLine[];
  subtotal: number;
  itemCount: number;
  reservedUntil: string | null;
  reservationActive: boolean;
};

type ChatMessage = {
  id: string;
  role: 'me' | 'other';
  text: string;
  meta?: string;
};

type PaymentMethodOption = {
  id: string;
  label: string;
  description?: string;
  provider?: string;
};

type CartSheetProps = {
  visible: boolean;
  onClose: () => void;
  sessionId: string | null;
  cart: CartState | null;
  loading: boolean;
  onRefresh: () => void;
};

function BasketSheet({ visible, onClose, sessionId, cart, loading, onRefresh }: CartSheetProps) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<string | null>(null);
  const [payPickOpen, setPayPickOpen] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [methodsLoading, setMethodsLoading] = useState(false);

  const run = async (label: string, fn: () => Promise<void>) => {
    if (!sessionId) return;
    setBusy(label);
    try {
      await fn();
      onRefresh();
    } catch (e) {
      Alert.alert('Basket', e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  const removeLine = (lineId: string) =>
    run('rm', async () => {
      await apiJson(`/api/cart/items/${lineId}`, sessionId, { method: 'DELETE' });
    });

  const reserve = () =>
    run('res', async () => {
      const data = (await apiJson('/api/cart/reserve', sessionId, {
        method: 'POST',
        body: JSON.stringify({ minutes: 20 }),
      })) as { message?: string };
      Alert.alert('Reserved', data.message ?? 'Prices held.');
    });

  const checkoutWithMethod = (paymentMethodId: string) =>
    run('pay', async () => {
      const data = (await apiJson('/api/cart/checkout', sessionId, {
        method: 'POST',
        body: JSON.stringify({ paymentMethodId }),
      })) as { orderId?: string; message?: string; paymentMethodLabel?: string };
      setPayPickOpen(false);
      Alert.alert(
        'Checkout',
        data.message ??
          `Order ${data.orderId ?? ''}${data.paymentMethodLabel ? ` · ${data.paymentMethodLabel}` : ''}`.trim(),
      );
      onClose();
    });

  const startStripeCheckout = async () => {
    if (!sessionId) return;
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      Alert.alert('Stripe', 'Open SmartHub in Chrome (web) to pay with a card.');
      return;
    }
    setBusy('stripe');
    try {
      const data = (await apiJson('/api/cart/stripe-checkout-session', sessionId, {
        method: 'POST',
        body: JSON.stringify({ origin: window.location.origin }),
      })) as { url?: string };
      setPayPickOpen(false);
      if (!data.url) throw new Error('No checkout URL from server');
      window.location.assign(data.url);
    } catch (e) {
      Alert.alert('Stripe', e instanceof Error ? e.message : 'Could not start checkout');
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (!payPickOpen) return;
    let cancelled = false;
    setMethodsLoading(true);
    apiJson('/api/payments/methods', null)
      .then((raw) => {
        if (cancelled || !raw || typeof raw !== 'object') return;
        const m = (raw as { methods?: PaymentMethodOption[]; stripeEnabled?: boolean }).methods;
        if (Array.isArray(m)) setPaymentMethods(m);
        setStripeEnabled(Boolean((raw as { stripeEnabled?: boolean }).stripeEnabled));
      })
      .catch((e) => {
        if (!cancelled) {
          Alert.alert('Payments', e instanceof Error ? e.message : 'Could not load methods');
          setPayPickOpen(false);
        }
      })
      .finally(() => {
        if (!cancelled) setMethodsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [payPickOpen]);

  useEffect(() => {
    if (!visible) setPayPickOpen(false);
  }, [visible]);

  const clearCart = () =>
    run('clr', async () => {
      await apiJson('/api/cart', sessionId, { method: 'DELETE' });
    });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalFrame}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={[styles.basketSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          {payPickOpen ? (
            <View style={styles.paymentOverlay} pointerEvents="box-none">
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => (busy ? undefined : setPayPickOpen(false))}
              />
              <View style={styles.paymentPickCard}>
                <Text style={styles.paymentPickTitle}>Pay with</Text>
                <Text style={styles.paymentPickSub}>
                  {stripeEnabled && Platform.OS === 'web'
                    ? 'Stripe (test cards) or demo methods below — no charge for demos.'
                    : stripeEnabled && Platform.OS !== 'web'
                      ? 'Demo methods below. Stripe card checkout works in Chrome (web).'
                      : 'Demo only — no real charge'}
                </Text>
                {methodsLoading ? (
                  <View style={styles.paymentPickLoading}>
                    <ActivityIndicator color={palette.accent} />
                  </View>
                ) : (
                  <ScrollView style={styles.paymentPickList} showsVerticalScrollIndicator={false}>
                    {stripeEnabled && Platform.OS === 'web' ? (
                      <Pressable
                        style={({ pressed }) => [styles.paymentMethodRow, styles.paymentStripeRow, pressed && styles.pressed]}
                        onPress={() => startStripeCheckout()}
                        disabled={busy !== null}
                      >
                        <Ionicons name="card" size={22} color="#0f172a" />
                        <View style={styles.paymentMethodTextCol}>
                          <Text style={styles.paymentMethodLabel}>Card with Stripe</Text>
                          <Text style={styles.paymentMethodDesc} numberOfLines={2}>
                            Secure hosted checkout — use test card 4242… in test mode
                          </Text>
                        </View>
                        {busy === 'stripe' ? (
                          <ActivityIndicator color={palette.accent} />
                        ) : (
                          <Ionicons name="open-outline" size={20} color={palette.textDim} />
                        )}
                      </Pressable>
                    ) : null}
                    {stripeEnabled && Platform.OS === 'web' && paymentMethods.length > 0 ? (
                      <Text style={styles.paymentSectionLabel}>Demo (instant)</Text>
                    ) : null}
                    {paymentMethods.map((m) => (
                      <Pressable
                        key={m.id}
                        style={({ pressed }) => [styles.paymentMethodRow, pressed && styles.pressed]}
                        onPress={() => checkoutWithMethod(m.id)}
                        disabled={busy !== null}
                      >
                        <Ionicons name="wallet-outline" size={22} color={palette.accent} />
                        <View style={styles.paymentMethodTextCol}>
                          <Text style={styles.paymentMethodLabel}>{m.label}</Text>
                          {m.description ? (
                            <Text style={styles.paymentMethodDesc} numberOfLines={2}>
                              {m.description}
                            </Text>
                          ) : null}
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={palette.textDim} />
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
                <Pressable
                  onPress={() => setPayPickOpen(false)}
                  disabled={busy !== null}
                  style={styles.paymentPickCancel}
                >
                  <Text style={styles.paymentPickCancelText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          <View style={styles.sheetHandleWrap}>
            <View style={styles.sheetHandle} />
          </View>
          <View style={styles.basketHeader}>
            <Text style={styles.basketTitle}>Basket</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={26} color={palette.textMuted} />
            </Pressable>
          </View>
          {cart?.reservationActive && cart.reservedUntil ? (
            <View style={styles.reserveBanner}>
              <Ionicons name="timer-outline" size={18} color={palette.gold} />
              <Text style={styles.reserveBannerText}>
                Reservation active until {new Date(cart.reservedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          ) : null}
          {loading || !cart ? (
            <View style={styles.basketLoading}>
              <ActivityIndicator color={palette.accent} />
            </View>
          ) : cart.lines.length === 0 ? (
            <View style={styles.basketEmpty}>
              <Ionicons name="bag-outline" size={48} color={palette.textDim} />
              <Text style={styles.basketEmptyText}>Your basket is empty</Text>
              <Text style={styles.basketEmptySub}>Add offers from price compare</Text>
            </View>
          ) : (
            <ScrollView style={styles.basketScroll} showsVerticalScrollIndicator={false}>
              {cart.lines.map((line) => (
                <View key={line.lineId} style={styles.basketLine}>
                  <View style={styles.basketLineTop}>
                    <Text style={styles.basketLineTitle} numberOfLines={2}>
                      {line.title}
                    </Text>
                    <Pressable
                      onPress={() => removeLine(line.lineId)}
                      disabled={busy !== null}
                      hitSlop={8}
                    >
                      <Ionicons name="trash-outline" size={20} color={palette.rose} />
                    </Pressable>
                  </View>
                  <Text style={styles.basketLineMeta}>
                    {line.retailer} · {line.host}
                  </Text>
                  <Text style={styles.basketLineSeller}>{line.sellerName}</Text>
                  <View style={styles.basketLineBottom}>
                    <Text style={styles.basketLineQty}>Qty {line.quantity}</Text>
                    <Text style={styles.basketLinePrice}>
                      {formatPrice(line.currency, line.unitPrice * line.quantity)}
                    </Text>
                  </View>
                  {line.listingUrl ? (
                    <Pressable onPress={() => Linking.openURL(line.listingUrl)}>
                      <Text style={styles.basketOpenLink}>View on retailer site</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          )}
          {cart && cart.lines.length > 0 ? (
            <View style={styles.basketFooter}>
              <View style={styles.basketTotalRow}>
                <Text style={styles.basketTotalLabel}>Subtotal</Text>
                <Text style={styles.basketTotalValue}>
                  {formatPrice(cart.lines[0]?.currency ?? 'USD', cart.subtotal)}
                </Text>
              </View>
              <View style={styles.basketActions}>
                <Pressable
                  style={({ pressed }) => [styles.basketSecondary, pressed && styles.pressed]}
                  onPress={() => clearCart()}
                  disabled={busy !== null}
                >
                  <Text style={styles.basketSecondaryText}>Clear</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.basketReserve, pressed && styles.pressed]}
                  onPress={() => reserve()}
                  disabled={busy !== null}
                >
                  {busy === 'res' ? (
                    <ActivityIndicator color={palette.gold} />
                  ) : (
                    <Text style={styles.basketReserveText}>Reserve 20 min</Text>
                  )}
                </Pressable>
              </View>
              <Pressable
                style={({ pressed }) => [styles.ctaWide, pressed && styles.pressed]}
                onPress={() => setPayPickOpen(true)}
                disabled={busy !== null}
              >
                <LinearGradient
                  colors={['#22d3ee', '#8b5cf6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaWideGrad}
                >
                  {busy === 'pay' ? (
                    <ActivityIndicator color="#0f172a" />
                  ) : (
                    <>
                      <Text style={styles.ctaWideText}>Checkout (demo)</Text>
                      <Ionicons name="card-outline" size={18} color="#0f172a" />
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

type AiSheetProps = {
  visible: boolean;
  onClose: () => void;
  sessionId: string | null;
};

function AskAiSheet({ visible, onClose, sessionId }: AiSheetProps) {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'ai-hello',
      role: 'other',
      text: 'Hi! Ask me things like "Best phone under $500?" or "Compare iPhone vs Samsung".',
      meta: 'SmartHub AI',
    },
  ]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const my: ChatMessage = { id: `m-${Date.now()}`, role: 'me', text };
    setMessages((prev) => [...prev, my]);
    setInput('');
    setLoading(true);
    try {
      const data = (await apiJson('/api/ai/suggest', sessionId, {
        method: 'POST',
        body: JSON.stringify({ query: text }),
      })) as { reply?: string };
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'other',
          text: data.reply ?? 'No response from assistant.',
          meta: 'SmartHub AI',
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: `aerr-${Date.now()}`,
          role: 'other',
          text: e instanceof Error ? e.message : 'Could not reach AI service.',
          meta: 'System',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalFrame}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={[styles.aiSheet, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <View style={styles.sheetHandleWrap}>
            <View style={styles.sheetHandle} />
          </View>
          <View style={styles.aiHead}>
            <Text style={styles.aiTitle}>Ask AI</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={palette.textMuted} />
            </Pressable>
          </View>
          <ScrollView style={styles.aiThread} contentContainerStyle={styles.aiThreadContent}>
            {messages.map((msg) => (
              <View
                key={msg.id}
                style={[styles.aiBubble, msg.role === 'me' ? styles.aiBubbleMe : styles.aiBubbleOther]}
              >
                {msg.meta ? <Text style={styles.aiMeta}>{msg.meta}</Text> : null}
                <Text style={[styles.aiText, msg.role === 'me' ? styles.aiTextMe : styles.aiTextOther]}>
                  {msg.text}
                </Text>
              </View>
            ))}
          </ScrollView>
          <View style={styles.aiComposer}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask for recommendations..."
              placeholderTextColor={palette.textDim}
              style={styles.aiInput}
              editable={!loading}
            />
            <Pressable onPress={send} style={({ pressed }) => [styles.aiSend, pressed && styles.pressed]}>
              {loading ? (
                <ActivityIndicator color={palette.bg} />
              ) : (
                <Ionicons name="send" size={16} color={palette.bg} />
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

type MessagesSheetProps = {
  visible: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSend: (text: string) => void;
};

function MessagesSheet({ visible, onClose, messages, onSend }: MessagesSheetProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalFrame}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={[styles.aiSheet, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <View style={styles.sheetHandleWrap}>
            <View style={styles.sheetHandle} />
          </View>
          <View style={styles.aiHead}>
            <Text style={styles.aiTitle}>Messages</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={palette.textMuted} />
            </Pressable>
          </View>
          <ScrollView style={styles.aiThread} contentContainerStyle={styles.aiThreadContent}>
            {messages.map((msg) => (
              <View
                key={msg.id}
                style={[styles.aiBubble, msg.role === 'me' ? styles.aiBubbleMe : styles.aiBubbleOther]}
              >
                {msg.meta ? <Text style={styles.aiMeta}>{msg.meta}</Text> : null}
                <Text style={[styles.aiText, msg.role === 'me' ? styles.aiTextMe : styles.aiTextOther]}>
                  {msg.text}
                </Text>
              </View>
            ))}
          </ScrollView>
          <View style={styles.aiComposer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Type a message..."
              placeholderTextColor={palette.textDim}
              style={styles.aiInput}
            />
            <Pressable onPress={send} style={({ pressed }) => [styles.aiSend, pressed && styles.pressed]}>
              <Ionicons name="paper-plane-outline" size={16} color={palette.bg} />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MainScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [condition, setCondition] = useState<ConditionFilter>('All');
  const [compareProduct, setCompareProduct] = useState<Listing | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [basketOpen, setBasketOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [cart, setCart] = useState<CartState | null>(null);
  const [cartLoading, setCartLoading] = useState(false);
  const [sellerMessages, setSellerMessages] = useState<ChatMessage[]>([
    {
      id: 's-1',
      role: 'other',
      text: 'Hi! This is TechVault Pro. Ask for availability, condition, or best offer.',
      meta: 'TechVault Pro',
    },
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let sid = await AsyncStorage.getItem(SESSION_KEY);
        if (!sid) {
          sid = newSessionId();
          await AsyncStorage.setItem(SESSION_KEY, sid);
        }
        if (!cancelled) setSessionId(sid);
      } catch {
        if (!cancelled) setSessionId(newSessionId());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshCart = useCallback(async () => {
    if (!sessionId) return;
    setCartLoading(true);
    try {
      const data = (await apiJson('/api/cart', sessionId)) as CartState;
      setCart(data);
    } catch {
      setCart({ lines: [], subtotal: 0, itemCount: 0, reservedUntil: null, reservationActive: false });
    } finally {
      setCartLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) refreshCart();
  }, [sessionId, refreshCart]);

  useEffect(() => {
    if (basketOpen && sessionId) refreshCart();
  }, [basketOpen, sessionId, refreshCart]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (!sessionId) return;
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('stripe_checkout');
    if (!checkout) return;

    const clearStripeQuery = () => {
      window.history.replaceState({}, '', window.location.pathname + (window.location.hash || ''));
    };

    if (checkout === 'cancel') {
      clearStripeQuery();
      Alert.alert('Checkout', 'Payment was cancelled.');
      return;
    }

    if (checkout !== 'success') {
      clearStripeQuery();
      return;
    }

    const stripeSessionId = params.get('session_id');
    if (!stripeSessionId) {
      clearStripeQuery();
      return;
    }

    clearStripeQuery();

    let cancelled = false;
    (async () => {
      try {
        const data = (await apiJson('/api/cart/stripe-verify', sessionId, {
          method: 'POST',
          body: JSON.stringify({ stripeSessionId }),
        })) as { message?: string; orderId?: string };
        if (cancelled) return;
        Alert.alert(
          'Paid with Stripe',
          data.message ??
            (data.orderId ? `Order ${data.orderId}` : 'Thank you for your order.'),
        );
        await refreshCart();
      } catch (e) {
        if (!cancelled) {
          Alert.alert('Payment', e instanceof Error ? e.message : 'Could not verify payment');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, refreshCart]);

  const applySearch = () => {
    setSearch(searchInput.trim());
  };

  const addToCart = useCallback(
    async (productId: string, offerId: string) => {
      if (!sessionId) throw new Error('No session');
      await apiJson('/api/cart/items', sessionId, {
        method: 'POST',
        body: JSON.stringify({ productId, offerId, quantity: 1 }),
      });
      await refreshCart();
    },
    [sessionId, refreshCart],
  );

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const data = (await apiJson('/api/products', sessionId, { method: 'GET' })) as { items: Listing[] };
      const raw = (data.items ?? []) as Listing[];
      setItems(
        raw.map((p) => ({
          ...p,
          offers: p.offers ?? [],
          priceHigh: p.priceHigh ?? p.price,
          offerCount: p.offerCount ?? 1,
          savingsMax: p.savingsMax ?? 0,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load listings');
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionId]);

  useEffect(() => {
    load('initial');
  }, [load]);

  const marketPulse = useMemo(() => {
    if (!items.length) return { avgSave: 0, listings: 0, offers: 0 };
    const withSave = items.filter((i) => i.savingsMax > 0);
    const avgSave =
      withSave.length === 0
        ? 0
        : Math.round(withSave.reduce((s, i) => s + i.savingsMax, 0) / withSave.length);
    const offers = items.reduce((s, i) => s + (i.offerCount || 0), 0);
    return { avgSave, listings: items.length, offers };
  }, [items]);

  const filtered = useMemo(() => {
    const q = normalizeText(search);
    return items.filter((p) => {
      if (!q) return true;
      const haystack = normalizeText(
        `${p.title} ${p.brand} ${p.category} ${p.condition}`,
      );
      if (!haystack.includes(q)) {
        return false;
      }
      if (category !== 'All' && p.category !== category) return false;
      if (condition !== 'All' && p.condition.toLowerCase() !== condition.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [items, search, category, condition]);

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setCategory('All');
    setCondition('All');
  };

  const sendSellerMessage = (text: string) => {
    const my = { id: `me-${Date.now()}`, role: 'me' as const, text };
    const lower = text.toLowerCase();
    let reply = 'Thanks! This item is available. We can ship in 2-3 days.';
    if (lower.includes('best price') || lower.includes('discount')) {
      reply = 'For SmartHub users, we can usually match the best verified offer.';
    } else if (lower.includes('condition')) {
      reply = 'Condition is exactly as listed, tested before shipping.';
    } else if (lower.includes('available') || lower.includes('stock')) {
      reply = 'Yes, currently in stock. Reserve in basket to lock your price.';
    }
    const seller = {
      id: `seller-${Date.now() + 1}`,
      role: 'other' as const,
      text: reply,
      meta: 'TechVault Pro',
    };
    setSellerMessages((prev) => [...prev, my, seller]);
  };

  const renderSkeleton = () => (
    <View style={styles.skeletonWrap}>
      {[0, 1, 2, 3, 4].map((k) => (
        <View key={k} style={styles.skeletonCard}>
          <LinearGradient
            colors={['rgba(148, 163, 184, 0.15)', 'rgba(148, 163, 184, 0.05)']}
            style={styles.skeletonThumb}
          />
          <View style={styles.skeletonLines}>
            <View style={styles.skeletonLineLg} />
            <View style={styles.skeletonLineSm} />
            <View style={styles.skeletonLineMd} />
          </View>
        </View>
      ))}
    </View>
  );

  const renderHeader = () => (
    <>
      <View style={styles.heroWrap}>
        <LinearGradient
          colors={['#0f172a', '#0a0f1c', palette.bg]}
          locations={[0, 0.4, 1]}
          style={styles.heroGradient}
        >
          <View style={[styles.heroOrb, styles.heroOrb1]} />
          <View style={[styles.heroOrb, styles.heroOrb2]} />
          <SafeAreaView edges={['top']} style={styles.heroInner}>
            <View style={styles.heroTop}>
              <View style={{ flex: 1 }}>
                <View style={styles.brandRow}>
                  <LinearGradient
                    colors={['rgba(34, 211, 238, 0.9)', '#8b5cf6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.brandDot}
                  />
                  <Text style={styles.heroEyebrow}>SmartHub · Price compare</Text>
                </View>
                <Text style={styles.heroTitle}>Find the best deal</Text>
                <Text style={styles.heroSub}>
                  Prices pulled from major retailer sites (demo) — compare, add to basket, reserve, then checkout.
                </Text>
              </View>
              <View style={styles.heroActions}>
                <Pressable
                  onPress={() => setBasketOpen(true)}
                  style={({ pressed }) => [styles.iconBtn, styles.iconBtnCart, pressed && styles.pressed]}
                >
                  <Ionicons name="bag-handle-outline" size={22} color={palette.text} />
                  {(cart?.itemCount ?? 0) > 0 ? (
                    <View style={styles.cartBadge}>
                      <Text style={styles.cartBadgeText}>
                        {(cart?.itemCount ?? 0) > 99 ? '99+' : String(cart?.itemCount)}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
                <Pressable style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
                  <Ionicons name="notifications-outline" size={22} color={palette.text} />
                </Pressable>
              </View>
            </View>

            <View style={styles.pulseRow}>
              <View style={styles.pulseCard}>
                <Ionicons name="prism-outline" size={18} color={palette.accent} />
                <Text style={styles.pulseValue}>{marketPulse.listings}</Text>
                <Text style={styles.pulseLabel}>Products</Text>
              </View>
              <View style={styles.pulseCard}>
                <Ionicons name="storefront-outline" size={18} color={palette.violet} />
                <Text style={styles.pulseValue}>{marketPulse.offers}</Text>
                <Text style={styles.pulseLabel}>Seller offers</Text>
              </View>
              <View style={styles.pulseCard}>
                <Ionicons name="wallet-outline" size={18} color={palette.gold} />
                <Text style={styles.pulseValue}>
                  {marketPulse.avgSave > 0 ? `$${marketPulse.avgSave}` : '—'}
                </Text>
                <Text style={styles.pulseLabel}>Avg. save</Text>
              </View>
            </View>

            <View style={styles.searchShell}>
              <Ionicons name="search" size={20} color={palette.textDim} style={styles.searchIcon} />
              <TextInput
                value={searchInput}
                onChangeText={setSearchInput}
                placeholder="Brand or model — Apply, Search key, or tap outside"
                placeholderTextColor={palette.textDim}
                style={styles.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                blurOnSubmit
                onSubmitEditing={applySearch}
                onEndEditing={applySearch}
              />
              <Pressable onPress={applySearch} hitSlop={10} style={styles.searchApplyBtn}>
                <Text style={styles.searchApplyText}>Apply</Text>
              </Pressable>
              {searchInput.length > 0 ? (
                <Pressable
                  onPress={() => {
                    setSearchInput('');
                    setSearch('');
                  }}
                  hitSlop={12}
                  style={styles.clearSearch}
                >
                  <Ionicons name="close-circle" size={22} color={palette.textMuted} />
                </Pressable>
              ) : null}
            </View>
            {search.length > 0 ? (
              <View style={styles.appliedSearchRow}>
                <Text style={styles.appliedSearchLabel}>Applied search:</Text>
                <Text style={styles.appliedSearchValue} numberOfLines={1}>
                  {search}
                </Text>
              </View>
            ) : null}
          </SafeAreaView>
        </LinearGradient>
      </View>

      <View style={styles.filtersBlock}>
        <Text style={styles.filterLabel}>Category</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {CATEGORIES.map((c) => {
            const active = category === c;
            return (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={({ pressed }) => [
                  styles.chip,
                  active && styles.chipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={[styles.filterLabel, styles.filterLabelSecond]}>Condition</Text>
        <View style={styles.conditionRow}>
          {CONDITIONS.map((c) => {
            const active = condition === c;
            return (
              <Pressable
                key={c}
                onPress={() => setCondition(c)}
                style={({ pressed }) => [
                  styles.condChip,
                  active && styles.condChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.condChipText, active && styles.condChipTextActive]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>
          {filtered.length} product{filtered.length === 1 ? '' : 's'}
        </Text>
        <Pressable onPress={clearFilters} hitSlop={8}>
          <Text style={styles.sectionAction}>Reset filters</Text>
        </Pressable>
      </View>
    </>
  );

  const renderCard = ({ item }: { item: Listing }) => {
    const [g0, g1] = thumbGradient(item.category);
    const offers = item.offers?.length ?? item.offerCount ?? 1;
    return (
      <Pressable
        onPress={() => setCompareProduct(item)}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
      >
        <LinearGradient colors={[g0, g1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardThumb}>
          <Ionicons name={categoryIcon(item.category)} size={30} color={palette.accent} />
        </LinearGradient>

        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={styles.offerCountBadge}>
              <Ionicons name="git-compare-outline" size={12} color={palette.accent} />
              <Text style={styles.offerCountText}>{offers} offers</Text>
            </View>
          </View>

          <Text style={styles.cardBrand}>{item.brand}</Text>

          <View style={styles.cardMeta}>
            <View style={styles.condPill}>
              <Text style={styles.condPillText}>
                {item.condition === 'new' ? 'New' : 'Used'}
              </Text>
            </View>
            {item.verifiedSeller ? (
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={12} color={palette.success} />
                <Text style={styles.verifiedText}>Verified sellers</Text>
              </View>
            ) : null}
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color={palette.star} />
              <Text style={styles.ratingText}>{item.rating.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.priceBlock}>
            <View>
              <Text style={styles.priceLabel}>From</Text>
              <Text style={styles.price}>{formatPrice(item.currency, item.price)}</Text>
              {item.priceHigh > item.price ? (
                <Text style={styles.priceWas}>up to {formatPrice(item.currency, item.priceHigh)}</Text>
              ) : null}
            </View>
            {item.savingsMax > 0 ? (
              <LinearGradient
                colors={['rgba(251, 191, 36, 0.2)', 'rgba(251, 113, 133, 0.15)']}
                style={styles.saveChip}
              >
                <Ionicons name="flash" size={14} color={palette.gold} />
                <Text style={styles.saveChipText}>Save {formatPrice(item.currency, item.savingsMax)}</Text>
              </LinearGradient>
            ) : null}
          </View>

          <View style={styles.cardFooter}>
            <Text style={styles.compareHintText}>Tap to compare all seller prices</Text>
            <Ionicons name="chevron-forward" size={18} color={palette.accent} />
          </View>
        </View>
      </Pressable>
    );
  };

  const listEmpty = () => (
    <View style={styles.emptyWrap}>
      <LinearGradient
        colors={['rgba(148, 163, 184, 0.12)', 'rgba(30, 41, 59, 0.3)']}
        style={styles.emptyIconCircle}
      >
        <Ionicons name="search-outline" size={40} color={palette.textMuted} />
      </LinearGradient>
      <Text style={styles.emptyTitle}>No matches</Text>
      <Text style={styles.emptySub}>Try another search or reset filters to browse every offer.</Text>
      <Pressable onPress={clearFilters} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
        <Text style={styles.primaryBtnText}>Clear filters</Text>
      </Pressable>
    </View>
  );

  const errorView = () => (
    <View style={styles.errorWrap}>
      <LinearGradient
        colors={['rgba(248, 113, 113, 0.15)', 'rgba(248, 113, 113, 0.05)']}
        style={styles.errorIconCircle}
      >
        <Ionicons name="cloud-offline-outline" size={36} color="#f87171" />
      </LinearGradient>
      <Text style={styles.errorTitle}>Connection issue</Text>
      <Text style={styles.errorBody}>{error}</Text>
      <Text style={styles.errorHint}>
        Start the API from the project folder: backend → npm run dev
      </Text>
      <Pressable onPress={() => load('initial')} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
        <Ionicons name="refresh" size={18} color={palette.bg} style={{ marginRight: 8 }} />
        <Text style={styles.primaryBtnText}>Try again</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.screen, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <StatusBar style="light" />
      <ComparePricesSheet
        product={compareProduct}
        onClose={() => setCompareProduct(null)}
        sessionReady={sessionId != null}
        onAddToCart={addToCart}
      />
      <BasketSheet
        visible={basketOpen}
        onClose={() => setBasketOpen(false)}
        sessionId={sessionId}
        cart={cart}
        loading={cartLoading}
        onRefresh={refreshCart}
      />
      <AskAiSheet visible={aiOpen} onClose={() => setAiOpen(false)} sessionId={sessionId} />
      <MessagesSheet
        visible={messagesOpen}
        onClose={() => setMessagesOpen(false)}
        messages={sellerMessages}
        onSend={sendSellerMessage}
      />

      {loading ? (
        <View style={styles.flex1}>
          {renderHeader()}
          <View style={styles.loadingBar}>
            <ActivityIndicator color={palette.accent} size="large" />
            <Text style={styles.loadingText}>Scanning seller prices…</Text>
          </View>
          {renderSkeleton()}
        </View>
      ) : error ? (
        <View style={styles.flex1}>
          {renderHeader()}
          {errorView()}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={listEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshing={refreshing}
          onRefresh={() => load('refresh')}
          renderItem={renderCard}
        />
      )}

      <LinearGradient
        colors={['transparent', 'rgba(5, 8, 16, 0.95)']}
        style={styles.bottomFade}
        pointerEvents="none"
      />
      <View style={[styles.bottomBar, { marginBottom: Math.max(insets.bottom, 6) }]}>
        <Pressable onPress={() => setAiOpen(true)} style={({ pressed }) => [styles.bottomBtn, pressed && styles.pressed]}>
          <Ionicons name="sparkles-outline" size={20} color={palette.violet} />
          <Text style={styles.bottomBtnText}>Ask AI</Text>
        </Pressable>
        <Pressable
          onPress={() => setBasketOpen(true)}
          style={({ pressed }) => [styles.bottomBtn, pressed && styles.pressed]}
        >
          <Ionicons name="bag-outline" size={20} color={palette.accent} />
          <Text style={[styles.bottomBtnText, { color: palette.accent }]}>Basket</Text>
        </Pressable>
        <Pressable onPress={() => setMessagesOpen(true)} style={({ pressed }) => [styles.bottomBtn, pressed && styles.pressed]}>
          <Ionicons name="chatbubble-ellipses-outline" size={20} color={palette.textMuted} />
          <Text style={[styles.bottomBtnText, { color: palette.textMuted }]}>Messages</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainScreen />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  flex1: {
    flex: 1,
  },
  heroWrap: {
    overflow: 'hidden',
  },
  heroGradient: {
    paddingBottom: 22,
    position: 'relative',
  },
  heroOrb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.35,
  },
  heroOrb1: {
    width: 220,
    height: 220,
    backgroundColor: '#22d3ee',
    top: -80,
    right: -60,
  },
  heroOrb2: {
    width: 160,
    height: 160,
    backgroundColor: '#8b5cf6',
    top: 40,
    left: -70,
  },
  heroInner: {
    paddingHorizontal: 20,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: palette.text,
    letterSpacing: -1,
    lineHeight: 38,
  },
  heroSub: {
    marginTop: 10,
    fontSize: 15,
    color: palette.textMuted,
    lineHeight: 22,
    maxWidth: 320,
  },
  pulseRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  pulseCard: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  pulseValue: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.text,
    marginTop: 6,
  },
  pulseLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: palette.textDim,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtnCart: {
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.rose,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: palette.bg,
  },
  cartBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  searchShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 26, 43, 0.9)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.borderGlow,
    paddingHorizontal: 16,
    minHeight: 54,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: palette.text,
    paddingVertical: Platform.OS === 'web' ? 14 : 12,
  },
  clearSearch: {
    marginLeft: 4,
  },
  searchApplyBtn: {
    marginLeft: 4,
    borderRadius: 10,
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  searchApplyText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.accent,
  },
  appliedSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  appliedSearchLabel: {
    fontSize: 12,
    color: palette.textDim,
  },
  appliedSearchValue: {
    flex: 1,
    fontSize: 12,
    color: palette.accent,
    fontWeight: '700',
  },
  filtersBlock: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  filterLabelSecond: {
    marginTop: 18,
  },
  chipsRow: {
    gap: 8,
    paddingRight: 20,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: palette.chipBg,
    borderWidth: 1,
    borderColor: palette.border,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: palette.chipActive,
    borderColor: palette.chipBorderActive,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.textMuted,
  },
  chipTextActive: {
    color: palette.accent,
  },
  conditionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  condChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: palette.chipBg,
    borderWidth: 1,
    borderColor: palette.border,
  },
  condChipActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  condChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.textMuted,
  },
  condChipTextActive: {
    color: palette.violet,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.text,
    letterSpacing: -0.3,
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.accent,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: palette.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
      web: {
        boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
      },
    }),
  },
  cardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.992 }],
  },
  cardThumb: {
    width: 78,
    height: 78,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
    lineHeight: 22,
  },
  offerCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.25)',
  },
  offerCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.accent,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.successBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.success,
  },
  cardBrand: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: palette.textMuted,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
    flexWrap: 'wrap',
  },
  condPill: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  condPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.textMuted,
    textTransform: 'capitalize',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
  },
  priceBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  priceLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  price: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.accent,
    letterSpacing: -0.5,
  },
  priceWas: {
    fontSize: 12,
    color: palette.textDim,
    marginTop: 2,
    textDecorationLine: 'line-through',
  },
  saveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
  },
  saveChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.gold,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  compareHintText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.textMuted,
  },
  loadingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 15,
    color: palette.textMuted,
    fontWeight: '500',
  },
  skeletonWrap: {
    paddingHorizontal: 20,
    flex: 1,
  },
  skeletonCard: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  skeletonThumb: {
    width: 78,
    height: 78,
    borderRadius: 18,
    marginRight: 14,
  },
  skeletonLines: {
    flex: 1,
    justifyContent: 'center',
    gap: 10,
  },
  skeletonLineLg: {
    height: 14,
    borderRadius: 6,
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    width: '88%',
  },
  skeletonLineMd: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(148, 163, 184, 0.06)',
    width: '55%',
  },
  skeletonLineSm: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(148, 163, 184, 0.06)',
    width: '70%',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: palette.border,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 15,
    color: palette.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.accent,
    paddingHorizontal: 28,
    paddingVertical: 15,
    borderRadius: 16,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.bg,
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  errorIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 8,
  },
  errorBody: {
    fontSize: 14,
    color: palette.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 13,
    color: palette.textDim,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
    pointerEvents: 'none',
  },
  bottomBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 26, 43, 0.94)',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: { elevation: 10 },
      web: {
        backdropFilter: 'blur(16px)',
        boxShadow: '0 -12px 40px rgba(0,0,0,0.5)',
      },
    }),
  },
  bottomBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    gap: 4,
  },
  bottomBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.violet,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.78,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: palette.modalOverlay,
    justifyContent: 'flex-end',
  },
  modalFrame: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.modalOverlay,
  },
  sheet: {
    backgroundColor: palette.bgElevated,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: palette.border,
    maxHeight: '88%',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sheetHandleWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(148, 163, 184, 0.35)',
  },
  sheetHero: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sheetHeroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  sheetIconWrap: {},
  sheetIconGrad: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sheetHeroText: {
    flex: 1,
    minWidth: 0,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: palette.text,
    lineHeight: 23,
  },
  sheetSub: {
    marginTop: 6,
    fontSize: 13,
    color: palette.textMuted,
    lineHeight: 18,
  },
  sheetClose: {
    padding: 4,
  },
  saveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
  },
  saveBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: palette.gold,
    lineHeight: 18,
  },
  sheetSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  offerScroll: {
    maxHeight: 340,
    marginBottom: 16,
  },
  offerRow: {
    position: 'relative',
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  offerRowBest: {
    borderColor: 'rgba(34, 211, 238, 0.45)',
  },
  offerRowInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  offerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
    minWidth: 0,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeBest: {
    backgroundColor: 'rgba(34, 211, 238, 0.2)',
  },
  rankText: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.textMuted,
  },
  rankTextBest: {
    color: palette.accent,
  },
  offerSellerBlock: {
    flex: 1,
    minWidth: 0,
  },
  offerSellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  offerSeller: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
    flexShrink: 1,
  },
  miniVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  miniVerifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.success,
  },
  webSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    maxWidth: '100%',
  },
  webSourceText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: palette.violet,
    minWidth: 0,
  },
  addBasketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: palette.accent,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  addBasketBtnBusy: {
    opacity: 0.7,
  },
  addBasketBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.bg,
  },
  offerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  offerMeta: {
    fontSize: 12,
    color: palette.textDim,
  },
  sellerStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  sellerRatingText: {
    fontSize: 11,
    color: palette.textMuted,
    fontWeight: '600',
  },
  offerRight: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  offerPrice: {
    fontSize: 17,
    fontWeight: '800',
    color: palette.text,
  },
  offerPriceBest: {
    color: palette.accent,
  },
  offerSaveHint: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.success,
    marginTop: 4,
  },
  ctaWide: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 4,
  },
  ctaWideGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  ctaWideText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  basketSheet: {
    position: 'relative',
    backgroundColor: palette.bgElevated,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: palette.border,
    maxHeight: '92%',
    paddingHorizontal: 20,
    paddingTop: 8,
    overflow: 'hidden',
  },
  paymentOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.modalOverlay,
    justifyContent: 'center',
    paddingHorizontal: 16,
    zIndex: 40,
  },
  paymentPickCard: {
    backgroundColor: palette.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.border,
    maxHeight: '75%',
  },
  paymentPickTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
    letterSpacing: -0.3,
  },
  paymentPickSub: {
    fontSize: 13,
    color: palette.textMuted,
    marginTop: 4,
    marginBottom: 14,
  },
  paymentPickLoading: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  paymentPickList: {
    maxHeight: 320,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: palette.bgElevated,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: palette.border,
  },
  paymentStripeRow: {
    backgroundColor: 'rgba(99, 91, 255, 0.1)',
    borderColor: 'rgba(99, 91, 255, 0.35)',
    marginBottom: 12,
  },
  paymentSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  paymentMethodTextCol: {
    flex: 1,
    minWidth: 0,
  },
  paymentMethodLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
  paymentMethodDesc: {
    fontSize: 12,
    color: palette.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  paymentPickCancel: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  paymentPickCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.textMuted,
  },
  basketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  basketTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.text,
    letterSpacing: -0.5,
  },
  reserveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
    marginBottom: 12,
  },
  reserveBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: palette.gold,
  },
  basketLoading: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  basketEmpty: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  basketEmptyText: {
    fontSize: 17,
    fontWeight: '700',
    color: palette.text,
    marginTop: 16,
  },
  basketEmptySub: {
    fontSize: 14,
    color: palette.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
  basketScroll: {
    maxHeight: 360,
    marginBottom: 12,
  },
  basketLine: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: palette.border,
  },
  basketLineTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  basketLineTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
    lineHeight: 20,
  },
  basketLineMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.violet,
    marginTop: 8,
  },
  basketLineSeller: {
    fontSize: 12,
    color: palette.textMuted,
    marginTop: 2,
  },
  basketLineBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  basketLineQty: {
    fontSize: 13,
    color: palette.textDim,
    fontWeight: '600',
  },
  basketLinePrice: {
    fontSize: 17,
    fontWeight: '800',
    color: palette.accent,
  },
  basketOpenLink: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: palette.accent,
  },
  basketFooter: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 16,
    gap: 12,
  },
  basketTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  basketTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.textMuted,
  },
  basketTotalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.text,
  },
  basketActions: {
    flexDirection: 'row',
    gap: 10,
  },
  basketSecondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    backgroundColor: palette.surface,
  },
  basketSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.textMuted,
  },
  basketReserve: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
  },
  basketReserveText: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.gold,
  },
  aiSheet: {
    backgroundColor: palette.bgElevated,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: palette.border,
    maxHeight: '90%',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  aiHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  aiTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
  },
  aiThread: {
    maxHeight: 360,
  },
  aiThreadContent: {
    paddingVertical: 8,
    gap: 10,
  },
  aiBubble: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  aiBubbleMe: {
    alignSelf: 'flex-end',
    maxWidth: '86%',
    backgroundColor: 'rgba(34, 211, 238, 0.14)',
    borderColor: 'rgba(34, 211, 238, 0.35)',
  },
  aiBubbleOther: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    backgroundColor: palette.surface,
    borderColor: palette.border,
  },
  aiMeta: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.textDim,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aiText: {
    fontSize: 14,
    lineHeight: 20,
  },
  aiTextMe: {
    color: palette.text,
  },
  aiTextOther: {
    color: palette.textMuted,
  },
  aiComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  aiInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    color: palette.text,
  },
  aiSend: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
