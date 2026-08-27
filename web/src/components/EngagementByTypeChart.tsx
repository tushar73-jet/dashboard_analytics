"use client";

import { Bar } from "react-chartjs-2";
import "@/lib/chart-setup";
import type { ByTypeData } from "@/lib/hooks";

const TYPE_LABELS: Record<string, string> = {
  IMAGE: "Single Image",
  VIDEO: "Reel",
  CAROUSEL_ALBUM: "Carousel",
};

const TYPE_COLORS: Record<string, { bg: string; border: string }> = {
  IMAGE: { bg: "rgba(56, 189, 248, 0.6)", border: "#38bdf8" },
  VIDEO: { bg: "rgba(232, 86, 127, 0.6)", border: "#e8567f" },
  CAROUSEL_ALBUM: { bg: "rgba(167, 139, 250, 0.6)", border: "#a78bfa" },
};

interface EngagementByTypeChartProps {
  data: ByTypeData[];
  loading?: boolean;
}

export function EngagementByTypeChart({
  data,
  loading,
}: EngagementByTypeChartProps) {
  if (loading) {
    return (
      <div className="chart-card">
        <div className="chart-card__title">Engagement by content type</div>
        <div className="chart-card__subtitle">Which format works best</div>
        <div className="skeleton skeleton--chart" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="chart-card">
        <div className="chart-card__title">Engagement by content type</div>
        <div className="chart-card__subtitle">Which format works best</div>
        <div className="empty-state" style={{ padding: "2rem" }}>
          <div className="empty-state__icon">📊</div>
          <div className="empty-state__desc">No content type data yet.</div>
        </div>
      </div>
    );
  }

  const chartData = {
    labels: data.map((d) => TYPE_LABELS[d.media_type] || d.media_type),
    datasets: [
      {
        label: "Engagement Rate (%)",
        data: data.map((d) => d.avg_engagement_rate),
        backgroundColor: data.map(
          (d) => TYPE_COLORS[d.media_type]?.bg || "rgba(150,150,150,0.6)"
        ),
        borderColor: data.map(
          (d) => TYPE_COLORS[d.media_type]?.border || "#999"
        ),
        borderWidth: 2,
        borderRadius: 8,
        maxBarThickness: 80,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(255, 255, 255, 0.04)" },
        ticks: {
          callback: (value: number | string) => `${value}%`,
        },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context: { parsed: { y: number | null }; dataIndex: number }) => {
            const d = data[context.dataIndex];
            return [
              `Engagement: ${context.parsed.y ?? 0}%`,
              `Avg reach: ${d.avg_reach}`,
              `Posts: ${d.post_count}`,
            ];
          },
        },
      },
    },
  };

  return (
    <div className="chart-card animate-in animate-in--delay-4">
      <div className="chart-card__title">Engagement by content type</div>
      <div className="chart-card__subtitle">
        Which format gets the most interaction
      </div>
      <div className="chart-card__body">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}
