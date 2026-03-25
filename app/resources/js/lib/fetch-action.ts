import { toast } from 'sonner';

/**
 * Fetch a fresh CSRF token by hitting the Sanctum CSRF cookie endpoint,
 * then reading the updated meta tag or XSRF cookie.
 */
async function refreshCsrfToken(): Promise<string | null> {
    try {
        await fetch('/sanctum/csrf-cookie', { credentials: 'same-origin' });
        // Laravel refreshes the XSRF-TOKEN cookie — read it
        const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
        if (match) {
            const token = decodeURIComponent(match[1]);
            // Update the meta tag so future calls use the fresh token
            const meta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
            if (meta) meta.content = token;
            return token;
        }
    } catch {
        // Fall through
    }
    return null;
}

type FetchActionOptions = {
    method?: string;
    data?: Record<string, unknown>;
    successMessage?: string;
};

/**
 * Wrapper around fetch for admin actions with automatic toast feedback.
 * Parses JSON response and shows success/error toasts.
 * Returns the parsed JSON data on success, or null on failure.
 */
export async function fetchAction(
    url: string,
    options: FetchActionOptions = {},
): Promise<Record<string, unknown> | null> {
    const { method = 'POST', data, successMessage } = options;
    const csrfToken =
        document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';

    // Laravel method spoofing: send PUT/PATCH/DELETE as POST with _method in body
    const spoofed = ['PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
    const actualMethod = spoofed ? 'POST' : method;

    const body = data
        ? JSON.stringify(spoofed ? { ...data, _method: method } : data)
        : spoofed
            ? JSON.stringify({ _method: method })
            : undefined;

    const headers: Record<string, string> = { 'X-CSRF-TOKEN': csrfToken, 'Accept': 'application/json' };
    if (spoofed) {
        headers['X-HTTP-Method-Override'] = method.toUpperCase();
    }
    if (body) {
        headers['Content-Type'] = 'application/json';
    }

    try {
        let res = await fetch(url, {
            method: actualMethod,
            headers,
            body,
        });

        // Handle expired CSRF token — refresh and retry once
        if (res.status === 419) {
            const freshToken = await refreshCsrfToken();
            if (freshToken) {
                headers['X-CSRF-TOKEN'] = freshToken;
                res = await fetch(url, {
                    method: actualMethod,
                    headers,
                    body,
                });
            }
        }

        const json = await res.json().catch(() => ({}));

        if (res.ok) {
            toast.success(
                successMessage || json.message || 'Action completed',
            );
            return json;
        }

        toast.error(json.error || json.message || `Request failed (${res.status})`);
        return null;
    } catch {
        toast.error('Network error — could not reach the server');
        return null;
    }
}
