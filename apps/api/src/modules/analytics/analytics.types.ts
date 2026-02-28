/** Click analytics types */

export interface ClickEventData {
    shortCode: string;
    ipAddress: string;
    userAgent: string;
    referrer: string;
    clickedAt: string;
}

export interface AnalyticsSummary {
    totalClicks: number;
    last24Hours: number;
    last7Days: number;
    last30Days: number;
    topReferrers: Array<{ referrer: string; count: number }>;
    clicksByDay: Array<{ date: string; count: number }>;
}
