export type OnlinePlayer = {
    username: string;
    zombie_kills?: number | null;
    hours_survived?: number | null;
    profession?: string | null;
};

export type ServerStatus = {
    online: boolean;
    status: 'offline' | 'starting' | 'online';
    container_status?: string;
    player_count: number;
    players: OnlinePlayer[];
    uptime: string | null;
    map: string | null;
    max_players: number | null;
    game_version: string | null;
    steam_branch: string | null;
};

export type WelcomeServerStatus = {
    online: boolean;
    status: 'offline' | 'starting' | 'online';
    player_count: number;
    players: string[];
    map: string | null;
};

export type ServerStats = {
    total_players: number;
    total_zombie_kills: number;
    total_hours_survived: number;
    total_deaths: number;
    total_pvp_kills: number;
    most_popular_profession: string | null;
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
    game_version: string | null;
    steam_branch: string | null;
    notes: string | null;
    created_at: string;
};

export type BackupSummary = {
    total_count: number;
    last_backup: BackupEntry | null;
    total_size_human: string;
};

export type GameState = {
    time: {
        year: number;
        month: number;
        day: number;
        hour: number;
        minute: number;
        day_of_year: number;
        is_night: boolean;
        formatted: string;
        date: string;
    };
    season: 'spring' | 'summer' | 'autumn' | 'winter';
    weather: {
        temperature: number;
        rain_intensity: number;
        fog_intensity: number;
        wind_intensity: number;
        snow_intensity: number;
        is_raining: boolean;
        is_foggy: boolean;
        is_snowing: boolean;
        condition: 'clear' | 'rain' | 'heavy_rain' | 'fog' | 'snow' | 'night';
    } | null;
    exported_at: string;
};

export type PlayerStatEntry = {
    username: string;
    zombie_kills: number;
    hours_survived: number;
    profession: string | null;
};

export type Leaderboard = {
    kills: PlayerStatEntry[];
    survival: PlayerStatEntry[];
    deaths: DeathLeaderboardEntry[];
};

export type GameEventEntry = {
    id: number;
    event_type: 'death' | 'pvp_hit' | 'pvp_kill' | 'craft' | 'connect' | 'disconnect';
    player: string;
    target: string | null;
    details: Record<string, unknown> | null;
    x: number | null;
    y: number | null;
    game_time: string | null;
    created_at: string;
};

export type AutoRestartInfo = {
    enabled: boolean;
    next_restart_at: string | null;
    schedule: string[];
    timezone: string;
};

export type ConnectionInfo = {
    server_ip: string;
    server_port: string;
};

export type DashboardData = {
    server: ServerStatus;
    auto_restart: AutoRestartInfo;
    game_state: GameState | null;
    recent_audit: AuditEntry[];
    backup_summary: BackupSummary;
    leaderboard: Leaderboard;
    game_events: GameEventEntry[];
    server_totals: ServerStats;
    connection: ConnectionInfo;
};

export type LeaderboardEntry = {
    rank: number;
    username: string;
    zombie_kills: number;
    hours_survived: number;
    profession: string | null;
    is_dead: boolean;
};

export type DeathLeaderboardEntry = {
    rank: number;
    username: string;
    death_count: number;
};

export type PlayerProfile = {
    username: string;
    zombie_kills: number;
    hours_survived: number;
    profession: string | null;
    skills: Record<string, number> | null;
    is_dead: boolean;
    ranks: {
        kills: number;
        survival: number;
        deaths: number;
    };
    event_counts: {
        death: number;
        pvp_hit: number;
        craft: number;
        connect: number;
    };
    recent_events: GameEventEntry[];
};

export type RatioLeaderboardEntry = {
    rank: number;
    username: string;
    ratio: number;
    numerator: number;
    death_count: number;
};

export type RankingsPageData = {
    server_stats: ServerStats;
    leaderboard_kills: LeaderboardEntry[];
    leaderboard_survival: LeaderboardEntry[];
    leaderboard_deaths: DeathLeaderboardEntry[];
    leaderboard_kd: RatioLeaderboardEntry[];
    leaderboard_hd: RatioLeaderboardEntry[];
    leaderboard_pvpd: RatioLeaderboardEntry[];
    server_name: string;
};

export type PlayerProfilePageData = {
    player: PlayerProfile;
    recent_events: GameEventEntry[];
};

export type WelcomePageData = {
    canRegister: boolean;
    server: WelcomeServerStatus;
    server_stats: ServerStats;
    top_players: PlayerStatEntry[];
    server_name: string;
    connection: { ip: string; port: string };
};

export type StatusServerStatus = {
    online: boolean;
    status: 'offline' | 'starting' | 'online';
    player_count: number;
    players: string[];
    uptime: string | null;
    map: string | null;
    max_players: number | null;
};

export type StatusPageData = {
    server: StatusServerStatus;
    game_state: GameState | null;
    mods: ModEntry[];
    server_name: string;
};

export type PlayerMarker = {
    username: string;
    name: string;
    x: number;
    y: number;
    z: number;
    status: 'online' | 'offline' | 'dead';
    is_online: boolean;
};

export type DziInfo = {
    width: number;
    height: number;
    x0: number;
    y0: number;
    sqr: number;
    maxNativeZoom: number;
    isometric: boolean;
};

export type MapConfig = {
    tileUrl: string | null;
    tileSize: number;
    minZoom: number;
    maxZoom: number;
    defaultZoom: number;
    center: { x: number; y: number };
    dzi: DziInfo | null;
};

export type InventoryItem = {
    full_type: string;
    name: string;
    category: string;
    count: number;
    condition: number | null;
    equipped: boolean;
    container: string;
    icon: string;
};

export type InventorySnapshot = {
    username: string;
    timestamp: string;
    items: InventoryItem[];
    weight: number;
    max_weight: number;
};

export type ItemCatalogEntry = {
    full_type: string;
    name: string;
    category: string;
    icon_name: string;
    icon: string;
};

export type DeliveryEntry = {
    id: string;
    action: 'give' | 'remove';
    username: string;
    item_type: string;
    count: number;
    status: string;
    created_at: string;
};

export type DeliveryResult = {
    id: string;
    status: 'delivered' | 'failed' | 'partial';
    processed_at: string;
    message: string | null;
};
