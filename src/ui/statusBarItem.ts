import * as vscode from 'vscode';
import { WorksnapsService } from '../service/worksnapsService';
import { WorksnapsApiClient, WorksnapsData } from '../api/worksnapsApiClient';
import { TrackerApiClient, TrackerHoursData } from '../api/trackerApiClient';

export class WorksnapsStatusBarItem implements vscode.Disposable {
    private statusBarItem: vscode.StatusBarItem;
    private service: WorksnapsService;

    constructor(service: WorksnapsService) {
        console.log('[Worksnaps] Creating StatusBarItem...');
        this.service = service;
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );

        this.statusBarItem.command = 'worksnaps.refreshData';

        this.service.setUpdateCallback(() => this.update());

        console.log('[Worksnaps] StatusBarItem created, showing...');
        this.update();
        this.statusBarItem.show();
        console.log('[Worksnaps] StatusBarItem shown successfully');
    }

    update(): void {
        try {
            console.log('[Worksnaps] Updating statusBarItem...');
            const config = this.getConfiguration();
            this.statusBarItem.tooltip = this.getTooltipText();

            if (!config.apiToken || !config.projectId) {
                console.log('[Worksnaps] API Token or Project ID not configured');
                this.statusBarItem.text = `${config.prefix} N/A`;
                this.statusBarItem.backgroundColor = undefined;
                this.statusBarItem.color = undefined;
                return;
            }

            const data = this.service.getData();
            console.log('[Worksnaps] Data from service:', data);

            if (data === null) {
                const isError = this.service.getLastError() !== null;
                const errorText = isError
                    ? `${config.prefix} $(warning) Error`
                    : `${config.prefix} Loading...`;

                console.log('[Worksnaps] No data, showing:', errorText);
                this.statusBarItem.text = errorText;

                if (isError) {
                    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                    this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
                } else {
                    this.statusBarItem.backgroundColor = undefined;
                    this.statusBarItem.color = undefined;
                }
                return;
            }

            this.buildOutput(data, config);
            console.log('[Worksnaps] StatusBarItem updated successfully');
        } catch (error) {
            console.error('[Worksnaps] Error updating statusBarItem:', error);
        }
    }

    private buildOutput(data: WorksnapsData, config: ReturnType<WorksnapsStatusBarItem['getConfiguration']>): void {
        let text = config.prefix;

        if (config.showTime) {
            text += ' ' + this.formatTime(data.hours);

            if (config.showRemaining) {
                text += ' ' + this.formatRemainingTime(data.hours, config.targetHours);
            }
        }

        if (config.showActivity) {
            text += ' | ' + this.formatActivityWithEmoji(data.activity);
        }

        if (config.showTrackerRemaining) {
            const trackerData = this.service.getTrackerData();
            if (trackerData !== null) {
                text += ' | ' + this.formatTrackerRemaining(trackerData);
            } else if (this.service.getTrackerLastError() !== null) {
                text += ' | T:$(warning)';
            } else if (config.redmineApiToken) {
                text += ' | T:...';
            }
        }

        if (this.service.isUsingCachedData()) {
            text += ' $(warning)';
        }

        this.statusBarItem.text = text;

        // Reset colors to default
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.color = undefined;
    }

    private formatTime(hours: number): string {
        const totalMinutes = Math.floor(hours * 60);
        const roundedMinutes = Math.round(totalMinutes / 10) * 10;

        const displayHours = Math.floor(roundedMinutes / 60);
        const displayMins = roundedMinutes % 60;

        return `${displayHours}:${displayMins.toString().padStart(2, '0')}`;
    }

    private formatRemainingTime(workedHours: number, targetHours: number): string {
        const targetMinutes = targetHours * 60;
        const workedMinutes = workedHours * 60;
        const roundedWorkedMinutes = Math.round(workedMinutes / 10) * 10;

        const remainingMinutes = targetMinutes - roundedWorkedMinutes;

        const roundedRemaining = remainingMinutes >= 0
            ? Math.round(remainingMinutes / 10) * 10
            : Math.round(remainingMinutes / 10) * 10;

        const absMinutes = Math.abs(roundedRemaining);
        const hours = Math.floor(absMinutes / 60);
        const mins = absMinutes % 60;

        // Add colored emoji based on remaining time
        const emoji = roundedRemaining < 0 ? '🟢' : '🔴';

        if (roundedRemaining < 0) {
            return `${emoji} (+${hours}:${mins.toString().padStart(2, '0')})`;
        } else {
            return `${emoji} (-${hours}:${mins.toString().padStart(2, '0')})`;
        }
    }

    /**
     * Format remaining time from Tracker API (worked vs required up to today)
     * Green for overtime, Red for remaining
     */
    private formatTrackerRemaining(trackerData: TrackerHoursData): string {
        // hoursOnNow — accumulated required hours up to today (in hours)
        // userMinutes — total worked minutes this month
        const requiredMinutes = trackerData.hoursOnNow * 60;
        const diff = trackerData.userMinutes - requiredMinutes; // positive = overtime, negative = undertime

        const absMinutes = Math.abs(diff);
        const hours = Math.floor(absMinutes / 60);
        const mins = absMinutes % 60;

        const emoji = diff >= 0 ? '🟢' : '🔴';
        const sign = diff >= 0 ? '+' : '-';

        return `T: ${emoji} (${sign}${hours}:${mins.toString().padStart(2, '0')})`;
    }

    private formatActivityWithEmoji(activity: number): string {
        const emoji = this.getActivityEmoji(activity);
        return `${emoji} ${activity}%`;
    }

    private getActivityEmoji(activity: number): string {
        if (activity >= 80) {
            return '🟢'; // Green circle - excellent
        } else if (activity >= 60) {
            return '🟡'; // Yellow circle - good
        } else {
            return '🔴'; // Red circle - needs improvement
        }
    }

    private getTooltipText(): string {
        const stats = `${WorksnapsApiClient.getStats()}\n${TrackerApiClient.getStats()}`;
        return `${this.getTooltipBaseText()}\n---\n${stats}`;
    }

    private getTooltipBaseText(): string {
        const error = this.service.getLastError();
        const trackerError = this.service.getTrackerLastError();
        const config = this.getConfiguration();

        if (error !== null) {
            return `Worksnaps Error: ${error}\nClick to retry`;
        }

        if (this.service.isUsingCachedData()) {
            return 'Worksnaps (using cached data)\nClick to refresh';
        }

        if (!config.apiToken || !config.projectId) {
            return 'Worksnaps: Not configured\nGo to Settings → Extensions → Worksnaps';
        }

        if (config.showTrackerRemaining && trackerError !== null) {
            return `Worksnaps Time Tracker\nTracker Error: ${trackerError}\nClick to refresh`;
        }

        return 'Worksnaps Time Tracker\nClick to refresh';
    }

    private getConfiguration() {
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
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }
}
