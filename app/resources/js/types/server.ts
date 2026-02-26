export type ServerStatus = {
    online: boolean;
    player_count: number;
    players: string[];
    uptime: string | null;
    map: string | null;
    max_players: number | null;
};

export type ModEntry = {
    workshop_id: string;
    mod_id: string;
    position: number;
};

export type AuditEntry = {
    id: string;
    actor: string;
    action: string;
    target: string | null;
    details: Record<string, unknown> | null;
    ip_address: string | null;
    created_at: string;
};

export type BackupEntry = {
    id: string;
    filename: string;
    size_bytes: number;
    size_human: string;
    type: 'manual' | 'scheduled' | 'daily' | 'pre_rollback' | 'pre_update';
    notes: string | null;
    created_at: string;
};

export type BackupSummary = {
    total_count: number;
    last_backup: BackupEntry | null;
    total_size_human: string;
};

export type DashboardData = {
    server: ServerStatus;
    recent_audit: AuditEntry[];
    backup_summary: BackupSummary;
};

export type StatusPageData = {
    server: ServerStatus;
    mods: ModEntry[];
    server_name: string;
};
