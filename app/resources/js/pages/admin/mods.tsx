import { Head, router } from '@inertiajs/react';
import { AlertTriangle, Download, Info, Package, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { fetchAction } from '@/lib/fetch-action';
import AppLayout from '@/layouts/app-layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { BreadcrumbItem, ModEntry, ModEnrichment } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Mods', href: '/admin/mods' },
];

type ImportItem = {
    workshop_id: string;
    title: string;
    detected_mod_id: string | null;
    mod_id: string; // editable by user
};

export default function Mods({
    mods,
    ini_file,
    ini_exists,
    ini_misaligned,
    enriched,
}: {
    mods: ModEntry[];
    ini_file: string;
    ini_exists: boolean;
    ini_misaligned: boolean;
    enriched?: Record<string, ModEnrichment>;
}) {
    const [showAdd, setShowAdd] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<ModEntry | null>(null);
    const [workshopId, setWorkshopId] = useState('');
    const [modId, setModId] = useState('');
    const [mapFolder, setMapFolder] = useState('');
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [modIdError, setModIdError] = useState('');

    // Multi-mod-ID hint in Add Mod dialog
    const [addLookupLoading, setAddLookupLoading] = useState(false);
    const [addAllModIds, setAddAllModIds] = useState<string[]>([]);

    // Import dialog state
    const [showImport, setShowImport] = useState(false);
    const [importStep, setImportStep] = useState<'input' | 'review'>('input');
    const [importUrl, setImportUrl] = useState('');
    const [importLookupError, setImportLookupError] = useState('');
    const [importLoading, setImportLoading] = useState(false);
    const [importItems, setImportItems] = useState<ImportItem[]>([]);
    const [importIsCollection, setImportIsCollection] = useState(false);
    const [importReplaceExisting, setImportReplaceExisting] = useState<'add' | 'replace'>('add');

    const installedWorkshopIds = useMemo(() => new Set(mods.map((m) => m.workshop_id)), [mods]);
    const installedModIds = useMemo(() => new Set(mods.map((m) => m.mod_id)), [mods]);

    const filteredMods = useMemo(() => {
        if (!search) return mods;
        const q = search.toLowerCase();
        return mods.filter((m) => m.mod_id.toLowerCase().includes(q) || m.workshop_id.toLowerCase().includes(q));
    }, [mods, search]);

    function getMissingDeps(mod: ModEntry): string[] {
        const info = enriched?.[mod.workshop_id];
        if (!info) return [];
        return info.dependency_ids.filter((id) => !installedWorkshopIds.has(id));
    }

    async function lookupWorkshopId(id: string) {
        if (!id.trim()) {
            setAddAllModIds([]);
            return;
        }
        setAddLookupLoading(true);
        try {
            const res = await fetch('/admin/mods/import/lookup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? '',
                },
                body: JSON.stringify({ url: id.trim() }),
            });
            if (res.ok) {
                const data = await res.json();
                const item = data.items?.[0];
                if (item?.detected_mod_id) {
                    setModId((prev) => prev || item.detected_mod_id);
                }
                // Collect all mod IDs from enriched data if available
                const enrichedItem = enriched?.[id.trim()];
                if (enrichedItem?.all_mod_ids?.length) {
                    setAddAllModIds(enrichedItem.all_mod_ids);
                } else {
                    setAddAllModIds([]);
                }
            }
        } catch {
            // Silent — not critical
        }
        setAddLookupLoading(false);
    }

    const uninstalledHintModIds = useMemo(() => {
        if (addAllModIds.length <= 1) return [];
        return addAllModIds.filter((id) => !installedModIds.has(id));
    }, [addAllModIds, installedModIds]);

    async function addMod() {
        if (modId.includes(';')) {
            setModIdError('Mod ID must not contain semicolons. Add each sub-mod as a separate entry.');
            return;
        }
        setLoading(true);
        await fetchAction('/admin/mods', {
            data: { workshop_id: workshopId, mod_id: modId, map_folder: mapFolder || null },
            successMessage: `Added mod ${modId}`,
        });
        setLoading(false);
        setShowAdd(false);
        setWorkshopId('');
        setModId('');
        setMapFolder('');
        setModIdError('');
        setAddAllModIds([]);
        router.reload({ only: ['mods'] });
    }

    async function removeMod(mod: ModEntry) {
        setLoading(true);
        await fetchAction(`/admin/mods/${mod.workshop_id}`, {
            method: 'DELETE',
            successMessage: `Removed mod ${mod.mod_id}`,
        });
        setLoading(false);
        setDeleteTarget(null);
        router.reload({ only: ['mods'] });
    }

    function openImport() {
        setImportUrl('');
        setImportLookupError('');
        setImportItems([]);
        setImportIsCollection(false);
        setImportReplaceExisting('add');
        setImportStep('input');
        setShowImport(true);
    }

    async function lookupImport() {
        if (!importUrl.trim()) return;
        setImportLoading(true);
        setImportLookupError('');

        try {
            const res = await fetch('/admin/mods/import/lookup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? '',
                },
                body: JSON.stringify({ url: importUrl.trim() }),
            });

            const data = await res.json();

            if (!res.ok) {
                setImportLookupError(data.error ?? 'Failed to look up workshop item.');
                setImportLoading(false);
                return;
            }

            if (!data.items || data.items.length === 0) {
                setImportLookupError('No items found. Check the URL and try again.');
                setImportLoading(false);
                return;
            }

            setImportItems(
                data.items.map((item: { workshop_id: string; title: string; detected_mod_id: string | null }) => ({
                    ...item,
                    mod_id: item.detected_mod_id ?? '',
                })),
            );
            setImportIsCollection(data.is_collection ?? false);
            setImportStep('review');
        } catch {
            setImportLookupError('Network error. Please try again.');
        }

        setImportLoading(false);
    }

    async function applyImport() {
        const missingModIds = importItems.some((item) => !item.mod_id.trim());
        if (missingModIds) return;

        setImportLoading(true);
        await fetchAction('/admin/mods/import/apply', {
            data: {
                mods: importItems.map((item) => ({ workshop_id: item.workshop_id, mod_id: item.mod_id.trim() })),
                replace_existing: importReplaceExisting === 'replace',
            },
            successMessage: `Imported ${importItems.length} mod${importItems.length !== 1 ? 's' : ''}`,
        });
        setImportLoading(false);
        setShowImport(false);
        router.reload({ only: ['mods'] });
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Mod Manager" />
            <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
                {ini_misaligned && (
                    <Alert variant="destructive">
                        <AlertTriangle className="size-4" />
                        <AlertTitle>Mod list is misaligned</AlertTitle>
                        <AlertDescription>
                            The <code>WorkshopItems=</code> and <code>Mods=</code> lines have different counts. This usually means the INI was manually edited or a mod ID was entered with a semicolon. Add/remove operations may act on the wrong mods. Fix the INI file directly before making changes.
                        </AlertDescription>
                    </Alert>
                )}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Mod Manager</h1>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <span>{mods.length} mod{mods.length !== 1 ? 's' : ''} installed</span>
                            <span>&middot;</span>
                            <Badge variant={ini_exists ? 'outline' : 'destructive'} className="font-mono text-xs">
                                {ini_file}
                            </Badge>
                            {!ini_exists && (
                                <span className="text-xs text-destructive">INI not found</span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={openImport}>
                            <Download className="mr-1.5 size-4" />
                            Import from Workshop
                        </Button>
                        <Button onClick={() => setShowAdd(true)}>
                            <Plus className="mr-1.5 size-4" />
                            Add Mod
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Package className="size-5" />
                                    Installed Mods
                                </CardTitle>
                                <CardDescription>
                                    {filteredMods.length} of {mods.length} mods &middot; Changes require a server restart
                                </CardDescription>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search mods..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9 sm:w-[200px]"
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {filteredMods.length > 0 ? (
                            <TooltipProvider>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px]">#</TableHead>
                                            <TableHead>Mod ID</TableHead>
                                            <TableHead className="hidden sm:table-cell">Workshop ID</TableHead>
                                            <TableHead className="hidden sm:table-cell">Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredMods.map((mod) => {
                                            const missingDeps = getMissingDeps(mod);
                                            const hasMissingDeps = missingDeps.length > 0;
                                            const enrichmentLoaded = enriched !== undefined;

                                            return (
                                                <TableRow
                                                    key={`${mod.workshop_id}-${mod.position}`}
                                                    className={hasMissingDeps ? 'bg-destructive/5' : undefined}
                                                >
                                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                                        {mod.position + 1}
                                                    </TableCell>
                                                    <TableCell className="font-medium">{mod.mod_id}</TableCell>
                                                    <TableCell className="hidden sm:table-cell">
                                                        <Badge variant="secondary" className="text-xs">
                                                            {mod.workshop_id}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="hidden sm:table-cell">
                                                        {!enrichmentLoaded ? (
                                                            <Skeleton className="h-5 w-20 rounded-full" />
                                                        ) : hasMissingDeps ? (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Badge variant="destructive" className="cursor-help text-xs">
                                                                        Missing deps
                                                                    </Badge>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="max-w-xs">
                                                                    <p className="mb-1 font-semibold">Required dependencies not installed:</p>
                                                                    <ul className="space-y-0.5">
                                                                        {missingDeps.map((id) => (
                                                                            <li key={id} className="font-mono text-xs">{id}</li>
                                                                        ))}
                                                                    </ul>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        ) : (
                                                            <Badge variant="default" className="bg-green-600 text-xs hover:bg-green-600">
                                                                In INI
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-destructive hover:text-destructive"
                                                            onClick={() => setDeleteTarget(mod)}
                                                        >
                                                            <Trash2 className="size-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TooltipProvider>
                        ) : (
                            <p className="py-8 text-center text-muted-foreground">
                                {search ? 'No mods match your search' : 'No mods installed'}
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Add Mod Dialog */}
            <Dialog open={showAdd} onOpenChange={(open) => { setShowAdd(open); if (!open) { setAddAllModIds([]); setModIdError(''); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Mod</DialogTitle>
                        <DialogDescription>
                            Add a Steam Workshop mod. Both Workshop ID and Mod ID are required.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="workshop-id">Workshop ID</Label>
                            <Input
                                id="workshop-id"
                                value={workshopId}
                                onChange={(e) => { setWorkshopId(e.target.value); setAddAllModIds([]); }}
                                onBlur={(e) => lookupWorkshopId(e.target.value)}
                                placeholder="e.g. 2313387159"
                            />
                            {addLookupLoading && <p className="text-xs text-muted-foreground">Checking Workshop...</p>}
                        </div>
                        {uninstalledHintModIds.length > 1 && (
                            <Alert>
                                <Info className="size-4" />
                                <AlertTitle>Multiple mod IDs detected</AlertTitle>
                                <AlertDescription>
                                    This workshop item contains {addAllModIds.length} mod IDs:{' '}
                                    {addAllModIds.map((id) => <code key={id} className="mx-0.5 rounded bg-muted px-1">{id}</code>)}.
                                    Add them as separate entries to enable all features.
                                </AlertDescription>
                            </Alert>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="mod-id">Mod ID</Label>
                            <Input
                                id="mod-id"
                                value={modId}
                                onChange={(e) => { setModId(e.target.value); setModIdError(''); }}
                                placeholder="e.g. Arsenal(26)GunFighter"
                                className={modIdError ? 'border-destructive' : ''}
                            />
                            {modIdError && <p className="text-xs text-destructive">{modIdError}</p>}
                            <p className="text-xs text-muted-foreground">One mod ID per entry. For mods with multiple sub-mods, add the workshop item again with each mod ID separately.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="map-folder">Map Folder (optional)</Label>
                            <Input
                                id="map-folder"
                                value={mapFolder}
                                onChange={(e) => setMapFolder(e.target.value)}
                                placeholder="Only for map mods"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                        <Button disabled={loading || !workshopId || !modId} onClick={addMod}>
                            Add Mod
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove Mod</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to remove <strong>{deleteTarget?.mod_id}</strong> ({deleteTarget?.workshop_id})?
                            A server restart will be required.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            disabled={loading}
                            onClick={() => deleteTarget && removeMod(deleteTarget)}
                        >
                            Remove Mod
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Import from Workshop Dialog */}
            <Dialog open={showImport} onOpenChange={(open) => { if (!importLoading) setShowImport(open); }}>
                <DialogContent className="sm:max-w-2xl">
                    {importStep === 'input' ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>Import from Steam Workshop</DialogTitle>
                                <DialogDescription>
                                    Paste a Steam Workshop mod URL or collection URL. Workshop IDs are also accepted.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-3">
                                <Label htmlFor="import-url">Workshop URL or ID</Label>
                                <Input
                                    id="import-url"
                                    value={importUrl}
                                    onChange={(e) => { setImportUrl(e.target.value); setImportLookupError(''); }}
                                    placeholder="https://steamcommunity.com/sharedfiles/filedetails/?id=2200148440"
                                    onKeyDown={(e) => { if (e.key === 'Enter') lookupImport(); }}
                                />
                                {importLookupError && <p className="text-xs text-destructive">{importLookupError}</p>}
                                <p className="text-xs text-muted-foreground">
                                    Supports individual mod links and collection links. Mod IDs will be auto-detected where possible.
                                </p>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setShowImport(false)}>Cancel</Button>
                                <Button disabled={importLoading || !importUrl.trim()} onClick={lookupImport}>
                                    {importLoading ? 'Looking up...' : 'Look Up'}
                                </Button>
                            </DialogFooter>
                        </>
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    {importIsCollection ? 'Review Collection' : 'Review Mod'}
                                </DialogTitle>
                                <DialogDescription>
                                    {importIsCollection
                                        ? `Found ${importItems.length} mod${importItems.length !== 1 ? 's' : ''} in this collection. Fill in any missing Mod IDs before importing.`
                                        : 'Confirm the mod details before adding. Fill in the Mod ID if it was not detected automatically.'}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="max-h-72 overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Title</TableHead>
                                            <TableHead className="w-[130px]">Workshop ID</TableHead>
                                            <TableHead className="w-[180px]">Mod ID</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {importItems.map((item, i) => (
                                            <TableRow key={item.workshop_id}>
                                                <TableCell className="text-sm">{item.title}</TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="font-mono text-xs">
                                                        {item.workshop_id}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        value={item.mod_id}
                                                        onChange={(e) => {
                                                            const updated = [...importItems];
                                                            updated[i] = { ...updated[i], mod_id: e.target.value };
                                                            setImportItems(updated);
                                                        }}
                                                        placeholder="Required"
                                                        className={!item.mod_id.trim() ? 'border-destructive' : ''}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            {importIsCollection && (
                                <div className="space-y-2 pt-1">
                                    <Label>Import mode</Label>
                                    <RadioGroup
                                        value={importReplaceExisting}
                                        onValueChange={(v) => setImportReplaceExisting(v as 'add' | 'replace')}
                                        className="flex flex-col gap-2"
                                    >
                                        <div className="flex items-center gap-2">
                                            <RadioGroupItem value="add" id="import-add" />
                                            <Label htmlFor="import-add" className="font-normal">Add on top of existing mods</Label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <RadioGroupItem value="replace" id="import-replace" />
                                            <Label htmlFor="import-replace" className="font-normal text-destructive">Replace all mods with this collection</Label>
                                        </div>
                                    </RadioGroup>
                                </div>
                            )}
                            <DialogFooter className="gap-2">
                                <Button variant="outline" onClick={() => setImportStep('input')}>Back</Button>
                                <Button
                                    disabled={importLoading || importItems.some((item) => !item.mod_id.trim())}
                                    onClick={applyImport}
                                >
                                    {importLoading ? 'Importing...' : `Import ${importItems.length} mod${importItems.length !== 1 ? 's' : ''}`}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
