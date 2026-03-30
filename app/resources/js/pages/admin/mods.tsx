import { Head, router } from '@inertiajs/react';
import { AlertTriangle, Download, Info, Package, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { fetchAction } from '@/lib/fetch-action';
import AppLayout from '@/layouts/app-layout';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { BreadcrumbItem } from '@/types';

type ModEntry = {
    name: string;
    enabled: boolean;
};

type InstalledMod = {
    name: string;
    version: string;
    file: string;
};

type PortalRelease = {
    version: string;
    game_version: string;
    released_at: string;
    download_url: string;
};

type PortalMod = {
    name: string;
    title: string;
    summary: string;
    downloads_count: number;
    latest_release: {
        version: string;
        game_version: string;
    } | null;
};

type Props = {
    mods: ModEntry[];
    installed: InstalledMod[];
    hasCredentials: boolean;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Mods', href: '/admin/mods' },
];

function formatDownloads(count: number): string {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
    return String(count);
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function Mods({ mods, installed, hasCredentials }: Props) {
    const [needsRestart, setNeedsRestart] = useState(false);
    const [togglingMod, setTogglingMod] = useState<string | null>(null);
    const [removeTarget, setRemoveTarget] = useState<ModEntry | null>(null);
    const [removing, setRemoving] = useState(false);
    const [restarting, setRestarting] = useState(false);

    // Portal search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<PortalMod[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Install dialog
    const [installTarget, setInstallTarget] = useState<PortalMod | null>(null);
    const [releases, setReleases] = useState<PortalRelease[]>([]);
    const [loadingReleases, setLoadingReleases] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState('');
    const [installing, setInstalling] = useState(false);

    const installedByName = Object.fromEntries(installed.map((m) => [m.name, m]));

    // Debounced portal search
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (searchQuery.length < 2) {
            setSearchResults([]);
            setSearchError(null);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            setSearchError(null);
            try {
                const csrfToken =
                    document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
                const res = await fetch('/admin/mods/search', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                    },
                    body: JSON.stringify({ query: searchQuery }),
                });
                const json = await res.json().catch(() => ({}));
                if (res.ok) {
                    setSearchResults(json.results ?? []);
                } else {
                    setSearchError(json.error ?? json.message ?? 'Search failed');
                    setSearchResults([]);
                }
            } catch {
                setSearchError('Network error — could not reach the server');
                setSearchResults([]);
            } finally {
                setSearching(false);
            }
        }, 400);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [searchQuery]);

    async function toggleMod(mod: ModEntry) {
        setTogglingMod(mod.name);
        await fetchAction(`/admin/mods/${mod.name}/toggle`, {
            successMessage: `${mod.enabled ? 'Disabled' : 'Enabled'} ${mod.name}`,
        });
        setTogglingMod(null);
        setNeedsRestart(true);
        router.reload({ only: ['mods'] });
    }

    async function removeMod() {
        if (!removeTarget) return;
        setRemoving(true);
        await fetchAction(`/admin/mods/${removeTarget.name}`, {
            method: 'DELETE',
            successMessage: `Removed ${removeTarget.name}`,
        });
        setRemoving(false);
        setRemoveTarget(null);
        setNeedsRestart(true);
        router.reload({ only: ['mods', 'installed'] });
    }

    async function openInstallDialog(mod: PortalMod) {
        setInstallTarget(mod);
        setReleases([]);
        setSelectedVersion('');
        setLoadingReleases(true);
        try {
            const csrfToken =
                document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
            const res = await fetch(`/admin/mods/${mod.name}/details`, {
                headers: {
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
            });
            const json = await res.json().catch(() => ({}));
            if (res.ok) {
                const fetched: PortalRelease[] = json.releases ?? [];
                setReleases(fetched);
                if (fetched.length > 0) {
                    setSelectedVersion(fetched[0].version);
                }
            }
        } catch {
            // releases stays empty — handled in dialog
        } finally {
            setLoadingReleases(false);
        }
    }

    async function confirmInstall() {
        if (!installTarget || !selectedVersion) return;
        const release = releases.find((r) => r.version === selectedVersion);
        if (!release) return;
        setInstalling(true);
        await fetchAction('/admin/mods/install', {
            data: { download_url: release.download_url, version: release.version, name: installTarget.name },
            successMessage: `Installed ${installTarget.name} v${release.version}`,
        });
        setInstalling(false);
        setInstallTarget(null);
        setNeedsRestart(true);
        router.reload({ only: ['mods', 'installed'] });
    }

    async function restartServer() {
        setRestarting(true);
        await fetchAction('/admin/server/restart', {
            successMessage: 'Server restart initiated',
        });
        setRestarting(false);
        setNeedsRestart(false);
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Mod Manager" />
            <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Mod Manager</h1>
                        <p className="text-muted-foreground">
                            {mods.length} mod{mods.length !== 1 ? 's' : ''} in mod-list.json
                        </p>
                    </div>
                </div>

                {/* Section 1 — Installed Mods */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Package className="size-5" />
                            Installed Mods
                            <Badge variant="secondary" className="ml-1">{mods.length}</Badge>
                        </CardTitle>
                        <CardDescription>
                            Mods currently in mod-list.json. Enable/disable or remove them below.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {mods.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead className="hidden sm:table-cell">Version</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {mods.map((mod) => {
                                        const zip = installedByName[mod.name];
                                        const isBase = mod.name === 'base';
                                        return (
                                            <TableRow key={mod.name}>
                                                <TableCell className="font-medium">{mod.name}</TableCell>
                                                <TableCell className="hidden text-muted-foreground sm:table-cell">
                                                    {zip ? zip.version : '—'}
                                                </TableCell>
                                                <TableCell>
                                                    {mod.enabled ? (
                                                        <Badge variant="default" className="bg-green-600 text-xs hover:bg-green-600">
                                                            Enabled
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-xs">
                                                            Disabled
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <Switch
                                                                checked={mod.enabled}
                                                                disabled={isBase || togglingMod === mod.name}
                                                                onCheckedChange={() => toggleMod(mod)}
                                                                aria-label={`Toggle ${mod.name}`}
                                                            />
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            disabled={isBase}
                                                            className="text-destructive hover:text-destructive"
                                                            onClick={() => setRemoveTarget(mod)}
                                                        >
                                                            <Trash2 className="size-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        ) : (
                            <p className="py-8 text-center text-muted-foreground">No mods installed</p>
                        )}
                    </CardContent>
                </Card>

                {/* Section 2 — Mod Portal Search */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Search className="size-5" />
                            Browse Mod Portal
                        </CardTitle>
                        <CardDescription>
                            Search the Steam Workshop and install mods directly.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {!hasCredentials && (
                            <Alert>
                                <Info className="size-4" />
                                <AlertDescription>
                                    Mod Portal credentials not configured — you can browse but cannot install mods.
                                    Add <code className="rounded bg-muted px-1 py-0.5 text-xs">STEAM_API_USERNAME</code> and{' '}
                                    <code className="rounded bg-muted px-1 py-0.5 text-xs">STEAM_API_TOKEN</code> to your{' '}
                                    <code className="rounded bg-muted px-1 py-0.5 text-xs">.env</code> file.
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                            <Input
                                placeholder="Search mods... (min. 2 characters)"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        {searching && (
                            <p className="py-4 text-center text-sm text-muted-foreground">Searching...</p>
                        )}

                        {searchError && !searching && (
                            <Alert variant="destructive">
                                <AlertTriangle className="size-4" />
                                <AlertDescription>{searchError}</AlertDescription>
                            </Alert>
                        )}

                        {!searching && searchResults.length > 0 && (
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {searchResults.map((mod) => (
                                    <div
                                        key={mod.name}
                                        className="flex flex-col gap-2 rounded-lg border p-4"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="truncate font-medium text-sm">{mod.title || mod.name}</p>
                                                <p className="font-mono text-xs text-muted-foreground">{mod.name}</p>
                                            </div>
                                            {mod.latest_release && (
                                                <Badge variant="secondary" className="shrink-0 text-xs">
                                                    v{mod.latest_release.version}
                                                </Badge>
                                            )}
                                        </div>
                                        {mod.summary && (
                                            <p className="line-clamp-2 text-xs text-muted-foreground">{mod.summary}</p>
                                        )}
                                        <div className="flex items-center justify-between gap-2 pt-1">
                                            <span className="text-xs text-muted-foreground">
                                                <Download className="mr-1 inline size-3" />
                                                {formatDownloads(mod.downloads_count)}
                                            </span>
                                            <Button
                                                size="sm"
                                                disabled={!hasCredentials}
                                                onClick={() => openInstallDialog(mod)}
                                            >
                                                Install
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!searching && searchQuery.length >= 2 && searchResults.length === 0 && !searchError && (
                            <p className="py-4 text-center text-sm text-muted-foreground">No mods found for "{searchQuery}"</p>
                        )}

                        {searchQuery.length < 2 && !searching && (
                            <p className="py-4 text-center text-sm text-muted-foreground">
                                Type at least 2 characters to search the mod portal
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Section 3 — Restart Banner */}
                {needsRestart && (
                    <Alert>
                        <AlertTriangle className="size-4" />
                        <AlertDescription className="flex items-center justify-between gap-4">
                            <span>Server restart required to apply mod changes.</span>
                            <Button size="sm" disabled={restarting} onClick={restartServer}>
                                <RefreshCw className={`mr-1.5 size-4 ${restarting ? 'animate-spin' : ''}`} />
                                {restarting ? 'Restarting...' : 'Restart Server'}
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}
            </div>

            {/* Remove Confirmation Dialog */}
            <Dialog open={removeTarget !== null} onOpenChange={() => setRemoveTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove Mod</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to remove <strong>{removeTarget?.name}</strong>?
                            The mod file will be deleted and a server restart will be required.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancel</Button>
                        <Button variant="destructive" disabled={removing} onClick={removeMod}>
                            {removing ? 'Removing...' : 'Remove Mod'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Install Dialog */}
            <Dialog open={installTarget !== null} onOpenChange={(open) => { if (!open) setInstallTarget(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Install {installTarget?.title || installTarget?.name}</DialogTitle>
                        <DialogDescription>
                            {installTarget?.summary || 'Select a version to install.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {loadingReleases ? (
                            <p className="py-4 text-center text-sm text-muted-foreground">Loading versions...</p>
                        ) : releases.length > 0 ? (
                            <div className="space-y-2">
                                <Label htmlFor="version-select">Version</Label>
                                <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                                    <SelectTrigger id="version-select">
                                        <SelectValue placeholder="Select a version" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {releases.map((r) => (
                                            <SelectItem key={r.version} value={r.version}>
                                                v{r.version} — PZ {r.game_version} ({formatDate(r.released_at)})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <p className="py-4 text-center text-sm text-muted-foreground">
                                No releases available for this mod.
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setInstallTarget(null)}>Cancel</Button>
                        <Button
                            disabled={installing || loadingReleases || !selectedVersion}
                            onClick={confirmInstall}
                        >
                            {installing ? 'Installing...' : 'Install'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
