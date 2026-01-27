import * as vscode from 'vscode';
import { WorksnapsService } from './service/worksnapsService';
import { WorksnapsStatusBarItem } from './ui/statusBarItem';

let worksnapsService: WorksnapsService;
let statusBarItem: WorksnapsStatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    console.log('[Worksnaps] Extension is now active!');

    worksnapsService = new WorksnapsService();

    statusBarItem = new WorksnapsStatusBarItem(worksnapsService);

    const config = vscode.workspace.getConfiguration('worksnaps');
    const updateInterval = config.get<number>('updateInterval', 60);

    worksnapsService.refreshData();

    worksnapsService.startAutoRefresh(updateInterval);

    const refreshCommand = vscode.commands.registerCommand('worksnaps.refreshData', async () => {
        console.log('[Worksnaps] Manual refresh triggered');
        await worksnapsService.refreshData();
        statusBarItem.update();
        vscode.window.showInformationMessage('Worksnaps data refreshed!');
    });

    const openSettingsCommand = vscode.commands.registerCommand('worksnaps.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'worksnaps');
    });

    vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('worksnaps')) {
            console.log('[Worksnaps] Configuration changed, updating...');

            worksnapsService.stopAutoRefresh();

            const newConfig = vscode.workspace.getConfiguration('worksnaps');
            const newUpdateInterval = newConfig.get<number>('updateInterval', 60);

            worksnapsService.startAutoRefresh(newUpdateInterval);

            worksnapsService.refreshData();
            statusBarItem.update();
        }
    });

    context.subscriptions.push(refreshCommand);
    context.subscriptions.push(openSettingsCommand);
    context.subscriptions.push(statusBarItem);

    console.log('[Worksnaps] Extension activated successfully');
}

export function deactivate() {
    console.log('[Worksnaps] Extension is being deactivated');

    if (worksnapsService) {
        worksnapsService.stopAutoRefresh();
    }

    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
