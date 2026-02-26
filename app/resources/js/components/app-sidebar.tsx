import { Link } from '@inertiajs/react';
import {
    Activity,
    Archive,
    BookOpen,
    Folder,
    LayoutGrid,
    Package,
    ScrollText,
    Shield,
    Terminal,
    Users,
    Wrench,
} from 'lucide-react';
import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import type { NavItem } from '@/types';
import AppLogo from './app-logo';
import { dashboard } from '@/routes';

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
    },
    {
        title: 'Players',
        href: '/admin/players',
        icon: Users,
    },
    {
        title: 'Config',
        href: '/admin/config',
        icon: Wrench,
    },
    {
        title: 'Mods',
        href: '/admin/mods',
        icon: Package,
    },
    {
        title: 'Backups',
        href: '/admin/backups',
        icon: Archive,
    },
    {
        title: 'Whitelist',
        href: '/admin/whitelist',
        icon: Shield,
    },
    {
        title: 'Audit Log',
        href: '/admin/audit',
        icon: ScrollText,
    },
    {
        title: 'RCON Console',
        href: '/admin/rcon',
        icon: Terminal,
    },
    {
        title: 'Server Logs',
        href: '/admin/logs',
        icon: Activity,
    },
];

const footerNavItems: NavItem[] = [
    {
        title: 'Server Status',
        href: '/status',
        icon: Activity,
    },
    {
        title: 'Documentation',
        href: 'https://laravel.com/docs',
        icon: BookOpen,
    },
];

export function AppSidebar() {
    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
