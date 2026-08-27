"use client";

import { Bar } from "react-chartjs-2";
import "@/lib/chart-setup";
import type { ByHourData } from "@/lib/hooks";

function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h > 12 ? `${h - 12} PM` : `${h} AM`;
}

interface EngagementByHourChartProps {
  data: ByHourData[];
  loading?: boolean;
}

export function EngagementByHourChart({
  data,
  loading,
}: EngagementByHourChartProps) {
  if (loading) {
    return (
      <div className="chart-card">
        <div className="chart-card__title">Engagement by posting hour</div>
        <div className="chart-card__subtitle">When your audience engages most</div>
        <div className="skeleton skeleton--chart" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="chart-card">
        <div className="chart-card__title">Engagement by posting hour</div>
        <div className="chart-card__subtitle">When your audience engages most</div>
        <div className="empty-state" style={{ padding: "2rem" }}>
          <div className="empty-state__icon">⏰</div>
          <div className="empty-state__desc">No hourly data yet.</div>
        </div>
      </div>
    );
  }

  // Ensure all 24 hours are represented
  const fullData = Array.from({ length: 24 }, (_, h) => {
    const existing = data.find((d) => d.posting_hour === h);
    return {
      posting_hour: h,
      avg_engagement_rate: existing ? existing.avg_engagement_rate : 0,
      post_count: existing ? existing.post_count : 0,
      avg_reach: existing ? existing.avg_reach : 0,
    };
  });

  const maxEr = Math.max(...fullData.map((d) => d.avg_engagement_rate));

  const chartData = {
    labels: fullData.map((d) => formatHour(d.posting_hour)),
    datasets: [
      {
        label: "Engagement Rate (%)",
        data: fullData.map((d) => d.avg_engagement_rate),
        backgroundColor: fullData.map((d) => {
          const ratio = maxEr > 0 ? d.avg_engagement_rate / maxEr : 0;
          if (ratio > 0.8) return "rgba(232, 86, 127, 0.7)";
          if (ratio > 0.5) return "rgba(167, 139, 250, 0.5)";
          return "rgba(167, 139, 250, 0.2)";
        }),
        borderColor: fullData.map((d) => {
          const ratio = maxEr > 0 ? d.avg_engagement_rate / maxEr : 0;
          if (ratio > 0.8) return "#e8567f";
          if (ratio > 0.5) return "#a78bfa";
          return "rgba(167, 139, 250, 0.4)";
        }),
        borderWidth: 1.5,
        borderRadius: 4,
        maxBarThickness: 32,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          maxRotation: 45,
          font: { size: 10 },
          callback: (_value: string | number, index: number) =>
            index % 3 === 0 ? formatHour(index) : "",
        },
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
          label: (context: { dataIndex: number; parsed: { y: number | null } }) => {
            const d = fullData[context.dataIndex];
            return [
              `Engagement: ${context.parsed.y ?? 0}%`,
              `Posts at this hour: ${d.post_count}`,
              `Avg reach: ${d.avg_reach}`,
            ];
          },
        },
      },
    },
  };

  return (
    <div className="chart-card animate-in animate-in--delay-5">
      <div className="chart-card__title">Engagement by posting hour</div>
      <div className="chart-card__subtitle">
        When your audience engages most (IST)
      </div>
      <div className="chart-card__body">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}
