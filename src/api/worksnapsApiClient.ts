import * as https from 'https';

export interface WorksnapsData {
    hours: number;
    activity: number;
}

export class WorksnapsApiClient {
    private readonly apiBaseUrl = 'https://api.worksnaps.com/api';
    private readonly timeout = 30000; // Increased to 30 seconds
    private userId: string | null;
    private readonly authHeader: string;

    constructor(
        private readonly apiToken: string,
        private readonly projectId: string,
        userId?: string
    ) {
        this.userId = userId || null;
        const credentials = Buffer.from(`${this.apiToken}:`).toString('base64');
        this.authHeader = `Basic ${credentials}`;
    }

    private async makeRequest(path: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const url = `${this.apiBaseUrl}${path}`;

            const options: https.RequestOptions = {
                method: 'GET',
                headers: {
                    'Authorization': this.authHeader
                },
                timeout: this.timeout
            };

            const req = https.get(url, options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(data);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    async getUserId(): Promise<string | null> {
        if (this.userId) {
            console.log(`[Worksnaps] Using cached user ID: ${this.userId}`);
            return this.userId;
        }

        try {
            console.log('[Worksnaps] Fetching user ID from API...');
            const data = await this.makeRequest('/me.xml');

            const idRegex = /<id>(\d+)<\/id>/;
            const match = data.match(idRegex);

            if (match) {
                this.userId = match[1];
                console.log(`[Worksnaps] User ID extracted: ${this.userId}`);
                return this.userId;
            }

            console.error('[Worksnaps] Failed to extract user ID from response');
            return null;
        } catch (error) {
            console.error('[Worksnaps] Exception while getting user ID:', error);
            return null;
        }
    }

    async getTodayTimeEntries(): Promise<WorksnapsData | null> {
        try {
            console.log('[Worksnaps] Getting today\'s time entries...');

            const currentUserId = await this.getUserId();
            if (!currentUserId) {
                console.error('[Worksnaps] Cannot get time entries: User ID is null');
                return null;
            }

            const todayStart = this.getTodayStartTimestamp();
            const now = Math.floor(Date.now() / 1000);

            const path = `/projects/${this.projectId}/time_entries.xml?from_timestamp=${todayStart}&to_timestamp=${now}&user_ids=${currentUserId}`;

            console.log(`[Worksnaps] Requesting time entries: ${path}`);
            const xmlData = await this.makeRequest(path);

            console.log(`[Worksnaps] Time entries response received (${xmlData.length} chars)`);

            const data = this.parseTimeEntries(xmlData);
            console.log(`[Worksnaps] Parsed data: hours=${data.hours}, activity=${data.activity}`);

            return data;
        } catch (error) {
            console.error('[Worksnaps] Exception while getting time entries:', error);
            return null;
        }
    }

    private getTodayStartTimestamp(): number {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        return Math.floor(today.getTime() / 1000);
    }

    private parseTimeEntries(xmlData: string): WorksnapsData {
        if (xmlData.includes('<error>')) {
            return { hours: 0, activity: 0 };
        }

        if (!xmlData.includes('<time_entry>')) {
            return { hours: 0, activity: 0 };
        }

        const durationRegex = /<duration_in_minutes>(\d+)<\/duration_in_minutes>/g;
        const durations: number[] = [];
        let match;

        while ((match = durationRegex.exec(xmlData)) !== null) {
            durations.push(parseInt(match[1]));
        }

        const totalMinutes = durations.reduce((sum, duration) => sum + duration, 0);

        const activityRegex = /<activity_level>(\d+)<\/activity_level>/g;
        const activities: number[] = [];

        while ((match = activityRegex.exec(xmlData)) !== null) {
            activities.push(parseInt(match[1]) * 10);
        }

        const avgActivity = activities.length > 0
            ? Math.trunc(activities.reduce((sum, activity) => sum + activity, 0) / activities.length)
            : 0;

        const hours = totalMinutes / 60;

        return { hours, activity: avgActivity };
    }
}
