"use client";

interface MetricCardProps {
  icon: string;
  label: string;
  value: string | number;
  subtext?: string;
  colorClass: string;
  loading?: boolean;
  animationDelay?: number;
}

export function MetricCard({
  icon,
  label,
  value,
  subtext,
  colorClass,
  loading,
  animationDelay = 0,
}: MetricCardProps) {
  if (loading) {
    return (
      <div className="card">
        <div className="skeleton" style={{ width: 40, height: 40, marginBottom: 16 }} />
        <div className="skeleton skeleton--text" style={{ marginBottom: 8 }} />
        <div className="skeleton skeleton--number" />
        <div className="skeleton skeleton--text" style={{ width: "40%" }} />
      </div>
    );
  }

  return (
    <div
      className={`card animate-in animate-in--delay-${animationDelay}`}
    >
      <div className={`metric-card__icon metric-card__icon--${colorClass}`}>
        {icon}
      </div>
      <div className="metric-card__label">{label}</div>
      <div className="metric-card__value">{value}</div>
      {subtext && <div className="metric-card__subtext">{subtext}</div>}
    </div>
  );
}
