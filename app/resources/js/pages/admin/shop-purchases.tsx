import { Head, Link, router } from '@inertiajs/react';
import { Coins, Package, Search, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import type { ShopDelivery, ShopPurchase } from '@/types/server';

type PurchaseUser = {
    id: number;
    username: string;
    name: string;
};

type AdminPurchase = ShopPurchase & {
    user?: PurchaseUser;
};

type PaginatedData<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: Array<{ url: string | null; label: string; active: boolean }>;
};

type Props = {
    purchases: PaginatedData<AdminPurchase>;
    stats: {
        total_revenue: number;
        total_purchases: number;
        items_sold: number;
    };
    filters: {
        search: string;
        status: string;
    };
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Shop', href: '/admin/shop' },
    { title: 'Purchases', href: '/admin/shop/purchases' },
];

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    queued: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    delivered: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    partially_delivered: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

function StatusBadge({ status }: { status: string }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[status] || ''}`}>
            {status.replace('_', ' ')}
        </span>
    );
}

function getPurchasableName(purchase: AdminPurchase): string {
    if (purchase.purchasable) {
        return purchase.purchasable.name;
    }
    if (purchase.metadata && typeof purchase.metadata === 'object') {
        const meta = purchase.metadata as Record<string, unknown>;
        if (typeof meta.name === 'string') return meta.name;
        if (Array.isArray(meta.items)) {
            return (meta.items as Array<{ name?: string }>).map((i) => i.name || '?').join(', ');
        }
    }
    return purchase.purchasable_type.includes('Bundle') ? 'Bundle' : 'Item';
}

export default function ShopPurchases({ purchases, stats, filters }: Props) {
    const [search, setSearch] = useState(filters.search);
    const [status, setStatus] = useState(filters.status);

    function applyFilters() {
        const params: Record<string, string> = {};
        if (search) params.search = search;
        if (status) params.status = status;
        router.get('/admin/shop/purchases', params, { preserveState: true });
    }

    function clearFilters() {
        setSearch('');
        setStatus('');
        router.get('/admin/shop/purchases', {}, { preserveState: true });
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Shop Purchases" />
            <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Shop Purchases</h1>
                    <p className="text-muted-foreground text-sm">
                        View and manage all player purchases
                    </p>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Card>
                        <CardContent className="flex items-center gap-3 pt-6">
                            <Coins className="text-muted-foreground size-5" />
                            <div>
                                <p className="text-2xl font-bold tabular-nums">{stats.total_revenue.toFixed(2)}</p>
                                <p className="text-muted-foreground text-xs">Total Revenue</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex items-center gap-3 pt-6">
                            <ShoppingBag className="text-muted-foreground size-5" />
                            <div>
                                <p className="text-2xl font-bold">{stats.total_purchases}</p>
                                <p className="text-muted-foreground text-xs">Total Purchases</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex items-center gap-3 pt-6">
                            <Package className="text-muted-foreground size-5" />
                            <div>
                                <p className="text-2xl font-bold">{stats.items_sold}</p>
                                <p className="text-muted-foreground text-xs">Items Sold</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <Card>
                    <CardHeader>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <CardTitle>All Purchases</CardTitle>
                                <CardDescription>{purchases.total} total</CardDescription>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative">
                                    <Search className="text-muted-foreground absolute left-2.5 top-2.5 size-4" />
                                    <Input
                                        placeholder="Search player..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                                        className="pl-9 sm:w-[200px]"
                                    />
                                </div>
                                <Select value={status} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); }}>
                                    <SelectTrigger className="w-[160px]">
                                        <SelectValue placeholder="All statuses" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All statuses</SelectItem>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="queued">Queued</SelectItem>
                                        <SelectItem value="delivered">Delivered</SelectItem>
                                        <SelectItem value="partially_delivered">Partial</SelectItem>
                                        <SelectItem value="failed">Failed</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button size="sm" onClick={applyFilters}>Filter</Button>
                                {(filters.search || filters.status) && (
                                    <Button size="sm" variant="ghost" onClick={clearFilters}>Clear</Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {purchases.data.length > 0 ? (
                            <div className="space-y-2">
                                {purchases.data.map((purchase) => (
                                    <div
                                        key={purchase.id}
                                        className="rounded-lg border border-border/50 p-3"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium">
                                                            {purchase.user?.username || 'Unknown'}
                                                        </span>
                                                        <span className="text-muted-foreground text-xs">
                                                            bought
                                                        </span>
                                                        <span className="truncate text-sm font-medium">
                                                            {purchase.quantity_bought}x {getPurchasableName(purchase)}
                                                        </span>
                                                    </div>
                                                    <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                                                        <span>{new Date(purchase.created_at).toLocaleString()}</span>
                                                        {purchase.discount_amount && parseFloat(purchase.discount_amount) > 0 && (
                                                            <span className="text-green-600">
                                                                -{parseFloat(purchase.discount_amount).toFixed(2)} discount
                                                            </span>
                                                        )}
                                                    </div>
                                                    {/* Delivery details */}
                                                    {purchase.deliveries && purchase.deliveries.length > 0 && (
                                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                                            {purchase.deliveries.map((delivery: ShopDelivery) => (
                                                                <Badge
                                                                    key={delivery.id}
                                                                    variant="outline"
                                                                    className="text-xs"
                                                                    title={delivery.error_message || undefined}
                                                                >
                                                                    {delivery.item_type} x{delivery.quantity} — {delivery.status}
                                                                    {delivery.error_message && ' (!)'}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-3">
                                                <Badge variant="secondary" className="tabular-nums text-sm">
                                                    {parseFloat(purchase.total_price).toFixed(2)}
                                                </Badge>
                                                <StatusBadge status={purchase.delivery_status} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground py-8 text-center">
                                No purchases found.
                            </p>
                        )}

                        {/* Pagination */}
                        {purchases.last_page > 1 && (
                            <div className="mt-4 flex items-center justify-center gap-1">
                                {purchases.links.map((link, i) => (
                                    <div key={i}>
                                        {link.url ? (
                                            <Link
                                                href={link.url}
                                                className={`rounded-md px-3 py-1.5 text-sm ${
                                                    link.active
                                                        ? 'bg-primary text-primary-foreground'
                                                        : 'hover:bg-accent'
                                                }`}
                                                dangerouslySetInnerHTML={{ __html: link.label }}
                                                preserveState
                                            />
                                        ) : (
                                            <span
                                                className="text-muted-foreground px-3 py-1.5 text-sm"
                                                dangerouslySetInnerHTML={{ __html: link.label }}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
