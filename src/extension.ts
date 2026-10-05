import * as vscode from 'vscode';
import { WorksnapsService } from './service/worksnapsService';
import { WorksnapsStatusBarItem } from './ui/statusBarItem';

let worksnapsService: WorksnapsService;
let statusBarItem: WorksnapsStatusBarItem;
let configChangeTimer: NodeJS.Timeout | null = null;

// Debounce settings changes so typing a token doesn't fire a request per keystroke
const CONFIG_CHANGE_DEBOUNCE_MS = 1000;

export function activate(context: vscode.ExtensionContext) {
    console.log('[Worksnaps] Extension is now active!');

    worksnapsService = new WorksnapsService();

    statusBarItem = new WorksnapsStatusBarItem(worksnapsService);

    const config = vscode.workspace.getConfiguration('worksnaps');
    const updateInterval = config.get<number>('updateInterval', 60);

    worksnapsService.refreshIfStale();

    worksnapsService.startAutoRefresh(updateInterval);

    // Background windows don't poll; catch up when the window gets focus
    const windowStateListener = vscode.window.onDidChangeWindowState((state) => {
        if (state.focused) {
            worksnapsService.refreshIfStale();
        }
    });

    const refreshCommand = vscode.commands.registerCommand('worksnaps.refreshData', async () => {
        console.log('[Worksnaps] Manual refresh triggered');
        await worksnapsService.refreshData();
        statusBarItem.update();
        vscode.window.showInformationMessage('Worksnaps data refreshed!');
    });

    const openSettingsCommand = vscode.commands.registerCommand('worksnaps.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'worksnaps');
    });

    const configChangeListener = vscode.workspace.onDidChangeConfiguration((e) => {
        if (!e.affectsConfiguration('worksnaps')) {
            return;
        }

        if (configChangeTimer) {
            clearTimeout(configChangeTimer);
        }

        configChangeTimer = setTimeout(() => {
            configChangeTimer = null;
            console.log('[Worksnaps] Configuration changed, updating...');

            worksnapsService.stopAutoRefresh();

            const newConfig = vscode.workspace.getConfiguration('worksnaps');
            const newUpdateInterval = newConfig.get<number>('updateInterval', 60);

            worksnapsService.startAutoRefresh(newUpdateInterval);

            // Settings change fires in every window: only the focused one refreshes now,
            // the rest pick up new settings when they get focus
            worksnapsService.invalidateCache();
            worksnapsService.refreshIfStale();
            statusBarItem.update();
        }, CONFIG_CHANGE_DEBOUNCE_MS);
    });

    context.subscriptions.push(refreshCommand);
    context.subscriptions.push(openSettingsCommand);
    context.subscriptions.push(statusBarItem);
    context.subscriptions.push(configChangeListener);
    context.subscriptions.push(windowStateListener);

    console.log('[Worksnaps] Extension activated successfully');
}

export function deactivate() {
    console.log('[Worksnaps] Extension is being deactivated');

    if (configChangeTimer) {
        clearTimeout(configChangeTimer);
        configChangeTimer = null;
    }

    if (worksnapsService) {
        worksnapsService.stopAutoRefresh();
    }

    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
