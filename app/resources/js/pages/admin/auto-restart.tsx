import { Head, router } from '@inertiajs/react';
import { Timer } from 'lucide-react';
import { useState } from 'react';
import { fetchAction } from '@/lib/fetch-action';
import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import type { BreadcrumbItem } from '@/types';

type Settings = {
    enabled: boolean;
    interval_hours: number;
    warning_minutes: number;
    warning_message: string | null;
    next_restart_at: string | null;
};

type Props = {
    settings: Settings;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Auto Restart', href: '/admin/auto-restart' },
];

const INTERVAL_OPTIONS = [
    { value: '2', label: 'Every 2 hours' },
    { value: '3', label: 'Every 3 hours' },
    { value: '4', label: 'Every 4 hours' },
    { value: '6', label: 'Every 6 hours' },
    { value: '8', label: 'Every 8 hours' },
    { value: '12', label: 'Every 12 hours' },
    { value: '24', label: 'Every 24 hours' },
] as const;

const WARNING_OPTIONS = [
    { value: '2', label: '2 minutes' },
    { value: '5', label: '5 minutes' },
    { value: '10', label: '10 minutes' },
    { value: '15', label: '15 minutes' },
    { value: '30', label: '30 minutes' },
] as const;

export default function AutoRestart({ settings }: Props) {
    const [enabled, setEnabled] = useState(settings.enabled);
    const [intervalHours, setIntervalHours] = useState(String(settings.interval_hours));
    const [warningMinutes, setWarningMinutes] = useState(String(settings.warning_minutes));
    const [warningMessage, setWarningMessage] = useState(settings.warning_message ?? '');
    const [saving, setSaving] = useState(false);

    async function save() {
        setSaving(true);
        await fetchAction('/admin/auto-restart', {
            method: 'PATCH',
            data: {
                enabled,
                interval_hours: parseInt(intervalHours, 10),
                warning_minutes: parseInt(warningMinutes, 10),
                warning_message: warningMessage.trim() || null,
            },
            successMessage: 'Auto-restart settings saved',
        });
        setSaving(false);
        router.reload();
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Auto Restart" />
            <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Auto Restart</h1>
                    <p className="text-muted-foreground">
                        Automatically restart the server at regular intervals to maintain performance.
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Timer className="size-5" />
                            Restart Settings
                        </CardTitle>
                        <CardDescription>
                            Configure automatic server restarts with in-game countdown warnings.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Enable/Disable */}
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="auto-restart-enabled">Enable Auto Restart</Label>
                                <p className="text-sm text-muted-foreground">
                                    When enabled, the server will restart automatically at the configured interval.
                                </p>
                            </div>
                            <Switch
                                id="auto-restart-enabled"
                                checked={enabled}
                                onCheckedChange={setEnabled}
                            />
                        </div>

                        <Separator />

                        {/* Interval */}
                        <div className="grid gap-2">
                            <Label htmlFor="interval">Restart Interval</Label>
                            <Select value={intervalHours} onValueChange={setIntervalHours}>
                                <SelectTrigger id="interval">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {INTERVAL_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Warning Minutes */}
                        <div className="grid gap-2">
                            <Label htmlFor="warning">Warning Time</Label>
                            <p className="text-sm text-muted-foreground">
                                How long before the restart to start sending in-game countdown warnings.
                            </p>
                            <Select value={warningMinutes} onValueChange={setWarningMinutes}>
                                <SelectTrigger id="warning">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {WARNING_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Warning Message */}
                        <div className="grid gap-2">
                            <Label htmlFor="warning-message">Warning Message (optional)</Label>
                            <Input
                                id="warning-message"
                                value={warningMessage}
                                onChange={(e) => setWarningMessage(e.target.value)}
                                placeholder="restart (automatic)"
                                maxLength={500}
                            />
                            <p className="text-sm text-muted-foreground">
                                Custom label for countdown warnings. Default: &quot;restart (automatic)&quot;
                            </p>
                        </div>

                        <Separator />

                        {/* Next Restart Info */}
                        {settings.enabled && settings.next_restart_at && (
                            <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
                                Next restart scheduled for:{' '}
                                <span className="font-semibold">
                                    {new Date(settings.next_restart_at).toLocaleString()}
                                </span>
                            </div>
                        )}

                        {/* Save Button */}
                        <Button onClick={save} disabled={saving}>
                            {saving ? 'Saving...' : 'Save Settings'}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
