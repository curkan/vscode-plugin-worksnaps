import * as http from 'http';
import * as https from 'https';

export interface TrackerHoursData {
    /** Required hours for the month */
    monthHours: number;
    /** Hours worked so far in the month */
    monthHoursUser: number;
    /** Accumulated required hours up to today */
    hoursOnNow: number;
    /** Total worked minutes this month */
    userMinutes: number;
}

/**
 * Client for interacting with Tracker (Redmine) API to fetch hours data
 */
export class TrackerApiClient {
    private readonly timeout = 30000;

    private static totalRequests = 0;
    private static requestsToday = 0;
    private static lastResetDay = -1;

    constructor(
        private readonly apiKey: string,
        private readonly endpointUrl: string
    ) {}

    static getStats(): string {
        return `TrackerAPI: total=${TrackerApiClient.totalRequests}, today=${TrackerApiClient.requestsToday}`;
    }

    private static trackRequest(): void {
        const today = new Date().getDate();
        if (today !== TrackerApiClient.lastResetDay) {
            TrackerApiClient.requestsToday = 0;
            TrackerApiClient.lastResetDay = today;
        }
        TrackerApiClient.totalRequests++;
        TrackerApiClient.requestsToday++;
        console.log(`[Worksnaps] TrackerAPI request #${TrackerApiClient.requestsToday} today (#${TrackerApiClient.totalRequests} total)`);
    }

    private async makeRequest(): Promise<string> {
        return new Promise((resolve, reject) => {
            const url = new URL(this.endpointUrl);
            const transport = url.protocol === 'http:' ? http : https;

            const options: https.RequestOptions = {
                method: 'GET',
                headers: {
                    'X-Redmine-API-Key': this.apiKey,
                    'Content-Type': 'application/json'
                },
                timeout: this.timeout
            };

            const req = transport.get(url, options, (res) => {
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

    /**
     * Fetch hours data from tracker API
     */
    async getMyHours(): Promise<TrackerHoursData | null> {
        try {
            TrackerApiClient.trackRequest();
            console.log(`[Worksnaps] Requesting tracker hours: ${this.endpointUrl}`);
            const response = await this.makeRequest();

            const json = JSON.parse(response);
            const data: TrackerHoursData = {
                monthHours: Number(json.month_hours) || 0,
                monthHoursUser: Number(json.month_hours_user) || 0,
                hoursOnNow: Number(json.hours_on_now) || 0,
                userMinutes: Number(json.user_minutes) || 0
            };

            console.log(`[Worksnaps] Parsed tracker data: userMinutes=${data.userMinutes}, hoursOnNow=${data.hoursOnNow}`);
            return data;
        } catch (error) {
            console.error('[Worksnaps] Exception while fetching tracker hours:', error);
            return null;
        }
    }
}
