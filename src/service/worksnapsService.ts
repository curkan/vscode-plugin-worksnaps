import * as vscode from 'vscode';
import { WorksnapsApiClient, WorksnapsData } from '../api/worksnapsApiClient';

export class WorksnapsService {
    private cachedData: WorksnapsData | null = null;
    private cacheTimestamp: number = 0;
    private lastError: string | null = null;
    private isRefreshing: boolean = false;
    private refreshTimer: NodeJS.Timeout | null = null;
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

        if (!this.isRefreshing) {
            this.refreshData();
        }

        return this.cachedData;
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

        if (!config.apiToken || !config.projectId) {
            console.warn('[Worksnaps] Refresh aborted: API token or project ID is empty');
            this.lastError = 'API Token or Project ID not configured';
            return;
        }

        console.log(`[Worksnaps] Starting refresh with token: ${config.apiToken.substring(0, 10)}..., projectId: ${config.projectId}`);
        this.isRefreshing = true;
        this.lastError = null;

        try {
            const client = new WorksnapsApiClient(
                config.apiToken,
                config.projectId,
                config.userId || undefined
            );

            console.log('[Worksnaps] Calling API client...');
            const data = await client.getTodayTimeEntries();

            if (data !== null) {
                console.log(`[Worksnaps] Data received successfully: hours=${data.hours}, activity=${data.activity}`);
                this.cachedData = data;
                this.cacheTimestamp = Math.floor(Date.now() / 1000);
                this.lastError = null;
            } else {
                console.error('[Worksnaps] API returned null data');
                this.lastError = 'Failed to fetch data from API';
            }
        } catch (error) {
            this.lastError = error instanceof Error ? error.message : 'Unknown error';
            console.error('[Worksnaps] Exception during refresh:', error);
        } finally {
            this.isRefreshing = false;
            console.log(`[Worksnaps] Refresh completed. Error: ${this.lastError}`);

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

    clearCache(): void {
        this.cachedData = null;
        this.cacheTimestamp = 0;
        this.lastError = null;
    }

    private isCacheValid(): boolean {
        if (this.cachedData === null) {
            return false;
        }

        const now = Math.floor(Date.now() / 1000);
        const age = now - this.cacheTimestamp;

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
                prefix: config.get<string>('prefix', 'WS:')
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
                prefix: 'WS:'
            };
        }
    }
}
