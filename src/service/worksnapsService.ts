import * as vscode from 'vscode';
import { WorksnapsApiClient, WorksnapsData } from '../api/worksnapsApiClient';
import { TrackerApiClient, TrackerHoursData } from '../api/trackerApiClient';

export class WorksnapsService {
    private cachedData: WorksnapsData | null = null;
    private cacheTimestamp: number = 0;
    private lastError: string | null = null;
    private isRefreshing: boolean = false;
    private refreshTimer: NodeJS.Timeout | null = null;

    // User ID resolved via /me.xml, reused to avoid an extra request on every refresh
    private resolvedUserId: string | null = null;
    private resolvedUserIdToken: string | null = null;

    private cachedTrackerData: TrackerHoursData | null = null;
    private trackerCacheTimestamp: number = 0;
    private trackerLastError: string | null = null;
    private isTrackerRefreshing: boolean = false;

    private updateCallback: (() => void) | null = null;

    private static readonly CACHE_TTL_SECONDS = 60;

    constructor() {}

    setUpdateCallback(callback: () => void): void {
        this.updateCallback = callback;
    }

    getData(): WorksnapsData | null {
        if (this.isCacheValid()) {
            return this.cachedData;
        }

        if (!this.isRefreshing && this.isWindowFocused()) {
            this.refreshData();
        }

        return this.cachedData;
    }

    getTrackerData(): TrackerHoursData | null {
        const config = this.getConfiguration();

        if (!this.isTrackerConfigured(config)) {
            return null;
        }

        if (this.isTrackerCacheValid()) {
            return this.cachedTrackerData;
        }

        if (!this.isTrackerRefreshing && this.isWindowFocused()) {
            this.refreshTrackerData();
        }

        return this.cachedTrackerData;
    }

    getTrackerLastError(): string | null {
        return this.trackerLastError;
    }

    getLastError(): string | null {
        return this.lastError;
    }

    isUsingCachedData(): boolean {
        return this.lastError !== null && this.cachedData !== null;
    }

    async refreshData(): Promise<void> {
        const config = this.getConfiguration();

        console.log('[Worksnaps] Refresh data requested');

        if (this.isRefreshing) {
            console.log('[Worksnaps] Refresh already in progress, skipping');
            return;
        }

        if (!config.apiToken || !config.projectId) {
            console.warn('[Worksnaps] Refresh aborted: API token or project ID is empty');
            this.lastError = 'API Token or Project ID not configured';
            return;
        }

        console.log(`[Worksnaps] Starting refresh with token: ${config.apiToken.substring(0, 10)}..., projectId: ${config.projectId}`);
        this.isRefreshing = true;
        this.lastError = null;

        try {
            const cachedUserId = this.resolvedUserIdToken === config.apiToken ? this.resolvedUserId : null;
            const client = new WorksnapsApiClient(
                config.apiToken,
                config.projectId,
                config.userId || cachedUserId || undefined
            );

            console.log('[Worksnaps] Calling API client...');
            const data = await client.getTodayTimeEntries();

            if (data !== null && !config.userId) {
                // Already resolved by getTodayTimeEntries, no extra request
                this.resolvedUserId = await client.getUserId();
                this.resolvedUserIdToken = config.apiToken;
            }

            if (data !== null) {
                console.log(`[Worksnaps] Data received successfully: hours=${data.hours}, activity=${data.activity}`);
                this.cachedData = data;
                this.lastError = null;
            } else {
                console.error('[Worksnaps] API returned null data');
                this.lastError = 'Failed to fetch data from API';
            }
        } catch (error) {
            this.lastError = error instanceof Error ? error.message : 'Unknown error';
            console.error('[Worksnaps] Exception during refresh:', error);
        } finally {
            // Always update timestamp to prevent retry loop on errors
            this.cacheTimestamp = Math.floor(Date.now() / 1000);
            this.isRefreshing = false;
            console.log(`[Worksnaps] Refresh completed. Error: ${this.lastError}`);

            // Refresh tracker data independently of Worksnaps result
            if (this.isTrackerConfigured(config)) {
                this.refreshTrackerData();
            }

            if (this.updateCallback) {
                this.updateCallback();
            }
        }
    }

    async refreshTrackerData(): Promise<void> {
        const config = this.getConfiguration();

        if (!config.redmineApiToken || !config.trackerEndpointUrl) {
            this.trackerLastError = 'Redmine API key or Tracker endpoint URL not configured';
            return;
        }

        if (this.isTrackerRefreshing) {
            console.log('[Worksnaps] Tracker refresh already in progress, skipping');
            return;
        }

        console.log('[Worksnaps] Starting tracker data refresh...');
        this.isTrackerRefreshing = true;
        this.trackerLastError = null;

        try {
            const client = new TrackerApiClient(config.redmineApiToken, config.trackerEndpointUrl);
            const data = await client.getMyHours();

            if (data !== null) {
                console.log(`[Worksnaps] Tracker data received: userMinutes=${data.userMinutes}`);
                this.cachedTrackerData = data;
                this.trackerLastError = null;
            } else {
                console.error('[Worksnaps] Tracker API returned null data');
                this.trackerLastError = 'Failed to fetch data from Tracker API';
            }
        } catch (error) {
            this.trackerLastError = error instanceof Error ? error.message : 'Unknown error';
            console.error('[Worksnaps] Exception during tracker refresh:', error);
        } finally {
            // Always update timestamp to prevent retry loop on errors
            this.trackerCacheTimestamp = Math.floor(Date.now() / 1000);
            this.isTrackerRefreshing = false;

            if (this.updateCallback) {
                this.updateCallback();
            }
        }
    }

    startAutoRefresh(intervalSeconds: number = 60): void {
        console.log(`[Worksnaps] startAutoRefresh called with interval: ${intervalSeconds} seconds`);
        this.stopAutoRefresh();

        console.log('[Worksnaps] Setting up auto-refresh timer...');
        this.refreshTimer = setInterval(() => {
            // Only the focused window polls, so N open windows don't make N requests
            if (!this.isWindowFocused()) {
                console.log('[Worksnaps] Auto-refresh cycle: window not focused, skipping');
                return;
            }

            console.log('[Worksnaps] Auto-refresh cycle: triggering refresh now');
            this.refreshData();
        }, intervalSeconds * 1000);

        console.log('[Worksnaps] Auto-refresh timer started');
    }

    stopAutoRefresh(): void {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
            console.log('[Worksnaps] Auto-refresh stopped');
        }
    }

    /**
     * Refresh data only if the cache has expired and this window is focused.
     * Used on startup and when the window regains focus.
     */
    refreshIfStale(): void {
        if (!this.isWindowFocused()) {
            return;
        }

        if (!this.isCacheValid()) {
            // Also refreshes tracker data when done
            this.refreshData();
        } else if (this.isTrackerConfigured(this.getConfiguration()) && !this.isTrackerCacheValid()) {
            this.refreshTrackerData();
        }
    }

    /**
     * Mark cached data as expired but keep showing it until the next refresh
     */
    invalidateCache(): void {
        this.cacheTimestamp = 0;
        this.trackerCacheTimestamp = 0;
    }

    clearCache(): void {
        this.cachedData = null;
        this.cacheTimestamp = 0;
        this.lastError = null;
        this.cachedTrackerData = null;
        this.trackerCacheTimestamp = 0;
        this.trackerLastError = null;
    }

    private isWindowFocused(): boolean {
        return vscode.window.state.focused;
    }

    private isTrackerConfigured(config: ReturnType<WorksnapsService['getConfiguration']>): boolean {
        return config.showTrackerRemaining && !!config.redmineApiToken && !!config.trackerEndpointUrl;
    }

    private isCacheValid(): boolean {
        if (this.cacheTimestamp === 0) {
            return false;
        }

        const now = Math.floor(Date.now() / 1000);
        const age = now - this.cacheTimestamp;

        return age < WorksnapsService.CACHE_TTL_SECONDS;
    }

    /**
     * Check if tracker cache is still valid (includes error cooldown)
     */
    private isTrackerCacheValid(): boolean {
        if (this.trackerCacheTimestamp === 0) {
            return false;
        }

        const now = Math.floor(Date.now() / 1000);
        const age = now - this.trackerCacheTimestamp;

        return age < WorksnapsService.CACHE_TTL_SECONDS;
    }

    private getConfiguration() {
        try {
            const config = vscode.workspace.getConfiguration('worksnaps');

            return {
                apiToken: config.get<string>('apiToken', ''),
                projectId: config.get<string>('projectId', ''),
                userId: config.get<string>('userId', ''),
                updateInterval: config.get<number>('updateInterval', 60),
                targetHours: config.get<number>('targetHours', 8),
                showTime: config.get<boolean>('showTime', true),
                showActivity: config.get<boolean>('showActivity', true),
                showRemaining: config.get<boolean>('showRemaining', true),
                prefix: config.get<string>('prefix', 'WS:'),
                redmineApiToken: config.get<string>('redmineApiToken', ''),
                trackerEndpointUrl: config.get<string>('trackerEndpointUrl', ''),
                showTrackerRemaining: config.get<boolean>('showTrackerRemaining', false)
            };
        } catch (error) {
            console.error('[Worksnaps] Failed to get configuration:', error);
            return {
                apiToken: '',
                projectId: '',
                userId: '',
                updateInterval: 60,
                targetHours: 8,
                showTime: true,
                showActivity: true,
                showRemaining: true,
                prefix: 'WS:',
                redmineApiToken: '',
                trackerEndpointUrl: '',
                showTrackerRemaining: false
            };
        }
    }
}
