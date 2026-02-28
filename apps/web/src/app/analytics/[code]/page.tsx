"use client";

import { useState, useEffect, use } from "react";
import { getAnalytics, getUrl, AnalyticsData, UrlData, isAuthenticated } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AnalyticsPage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = use(params);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [urlData, setUrlData] = useState<UrlData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const router = useRouter();

    useEffect(() => {
        if (!isAuthenticated()) {
            router.push("/auth/login");
            return;
        }

        async function fetchData() {
            try {
                const [analyticsRes, urlRes] = await Promise.all([
                    getAnalytics(code),
                    getUrl(code),
                ]);

                if (analyticsRes.success && analyticsRes.data) {
                    setAnalytics(analyticsRes.data);
                } else {
                    setError("Failed to load analytics");
                }

                if (urlRes.success && urlRes.data) {
                    setUrlData(urlRes.data);
                }
            } catch {
                setError("Network error");
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [code, router]);

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function daysSinceCreation(): number {
        if (!analytics?.createdAt) return 1;
        const created = new Date(analytics.createdAt);
        const now = new Date();
        const diffMs = now.getTime() - created.getTime();
        return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    if (loading) {
        return (
            <div
                style={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-muted)",
                }}
            >
                Loading analytics...
            </div>
        );
    }

    if (error) {
        return (
            <div
                style={{
                    minHeight: "100vh",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 20,
                }}
            >
                <div style={{ fontSize: 48 }}>📊</div>
                <div style={{ color: "var(--error)", fontSize: 16 }}>{error}</div>
                <Link href="/dashboard">
                    <button className="btn-secondary" style={{ fontSize: 14 }}>
                        ← Back to Dashboard
                    </button>
                </Link>
            </div>
        );
    }

    const avgClicksPerDay = analytics
        ? (analytics.totalClicks / daysSinceCreation()).toFixed(1)
        : "0";

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
            {/* Top Nav */}
            <nav
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "16px 32px",
                    borderBottom: "1px solid var(--border-color)",
                }}
            >
                <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}>
                    <div
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: "var(--accent-gradient)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 16,
                            fontWeight: 800,
                        }}
                    >
                        S
                    </div>
                    <span style={{ fontSize: 20, fontWeight: 700 }}>
                        Shrink<span className="gradient-text">r</span>
                    </span>
                </Link>
                <Link href="/dashboard">
                    <button className="btn-secondary" style={{ fontSize: 13, padding: "8px 16px" }}>
                        ← Dashboard
                    </button>
                </Link>
            </nav>

            {/* Content */}
            <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
                {/* Header */}
                <div className="animate-fade-in-up" style={{ marginBottom: 32 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>ANALYTICS FOR</span>
                        {urlData?.isCustom && (
                            <span
                                style={{
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                    background: "rgba(0,184,148,0.12)",
                                    color: "var(--success)",
                                    fontSize: 10,
                                    fontWeight: 600,
                                }}
                            >
                                CUSTOM
                            </span>
                        )}
                    </div>
                    <h1 style={{ fontSize: 28, fontWeight: 700 }}>
                        <span className="gradient-text">/{code}</span>
                    </h1>
                    {urlData && (
                        <div
                            style={{
                                fontSize: 13,
                                color: "var(--text-muted)",
                                marginTop: 8,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                maxWidth: "100%",
                            }}
                        >
                            → {urlData.originalUrl}
                        </div>
                    )}
                </div>

                {/* Stats Grid */}
                <div
                    className="animate-fade-in-up animate-delay-100"
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: 16,
                        marginBottom: 32,
                    }}
                >
                    {/* Total Clicks */}
                    <div
                        className="glass-card"
                        style={{
                            padding: "28px 24px",
                            textAlign: "center",
                            position: "relative",
                            overflow: "hidden",
                        }}
                    >
                        <div
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                height: 3,
                                background: "var(--accent-gradient)",
                            }}
                        />
                        <div style={{ fontSize: 36, fontWeight: 800 }}>
                            <span className="gradient-text">{analytics?.totalClicks ?? 0}</span>
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
                            Total Clicks
                        </div>
                    </div>

                    {/* Avg Per Day */}
                    <div className="glass-card" style={{ padding: "28px 24px", textAlign: "center" }}>
                        <div style={{ fontSize: 36, fontWeight: 800, color: "var(--success)" }}>
                            {avgClicksPerDay}
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
                            Avg Clicks/Day
                        </div>
                    </div>

                    {/* Days Active */}
                    <div className="glass-card" style={{ padding: "28px 24px", textAlign: "center" }}>
                        <div style={{ fontSize: 36, fontWeight: 800, color: "var(--accent-secondary)" }}>
                            {daysSinceCreation()}
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
                            Days Active
                        </div>
                    </div>
                </div>

                {/* URL Details */}
                <div
                    className="glass-card animate-fade-in-up animate-delay-200"
                    style={{ padding: "24px 28px" }}
                >
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: "var(--text-secondary)" }}>
                        Link Details
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <DetailRow label="Short URL" value={urlData?.shortUrl || `http://localhost:3000/${code}`} isLink />
                        <DetailRow label="Original URL" value={urlData?.originalUrl || "-"} isLink />
                        <DetailRow label="Created" value={analytics?.createdAt ? formatDate(analytics.createdAt) : "-"} />
                        <DetailRow
                            label="Status"
                            value={urlData?.isActive ? "Active" : "Inactive"}
                            statusColor={urlData?.isActive ? "var(--success)" : "var(--error)"}
                        />
                        <DetailRow label="Expiry" value={urlData?.expiresAt ? formatDate(urlData.expiresAt) : "Never"} />
                    </div>
                </div>

                {/* Placeholder for future charts */}
                <div
                    className="glass-card animate-fade-in-up animate-delay-300"
                    style={{
                        padding: "48px 24px",
                        textAlign: "center",
                        marginTop: 20,
                    }}
                >
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
                    <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                        Detailed Analytics Coming Soon
                    </h3>
                    <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 400, margin: "0 auto" }}>
                        Click-by-day charts, referrer breakdown, device analytics, and
                        geographic distribution — powered by ClickHouse.
                    </p>
                </div>
            </main>
        </div>
    );
}

function DetailRow({
    label,
    value,
    isLink,
    statusColor,
}: {
    label: string;
    value: string;
    isLink?: boolean;
    statusColor?: string;
}) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{label}</span>
            {statusColor ? (
                <span
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 14,
                        color: statusColor,
                        fontWeight: 500,
                    }}
                >
                    <span
                        style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: statusColor,
                        }}
                    />
                    {value}
                </span>
            ) : isLink ? (
                <a
                    href={value}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        fontSize: 14,
                        color: "var(--accent-secondary)",
                        textDecoration: "none",
                        maxWidth: 400,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {value}
                </a>
            ) : (
                <span style={{ fontSize: 14 }}>{value}</span>
            )}
        </div>
    );
}
