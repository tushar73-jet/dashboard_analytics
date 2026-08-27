"use client";

import { useState } from "react";
import { useDashboardData } from "@/lib/hooks";
import { MetricCard } from "@/components/MetricCard";
import { InsightCallout } from "@/components/InsightCallout";
import { FollowerChart } from "@/components/FollowerChart";
import { EngagementByTypeChart } from "@/components/EngagementByTypeChart";
import { EngagementByHourChart } from "@/components/EngagementByHourChart";
import { PostingHeatmap } from "@/components/PostingHeatmap";
import { PostsTable } from "@/components/PostsTable";

const MEDIA_TYPE_LABELS: Record<string, string> = {
  IMAGE: "Single Image",
  VIDEO: "Reel",
  CAROUSEL_ALBUM: "Carousel",
};

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const [postsView, setPostsView] = useState<"top" | "bottom">("top");

  const {
    accountMetrics,
    followers,
    byType,
    byHour,
    byDay,
    topPosts,
    bottomPosts,
    insights,
    loading,
    error,
  } = useDashboardData(days);

  // Format follower count for display
  const formatNumber = (n: number | null | undefined): string => {
    if (n == null) return "—";
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
  };

  const bestTypeLabel = accountMetrics?.bestMediaType
    ? MEDIA_TYPE_LABELS[accountMetrics.bestMediaType.media_type] ||
      accountMetrics.bestMediaType.media_type
    : "—";

  return (
    <div className="dashboard">
      {/* ── Header ── */}
      <header className="header">
        <div className="header__brand">
          <div className="header__logo">✨</div>
          <div>
            <h1 className="header__title">Fashion Pur India</h1>
            <p className="header__subtitle">Instagram Analytics Dashboard</p>
          </div>
        </div>
        <div className="date-selector">
          {[30, 60, 90].map((d) => (
            <button
              key={d}
              className={`date-selector__btn ${
                days === d ? "date-selector__btn--active" : ""
              }`}
              onClick={() => setDays(d)}
            >
              {d} days
            </button>
          ))}
        </div>
      </header>

      {/* ── Error State ── */}
      {error && (
        <div
          className="card"
          style={{
            borderLeft: "3px solid var(--color-accent-rose)",
            marginBottom: "var(--space-6)",
          }}
        >
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <span style={{ fontSize: "1.5rem" }}>⚠️</span>
            <div>
              <strong>Could not load data</strong>
              <p
                style={{
                  color: "var(--color-text-secondary)",
                  fontSize: "var(--font-size-sm)",
                  marginTop: 4,
                }}
              >
                {error}. Make sure your database is set up and the ingestion
                script has run at least once.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── KPI Metric Cards ── */}
      <div className="metric-cards">
        <MetricCard
          icon="👥"
          label="Followers"
          value={formatNumber(accountMetrics?.latest?.followers)}
          subtext={
            accountMetrics?.latest
              ? `as of ${new Date(
                  accountMetrics.latest.snapshot_date
                ).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}`
              : undefined
          }
          colorClass="rose"
          loading={loading}
          animationDelay={1}
        />
        <MetricCard
          icon="💬"
          label="Avg Engagement Rate"
          value={
            accountMetrics?.engagement?.avg_engagement_rate != null
              ? `${accountMetrics.engagement.avg_engagement_rate}%`
              : "—"
          }
          subtext={
            accountMetrics?.engagement
              ? `across ${accountMetrics.engagement.posts_analyzed} posts`
              : undefined
          }
          colorClass="violet"
          loading={loading}
          animationDelay={2}
        />
        <MetricCard
          icon="👁️"
          label="Avg Reach / Post"
          value={formatNumber(accountMetrics?.engagement?.avg_reach)}
          subtext="people who saw your posts"
          colorClass="amber"
          loading={loading}
          animationDelay={3}
        />
        <MetricCard
          icon="🏆"
          label="Best Format"
          value={bestTypeLabel}
          subtext={
            accountMetrics?.bestMediaType
              ? `${accountMetrics.bestMediaType.avg_engagement_rate}% engagement`
              : undefined
          }
          colorClass="emerald"
          loading={loading}
          animationDelay={4}
        />
      </div>

      {/* ── What's Working — Insights ── */}
      <div className="section-header">
        <div>
          <h2 className="section-title">💡 What&apos;s working</h2>
          <p className="section-subtitle">
            Key patterns from your last {days} days of posts
          </p>
        </div>
      </div>
      <InsightCallout insights={insights} loading={loading} />

      {/* ── Charts Grid ── */}
      <div className="section-header">
        <div>
          <h2 className="section-title">📊 Performance breakdown</h2>
          <p className="section-subtitle">
            How your content performs across different dimensions
          </p>
        </div>
      </div>

      {/* Follower Trend — Full width */}
      <div className="charts-grid">
        <FollowerChart data={followers} loading={loading} />
      </div>

      {/* Engagement by Type + Hour — Side by side */}
      <div className="charts-grid" style={{ marginTop: "var(--space-5)" }}>
        <EngagementByTypeChart data={byType} loading={loading} />
        <EngagementByHourChart data={byHour} loading={loading} />
      </div>

      {/* Posting Heatmap — Full width */}
      <div className="charts-grid" style={{ marginTop: "var(--space-5)" }}>
        <PostingHeatmap byHour={byHour} byDay={byDay} loading={loading} />
      </div>

      {/* ── Top / Bottom Posts ── */}
      <div className="posts-section">
        <div className="section-header">
          <div>
            <h2 className="section-title">📋 Post performance</h2>
            <p className="section-subtitle">
              Your best and worst performing posts in the last {days} days
            </p>
          </div>
          <div className="posts-tabs">
            <button
              className={`posts-tabs__btn ${
                postsView === "top" ? "posts-tabs__btn--active" : ""
              }`}
              onClick={() => setPostsView("top")}
            >
              🔥 Top Posts
            </button>
            <button
              className={`posts-tabs__btn ${
                postsView === "bottom" ? "posts-tabs__btn--active" : ""
              }`}
              onClick={() => setPostsView("bottom")}
            >
              📉 Needs Work
            </button>
          </div>
        </div>
        <PostsTable
          posts={postsView === "top" ? topPosts : bottomPosts}
          title={postsView === "top" ? "Top Performing" : "Needs Improvement"}
          loading={loading}
        />
      </div>

      {/* ── Footer ── */}
      <footer className="footer">
        <p>
          Fashion Pur India Analytics • Data from Instagram Graph API •{" "}
          {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
