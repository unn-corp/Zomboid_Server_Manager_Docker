import { Head, Link, usePage } from '@inertiajs/react';
import {
    Archive,
    ChevronRight,
    Globe,
    Package,
    Shield,
    Skull,
    Terminal,
    Users,
    Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { login, register } from '@/routes';

const features = [
    {
        icon: Terminal,
        title: 'RCON Control',
        description: 'Full server management via RCON — start, stop, restart, broadcast, and execute commands remotely.',
    },
    {
        icon: Users,
        title: 'Player Management',
        description: 'Kick, ban, set access levels, teleport players, give items, and manage XP — all from the dashboard.',
    },
    {
        icon: Wrench,
        title: 'Config Editor',
        description: 'Edit server.ini and SandboxVars.lua through a web interface. No SSH required.',
    },
    {
        icon: Package,
        title: 'Mod Manager',
        description: 'Add, remove, and reorder Steam Workshop mods. Keeps WorkshopItems and Mods in sync.',
    },
    {
        icon: Archive,
        title: 'Backup & Rollback',
        description: 'Automated scheduled backups with retention policies. One-click rollback to any previous state.',
    },
    {
        icon: Shield,
        title: 'Whitelist Control',
        description: 'Manage server access with whitelist CRUD. Add and remove players with sync to PZ database.',
    },
];

export default function Welcome({ canRegister = true }: { canRegister?: boolean }) {
    const { auth } = usePage().props;

    return (
        <>
            <Head title="Zomboid Manager">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link
                    href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600,700"
                    rel="stylesheet"
                />
            </Head>
            <div className="min-h-screen bg-background">
                {/* Header */}
                <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
                        <div className="flex items-center gap-2">
                            <Skull className="size-6" />
                            <span className="text-lg font-semibold tracking-tight">Zomboid Manager</span>
                        </div>
                        <nav className="flex items-center gap-3">
                            <Link
                                href="/status"
                                className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                            >
                                Server Status
                            </Link>
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
                                    {canRegister && (
                                        <Link
                                            href={register()}
                                            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                                        >
                                            Register
                                        </Link>
                                    )}
                                </>
                            )}
                        </nav>
                    </div>
                </header>

                {/* Hero */}
                <section className="py-20 lg:py-28">
                    <div className="mx-auto max-w-5xl px-4 text-center">
                        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
                            <Globe className="size-4" />
                            Georgian Gaming Community
                        </div>
                        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                            Project Zomboid
                            <br />
                            <span className="text-muted-foreground">Dedicated Server</span>
                        </h1>
                        <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
                            A fully managed PZ server with web-based administration.
                            Mod management, automated backups, player controls, and RCON console — all from your browser.
                        </p>
                        <div className="flex items-center justify-center gap-4">
                            <Button asChild size="lg">
                                <Link href="/status">
                                    View Server Status
                                    <ChevronRight className="ml-1 size-4" />
                                </Link>
                            </Button>
                            {!auth.user && (
                                <Button asChild variant="outline" size="lg">
                                    <Link href={login()}>Admin Login</Link>
                                </Button>
                            )}
                        </div>
                    </div>
                </section>

                {/* Features Grid */}
                <section className="border-t border-border/40 bg-muted/30 py-16 lg:py-20">
                    <div className="mx-auto max-w-5xl px-4">
                        <div className="mb-12 text-center">
                            <h2 className="mb-3 text-2xl font-bold tracking-tight sm:text-3xl">
                                Server Management Features
                            </h2>
                            <p className="text-muted-foreground">
                                Everything you need to run a PZ server, without SSH access.
                            </p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {features.map((feature) => (
                                <Card key={feature.title} className="border-border/50">
                                    <CardHeader>
                                        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10">
                                            <feature.icon className="size-5 text-primary" />
                                        </div>
                                        <CardTitle className="text-base">{feature.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <CardDescription className="text-sm leading-relaxed">
                                            {feature.description}
                                        </CardDescription>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="border-t border-border/40 py-8">
                    <div className="mx-auto max-w-5xl px-4 text-center text-sm text-muted-foreground">
                        Powered by Zomboid Manager
                    </div>
                </footer>
            </div>
        </>
    );
}
