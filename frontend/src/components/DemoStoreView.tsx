import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShoppingBag,
  Flame,
  CheckCircle2,
  Activity,
  ArrowRight,
  Loader2,
  Search,
  SlidersHorizontal,
  Heart,
  Star,
  Trash2,
  Plus,
  Minus,
  X,
  Sparkles,
  Check,
  AlertTriangle,
  RotateCcw,
  Truck,
  ShieldCheck,
  Package,
} from 'lucide-react';
import {
  DemoProduct,
  DemoHealthResponse,
  LiveProbeResult,
  ChaosScenario,
  ChaosStatusResponse,
} from '../types';
import { api } from '../services/api';

interface DemoStoreViewProps {
  onIncidentCreated?: () => void;
  onNavigateToDashboard?: () => void;
  onError: (msg: string) => void;
}

interface CartItem {
  product: DemoProduct;
  quantity: number;
  selectedSize: string;
  selectedColor: string;
}

const CATEGORIES = [
  'All',
  'Men',
  'Women',
  'Streetwear',
  'Essentials',
  'Footwear',
  'Accessories',
  'New Arrivals',
  'Sale',
];

export const DemoStoreView: React.FC<DemoStoreViewProps> = ({
  onIncidentCreated,
  onNavigateToDashboard,
  onError,
}) => {
  // Catalog & Product State
  const [products, setProducts] = useState<DemoProduct[]>([]);
  const [health, setHealth] = useState<DemoHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [totalAvailable, setTotalAvailable] = useState<number>(0);

  // Chaos & Scenario State
  const [scenarios, setScenarios] = useState<ChaosScenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('scenario_a_catalog_db');
  const [activeScenario, setActiveScenario] = useState<ChaosScenario | null>(null);
  const [chaosStatus, setChaosStatus] = useState<ChaosStatusResponse | null>(null);
  const [isInjecting, setIsInjecting] = useState<boolean>(false);
  const [isProbing, setIsProbing] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [isRecovering, setIsRecovering] = useState<boolean>(false);
  const [lastProbe, setLastProbe] = useState<LiveProbeResult | null>(null);
  const [showChaosPanel, setShowChaosPanel] = useState<boolean>(true);

  // Storefront Filter & Search State
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'rating' | 'newest'>('featured');
  const [selectedProductDetail, setSelectedProductDetail] = useState<DemoProduct | null>(null);
  const [inventoryStatus, setInventoryStatus] = useState<{ in_stock: boolean; stock_count: number } | null>(null);
  const [isCheckingInventory, setIsCheckingInventory] = useState<boolean>(false);

  // Wishlist & Cart State
  const [wishlist, setWishlist] = useState<Record<string, boolean>>({});
  const [isWishlistOpen, setIsWishlistOpen] = useState<boolean>(false);
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});
  const [selectedColors, setSelectedColors] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState<string>('FESTIVE20');
  const [discountPercent, setDiscountPercent] = useState<number>(20);
  const [promoApplied, setPromoApplied] = useState<boolean>(true);

  // Checkout State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutSuccessOrder, setCheckoutSuccessOrder] = useState<{
    orderId: string;
    total: number;
    itemsCount: number;
    paymentMethod: string;
  } | null>(null);

  const [checkoutForm, setCheckoutForm] = useState({
    fullName: 'Akshita Sharma',
    email: 'akshita.sharma@example.com',
    phone: '+91 98765 43210',
    address: '42 Heritage Enclave, Civil Lines',
    city: 'Jaipur',
    state: 'Rajasthan',
    pincode: '302006',
    paymentMethod: 'UPI',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch Catalog & Scenario Data
  const fetchStoreData = useCallback(async () => {
    try {
      const [hRes, scRes, stRes] = await Promise.all([
        api.getDemoHealth(),
        api.getChaosScenarios(),
        api.getChaosStatus(),
      ]);

      setHealth(hRes);
      setScenarios(scRes.scenarios);
      setActiveScenario(scRes.active_scenario);
      setChaosStatus(stRes);

      if (hRes.status === 'healthy') {
        const pRes = await api.getDemoProducts({
          category: selectedCategory,
          search: searchQuery,
          sort: sortBy,
        });
        setProducts(pRes.products);
        setTotalAvailable(pRes.total_available);
      } else {
        setProducts([]);
      }
    } catch (err: any) {
      setHealth({
        status: 'unhealthy',
        service: 'backend_api_products',
        error: err.message || 'Service Unavailable',
        error_code: err.errorCode || 'ERR_SERVICE_UNAVAILABLE',
      });
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, searchQuery, sortBy]);

  useEffect(() => {
    setIsLoading(true);
    fetchStoreData();
    const timer = setInterval(() => {
      fetchStoreData();
    }, 4000);
    return () => clearInterval(timer);
  }, [fetchStoreData]);

  // Handle Inventory Check on Product Detail open
  useEffect(() => {
    if (selectedProductDetail) {
      setIsCheckingInventory(true);
      api
        .checkInventory(selectedProductDetail.id)
        .then((res) => {
          setInventoryStatus({ in_stock: res.in_stock, stock_count: res.stock_count });
        })
        .catch(() => {
          setInventoryStatus(null);
        })
        .finally(() => {
          setIsCheckingInventory(false);
        });
    }
  }, [selectedProductDetail]);

  // Chaos Actions
  const handleInjectScenario = async (scenarioIdToInject?: string) => {
    const scId = scenarioIdToInject || selectedScenarioId;
    setIsInjecting(true);
    try {
      const res = await api.injectChaosScenario(scId);
      showToast(`Fault Injected: ${res.scenario.name}`);
      // Run probe automatically to update SRE plane
      const probeRes = await api.runLiveProbe(true);
      setLastProbe(probeRes);
      if (onIncidentCreated) onIncidentCreated();
      await fetchStoreData();
    } catch (err: any) {
      onError(err.message || 'Failed to inject chaos scenario');
    } finally {
      setIsInjecting(false);
    }
  };

  const handleResetChaos = async () => {
    setIsResetting(true);
    try {
      await api.resetChaos();
      showToast('All chaos faults cleared. Subsystems restored to healthy.');
      setCheckoutError(null);
      await fetchStoreData();
    } catch (err: any) {
      onError(err.message || 'Failed to reset chaos state');
    } finally {
      setIsResetting(false);
    }
  };

  const handleManualProbe = async () => {
    setIsProbing(true);
    try {
      const probeRes = await api.runLiveProbe(true);
      setLastProbe(probeRes);
      if (probeRes.incident && onIncidentCreated) {
        onIncidentCreated();
      }
      showToast(
        probeRes.is_healthy
          ? 'Live Probe: All HTTP endpoints healthy (200 OK)'
          : `Live Probe: Outage detected on ${probeRes.service} (HTTP ${probeRes.health_probe.status_code})`
      );
      await fetchStoreData();
    } catch (err: any) {
      onError(err.message || 'Health probe failed');
    } finally {
      setIsProbing(false);
    }
  };

  const handleAutoRecover = async () => {
    setIsRecovering(true);
    try {
      // Find open incident
      const incRes = await api.getIncidents();
      const openInc = incRes.incidents.find(
        (i) => i.status === 'open' || i.status === 'recovering' || i.status === 'awaiting_approval'
      );

      if (openInc) {
        await api.startRecovery(openInc.id);
      } else {
        await api.restoreDemoService();
      }

      showToast('Allowlisted recovery executed! Endpoints verified HTTP 200.');
      if (onIncidentCreated) onIncidentCreated();
      await fetchStoreData();
    } catch (err: any) {
      onError(err.message || 'Failed to execute recovery');
    } finally {
      setIsRecovering(false);
    }
  };

  // Cart & Wishlist Actions
  const toggleWishlist = (productId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setWishlist((prev) => {
      const updated = { ...prev, [productId]: !prev[productId] };
      showToast(!prev[productId] ? 'Added to Wishlist' : 'Removed from Wishlist');
      return updated;
    });
  };

  const handleAddToCart = (product: DemoProduct, size?: string, color?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const finalSize = size || selectedSizes[product.id] || (product.sizes ? product.sizes[0] : 'Standard');
    const finalColor = color || selectedColors[product.id] || (product.colors ? product.colors[0] : 'Default');

    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (item) =>
          item.product.id === product.id &&
          item.selectedSize === finalSize &&
          item.selectedColor === finalColor
      );

      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx].quantity += 1;
        return updated;
      }
      return [...prev, { product, quantity: 1, selectedSize: finalSize, selectedColor: finalColor }];
    });

    showToast(`Added '${product.name}' to Shopping Bag`);
  };

  const updateCartQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const newQty = updated[index].quantity + delta;
      if (newQty <= 0) {
        return updated.filter((_, i) => i !== index);
      }
      updated[index].quantity = newQty;
      return updated;
    });
  };

  const removeCartItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
    showToast('Item removed from Shopping Bag');
  };

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    return promoApplied ? (cartSubtotal * discountPercent) / 100 : 0;
  }, [cartSubtotal, promoApplied, discountPercent]);

  const shippingFee = useMemo(() => {
    if (cartSubtotal === 0) return 0;
    return cartSubtotal >= 1999 ? 0 : 199;
  }, [cartSubtotal]);

  const cartTotal = useMemo(() => {
    return Math.max(0, cartSubtotal - discountAmount + shippingFee);
  }, [cartSubtotal, discountAmount, shippingFee]);

  const totalCartItemCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  const handleApplyCoupon = () => {
    if (promoCode.trim().toUpperCase() === 'FESTIVE20') {
      setDiscountPercent(20);
      setPromoApplied(true);
      showToast('Coupon FESTIVE20 applied: 20% Discount!');
    } else {
      showToast('Invalid promo code. Try FESTIVE20.');
    }
  };

  // Checkout Submission Flow
  const handleProceedCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    setIsSubmittingOrder(true);
    setCheckoutError(null);

    try {
      // 1. Submit checkout order to backend
      const checkoutRes = await api.submitCheckout({
        items: cart.map((i) => ({
          product_id: i.product.id,
          name: i.product.name,
          quantity: i.quantity,
          price: i.product.price,
          size: i.selectedSize,
          color: i.selectedColor,
        })),
        shipping_address: checkoutForm,
        payment_method: checkoutForm.paymentMethod,
        coupon_code: promoApplied ? promoCode : undefined,
        subtotal: cartSubtotal,
        total: cartTotal,
      });

      // 2. Process simulated payment transaction
      await api.processPayment({
        order_id: checkoutRes.order_id,
        amount: cartTotal,
        payment_method: checkoutForm.paymentMethod,
      });

      // Succeeded
      setCheckoutSuccessOrder({
        orderId: checkoutRes.order_id,
        total: cartTotal,
        itemsCount: totalCartItemCount,
        paymentMethod: checkoutForm.paymentMethod,
      });
      setCart([]);
      setIsCheckoutOpen(false);
      showToast('Order confirmed successfully!');
    } catch (err: any) {
      setCheckoutError(err.message || 'Checkout failed. Please check service status.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Wishlist items array
  const wishlistProducts = useMemo(() => {
    return products.filter((p) => wishlist[p.id]);
  }, [products, wishlist]);

  return (
    <div className="bg-[#FAF7F2] text-stone-900 min-h-screen font-['Plus_Jakarta_Sans',sans-serif] relative pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1C130D] text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl flex items-center space-x-2 border border-stone-800 animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="w-4 h-4 text-[#D95A1E]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Promotional Announcement Strip */}
      <div className="bg-[#1C130D] text-stone-300 text-[11px] font-medium py-2 px-4 border-b border-[#2C1E16]">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center space-x-2 overflow-x-auto whitespace-nowrap">
            <span className="px-1.5 py-0.2 rounded bg-[#D95A1E] text-white font-bold text-[9px]">
              FESTIVE '26
            </span>
            <span>Use code <strong className="text-white">FESTIVE20</strong> for 20% Off Entire Atelier</span>
            <span className="text-stone-500">•</span>
            <span className="hidden sm:inline">Complimentary Express Shipping above ₹1,999</span>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={() => setShowChaosPanel(!showChaosPanel)}
              className="text-[#D95A1E] hover:text-white font-semibold flex items-center space-x-1 transition cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>{showChaosPanel ? 'Hide Chaos Control' : 'Chaos Simulator'}</span>
            </button>
            {onNavigateToDashboard && (
              <button
                onClick={onNavigateToDashboard}
                className="text-stone-400 hover:text-white transition flex items-center space-x-1 cursor-pointer"
              >
                <span>SRE Plane</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Interactive Chaos Scenario & Operator Control Center */}
      {showChaosPanel && (
        <div className="bg-white border-b border-[#EBE5DB] shadow-xs px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="max-w-7xl mx-auto space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#D95A1E] text-white flex items-center justify-center shadow-xs shrink-0">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-stone-900 tracking-tight flex items-center space-x-1.5">
                    <span>Multi-Scenario Chaos Engine & Fault Injection</span>
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Select distinct outage scenarios to test deterministic incident recovery.
                  </p>
                </div>
              </div>

              {/* Status Badges */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 ${
                    health?.status === 'healthy'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200 animate-pulse'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      health?.status === 'healthy' ? 'bg-emerald-600' : 'bg-rose-600'
                    }`}
                  />
                  <span>Catalog: {health?.status === 'healthy' ? '200 OK' : health?.error_code || '503 DOWN'}</span>
                </span>

                {activeScenario && (
                  <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold font-mono">
                    Active: [{activeScenario.scenario_letter}] {activeScenario.target_service}
                  </span>
                )}

                {chaosStatus && (
                  <div className="hidden xl:flex items-center space-x-2 bg-stone-100 px-3 py-1 rounded-lg border border-stone-200 text-[11px] font-medium text-stone-600">
                    <span className="text-stone-400 font-semibold mr-0.5">Subsystems:</span>
                    <span className="flex items-center space-x-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${chaosStatus.subsystems.products_catalog === 'healthy' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span className="text-stone-700">Catalog</span>
                    </span>
                    <span className="text-stone-300">•</span>
                    <span className="flex items-center space-x-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${chaosStatus.subsystems.inventory === 'healthy' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span className="text-stone-700">Inventory</span>
                    </span>
                    <span className="text-stone-300">•</span>
                    <span className="flex items-center space-x-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${chaosStatus.subsystems.checkout === 'healthy' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span className="text-stone-700">Checkout</span>
                    </span>
                    <span className="text-stone-300">•</span>
                    <span className="flex items-center space-x-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${chaosStatus.subsystems.payment === 'healthy' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span className="text-stone-700">Payment</span>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Scenario Selector & Action Buttons */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center bg-stone-50/80 p-3.5 rounded-2xl border border-[#E7E2D9]">
              <div className="lg:col-span-6 space-y-1">
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                  Choose Chaos Outage Scenario:
                </label>
                <div className="relative">
                  <select
                    value={selectedScenarioId}
                    onChange={(e) => setSelectedScenarioId(e.target.value)}
                    disabled={isInjecting || isResetting}
                    className="w-full bg-white border border-[#DCD5C9] rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-stone-800 shadow-xs focus:outline-none focus:ring-1 focus:ring-[#D95A1E] transition cursor-pointer"
                  >
                    {scenarios.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        [{sc.scenario_letter}] {sc.name}
                      </option>
                    ))}
                  </select>
                </div>
                {lastProbe && (
                  <p className="text-[10px] font-mono text-stone-500">
                    Last Probe Result: <span className={lastProbe.is_healthy ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>{lastProbe.is_healthy ? '200 OK (All Healthy)' : `${lastProbe.health_probe.status_code} OUTAGE DETECTED`}</span>
                  </p>
                )}
              </div>

              <div className="lg:col-span-6 flex flex-wrap items-center justify-end gap-2 pt-1 lg:pt-0">
                <button
                  onClick={() => handleInjectScenario()}
                  disabled={isInjecting}
                  className="px-3.5 py-2 bg-[#D95A1E] hover:bg-[#C2410C] text-white text-xs font-bold rounded-xl shadow-xs flex items-center space-x-1.5 transition disabled:opacity-50 cursor-pointer"
                >
                  {isInjecting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Flame className="w-3.5 h-3.5 fill-white text-white" />
                  )}
                  <span>Inject Fault</span>
                </button>

                <button
                  onClick={handleManualProbe}
                  disabled={isProbing}
                  className="px-3.5 py-2 bg-white hover:bg-stone-50 border border-[#DCD5C9] text-stone-800 text-xs font-bold rounded-xl shadow-xs flex items-center space-x-1.5 transition cursor-pointer"
                >
                  <Activity className={`w-3.5 h-3.5 text-stone-600 ${isProbing ? 'animate-spin text-[#D95A1E]' : ''}`} />
                  <span>Run Probe</span>
                </button>

                <button
                  onClick={handleAutoRecover}
                  disabled={isRecovering}
                  className="px-3.5 py-2 bg-[#1B5E20] hover:bg-[#2E7D32] text-white text-xs font-bold rounded-xl shadow-xs flex items-center space-x-1.5 transition cursor-pointer"
                >
                  {isRecovering ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  )}
                  <span>Execute Recovery</span>
                </button>

                <button
                  onClick={handleResetChaos}
                  disabled={isResetting}
                  className="p-2 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl transition cursor-pointer"
                  title="Reset demo baseline"
                >
                  <RotateCcw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Luxury Fashion Store Header */}
      <header className="bg-white border-b border-[#EBE5DB] sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-18 gap-4">
            {/* Logo */}
            <div
              className="cursor-pointer select-none shrink-0"
              onClick={() => {
                setSelectedCategory('All');
                setSearchQuery('');
              }}
            >
              <span className="text-xl sm:text-2xl font-black text-[#1C130D] tracking-widest uppercase font-serif">
                AGNITIA
              </span>
              <span className="block text-[9px] font-mono tracking-widest text-[#D95A1E] uppercase font-bold -mt-1">
                ATELIER COUTURE
              </span>
            </div>

            {/* Category Navigation Pills (Desktop) */}
            <nav className="hidden xl:flex items-center space-x-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-[#1C130D] text-white'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </nav>

            {/* Search Bar & Action Buttons */}
            <div className="flex items-center space-x-3 shrink-0">
              {/* Search Input with Proper Padding & Vertical Centering */}
              <div className="relative hidden md:block">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search sarees, sherwanis, jackets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-8 py-2 bg-stone-50 border border-[#E7E2D9] rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#D95A1E] focus:border-[#D95A1E] w-56 lg:w-72 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Wishlist Button */}
              <button
                onClick={() => setIsWishlistOpen(true)}
                className="p-2 rounded-xl border border-[#E7E2D9] bg-stone-50 hover:bg-stone-100 text-stone-700 relative transition cursor-pointer"
                title="Wishlist"
              >
                <Heart className="w-4 h-4" />
                {wishlistProducts.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#D95A1E] text-white text-[9px] font-bold flex items-center justify-center">
                    {wishlistProducts.length}
                  </span>
                )}
              </button>

              {/* Shopping Bag Button */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-[#1C130D] hover:bg-stone-800 text-white text-xs font-semibold flex items-center space-x-2 shadow-xs transition cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 text-[#D95A1E]" />
                <span className="hidden sm:inline">Bag</span>
                <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-mono font-bold">
                  {totalCartItemCount}
                </span>
              </button>
            </div>
          </div>

          {/* Mobile Category Scrollbar */}
          <div className="xl:hidden flex items-center space-x-1 overflow-x-auto py-2 border-t border-[#EFEAE2] scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#1C130D] text-white'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* 4. Editorial Hero Banner (Visible on 'All' or 'New Arrivals') */}
      {(selectedCategory === 'All' || selectedCategory === 'New Arrivals') && !searchQuery && (
        <section className="relative bg-[#1C130D] text-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#D95A1E] text-white uppercase tracking-widest font-mono">
                SPRING / SUMMER 2026 COUTURE
              </span>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
                Heritage Banarasi Craft. Contemporary Silhouette.
              </h1>
              <p className="text-sm text-stone-300 max-w-xl leading-relaxed">
                Handcrafted pure silk weaves, artisanal Chikankari, and structured tailored separates designed for the modern connoisseur.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => setSelectedCategory('New Arrivals')}
                  className="px-5 py-2.5 bg-[#D95A1E] hover:bg-[#B84511] text-white text-xs font-bold rounded-xl shadow-md flex items-center space-x-2 transition cursor-pointer"
                >
                  <span>Explore New Arrivals</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setSelectedCategory('Sale')}
                  className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 transition cursor-pointer"
                >
                  <span>View Festive Sale (Flat 50% Off)</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 grid grid-cols-2 gap-4 items-center">
              <div className="relative group overflow-hidden rounded-2xl shadow-xl border border-white/10">
                <img
                  src="https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?auto=format&fit=crop&w=600&q=80"
                  alt="Men Banarasi Sherwani"
                  className="w-full h-64 sm:h-72 object-cover group-hover:scale-105 transition duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#D95A1E] font-bold block">Editorial</span>
                  <p className="text-xs font-bold leading-tight">Banarasi Silk Weave</p>
                </div>
              </div>
              <div className="relative group overflow-hidden rounded-2xl shadow-xl border border-white/10">
                <img
                  src="https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80"
                  alt="Women Kanjeevaram Saree"
                  className="w-full h-64 sm:h-72 object-cover group-hover:scale-105 transition duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#D95A1E] font-bold block">Artisanal</span>
                  <p className="text-xs font-bold leading-tight">Kanjeevaram Bridal</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 5. Main Catalog Content Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Outage State Banner if Catalog is Down */}
        {health?.status === 'unhealthy' && (
          <div className="bg-rose-50 border border-rose-300 rounded-2xl p-6 text-center space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-[#D32F2F] flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-rose-900 font-mono">
              [HTTP {health.error_code || '503'}] Catalog Service Unavailable
            </h3>
            <p className="text-xs text-rose-800 max-w-md mx-auto">
              {health.error || 'Simulated outage: Connection pool exhausted. Catalog browsing is temporarily offline.'}
            </p>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                onClick={fetchStoreData}
                className="px-4 py-2 bg-white hover:bg-rose-100 border border-rose-300 text-rose-900 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Retry Request
              </button>
              <button
                onClick={handleAutoRecover}
                className="px-4 py-2 bg-[#D95A1E] hover:bg-[#B84511] text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
              >
                Auto-Recover via BRIDGE
              </button>
            </div>
          </div>
        )}

        {/* Filter and Sorting Toolbar */}
        {health?.status === 'healthy' && (
          <div className="bg-white border border-[#EBE5DB] rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <h2 className="text-base font-bold text-stone-900">
                {selectedCategory} Collection
              </h2>
              <span className="text-xs font-mono text-stone-500 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200">
                {products.length} of {totalAvailable || products.length} Products
              </span>
            </div>

            {/* Sorting & Price filter */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center space-x-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-stone-400" />
                <span className="text-stone-500">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="bg-stone-50 border border-[#E7E2D9] rounded-lg px-2.5 py-1.5 text-xs text-stone-800 font-semibold focus:outline-none"
                >
                  <option value="featured">Featured Curations</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="rating">Highest Rated</option>
                  <option value="newest">Newest Drops</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Products Grid */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-stone-500">
            <Loader2 className="w-8 h-8 animate-spin text-[#D95A1E]" />
            <p className="text-xs font-mono">Loading Agnitia Atelier Catalog...</p>
          </div>
        ) : products.length === 0 && health?.status === 'healthy' ? (
          <div className="bg-white border border-[#EBE5DB] rounded-2xl p-16 text-center space-y-3">
            <Package className="w-10 h-10 text-stone-400 mx-auto" />
            <h3 className="text-sm font-bold text-stone-900">No Products Found</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              No items match your filter. Try adjusting your search query or category.
            </p>
            <button
              onClick={() => {
                setSelectedCategory('All');
                setSearchQuery('');
              }}
              className="px-4 py-2 bg-[#1C130D] text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => {
              const isWishlisted = !!wishlist[product.id];
              const selectedSize = selectedSizes[product.id] || (product.sizes ? product.sizes[0] : 'Standard');
              const selectedColor = selectedColors[product.id] || (product.colors ? product.colors[0] : 'Default');

              return (
                <div
                  key={product.id}
                  onClick={() => setSelectedProductDetail(product)}
                  className="bg-white border border-[#EBE5DB] rounded-2xl overflow-hidden shadow-xs hover:shadow-md hover:border-stone-400 transition flex flex-col group cursor-pointer"
                >
                  {/* Product Image Container */}
                  <div className="relative h-64 bg-stone-100 overflow-hidden">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />

                    {/* Badge */}
                    {product.discount_percent && (
                      <span className="absolute top-3 left-3 bg-[#D95A1E] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm font-mono">
                        {product.discount_percent}% OFF
                      </span>
                    )}

                    {/* Wishlist Icon */}
                    <button
                      onClick={(e) => toggleWishlist(product.id, e)}
                      className={`absolute top-3 right-3 p-2 rounded-full shadow-md transition cursor-pointer ${
                        isWishlisted
                          ? 'bg-[#D95A1E] text-white'
                          : 'bg-white/90 text-stone-700 hover:bg-white'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-white' : ''}`} />
                    </button>
                  </div>

                  {/* Card Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-stone-500">
                        <span className="uppercase font-semibold tracking-wider">{product.category}</span>
                        <div className="flex items-center space-x-1 text-amber-500 font-bold">
                          <Star className="w-3 h-3 fill-amber-400" />
                          <span>{product.rating || '4.8'}</span>
                        </div>
                      </div>

                      <h3 className="text-sm font-bold text-stone-900 line-clamp-1 group-hover:text-[#D95A1E] transition">
                        {product.name}
                      </h3>
                      <p className="text-[11px] text-stone-500 line-clamp-2 leading-relaxed">
                        {product.description}
                      </p>
                    </div>

                    {/* Size and Color Selector Pills */}
                    <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                      {product.sizes && (
                        <div className="flex flex-wrap gap-1">
                          {product.sizes.slice(0, 4).map((s) => (
                            <button
                              key={s}
                              onClick={() =>
                                setSelectedSizes((prev) => ({ ...prev, [product.id]: s }))
                              }
                              className={`px-1.5 py-0.5 text-[10px] rounded font-mono font-semibold border transition ${
                                selectedSize === s
                                  ? 'bg-[#1C130D] text-white border-[#1C130D]'
                                  : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                      {product.colors && product.colors.length > 1 && (
                        <div className="flex flex-wrap gap-1">
                          {product.colors.slice(0, 3).map((c) => (
                            <button
                              key={c}
                              onClick={() =>
                                setSelectedColors((prev) => ({ ...prev, [product.id]: c }))
                              }
                              className={`px-1.5 py-0.2 text-[9px] rounded font-mono border transition ${
                                selectedColor === c
                                  ? 'bg-[#D95A1E] text-white border-[#D95A1E]'
                                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                              }`}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Price & Add to Cart */}
                    <div className="pt-2 border-t border-[#F0EBE1] flex items-center justify-between">
                      <div>
                        <div className="flex items-baseline space-x-1.5">
                          <span className="text-sm font-bold text-stone-900 font-mono">
                            ₹{product.price.toLocaleString('en-IN')}
                          </span>
                          {product.original_price && (
                            <span className="text-[11px] text-stone-400 line-through font-mono">
                              ₹{product.original_price.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleAddToCart(product, selectedSize, selectedColor, e)}
                        className="px-3 py-1.5 bg-[#1C130D] hover:bg-[#D95A1E] text-white text-xs font-semibold rounded-lg shadow-2xs transition flex items-center space-x-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 6. Product Detail Modal */}
      {selectedProductDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-stone-200 flex flex-col md:flex-row max-h-[90vh]">
            <div className="md:w-1/2 h-64 md:h-auto bg-stone-100 relative">
              <img
                src={selectedProductDetail.image}
                alt={selectedProductDetail.name}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setSelectedProductDetail(null)}
                className="absolute top-4 left-4 p-2 rounded-full bg-white/90 text-stone-700 hover:bg-white md:hidden"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="md:w-1/2 p-6 flex flex-col justify-between space-y-4 overflow-y-auto">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase text-[#D95A1E]">
                    {selectedProductDetail.category}
                  </span>
                  <button
                    onClick={() => setSelectedProductDetail(null)}
                    className="p-1 rounded-full text-stone-400 hover:text-stone-700 hidden md:block"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <h2 className="text-xl font-bold text-stone-900">
                  {selectedProductDetail.name}
                </h2>

                <div className="flex items-baseline space-x-2">
                  <span className="text-xl font-bold text-stone-900 font-mono">
                    ₹{selectedProductDetail.price.toLocaleString('en-IN')}
                  </span>
                  {selectedProductDetail.original_price && (
                    <span className="text-xs text-stone-400 line-through font-mono">
                      ₹{selectedProductDetail.original_price.toLocaleString('en-IN')}
                    </span>
                  )}
                  {selectedProductDetail.discount_percent && (
                    <span className="text-xs font-bold text-[#D95A1E] font-mono">
                      ({selectedProductDetail.discount_percent}% OFF)
                    </span>
                  )}
                </div>

                <p className="text-xs text-stone-600 leading-relaxed">
                  {selectedProductDetail.description}
                </p>

                {/* Live Inventory Stock Check */}
                <div className="p-3 rounded-xl bg-stone-50 border border-[#E7E2D9] text-xs space-y-1 font-mono">
                  <span className="text-stone-500 font-bold block text-[11px]">Warehouse Stock Check:</span>
                  {isCheckingInventory ? (
                    <span className="text-stone-500 flex items-center space-x-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Verifying live inventory...</span>
                    </span>
                  ) : inventoryStatus ? (
                    <span className="text-[#2E7D32] font-semibold flex items-center space-x-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Available ({inventoryStatus.stock_count} units ready to dispatch)</span>
                    </span>
                  ) : (
                    <span className="text-[#D32F2F] font-semibold flex items-center space-x-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Inventory service unavailable (Scenario C active)</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-[#EFEAE2]">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      handleAddToCart(selectedProductDetail);
                      setSelectedProductDetail(null);
                    }}
                    className="flex-1 py-3 bg-[#1C130D] hover:bg-[#D95A1E] text-white text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Add to Shopping Bag</span>
                  </button>

                  <button
                    onClick={(e) => toggleWishlist(selectedProductDetail.id, e)}
                    className="p-3 rounded-xl border border-[#E7E2D9] hover:bg-stone-50 text-stone-700 transition"
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        wishlist[selectedProductDetail.id] ? 'fill-[#D95A1E] text-[#D95A1E]' : ''
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Shopping Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#EBE5DB] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShoppingBag className="w-5 h-5 text-[#D95A1E]" />
                <h3 className="text-base font-bold text-stone-900">
                  Shopping Bag ({totalCartItemCount})
                </h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1 rounded-full text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {cart.length === 0 ? (
                <div className="py-20 text-center space-y-3">
                  <ShoppingBag className="w-12 h-12 text-stone-300 mx-auto" />
                  <h4 className="text-sm font-bold text-stone-900">Your bag is empty</h4>
                  <p className="text-xs text-stone-500 max-w-xs mx-auto">
                    Explore our exquisite contemporary collections and add items to your bag.
                  </p>
                </div>
              ) : (
                cart.map((item, idx) => (
                  <div
                    key={`${item.product.id}-${idx}`}
                    className="flex items-start space-x-3 p-3 rounded-xl bg-stone-50 border border-[#E7E2D9]"
                  >
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="w-16 h-16 object-cover rounded-lg shrink-0"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <h4 className="text-xs font-bold text-stone-900 truncate">
                        {item.product.name}
                      </h4>
                      <p className="text-[10px] text-stone-500 font-mono">
                        Size: {item.selectedSize} • {item.selectedColor}
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-bold text-stone-900 font-mono">
                          ₹{(item.product.price * item.quantity).toLocaleString('en-IN')}
                        </span>
                        <div className="flex items-center space-x-1.5 bg-white border border-[#E7E2D9] rounded-lg px-1.5 py-0.5">
                          <button
                            onClick={() => updateCartQuantity(idx, -1)}
                            className="text-stone-500 hover:text-stone-800 p-0.5"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-mono font-bold px-1.5">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateCartQuantity(idx, 1)}
                            className="text-stone-500 hover:text-stone-800 p-0.5"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeCartItem(idx)}
                      className="text-stone-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Drawer Footer & Total */}
            {cart.length > 0 && (
              <div className="p-5 border-t border-[#EBE5DB] bg-stone-50 space-y-3">
                {/* Promo Code Input */}
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Coupon (e.g. FESTIVE20)"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="flex-1 bg-white border border-[#E7E2D9] rounded-xl px-3 py-1.5 text-xs text-stone-800 font-mono uppercase focus:outline-none"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    className="px-3 py-1.5 bg-[#1C130D] text-white text-xs font-bold rounded-xl hover:bg-stone-800 cursor-pointer"
                  >
                    Apply
                  </button>
                </div>

                {/* Cost Breakdown */}
                <div className="space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between text-stone-600">
                    <span>Subtotal:</span>
                    <span>₹{cartSubtotal.toLocaleString('en-IN')}</span>
                  </div>
                  {promoApplied && (
                    <div className="flex justify-between text-[#2E7D32] font-semibold">
                      <span>Festive Promo Discount (20%):</span>
                      <span>-₹{discountAmount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-stone-600">
                    <span>Shipping:</span>
                    <span>{shippingFee === 0 ? 'FREE (Orders > ₹1999)' : `₹${shippingFee}`}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-stone-900 pt-2 border-t border-[#E7E2D9]">
                    <span>Total Amount:</span>
                    <span>₹{cartTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsCartOpen(false);
                    setIsCheckoutOpen(true);
                  }}
                  className="w-full py-3 bg-[#D95A1E] hover:bg-[#B84511] text-white text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <span>Proceed to Simulated Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 8. Wishlist Drawer */}
      {isWishlistOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
            <div className="p-5 border-b border-[#EBE5DB] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Heart className="w-5 h-5 text-[#D95A1E]" />
                <h3 className="text-base font-bold text-stone-900">
                  Wishlist ({wishlistProducts.length})
                </h3>
              </div>
              <button onClick={() => setIsWishlistOpen(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {wishlistProducts.length === 0 ? (
                <div className="py-20 text-center space-y-3">
                  <Heart className="w-12 h-12 text-stone-300 mx-auto" />
                  <h4 className="text-sm font-bold text-stone-900">Your wishlist is empty</h4>
                  <p className="text-xs text-stone-500 max-w-xs mx-auto">
                    Save your favorite couture pieces here for easy access.
                  </p>
                </div>
              ) : (
                wishlistProducts.map((prod) => (
                  <div
                    key={prod.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-[#E7E2D9]"
                  >
                    <div className="flex items-center space-x-3">
                      <img
                        src={prod.image}
                        alt={prod.name}
                        className="w-14 h-14 object-cover rounded-lg"
                      />
                      <div>
                        <h4 className="text-xs font-bold text-stone-900">{prod.name}</h4>
                        <span className="text-xs font-mono text-stone-800 font-bold">
                          ₹{prod.price.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          handleAddToCart(prod);
                          toggleWishlist(prod.id);
                        }}
                        className="p-2 bg-[#1C130D] text-white rounded-lg hover:bg-[#D95A1E] transition"
                        title="Move to Bag"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleWishlist(prod.id)}
                        className="p-2 text-stone-400 hover:text-rose-600"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 9. Simulated Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-stone-200 space-y-5 animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#F0EBE1] pb-3">
              <div className="flex items-center space-x-2">
                <Truck className="w-5 h-5 text-[#D95A1E]" />
                <h3 className="text-base font-bold text-stone-900">
                  Simulated Express Checkout
                </h3>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="p-1 rounded-full text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {checkoutError && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1 font-mono">
                <div className="flex items-center space-x-2 font-bold text-[#D32F2F]">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Checkout Pipeline Failure</span>
                </div>
                <p>{checkoutError}</p>
              </div>
            )}

            <form onSubmit={handleProceedCheckout} className="space-y-4 text-xs">
              {/* Shipping Address Inputs */}
              <div>
                <h4 className="font-bold text-stone-800 mb-2">1. Delivery Address</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-stone-600 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={checkoutForm.fullName}
                      onChange={(e) => setCheckoutForm({ ...checkoutForm, fullName: e.target.value })}
                      className="w-full bg-stone-50 border border-[#E7E2D9] rounded-xl px-3 py-2 text-stone-900 focus:outline-none focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-600 mb-1">Contact Phone</label>
                    <input
                      type="text"
                      required
                      value={checkoutForm.phone}
                      onChange={(e) => setCheckoutForm({ ...checkoutForm, phone: e.target.value })}
                      className="w-full bg-stone-50 border border-[#E7E2D9] rounded-xl px-3 py-2 text-stone-900 focus:outline-none focus:bg-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-stone-600 mb-1">Street Address</label>
                    <input
                      type="text"
                      required
                      value={checkoutForm.address}
                      onChange={(e) => setCheckoutForm({ ...checkoutForm, address: e.target.value })}
                      className="w-full bg-stone-50 border border-[#E7E2D9] rounded-xl px-3 py-2 text-stone-900 focus:outline-none focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-600 mb-1">City</label>
                    <input
                      type="text"
                      required
                      value={checkoutForm.city}
                      onChange={(e) => setCheckoutForm({ ...checkoutForm, city: e.target.value })}
                      className="w-full bg-stone-50 border border-[#E7E2D9] rounded-xl px-3 py-2 text-stone-900 focus:outline-none focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-600 mb-1">PIN Code</label>
                    <input
                      type="text"
                      required
                      value={checkoutForm.pincode}
                      onChange={(e) => setCheckoutForm({ ...checkoutForm, pincode: e.target.value })}
                      className="w-full bg-stone-50 border border-[#E7E2D9] rounded-xl px-3 py-2 text-stone-900 focus:outline-none focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Methods */}
              <div>
                <h4 className="font-bold text-stone-800 mb-2">2. Payment Method</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['UPI', 'Credit Card', 'Netbanking', 'COD'].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setCheckoutForm({ ...checkoutForm, paymentMethod: method })}
                      className={`p-2.5 rounded-xl border text-center font-bold transition cursor-pointer ${
                        checkoutForm.paymentMethod === method
                          ? 'bg-[#1C130D] text-white border-[#1C130D]'
                          : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary and Confirmation */}
              <div className="p-3.5 bg-stone-50 rounded-xl border border-[#E7E2D9] space-y-1 font-mono">
                <div className="flex justify-between text-stone-600">
                  <span>Items ({totalCartItemCount}):</span>
                  <span>₹{cartSubtotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-stone-900 pt-1 border-t border-stone-200">
                  <span>Total Payable:</span>
                  <span>₹{cartTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCheckoutOpen(false)}
                  className="px-4 py-2.5 border border-stone-300 text-stone-700 font-bold rounded-xl hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOrder}
                  className="px-6 py-2.5 bg-[#D95A1E] hover:bg-[#B84511] text-white font-bold rounded-xl shadow-md transition flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingOrder && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Place Simulated Order (₹{cartTotal.toLocaleString('en-IN')})</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 10. Order Success Confirmation Modal */}
      {checkoutSuccessOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl border border-stone-200 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#2E7D32] flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-extrabold text-stone-900">
              Order Placed Successfully!
            </h3>
            <p className="text-xs text-stone-500">
              Your simulated couture order has been processed and logged in the BRIDGE pipeline.
            </p>

            <div className="p-4 bg-stone-50 rounded-2xl border border-[#E7E2D9] text-left text-xs font-mono space-y-1.5">
              <div className="flex justify-between">
                <span className="text-stone-500">Order Reference:</span>
                <span className="font-bold text-stone-900">{checkoutSuccessOrder.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Total Paid:</span>
                <span className="font-bold text-[#2E7D32]">
                  ₹{checkoutSuccessOrder.total.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Payment Channel:</span>
                <span className="font-bold text-stone-900">{checkoutSuccessOrder.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Dispatch Estimate:</span>
                <span className="font-bold text-stone-900">3-5 Business Days</span>
              </div>
            </div>

            <button
              onClick={() => setCheckoutSuccessOrder(null)}
              className="w-full py-3 bg-[#1C130D] hover:bg-stone-800 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}

      {/* 11. Luxury Brand Footer */}
      <footer className="bg-[#1C130D] text-stone-400 text-xs mt-16 border-t border-[#2C1E16] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <span className="text-lg font-black text-white tracking-widest uppercase">
              AGNITIA ATELIER
            </span>
            <p className="text-[11px] text-stone-400 leading-relaxed">
              Contemporary Indian luxury couture, combining age-old artisanal craftsmanship with modern architectural silhouettes.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-white font-bold text-xs uppercase tracking-wider">Collections</h4>
            <ul className="space-y-1.5 text-[11px]">
              <li><button onClick={() => setSelectedCategory('Men')} className="hover:text-white">Men's Royal Silk Sherwanis</button></li>
              <li><button onClick={() => setSelectedCategory('Women')} className="hover:text-white">Women's Handwoven Sarees</button></li>
              <li><button onClick={() => setSelectedCategory('Streetwear')} className="hover:text-white">Contemporary Streetwear</button></li>
              <li><button onClick={() => setSelectedCategory('Footwear')} className="hover:text-white">Handcrafted Mojari Juttis</button></li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-white font-bold text-xs uppercase tracking-wider">Customer Experience</h4>
            <ul className="space-y-1.5 text-[11px]">
              <li>Complimentary Express Shipping</li>
              <li>Bespoke Tailoring Concierge</li>
              <li>7-Day Hassle-Free Returns</li>
              <li>Authenticity Certificate Guarantee</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-white font-bold text-xs uppercase tracking-wider">BRIDGE Platform</h4>
            <p className="text-[11px] leading-relaxed text-stone-400">
              Live e-commerce demo backed by BRIDGE dependency-aware autonomous incident remediation and risk-gated recovery orchestration.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
