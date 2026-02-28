"use client";

import { useState } from "react";
import { createShortUrl, UrlData } from "@/lib/api";
import Link from "next/link";

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [result, setResult] = useState<UrlData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const res = await createShortUrl(url, customAlias || undefined);

      if (res.success && res.data) {
        setResult(res.data);
        setUrl("");
        setCustomAlias("");
      } else {
        setError(res.error?.message || "Failed to shorten URL");
      }
    } catch {
      setError("Network error. Is the API server running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      {/* Background Orbs */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: "-10%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(108,92,231,0.15) 0%, transparent 70%)",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-20%",
          right: "-10%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(116,185,255,0.12) 0%, transparent 70%)",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />

      {/* Navbar */}
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 40px",
          position: "relative",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "var(--accent-gradient)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 800,
            }}
          >
            S
          </div>
          <span style={{ fontSize: 22, fontWeight: 700 }}>
            Shrink<span className="gradient-text">r</span>
          </span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/auth/login">
            <button className="btn-secondary" style={{ padding: "10px 20px", fontSize: 14 }}>
              Log In
            </button>
          </Link>
          <Link href="/auth/register">
            <button className="btn-primary" style={{ padding: "10px 20px", fontSize: 14 }}>
              Sign Up Free
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "calc(100vh - 80px)",
          padding: "0 20px",
          position: "relative",
          zIndex: 10,
        }}
      >
        {/* Badge */}
        <div
          className="animate-fade-in-up"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 16px",
            borderRadius: 100,
            border: "1px solid var(--border-color)",
            background: "rgba(108,92,231,0.08)",
            fontSize: 13,
            color: "var(--accent-secondary)",
            marginBottom: 24,
          }}
        >
          <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "var(--success)" }} />
          Lightning-fast redirects in under 10ms
        </div>

        {/* Heading */}
        <h1
          className="animate-fade-in-up animate-delay-100"
          style={{
            fontSize: "clamp(36px, 5vw, 64px)",
            fontWeight: 800,
            textAlign: "center",
            lineHeight: 1.15,
            maxWidth: 700,
            marginBottom: 16,
          }}
        >
          Shorten Your Links,{" "}
          <span className="gradient-text">Amplify Your Reach</span>
        </h1>

        <p
          className="animate-fade-in-up animate-delay-200"
          style={{
            fontSize: 18,
            color: "var(--text-secondary)",
            textAlign: "center",
            maxWidth: 520,
            marginBottom: 40,
            lineHeight: 1.6,
          }}
        >
          Create short, memorable URLs with real-time analytics. Track every click, optimize every campaign.
        </p>

        {/* URL Input Form */}
        <form
          onSubmit={handleSubmit}
          className="glass-card animate-fade-in-up animate-delay-300"
          style={{
            width: "100%",
            maxWidth: 640,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", gap: 12 }}>
            <input
              type="url"
              className="input-field"
              placeholder="Paste your long URL here..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              style={{ flex: 1 }}
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !url}
              style={{ whiteSpace: "nowrap", minWidth: 120 }}
            >
              {loading ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 1s linear infinite" }}>
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="32" strokeDashoffset="8" />
                  </svg>
                  Shrinking...
                </span>
              ) : (
                "Shrink It →"
              )}
            </button>
          </div>

          {/* Advanced Options */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              fontSize: 13,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            {showAdvanced ? "▾" : "▸"} Custom alias (optional)
          </button>

          {showAdvanced && (
            <input
              type="text"
              className="input-field"
              placeholder="my-custom-alias"
              value={customAlias}
              onChange={(e) => setCustomAlias(e.target.value)}
              pattern="^[a-zA-Z0-9_-]+$"
              minLength={3}
              maxLength={20}
            />
          )}

          {/* Error */}
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

          {/* Result */}
          {result && (
            <div
              style={{
                padding: 20,
                borderRadius: 12,
                background: "rgba(0,184,148,0.08)",
                border: "1px solid rgba(0,184,148,0.2)",
              }}
            >
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                YOUR SHORT URL
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <a
                  href={result.shortUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "var(--success)",
                    textDecoration: "none",
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {result.shortUrl}
                </a>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="btn-secondary"
                  style={{ padding: "8px 16px", fontSize: 13, minWidth: 80 }}
                >
                  {copied ? "✓ Copied!" : "Copy"}
                </button>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  marginTop: 8,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                → {result.originalUrl}
              </div>
            </div>
          )}
        </form>

        {/* Stats */}
        <div
          className="animate-fade-in-up animate-delay-300"
          style={{
            display: "flex",
            gap: 48,
            marginTop: 60,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {[
            { value: "10ms", label: "Avg Redirect" },
            { value: "99.99%", label: "Uptime SLA" },
            { value: "10K+", label: "Redirects/sec" },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: "center" }}>
              <div className="gradient-text" style={{ fontSize: 32, fontWeight: 800 }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Features Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
            maxWidth: 900,
            width: "100%",
            marginTop: 80,
            marginBottom: 80,
          }}
        >
          {[
            {
              icon: "⚡",
              title: "Lightning Fast",
              desc: "Sub-10ms redirects powered by Redis caching and read replicas.",
            },
            {
              icon: "📊",
              title: "Real-time Analytics",
              desc: "Track every click with detailed referrer, device, and geo data.",
            },
            {
              icon: "🔒",
              title: "Secure by Default",
              desc: "HTTPS, rate limiting, malicious URL detection, and XSS prevention.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="glass-card"
              style={{ padding: 28 }}
            >
              <div style={{ fontSize: 28, marginBottom: 12 }}>{feature.icon}</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                {feature.title}
              </h3>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </main>

      {/* Spinner keyframes */}
      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
