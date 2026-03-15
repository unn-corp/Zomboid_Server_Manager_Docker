import { Head, router, usePage } from '@inertiajs/react';
import { ArrowDownToLine, CheckCircle, Clock, Coins, Copy, Loader2, Package, Search, ShoppingBag, Star, Tag, X, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PublicLayout from '@/layouts/public-layout';
import { fetchAction } from '@/lib/fetch-action';
import type { DepositResult, ShopBundle, ShopCategory, ShopItem, ShopPromotion } from '@/types/server';

type ActivePromotion = Pick<ShopPromotion, 'name' | 'code' | 'type' | 'value' | 'ends_at'>;

type Props = {
    categories: ShopCategory[];
    items: ShopItem[];
    bundles: ShopBundle[];
    balance: number | null;
    activePromotions: ActivePromotion[];
    hasPzAccount: boolean;
    pendingDeposit: boolean;
    lastDepositResult: DepositResult | null;
};

function ItemIcon({ src, name, size = 48 }: { src: string; name: string; size?: number }) {
    return (
        <img
            src={src}
            alt={name}
            width={size}
            height={size}
            className="rounded object-contain"
            onError={(e) => {
                (e.target as HTMLImageElement).src = '/images/items/placeholder.svg';
            }}
        />
    );
}

function formatDiscount(type: string, value: string): string {
    return type === 'percentage' ? `${parseFloat(value)}% OFF` : `${parseFloat(value).toFixed(2)} OFF`;
}

function PromoRibbon({ promotions }: { promotions: ActivePromotion[] }) {
    if (promotions.length === 0) return null;

    function copyCode(code: string) {
        navigator.clipboard.writeText(code);
    }

    return (
        <div className="space-y-2">
            {promotions.map((promo) => (
                <div
                    key={promo.code}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 dark:border-amber-700 dark:bg-amber-950/40"
                >
                    <div className="flex items-center gap-2">
                        <Tag className="size-4 text-amber-600 dark:text-amber-400" />
                        <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                            {promo.name} — {formatDiscount(promo.type, promo.value)}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => copyCode(promo.code!)}
                        className="flex items-center gap-1.5 rounded-md bg-amber-200/60 px-3 py-1 text-sm font-mono font-bold text-amber-900 transition-colors hover:bg-amber-200 dark:bg-amber-800/40 dark:text-amber-100 dark:hover:bg-amber-800/60"
                    >
                        {promo.code}
                        <Copy className="size-3.5" />
                    </button>
                </div>
            ))}
        </div>
    );
}

export default function ShopIndex({ categories, items, bundles, balance: initialBalance, activePromotions, hasPzAccount, pendingDeposit: initialPendingDeposit, lastDepositResult: initialLastDepositResult }: Props) {
    const { auth } = usePage().props;
    const isAuthenticated = !!auth.user;
    const [filter, setFilter] = useState('');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [buyItem, setBuyItem] = useState<ShopItem | null>(null);
    const [buyBundle, setBuyBundle] = useState<ShopBundle | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [promoCode, setPromoCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [depositLoading, setDepositLoading] = useState(false);
    const [pendingDeposit, setPendingDeposit] = useState(initialPendingDeposit);
    const [lastDepositResult, setLastDepositResult] = useState(initialLastDepositResult);
    const [depositCooldown, setDepositCooldown] = useState(0);
    const [depositError, setDepositError] = useState<string | null>(null);
    const [balance, setBalance] = useState(initialBalance);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Sync from server props when page re-renders via Inertia
    useEffect(() => {
        setPendingDeposit(initialPendingDeposit);
        setLastDepositResult(initialLastDepositResult);
        setBalance(initialBalance);
    }, [initialPendingDeposit, initialLastDepositResult, initialBalance]);

    // Auto-dismiss deposit result after 8 seconds
    useEffect(() => {
        if (!lastDepositResult) return;
        const timer = setTimeout(() => setLastDepositResult(null), 8000);
        return () => clearTimeout(timer);
    }, [lastDepositResult]);

    // Auto-dismiss deposit error after 8 seconds (unless rate limited — cooldown handles that)
    useEffect(() => {
        if (!depositError || depositCooldown > 0) return;
        const timer = setTimeout(() => setDepositError(null), 8000);
        return () => clearTimeout(timer);
    }, [depositError, depositCooldown]);

    const pollDepositStatus = useCallback(async () => {
        try {
            const res = await fetch('/shop/deposit/status', {
                headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'same-origin',
            });
            if (!res.ok) return;
            const data = await res.json();
            setPendingDeposit(data.pendingDeposit);
            setLastDepositResult(data.lastDepositResult);
            if (data.balance !== undefined && data.balance !== null) {
                setBalance(data.balance);
            }
        } catch {
            // Silently ignore polling errors
        }
    }, []);

    // Poll every 5 seconds while a deposit is pending
    useEffect(() => {
        if (pendingDeposit) {
            pollRef.current = setInterval(pollDepositStatus, 5000);
            return () => {
                if (pollRef.current) clearInterval(pollRef.current);
            };
        }
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, [pendingDeposit, pollDepositStatus]);

    const filteredItems = useMemo(() => {
        let result = items;
        if (activeCategory) {
            result = result.filter((i) => i.category_id === activeCategory);
        }
        if (filter) {
            const q = filter.toLowerCase();
            result = result.filter(
                (i) => i.name.toLowerCase().includes(q) || i.item_type.toLowerCase().includes(q),
            );
        }
        return result;
    }, [items, filter, activeCategory]);

    const featuredItems = useMemo(() => items.filter((i) => i.is_featured), [items]);
    const featuredBundles = useMemo(() => bundles.filter((b) => b.is_featured), [bundles]);

    async function handleBuyItem() {
        if (!buyItem) return;
        setLoading(true);
        const result = await fetchAction(`/shop/${buyItem.slug}/purchase`, {
            data: {
                quantity,
                promotion_code: promoCode || undefined,
            },
            successMessage: `Purchased ${quantity}x ${buyItem.name}`,
        });
        setLoading(false);
        if (result) {
            setBuyItem(null);
            setQuantity(1);
            setPromoCode('');
            router.reload();
        }
    }

    async function handleBuyBundle() {
        if (!buyBundle) return;
        setLoading(true);
        const result = await fetchAction(`/shop/bundle/${buyBundle.slug}/purchase`, {
            data: {
                promotion_code: promoCode || undefined,
            },
            successMessage: `Purchased ${buyBundle.name}`,
        });
        setLoading(false);
        if (result) {
            setBuyBundle(null);
            setPromoCode('');
            router.reload();
        }
    }

    function startCooldown(seconds: number) {
        if (cooldownRef.current) clearInterval(cooldownRef.current);
        setDepositCooldown(seconds);
        cooldownRef.current = setInterval(() => {
            setDepositCooldown((prev) => {
                if (prev <= 1) {
                    if (cooldownRef.current) clearInterval(cooldownRef.current);
                    cooldownRef.current = null;
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }

    // Clean up cooldown interval on unmount
    useEffect(() => {
        return () => {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
        };
    }, []);

    async function handleDeposit() {
        setDepositLoading(true);
        setDepositError(null);
        const csrfToken = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
        try {
            const res = await fetch('/shop/deposit', {
                method: 'POST',
                headers: { 'X-CSRF-TOKEN': csrfToken, 'Accept': 'application/json' },
            });
            const json = await res.json().catch(() => ({}));

            if (res.ok) {
                toast.success('Deposit request sent! Stay online in-game.');
                setPendingDeposit(true);
                setLastDepositResult(null);
            } else if (res.status === 429) {
                const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10);
                startCooldown(retryAfter);
                setDepositError('Too many deposit requests. Please wait before trying again.');
            } else {
                setDepositError(json.error || json.message || `Request failed (${res.status})`);
            }
        } catch {
            setDepositError('Network error — could not reach the server');
        }
        setDepositLoading(false);
    }

    function handleItemClick(clickedItem: ShopItem) {
        if (!isAuthenticated) {
            router.visit('/login?redirect=/shop');
            return;
        }
        setBuyItem(clickedItem);
        setQuantity(1);
    }

    function handleBundleClick(clickedBundle: ShopBundle) {
        if (!isAuthenticated) {
            router.visit('/login?redirect=/shop');
            return;
        }
        setBuyBundle(clickedBundle);
    }

    return (
        <PublicLayout>
            <Head title="Shop" />
            <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-6">
                {/* Header with balance */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Shop</h1>
                        <p className="text-muted-foreground text-sm">
                            Browse and purchase items for your character
                        </p>
                    </div>
                    {balance !== null && (
                        <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2">
                            <Coins className="size-5 text-amber-500" />
                            <span className="text-lg font-bold tabular-nums">{balance.toFixed(2)}</span>
                        </div>
                    )}
                </div>

                {/* Promo ribbon */}
                <PromoRibbon promotions={activePromotions} />

                {/* Deposit In-Game Money */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <ArrowDownToLine className="size-5 text-green-600 dark:text-green-400" />
                            <CardTitle>Deposit In-Game Money</CardTitle>
                        </div>
                        <CardDescription>
                            Convert Money and MoneyStack items from your inventory into shop coins
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {/* How It Works */}
                            <div className="space-y-2">
                                <p className="text-sm font-medium">How It Works</p>
                                <ol className="text-muted-foreground space-y-1 text-sm">
                                    <li>1. Make sure you are online in-game</li>
                                    <li>2. Click "Deposit" below</li>
                                    <li>3. Within ~15 seconds, all Money and MoneyStack items are removed from your inventory</li>
                                    <li>4. Your wallet is credited automatically</li>
                                </ol>
                                <div className="flex gap-3 pt-1">
                                    <Badge variant="outline" className="text-xs">
                                        <Coins className="mr-1 size-3 text-amber-500" />
                                        Money = 1 coin
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                        <Coins className="mr-1 size-3 text-amber-500" />
                                        MoneyStack = 10 coins
                                    </Badge>
                                </div>
                            </div>

                            {/* Action area */}
                            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-4">
                                {!isAuthenticated ? (
                                    <>
                                        <p className="text-muted-foreground text-center text-sm">
                                            Log in to deposit money
                                        </p>
                                        <Button size="sm" onClick={() => router.visit('/login?redirect=/shop')}>
                                            Log In
                                        </Button>
                                    </>
                                ) : !hasPzAccount ? (
                                    <p className="text-muted-foreground text-center text-sm">
                                        Link your PZ account first via the whitelist to use deposits
                                    </p>
                                ) : pendingDeposit ? (
                                    <>
                                        <Loader2 className="size-6 animate-spin text-amber-500" />
                                        <p className="text-sm font-medium">Deposit in progress...</p>
                                        <p className="text-muted-foreground text-center text-xs">
                                            Stay online in-game. Your money will be collected shortly.
                                        </p>
                                    </>
                                ) : (
                                    <Button onClick={handleDeposit} disabled={depositLoading || depositCooldown > 0}>
                                        {depositLoading ? (
                                            <Loader2 className="mr-1.5 size-4 animate-spin" />
                                        ) : depositCooldown > 0 ? (
                                            <Clock className="mr-1.5 size-4" />
                                        ) : (
                                            <ArrowDownToLine className="mr-1.5 size-4" />
                                        )}
                                        {depositCooldown > 0 ? `Wait ${depositCooldown}s` : 'Deposit Money'}
                                    </Button>
                                )}

                                {/* Deposit error */}
                                {depositError && !pendingDeposit && (
                                    <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                                        <XCircle className="size-3.5 shrink-0" />
                                        <span className="flex-1">{depositError}</span>
                                        <button
                                            type="button"
                                            onClick={() => setDepositError(null)}
                                            className="shrink-0 rounded p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                                            aria-label="Dismiss"
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    </div>
                                )}

                                {/* Last result */}
                                {lastDepositResult && !pendingDeposit && (
                                    <div className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs ${
                                        lastDepositResult.status === 'success'
                                            ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300'
                                            : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                    }`}>
                                        {lastDepositResult.status === 'success' ? (
                                            <CheckCircle className="size-3.5 shrink-0" />
                                        ) : (
                                            <XCircle className="size-3.5 shrink-0" />
                                        )}
                                        <span className="flex-1">
                                            {lastDepositResult.status === 'success'
                                                ? `Deposited ${lastDepositResult.total_coins} coins (${lastDepositResult.money_count} Money + ${lastDepositResult.stack_count} MoneyStack)`
                                                : lastDepositResult.message || 'Deposit failed'}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setLastDepositResult(null)}
                                            className="shrink-0 rounded p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                                            aria-label="Dismiss"
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Featured section */}
                {(featuredItems.length > 0 || featuredBundles.length > 0) && (
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Star className="size-5 text-amber-500" />
                                <CardTitle>Featured</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                                {featuredItems.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className="flex flex-col items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-center transition-colors hover:bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20 dark:hover:bg-amber-950/40"
                                        onClick={() => handleItemClick(item)}
                                    >
                                        <ItemIcon src={item.icon || '/images/items/placeholder.svg'} name={item.name} />
                                        <span className="text-sm font-medium">{item.name}</span>
                                        <Badge variant="secondary" className="tabular-nums">
                                            {parseFloat(item.price).toFixed(2)}
                                        </Badge>
                                    </button>
                                ))}
                                {featuredBundles.map((bundle) => (
                                    <button
                                        key={bundle.id}
                                        type="button"
                                        className="flex flex-col items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-center transition-colors hover:bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20 dark:hover:bg-amber-950/40"
                                        onClick={() => handleBundleClick(bundle)}
                                    >
                                        <Package className="size-12 text-muted-foreground" />
                                        <span className="text-sm font-medium">{bundle.name}</span>
                                        <Badge variant="secondary" className="tabular-nums">
                                            {parseFloat(bundle.price).toFixed(2)}
                                        </Badge>
                                        <span className="text-muted-foreground text-xs">{bundle.items.length} items</span>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Category tabs + search */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant={activeCategory === null ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setActiveCategory(null)}
                        >
                            All
                        </Button>
                        {categories.map((cat) => (
                            <Button
                                key={cat.id}
                                variant={activeCategory === cat.id ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setActiveCategory(cat.id)}
                            >
                                {cat.name}
                            </Button>
                        ))}
                    </div>
                    <div className="relative">
                        <Search className="text-muted-foreground absolute left-2.5 top-2.5 size-4" />
                        <Input
                            placeholder="Search items..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="pl-9 sm:w-[250px]"
                        />
                    </div>
                </div>

                {/* Items grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {filteredItems.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className="flex flex-col items-center gap-2 rounded-lg border border-border/50 p-4 text-center transition-colors hover:bg-accent"
                            onClick={() => handleItemClick(item)}
                        >
                            <ItemIcon src={item.icon || '/images/items/placeholder.svg'} name={item.name} />
                            <span className="truncate text-sm font-medium">{item.name}</span>
                            {item.description && (
                                <span className="text-muted-foreground line-clamp-2 text-xs">{item.description}</span>
                            )}
                            <div className="flex items-center gap-1.5">
                                <Coins className="size-3.5 text-amber-500" />
                                <span className="text-sm font-semibold tabular-nums">{parseFloat(item.price).toFixed(2)}</span>
                            </div>
                            {item.quantity > 1 && (
                                <span className="text-muted-foreground text-xs">x{item.quantity} per purchase</span>
                            )}
                            {item.stock !== null && item.stock <= 5 && (
                                <Badge variant="destructive" className="text-xs">
                                    {item.stock === 0 ? 'Out of stock' : `Only ${item.stock} left`}
                                </Badge>
                            )}
                        </button>
                    ))}
                </div>

                {filteredItems.length === 0 && (
                    <p className="text-muted-foreground py-12 text-center">
                        No items found.
                    </p>
                )}

                {/* Bundles section */}
                {bundles.length > 0 && (
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Package className="size-5" />
                                <CardTitle>Bundles</CardTitle>
                            </div>
                            <CardDescription>Save with item bundles</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {bundles.map((bundle) => (
                                    <button
                                        key={bundle.id}
                                        type="button"
                                        className="rounded-lg border border-border/50 p-4 text-left transition-colors hover:bg-accent"
                                        onClick={() => handleBundleClick(bundle)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium">{bundle.name}</span>
                                            <div className="flex items-center gap-1">
                                                <Coins className="size-3.5 text-amber-500" />
                                                <span className="font-semibold tabular-nums">
                                                    {parseFloat(bundle.price).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                        {bundle.description && (
                                            <p className="text-muted-foreground mt-1 text-sm">{bundle.description}</p>
                                        )}
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {bundle.items.map((item) => (
                                                <Badge key={item.id} variant="outline" className="text-xs">
                                                    {item.name} x{item.pivot.quantity}
                                                </Badge>
                                            ))}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Buy Item Dialog */}
            <Dialog
                open={buyItem !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setBuyItem(null);
                        setQuantity(1);
                        setPromoCode('');
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Purchase Item</DialogTitle>
                        <DialogDescription>Confirm your purchase.</DialogDescription>
                    </DialogHeader>
                    {buyItem && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 rounded-md bg-muted p-3">
                                <ItemIcon
                                    src={buyItem.icon || '/images/items/placeholder.svg'}
                                    name={buyItem.name}
                                    size={40}
                                />
                                <div className="flex-1">
                                    <p className="font-medium">{buyItem.name}</p>
                                    <p className="text-muted-foreground text-sm">
                                        {parseFloat(buyItem.price).toFixed(2)} each &middot; x{buyItem.quantity} items per unit
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Quantity</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={buyItem.max_per_player || 100}
                                        value={quantity}
                                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Promo Code</Label>
                                    <Input
                                        placeholder="Optional"
                                        value={promoCode}
                                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between rounded-md bg-muted p-3">
                                <span className="text-sm font-medium">Total</span>
                                <div className="flex items-center gap-1.5">
                                    <Coins className="size-4 text-amber-500" />
                                    <span className="text-lg font-bold tabular-nums">
                                        {(parseFloat(buyItem.price) * quantity).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                            {balance !== null && parseFloat(buyItem.price) * quantity > balance && (
                                <p className="text-sm text-destructive">
                                    Insufficient balance. You need {(parseFloat(buyItem.price) * quantity - balance).toFixed(2)} more.
                                </p>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBuyItem(null)}>
                            Cancel
                        </Button>
                        <Button
                            disabled={!buyItem || loading || (buyItem && balance !== null && parseFloat(buyItem.price) * quantity > balance)}
                            onClick={handleBuyItem}
                        >
                            <ShoppingBag className="mr-1.5 size-4" />
                            Buy Now
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Buy Bundle Dialog */}
            <Dialog
                open={buyBundle !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setBuyBundle(null);
                        setPromoCode('');
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Purchase Bundle</DialogTitle>
                        <DialogDescription>Confirm your bundle purchase.</DialogDescription>
                    </DialogHeader>
                    {buyBundle && (
                        <div className="space-y-4">
                            <div className="rounded-md bg-muted p-3">
                                <p className="font-medium">{buyBundle.name}</p>
                                {buyBundle.description && (
                                    <p className="text-muted-foreground text-sm">{buyBundle.description}</p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <Label className="text-sm">Includes:</Label>
                                {buyBundle.items.map((item) => (
                                    <div key={item.id} className="flex items-center gap-2 text-sm">
                                        <img
                                            src={item.icon || '/images/items/placeholder.svg'}
                                            alt={item.name}
                                            width={20}
                                            height={20}
                                            className="rounded"
                                        />
                                        <span>{item.name}</span>
                                        <Badge variant="outline" className="text-xs">x{item.pivot.quantity}</Badge>
                                    </div>
                                ))}
                            </div>
                            <div className="space-y-2">
                                <Label>Promo Code</Label>
                                <Input
                                    placeholder="Optional"
                                    value={promoCode}
                                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                                />
                            </div>
                            <div className="flex items-center justify-between rounded-md bg-muted p-3">
                                <span className="text-sm font-medium">Total</span>
                                <div className="flex items-center gap-1.5">
                                    <Coins className="size-4 text-amber-500" />
                                    <span className="text-lg font-bold tabular-nums">
                                        {parseFloat(buyBundle.price).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                            {balance !== null && parseFloat(buyBundle.price) > balance && (
                                <p className="text-sm text-destructive">
                                    Insufficient balance. You need {(parseFloat(buyBundle.price) - balance).toFixed(2)} more.
                                </p>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBuyBundle(null)}>
                            Cancel
                        </Button>
                        <Button
                            disabled={!buyBundle || loading || (buyBundle && balance !== null && parseFloat(buyBundle.price) > balance)}
                            onClick={handleBuyBundle}
                        >
                            <ShoppingBag className="mr-1.5 size-4" />
                            Buy Now
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PublicLayout>
    );
}
