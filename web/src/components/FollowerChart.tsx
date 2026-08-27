"use client";

import { Line } from "react-chartjs-2";
import "@/lib/chart-setup";
import type { FollowerData } from "@/lib/hooks";

interface FollowerChartProps {
  data: FollowerData[];
  loading?: boolean;
}

export function FollowerChart({ data, loading }: FollowerChartProps) {
  if (loading) {
    return (
      <div className="chart-card chart-card--full">
        <div className="chart-card__title">People following you</div>
        <div className="chart-card__subtitle">Follower count over time</div>
        <div className="skeleton skeleton--chart" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="chart-card chart-card--full">
        <div className="chart-card__title">People following you</div>
        <div className="chart-card__subtitle">Follower count over time</div>
        <div className="empty-state" style={{ padding: "2rem" }}>
          <div className="empty-state__icon">📈</div>
          <div className="empty-state__desc">
            No follower data yet. This chart will populate after a few days of data collection.
          </div>
        </div>
      </div>
    );
  }

  const chartData = {
    labels: data.map((d) => d.snapshot_date),
    datasets: [
      {
        label: "Followers",
        data: data.map((d) => d.followers),
        borderColor: "#e8567f",
        backgroundColor: "rgba(232, 86, 127, 0.1)",
        fill: true,
        tension: 0.4,
        pointRadius: data.length > 30 ? 0 : 4,
        pointHoverRadius: 6,
        pointBackgroundColor: "#e8567f",
        pointBorderColor: "transparent",
        borderWidth: 2.5,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: "index" as const,
    },
    scales: {
      x: {
        type: "time" as const,
        time: {
          unit: data.length > 60 ? ("month" as const) : ("day" as const),
          tooltipFormat: "MMM d, yyyy",
        },
        grid: { display: false },
        ticks: { maxTicksLimit: 8 },
      },
      y: {
        beginAtZero: false,
        grid: {
          color: "rgba(255, 255, 255, 0.04)",
        },
        ticks: {
          callback: (value: number | string) => {
            const num = typeof value === "string" ? parseFloat(value) : value;
            return num >= 1000 ? `${(num / 1000).toFixed(1)}k` : num;
          },
        },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context: { parsed: { y: number | null } }) =>
            `Followers: ${(context.parsed.y ?? 0).toLocaleString()}`,
        },
      },
    },
  };

  return (
    <div className="chart-card chart-card--full animate-in animate-in--delay-3">
      <div className="chart-card__title">People following you</div>
      <div className="chart-card__subtitle">
        Follower count over time — {data.length} data points
      </div>
      <div className="chart-card__body">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
