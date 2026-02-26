import { Head, Link, usePage, usePoll } from '@inertiajs/react';
import { Circle, Clock, Globe, Map, Monitor, Package, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { StatusPageData } from '@/types';
import { login, register } from '@/routes';

export default function Status({
    server,
    mods,
    server_name,
}: StatusPageData) {
    const { auth } = usePage().props;

    usePoll(5000, { only: ['server'] });

    return (
        <>
            <Head title={`${server_name} — Server Status`} />
            <div className="min-h-screen bg-background">
                {/* Header */}
                <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
                        <Link href="/" className="text-lg font-semibold tracking-tight">
                            Zomboid Manager
                        </Link>
                        <nav className="flex items-center gap-3">
                            {auth.user ? (
                                <Link
                                    href="/dashboard"
                                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                                >
                                    Dashboard
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        href={login()}
                                        className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                                    >
                                        Log in
                                    </Link>
                                    <Link
                                        href={register()}
                                        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                                    >
                                        Register
                                    </Link>
                                </>
                            )}
                        </nav>
                    </div>
                </header>

                {/* Content */}
                <main className="mx-auto max-w-5xl px-4 py-8">
                    {/* Server Status Hero */}
                    <div className="mb-8 text-center">
                        <h1 className="mb-2 text-3xl font-bold tracking-tight">{server_name}</h1>
                        <div className="flex items-center justify-center gap-2">
                            <Circle
                                className={`size-3 fill-current ${server.online ? 'text-green-500' : 'text-red-500'}`}
                            />
                            <span className={`text-lg font-medium ${server.online ? 'text-green-500' : 'text-red-500'}`}>
                                {server.online ? 'Online' : 'Offline'}
                            </span>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Players</CardTitle>
                                <Users className="size-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {server.player_count}
                                    {server.max_players !== null && (
                                        <span className="text-base font-normal text-muted-foreground">
                                            /{server.max_players}
                                        </span>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Map</CardTitle>
                                <Map className="size-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="truncate text-2xl font-bold">
                                    {server.map || 'N/A'}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Uptime</CardTitle>
                                <Clock className="size-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="truncate text-2xl font-bold">
                                    {server.uptime || 'N/A'}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Mods</CardTitle>
                                <Package className="size-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{mods.length}</div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Online Players */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Users className="size-5" />
                                    Online Players
                                </CardTitle>
                                <CardDescription>
                                    {server.player_count} player{server.player_count !== 1 ? 's' : ''} connected
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {server.players.length > 0 ? (
                                    <div className="space-y-2">
                                        {server.players.map((player) => (
                                            <div
                                                key={player}
                                                className="flex items-center gap-2 rounded-md border border-border/50 px-3 py-2"
                                            >
                                                <Circle className="size-2 fill-green-500 text-green-500" />
                                                <span className="text-sm font-medium">{player}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        {server.online ? 'No players online' : 'Server is offline'}
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Mod List */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Package className="size-5" />
                                    Installed Mods
                                </CardTitle>
                                <CardDescription>
                                    {mods.length} mod{mods.length !== 1 ? 's' : ''} installed
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {mods.length > 0 ? (
                                    <div className="space-y-2">
                                        {mods.map((mod) => (
                                            <div
                                                key={mod.workshop_id}
                                                className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2"
                                            >
                                                <span className="text-sm font-medium">{mod.mod_id}</span>
                                                <Badge variant="secondary" className="text-xs">
                                                    {mod.workshop_id}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No mods installed</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </main>

                {/* Footer */}
                <footer className="mt-12 border-t border-border/40 py-6">
                    <div className="mx-auto max-w-5xl px-4 text-center text-sm text-muted-foreground">
                        Powered by Zomboid Manager
                    </div>
                </footer>
            </div>
        </>
    );
}
