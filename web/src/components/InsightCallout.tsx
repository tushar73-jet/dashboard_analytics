"use client";

import type { Insight } from "@/lib/hooks";

interface InsightCalloutProps {
  insights: Insight[];
  loading?: boolean;
}

export function InsightCallout({ insights, loading }: InsightCalloutProps) {
  if (loading) {
    return (
      <div className="insights-grid">
        {[1, 2, 3].map((i) => (
          <div key={i} className="insight-card">
            <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 8 }} />
            <div className="insight-card__body">
              <div className="skeleton skeleton--text" style={{ marginBottom: 8 }} />
              <div className="skeleton skeleton--text" style={{ width: "80%" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="empty-state" style={{ padding: "2rem" }}>
        <div className="empty-state__icon">💡</div>
        <div className="empty-state__title">No insights yet</div>
        <div className="empty-state__desc">
          We need more data to generate insights. Run the ingestion script to start collecting post metrics.
        </div>
      </div>
    );
  }

  return (
    <div className="insights-grid">
      {insights.map((insight, i) => (
        <div
          key={insight.id}
          className={`insight-card insight-card--${insight.type} animate-in animate-in--delay-${i + 1}`}
        >
          <div className="insight-card__icon">{insight.icon}</div>
          <div className="insight-card__body">
            <div className="insight-card__title">{insight.title}</div>
            <div className="insight-card__desc">{insight.description}</div>
          </div>
          {insight.metric && (
            <div className={`insight-card__badge insight-card__badge--${insight.type}`}>
              {insight.metric}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
