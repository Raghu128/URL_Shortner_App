"use client";

import { useState, useEffect, useCallback } from "react";
import { listUrls, createShortUrl, deleteUrl, UrlData, getUser, isAuthenticated, logout } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
    const [urls, setUrls] = useState<UrlData[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Create form
    const [newUrl, setNewUrl] = useState("");
    const [customAlias, setCustomAlias] = useState("");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState("");
    const [showCreate, setShowCreate] = useState(false);

    // UI state
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [user, setUser] = useState<{ email: string; name: string | null; tier: string } | null>(null);

    const router = useRouter();

    const fetchUrls = useCallback(async () => {
        setLoading(true);
        try {
            const res = await listUrls(page, 10);
            if (res.success && res.data) {
                setUrls(res.data);
                if (res.meta?.pagination) {
                    setTotal(res.meta.pagination.total);
                    setTotalPages(res.meta.pagination.totalPages);
                }
            }
        } catch {
            // If unauthorized, redirect to login
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        if (!isAuthenticated()) {
            router.push("/auth/login");
            return;
        }
        setUser(getUser());
        fetchUrls();
    }, [router, fetchUrls]);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setCreateError("");
        setCreating(true);

        try {
            const res = await createShortUrl(newUrl, customAlias || undefined);
            if (res.success) {
                setNewUrl("");
                setCustomAlias("");
                setShowCreate(false);
                fetchUrls();
            } else {
                setCreateError(res.error?.message || "Failed to create URL");
            }
        } catch {
            setCreateError("Network error");
        } finally {
            setCreating(false);
        }
    }

    async function handleDelete(code: string) {
        if (!confirm("Are you sure you want to delete this URL?")) return;
        try {
            await deleteUrl(code);
            fetchUrls();
        } catch {
            // silently fail
        }
    }

    async function handleCopy(shortUrl: string, shortCode: string) {
        await navigator.clipboard.writeText(shortUrl);
        setCopiedCode(shortCode);
        setTimeout(() => setCopiedCode(null), 2000);
    }

    function handleLogout() {
        logout();
        router.push("/");
    }

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    }

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

                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                    {user && (
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: "50%",
                                    background: "var(--accent-gradient)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 14,
                                    fontWeight: 600,
                                }}
                            >
                                {(user.name || user.email).charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                                {user.name || user.email}
                            </span>
                            <span
                                style={{
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                    background: "rgba(108,92,231,0.15)",
                                    color: "var(--accent-secondary)",
                                    fontSize: 11,
                                    fontWeight: 600,
                                    textTransform: "uppercase",
                                }}
                            >
                                {user.tier}
                            </span>
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        style={{
                            background: "none",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            fontSize: 13,
                        }}
                    >
                        Sign out
                    </button>
                </div>
            </nav>

            {/* Main Content */}
            <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                    <div>
                        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Your Links</h1>
                        <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>
                            {total} total link{total !== 1 ? "s" : ""}
                        </p>
                    </div>
                    <button
                        className="btn-primary"
                        onClick={() => setShowCreate(!showCreate)}
                        style={{ fontSize: 14 }}
                    >
                        + New Link
                    </button>
                </div>

                {/* Create Form */}
                {showCreate && (
                    <form
                        onSubmit={handleCreate}
                        className="glass-card animate-fade-in-up"
                        style={{ padding: 24, marginBottom: 24 }}
                    >
                        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                            <input
                                type="url"
                                className="input-field"
                                placeholder="https://example.com/your-long-url"
                                value={newUrl}
                                onChange={(e) => setNewUrl(e.target.value)}
                                required
                                style={{ flex: 1 }}
                            />
                            <input
                                type="text"
                                className="input-field"
                                placeholder="Custom alias (optional)"
                                value={customAlias}
                                onChange={(e) => setCustomAlias(e.target.value)}
                                style={{ width: 200 }}
                                pattern="^[a-zA-Z0-9_-]+$"
                                minLength={3}
                                maxLength={20}
                            />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            {createError && (
                                <span style={{ color: "var(--error)", fontSize: 13 }}>{createError}</span>
                            )}
                            <div style={{ flex: 1 }} />
                            <button type="submit" className="btn-primary" disabled={creating} style={{ fontSize: 14 }}>
                                {creating ? "Creating..." : "Create →"}
                            </button>
                        </div>
                    </form>
                )}

                {/* URL List */}
                {loading ? (
                    <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
                        Loading your links...
                    </div>
                ) : urls.length === 0 ? (
                    <div
                        className="glass-card"
                        style={{
                            textAlign: "center",
                            padding: 60,
                        }}
                    >
                        <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
                        <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>No links yet</h3>
                        <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 20 }}>
                            Create your first short URL to get started.
                        </p>
                        <button className="btn-primary" onClick={() => setShowCreate(true)} style={{ fontSize: 14 }}>
                            + Create Your First Link
                        </button>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {urls.map((u) => (
                            <div
                                key={u.shortCode}
                                className="glass-card"
                                style={{
                                    padding: "20px 24px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 20,
                                }}
                            >
                                {/* Icon */}
                                <div
                                    style={{
                                        width: 42,
                                        height: 42,
                                        borderRadius: 10,
                                        background: u.isCustom
                                            ? "rgba(0,184,148,0.12)"
                                            : "rgba(108,92,231,0.12)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 18,
                                        flexShrink: 0,
                                    }}
                                >
                                    {u.isCustom ? "✦" : "🔗"}
                                </div>

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                        <span
                                            style={{
                                                fontSize: 16,
                                                fontWeight: 600,
                                                color: "var(--accent-secondary)",
                                                cursor: "pointer",
                                            }}
                                            onClick={() => handleCopy(u.shortUrl, u.shortCode)}
                                        >
                                            {u.shortUrl.replace(/^https?:\/\//, "")}
                                        </span>
                                        <button
                                            onClick={() => handleCopy(u.shortUrl, u.shortCode)}
                                            style={{
                                                background: "none",
                                                border: "none",
                                                color: copiedCode === u.shortCode ? "var(--success)" : "var(--text-muted)",
                                                cursor: "pointer",
                                                fontSize: 12,
                                                padding: "2px 6px",
                                                borderRadius: 4,
                                            }}
                                        >
                                            {copiedCode === u.shortCode ? "✓ Copied" : "Copy"}
                                        </button>
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 13,
                                            color: "var(--text-muted)",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        → {u.originalUrl}
                                    </div>
                                </div>

                                {/* Stats */}
                                <div style={{ textAlign: "center", flexShrink: 0, minWidth: 70 }}>
                                    <div style={{ fontSize: 20, fontWeight: 700 }}>{u.clickCount}</div>
                                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>clicks</div>
                                </div>

                                {/* Date */}
                                <div style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0, minWidth: 80 }}>
                                    {formatDate(u.createdAt)}
                                </div>

                                {/* Actions */}
                                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                                    <Link
                                        href={`/analytics/${u.shortCode}`}
                                        style={{
                                            padding: "6px 12px",
                                            borderRadius: 8,
                                            border: "1px solid var(--border-color)",
                                            background: "transparent",
                                            color: "var(--text-secondary)",
                                            fontSize: 12,
                                            textDecoration: "none",
                                            transition: "all 0.2s",
                                        }}
                                    >
                                        📊 Analytics
                                    </Link>
                                    <button
                                        onClick={() => handleDelete(u.shortCode)}
                                        style={{
                                            padding: "6px 12px",
                                            borderRadius: 8,
                                            border: "1px solid rgba(225,112,85,0.2)",
                                            background: "transparent",
                                            color: "var(--error)",
                                            fontSize: 12,
                                            cursor: "pointer",
                                            transition: "all 0.2s",
                                        }}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 20 }}>
                                <button
                                    className="btn-secondary"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page <= 1}
                                    style={{ padding: "8px 16px", fontSize: 13 }}
                                >
                                    ← Previous
                                </button>
                                <span
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        fontSize: 13,
                                        color: "var(--text-muted)",
                                    }}
                                >
                                    Page {page} of {totalPages}
                                </span>
                                <button
                                    className="btn-secondary"
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                    style={{ padding: "8px 16px", fontSize: 13 }}
                                >
                                    Next →
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
