"use client";

import { useState } from "react";
import { login, saveAuth } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await login(email, password);
            if (res.success && res.data) {
                saveAuth(res.data);
                router.push("/dashboard");
            } else {
                setError(res.error?.message || "Login failed");
            }
        } catch {
            setError("Network error. Is the API server running?");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 20,
                position: "relative",
            }}
        >
            {/* Background Orb */}
            <div
                style={{
                    position: "absolute",
                    top: "30%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 500,
                    height: 500,
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(108,92,231,0.12) 0%, transparent 70%)",
                    filter: "blur(80px)",
                    pointerEvents: "none",
                }}
            />

            <div style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 10 }}>
                {/* Logo */}
                <Link
                    href="/"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        justifyContent: "center",
                        marginBottom: 40,
                        textDecoration: "none",
                        color: "inherit",
                    }}
                >
                    <div
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            background: "var(--accent-gradient)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 20,
                            fontWeight: 800,
                        }}
                    >
                        S
                    </div>
                    <span style={{ fontSize: 24, fontWeight: 700 }}>
                        Shrink<span className="gradient-text">r</span>
                    </span>
                </Link>

                {/* Card */}
                <div className="glass-card animate-fade-in-up" style={{ padding: 36 }}>
                    <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Welcome back</h1>
                    <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 28 }}>
                        Sign in to access your dashboard
                    </p>

                    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div>
                            <label style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>
                                Email
                            </label>
                            <input
                                type="email"
                                className="input-field"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>
                                Password
                            </label>
                            <input
                                type="password"
                                className="input-field"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                                minLength={8}
                            />
                        </div>

                        {error && (
                            <div
                                style={{
                                    padding: "12px 16px",
                                    borderRadius: 10,
                                    background: "rgba(225,112,85,0.1)",
                                    border: "1px solid rgba(225,112,85,0.3)",
                                    color: "var(--error)",
                                    fontSize: 14,
                                }}
                            >
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={loading}
                            style={{ width: "100%", padding: "14px", fontSize: 15, marginTop: 4 }}
                        >
                            {loading ? "Signing in..." : "Sign In"}
                        </button>
                    </form>

                    <div style={{ textAlign: "center", marginTop: 24, fontSize: 14, color: "var(--text-muted)" }}>
                        Don&apos;t have an account?{" "}
                        <Link
                            href="/auth/register"
                            style={{ color: "var(--accent-secondary)", textDecoration: "none", fontWeight: 500 }}
                        >
                            Sign up free
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
