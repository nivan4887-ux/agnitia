import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Flame,
  CheckCircle2,
  Zap,
  Activity,
  ArrowRight,
  ShieldAlert,
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
  ShoppingBagIcon,
  Check,
  Percent,
} from 'lucide-react';
import { DemoProduct, DemoHealthResponse, LiveProbeResult } from '../types';
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
  'Ethnic Wear',
  'Shoes',
  'Bags',
  'Accessories',
  'Sale',
];

export const DemoStoreView: React.FC<DemoStoreViewProps> = ({
  onIncidentCreated,
  onNavigateToDashboard,
  onError,
}) => {
  const [products, setProducts] = useState<DemoProduct[]>([]);
  const [health, setHealth] = useState<DemoHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInjecting, setIsInjecting] = useState<boolean>(false);
  const [isProbing, setIsProbing] = useState<boolean>(false);
  const [lastProbe, setLastProbe] = useState<LiveProbeResult | null>(null);

  // Store & Shopping state
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'rating'>('featured');
  const [wishlist, setWishlist] = useState<Record<string, boolean>>({});
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});
  const [selectedColors, setSelectedColors] = useState<Record<string, string>>({});

  // Cart & Checkout state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState<string>('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);
  const [checkoutSuccessOrder, setCheckoutSuccessOrder] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchStoreData = async () => {
    setIsLoading(true);
    try {
      const hRes = await api.getDemoHealth();
      setHealth(hRes);

      if (hRes.status === 'healthy') {
        const pRes = await api.getDemoProducts();
        setProducts(pRes.products);
      } else {
        setProducts([]);
      }
    } catch (err: any) {
      setHealth({
        status: 'unhealthy',
        service: 'backend_api_products',
        error: err.message || 'HTTP 503 Service Unavailable',
        error_code: 'ERR_DB_POOL_EXHAUSTED',
      });
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStoreData();
    const timer = setInterval(() => {
      fetchStoreData();
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleInjectFailure = async () => {
    setIsInjecting(true);
    try {
      await api.injectDemoChaos('Simulated database connection pool exhaustion on Products API');
      const probeRes = await api.runLiveProbe(true);
      setLastProbe(probeRes);
      if (onIncidentCreated) onIncidentCreated();
      await fetchStoreData();
    } catch (err: any) {
      onError(err.message || 'Failed to inject chaos failure');
    } finally {
      setIsInjecting(false);
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
      await fetchStoreData();
    } catch (err: any) {
      onError(err.message || 'Health probe failed');
    } finally {
      setIsProbing(false);
    }
  };

  const toggleWishlist = (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setWishlist((prev) => {
      const next = { ...prev, [productId]: !prev[productId] };
      showToast(next[productId] ? 'Added to Wishlist ❤️' : 'Removed from Wishlist');
      return next;
    });
  };

  const handleAddToCart = (product: DemoProduct) => {
    const size = selectedSizes[product.id] || (product.sizes ? product.sizes[0] : 'Standard');
    const color = selectedColors[product.id] || (product.colors ? product.colors[0] : 'Default');

    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (item) => item.product.id === product.id && item.selectedSize === size && item.selectedColor === color
      );
      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx].quantity += 1;
        return updated;
      }
      return [...prev, { product, quantity: 1, selectedSize: size, selectedColor: color }];
    });

    showToast(`Added "${product.name}" (${size}, ${color}) to Bag!`);
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      updated[index].quantity += delta;
      if (updated[index].quantity <= 0) {
        return updated.filter((_, i) => i !== index);
      }
      return updated;
    });
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const handleApplyPromo = () => {
    if (promoCode.trim().toUpperCase() === 'FESTIVE10') {
      setDiscountPercent(10);
      showToast('Promo code FESTIVE10 applied: 10% Extra Discount!');
    } else if (promoCode.trim().toUpperCase() === 'UTSAV20') {
      setDiscountPercent(20);
      showToast('Promo code UTSAV20 applied: 20% Mega Discount!');
    } else {
      showToast('Invalid promo code. Try FESTIVE10 or UTSAV20');
    }
  };

  const handleCheckout = () => {
    setIsCheckingOut(true);
    setTimeout(() => {
      const orderId = `RO-IND-${Math.floor(100000 + Math.random() * 900000)}`;
      setCheckoutSuccessOrder(orderId);
      setCart([]);
      setIsCheckingOut(false);
    }, 1200);
  };

  // Filtered and Sorted Products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
        const matchesQuery =
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.category.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCat && matchesQuery;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.price - b.price;
        if (sortBy === 'price-desc') return b.price - a.price;
        if (sortBy === 'rating') return (b.rating || 4.5) - (a.rating || 4.5);
        return 0; // featured
      });
  }, [products, selectedCategory, searchQuery, sortBy]);

  const totalItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const rawSubtotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const discountAmount = (rawSubtotal * discountPercent) / 100;
  const deliveryFee = rawSubtotal > 999 || rawSubtotal === 0 ? 0 : 99;
  const grandTotal = Math.max(0, rawSubtotal - discountAmount + deliveryFee);

  const isHealthy = health?.status === 'healthy';

  return (
    <div className="space-y-6">
      {/* SRE Live Control Bar */}
      <div className="bg-white border border-[#EBE5DB] rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-[#D95A1E]/10 text-[#D95A1E] rounded-xl">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-stone-900">
                Agnitia Indian Fashion Atelier (Live Demo)
              </h2>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase font-mono ${
                  isHealthy
                    ? 'bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]'
                    : 'bg-[#FFEBEE] text-[#D32F2F] border border-[#FFCDD2] animate-pulse'
                }`}
              >
                {isHealthy ? 'HTTP 200 OK' : 'HTTP 503 OUTAGE'}
              </span>
            </div>
            <p className="text-[11px] text-stone-500">
              Live fashion catalog backed by RecoverOps <code className="text-[#D95A1E] font-mono font-semibold">backend_api</code>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2.5">
          {isHealthy ? (
            <button
              onClick={handleInjectFailure}
              disabled={isInjecting}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center space-x-1.5 transition disabled:opacity-50"
            >
              <Flame className="w-3.5 h-3.5 text-rose-100" />
              <span>{isInjecting ? 'Injecting Outage...' : 'Inject Outage (HTTP 503)'}</span>
            </button>
          ) : (
            <button
              onClick={onNavigateToDashboard}
              className="px-4 py-1.5 bg-[#D95A1E] hover:bg-[#C2410C] text-white text-xs font-bold rounded-xl shadow-sm flex items-center space-x-1.5 transition"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Recover in SRE Control Plane</span>
            </button>
          )}

          <button
            onClick={handleManualProbe}
            disabled={isProbing}
            className="px-3 py-1.5 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium rounded-xl border border-[#E7E2D9] flex items-center space-x-1.5 transition disabled:opacity-50 shadow-2xs"
          >
            <Activity className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin text-[#D95A1E]' : 'text-stone-400'}`} />
            <span>{isProbing ? 'Probing...' : 'Probe'}</span>
          </button>

          {/* Cart Icon trigger */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="px-3 py-1.5 bg-[#1C130D] hover:bg-[#2C1E16] text-white text-xs font-semibold rounded-xl flex items-center space-x-2 shadow-xs transition relative"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Bag ({totalItemsCount})</span>
            {totalItemsCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-[#D95A1E] absolute -top-0.5 -right-0.5 ring-2 ring-white animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-[#1C130D] text-white px-4 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between shadow-lg animate-in fade-in sticky top-4 z-40">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-[#D95A1E]" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-stone-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Outage Banner or Storefront Catalog */}
      {!isHealthy ? (
        /* Real HTTP 503 Outage Screen */
        <div className="bg-white border border-[#FFCDD2] rounded-3xl p-10 text-center space-y-6 shadow-[0_2px_10px_rgba(211,47,47,0.08)]">
          <div className="w-16 h-16 bg-[#FFEBEE] text-[#D32F2F] rounded-2xl flex items-center justify-center mx-auto border border-[#FFCDD2]">
            <ShieldAlert className="w-8 h-8 animate-pulse" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <span className="px-3 py-1 bg-[#FFEBEE] text-[#D32F2F] font-mono font-bold text-xs rounded-full border border-[#FFCDD2]">
              HTTP 503 SERVICE UNAVAILABLE
            </span>
            <h3 className="text-xl font-bold text-stone-900 font-mono pt-2">
              Indian Fashion Catalog Offline
            </h3>
            <p className="text-xs text-stone-600">
              {health?.error || 'Database connection pool exhausted. Real HTTP requests to /demo/products are returning 503.'}
            </p>
            {health?.error_code && (
              <p className="text-[11px] font-mono text-[#D32F2F] font-bold">
                Error Code: {health.error_code}
              </p>
            )}
          </div>

          <div className="bg-[#FAF7F2] border border-[#EFEAE2] rounded-2xl p-4 max-w-lg mx-auto text-left font-mono text-xs text-stone-800 space-y-1.5">
            <div className="text-stone-500 text-[11px] pb-1 border-b border-[#E7E2D9] flex items-center justify-between">
              <span>Actual Diagnostic Response</span>
              <span className="text-[#D32F2F] font-bold">503 Service Unavailable</span>
            </div>
            <p className="text-[#D32F2F] font-semibold">GET /demo/products &rarr; HTTP 503</p>
            <p className="text-stone-600 text-[11px]">Reason: {health?.error}</p>
            <p className="text-[#D95A1E] text-[11px] pt-1 font-medium">
              &bull; Incident registered in RecoverOps SRE Control Plane.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={onNavigateToDashboard}
              className="px-6 py-2.5 bg-[#D95A1E] hover:bg-[#C2410C] text-white text-xs font-bold rounded-xl shadow-md inline-flex items-center space-x-2 transition"
            >
              <span>Inspect & Recover Service in Control Plane</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Healthy Indian Fashion Storefront */
        <div className="space-y-6">
          {/* Fashion Hero Banner */}
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#1C130D] to-[#3B2516] text-white p-8 md:p-10 shadow-md">
            <div className="max-w-xl space-y-3 relative z-10">
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-[#D95A1E]/30 border border-[#D95A1E]/50 rounded-full text-[11px] font-semibold text-[#FFCC80]">
                <Sparkles className="w-3.5 h-3.5 text-[#D95A1E]" />
                <span>Utsav & Riwaaz • Festive Indian Couture</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#FAF7F2]">
                Handcrafted Silks, Chikankari & Royal Sherwanis
              </h1>
              <p className="text-xs text-stone-300 leading-relaxed">
                Discover heritage Banarasi weaves, handcrafted mojari juttis, and pure Kanjeevaram sarees curated for celebrations across India.
              </p>
              <div className="pt-2 flex items-center space-x-3">
                <button
                  onClick={() => setSelectedCategory('Ethnic Wear')}
                  className="px-5 py-2.5 bg-[#D95A1E] hover:bg-[#C2410C] text-white text-xs font-bold rounded-xl shadow-md transition"
                >
                  Explore Ethnic Wear
                </button>
                <span className="text-xs font-medium text-stone-300">
                  Flat 30% Off on Selected Styles
                </span>
              </div>
            </div>

            {/* Subtle background luxury motif */}
            <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-400 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Filter & Category Bar */}
          <div className="bg-white border border-[#EBE5DB] rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3">
            {/* Category Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    selectedCategory === cat
                      ? 'bg-[#D95A1E] text-white shadow-xs'
                      : 'bg-[#FAF7F2] text-stone-700 hover:bg-stone-200/60 border border-[#EFEAE2]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search & Sort Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#EFEAE2]">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search sherwanis, sarees, juttis, jewelry..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E7E2D9] rounded-xl pl-9 pr-3 py-1.5 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#D95A1E]"
                />
              </div>

              <div className="flex items-center space-x-2 text-xs">
                <SlidersHorizontal className="w-3.5 h-3.5 text-stone-500" />
                <span className="text-stone-500 font-medium">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-[#FAF7F2] border border-[#E7E2D9] rounded-xl px-2.5 py-1.5 text-xs text-stone-800 font-medium focus:outline-none focus:ring-1 focus:ring-[#D95A1E]"
                >
                  <option value="featured">Featured Collection</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="rating">Highest Rated</option>
                </select>
              </div>
            </div>
          </div>

          {/* Product Grid */}
          {isLoading && products.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3 text-stone-500">
              <Loader2 className="w-8 h-8 animate-spin text-[#D95A1E]" />
              <p className="text-xs font-mono">Fetching Indian fashion atelier catalog (/demo/products)...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-16 text-center text-stone-500 bg-white border border-[#EBE5DB] rounded-2xl">
              <p className="text-sm font-semibold">No fashion products match your filter.</p>
              <p className="text-xs text-stone-400 mt-1">Try searching for &quot;Silk&quot;, &quot;Kurta&quot;, or select &quot;All&quot;.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {filteredProducts.map((p) => {
                const isWishlisted = !!wishlist[p.id];
                const activeSize = selectedSizes[p.id] || (p.sizes ? p.sizes[0] : 'Standard');
                const activeColor = selectedColors[p.id] || (p.colors ? p.colors[0] : 'Default');

                return (
                  <div
                    key={p.id}
                    className="bg-white border border-[#EBE5DB] hover:border-[#D95A1E]/50 rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition flex flex-col justify-between space-y-3.5 group relative"
                  >
                    {/* Top Image & Badges */}
                    <div className="relative rounded-xl overflow-hidden aspect-[4/5] bg-stone-100">
                      {p.image ? (
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-full h-full object-cover object-center group-hover:scale-105 transition duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-400 font-mono text-xs">
                          {p.name}
                        </div>
                      )}

                      {/* Discount Badge */}
                      {p.discount_percent && (
                        <span className="absolute top-2.5 left-2.5 bg-[#D95A1E] text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                          {p.discount_percent}% OFF
                        </span>
                      )}

                      {/* Wishlist Button */}
                      <button
                        onClick={(e) => toggleWishlist(p.id, e)}
                        className={`absolute top-2.5 right-2.5 p-1.5 rounded-full backdrop-blur-md transition ${
                          isWishlisted
                            ? 'bg-rose-50 text-[#D32F2F] shadow-sm'
                            : 'bg-white/80 hover:bg-white text-stone-700 shadow-xs'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-[#D32F2F]' : ''}`} />
                      </button>
                    </div>

                    {/* Product Details */}
                    <div className="space-y-1.5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-stone-500 font-medium">
                          <span className="uppercase text-[10px] font-bold text-[#D95A1E] tracking-wider">
                            {p.category}
                          </span>
                          <span className="flex items-center space-x-1 text-amber-600 font-bold">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            <span>{p.rating || 4.8}</span>
                          </span>
                        </div>

                        <h3 className="text-xs font-bold text-stone-900 group-hover:text-[#D95A1E] transition-colors line-clamp-2 mt-1">
                          {p.name}
                        </h3>

                        <p className="text-[11px] text-stone-500 line-clamp-2 mt-1 leading-snug">
                          {p.description}
                        </p>
                      </div>

                      {/* Size & Color Selectors */}
                      <div className="space-y-1.5 pt-2 border-t border-[#EFEAE2] text-xs">
                        {p.sizes && p.sizes.length > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-stone-400 font-medium">Size:</span>
                            <div className="flex space-x-1">
                              {p.sizes.map((s) => (
                                <button
                                  key={s}
                                  onClick={() =>
                                    setSelectedSizes((prev) => ({ ...prev, [p.id]: s }))
                                  }
                                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                                    activeSize === s
                                      ? 'bg-[#1C130D] text-white'
                                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                                  }`}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {p.colors && p.colors.length > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-stone-400 font-medium">Color:</span>
                            <div className="flex space-x-1">
                              {p.colors.map((c) => (
                                <button
                                  key={c}
                                  onClick={() =>
                                    setSelectedColors((prev) => ({ ...prev, [p.id]: c }))
                                  }
                                  title={c}
                                  className={`px-1.5 py-0.5 text-[9px] font-semibold rounded truncate max-w-[85px] ${
                                    activeColor === c
                                      ? 'bg-[#D95A1E] text-white font-bold'
                                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                                  }`}
                                >
                                  {c}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Price & Add to Bag */}
                        <div className="flex items-baseline justify-between pt-1">
                          <div className="flex items-baseline space-x-1.5">
                            <span className="text-sm font-extrabold text-stone-900">
                              ₹{p.price.toLocaleString('en-IN')}
                            </span>
                            {p.original_price && (
                              <span className="text-[10px] text-stone-400 line-through">
                                ₹{p.original_price.toLocaleString('en-IN')}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-emerald-700 font-medium">
                            {p.stock_count} in stock
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Add to Bag Button */}
                    <button
                      onClick={() => handleAddToCart(p)}
                      className="w-full py-2 bg-[#D95A1E] hover:bg-[#C2410C] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center space-x-1.5"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Add to Bag</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Cart Slide-Over / Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between p-6 space-y-4 animate-in slide-in-from-right duration-200">
            {/* Cart Header */}
            <div className="flex items-center justify-between border-b border-[#EFEAE2] pb-3.5">
              <div className="flex items-center space-x-2">
                <ShoppingBagIcon className="w-5 h-5 text-[#D95A1E]" />
                <h3 className="text-base font-bold text-stone-900">
                  Shopping Bag ({totalItemsCount})
                </h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
              {cart.length === 0 ? (
                <div className="py-20 text-center text-stone-400 space-y-2">
                  <ShoppingBag className="w-10 h-10 mx-auto stroke-1" />
                  <p className="text-xs font-medium">Your shopping bag is empty.</p>
                  <p className="text-[11px]">Add handwoven sarees, sherwanis, or juttis to get started.</p>
                </div>
              ) : (
                cart.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-[#FAF7F2] rounded-xl border border-[#EFEAE2] space-x-3"
                  >
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="w-14 h-16 object-cover rounded-lg shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-stone-900 truncate">
                        {item.product.name}
                      </h4>
                      <p className="text-[11px] text-stone-500">
                        Size: <span className="font-semibold text-stone-700">{item.selectedSize}</span> | ₹{item.product.price.toLocaleString('en-IN')}
                      </p>
                      <div className="flex items-center space-x-2 mt-1.5">
                        <button
                          onClick={() => updateQuantity(idx, -1)}
                          className="w-5 h-5 rounded bg-white border border-[#E7E2D9] flex items-center justify-center text-stone-600 hover:bg-stone-100"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-stone-900">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(idx, 1)}
                          className="w-5 h-5 rounded bg-white border border-[#E7E2D9] flex items-center justify-center text-stone-600 hover:bg-stone-100"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-stone-900 block">
                        ₹{(item.product.price * item.quantity).toLocaleString('en-IN')}
                      </span>
                      <button
                        onClick={() => removeFromCart(idx)}
                        className="text-stone-400 hover:text-rose-600 p-1 mt-1 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Promo & Summary */}
            {cart.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-[#EFEAE2]">
                {/* Promo code bar */}
                <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <Percent className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Coupon (e.g. FESTIVE10)"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      className="w-full bg-[#FAF7F2] border border-[#E7E2D9] rounded-xl pl-8 pr-2 py-1.5 text-xs uppercase font-mono text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#D95A1E]"
                    />
                  </div>
                  <button
                    onClick={handleApplyPromo}
                    className="px-3 py-1.5 bg-[#1C130D] hover:bg-[#2C1E16] text-white text-xs font-semibold rounded-xl"
                  >
                    Apply
                  </button>
                </div>

                {/* Subtotal & Delivery Summary */}
                <div className="space-y-1.5 text-xs text-stone-600 font-mono">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-bold text-stone-900">₹{rawSubtotal.toLocaleString('en-IN')}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-[#2E7D32]">
                      <span>Discount ({discountPercent}%):</span>
                      <span>-₹{discountAmount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Delivery Fee:</span>
                    <span>{deliveryFee === 0 ? <strong className="text-[#2E7D32]">FREE</strong> : `₹${deliveryFee}`}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-[#EFEAE2] text-sm font-bold text-stone-900">
                    <span>Grand Total:</span>
                    <span className="text-[#D95A1E]">₹{grandTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Checkout Button */}
                <button
                  onClick={handleCheckout}
                  disabled={isCheckingOut}
                  className="w-full py-2.5 bg-[#D95A1E] hover:bg-[#C2410C] text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center space-x-2 transition disabled:opacity-50"
                >
                  {isCheckingOut ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Simulate Instant Checkout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Simulated Checkout Success Confirmation Modal */}
      {checkoutSuccessOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#EBE5DB] rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-full bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-bold text-stone-900">
                Order Placed Successfully!
              </h3>
              <p className="text-xs text-stone-500 font-mono mt-0.5">
                Order #{checkoutSuccessOrder}
              </p>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed bg-[#FAF7F2] p-3 rounded-xl border border-[#EFEAE2]">
              Thank you for shopping at <strong>Agnitia Indian Fashion Atelier</strong>. Your festive attire is being prepared for dispatch with insured express delivery.
            </p>

            <button
              onClick={() => setCheckoutSuccessOrder(null)}
              className="w-full py-2.5 bg-[#1C130D] hover:bg-[#2C1E16] text-white text-xs font-semibold rounded-xl shadow-sm transition"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}

      {/* Live Probe Diagnostic Terminal Output */}
      {lastProbe && (
        <div className="bg-white border border-[#EBE5DB] rounded-2xl p-4 font-mono text-xs text-stone-700 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 pb-1 border-b border-[#EFEAE2] text-[11px]">
            <div className="flex items-center space-x-1.5">
              <Activity className="w-3.5 h-3.5 text-[#D95A1E]" />
              <span className="font-semibold text-stone-900">Live HTTP Probe Telemetry</span>
            </div>
            <span>{new Date(lastProbe.timestamp).toLocaleTimeString()}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-stone-500">Health Probe: </span>
              <span className={lastProbe.health_probe.healthy ? 'text-[#2E7D32] font-bold' : 'text-[#D32F2F] font-bold'}>
                {lastProbe.health_probe.endpoint} &rarr; HTTP {lastProbe.health_probe.status_code}
              </span>
            </div>
            <div>
              <span className="text-stone-500">Products Probe: </span>
              <span className={lastProbe.products_probe.healthy ? 'text-[#2E7D32] font-bold' : 'text-[#D32F2F] font-bold'}>
                {lastProbe.products_probe.endpoint} &rarr; HTTP {lastProbe.products_probe.status_code} ({lastProbe.products_probe.products_returned || 0} items)
              </span>
            </div>
          </div>
          {lastProbe.incident && (
            <div className="p-2 bg-[#FFEBEE] border border-[#FFCDD2] rounded-xl text-[#D32F2F] text-[11px]">
              &bull; <strong>Auto-Detected Incident:</strong> Incident #{lastProbe.incident.id.slice(0, 8)} created for service <code className="text-stone-900 font-bold">{lastProbe.incident.failed_service}</code>.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
