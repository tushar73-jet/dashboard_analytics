"use client";

import type { ByHourData, ByDayData } from "@/lib/hooks";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Heatmap showing engagement rate by hour (x-axis) and day of week (y-axis).
 * Color intensity maps to engagement rate relative to the dataset max.
 */
interface PostingHeatmapProps {
  byHour: ByHourData[];
  byDay: ByDayData[];
  loading?: boolean;
}

function getHeatColor(value: number, max: number): string {
  if (max === 0) return "rgba(255, 255, 255, 0.03)";
  const ratio = value / max;

  if (ratio === 0) return "rgba(255, 255, 255, 0.03)";
  if (ratio < 0.2) return "rgba(167, 139, 250, 0.15)";
  if (ratio < 0.4) return "rgba(167, 139, 250, 0.3)";
  if (ratio < 0.6) return "rgba(232, 86, 127, 0.4)";
  if (ratio < 0.8) return "rgba(232, 86, 127, 0.6)";
  return "rgba(232, 86, 127, 0.85)";
}

function formatHour(h: number): string {
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  return h > 12 ? `${h - 12}p` : `${h}a`;
}

export function PostingHeatmap({
  byHour,
  byDay,
  loading,
}: PostingHeatmapProps) {
  if (loading) {
    return (
      <div className="chart-card chart-card--full">
        <div className="chart-card__title">Best times to post</div>
        <div className="chart-card__subtitle">Engagement by posting hour and day</div>
        <div className="skeleton skeleton--chart" />
      </div>
    );
  }

  // Build a lookup: hourData[hour] and dayData[day]
  const hourMap = new Map(byHour.map((h) => [h.posting_hour, h]));
  const dayMap = new Map(byDay.map((d) => [d.day_of_week, d]));

  // For the heatmap, we create a matrix of [day][hour]
  // Since we don't have cross-tabulated data, we approximate by
  // averaging hour and day effects
  const maxEr = Math.max(
    ...byHour.map((h) => h.avg_engagement_rate),
    ...byDay.map((d) => d.avg_engagement_rate),
    0.01
  );

  // Get display hours (only show every 2 hours for labels)
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="chart-card chart-card--full animate-in animate-in--delay-5">
      <div className="chart-card__title">Best times to post</div>
      <div className="chart-card__subtitle">
        Engagement rate by posting hour (IST) and day of week — brighter = higher engagement
      </div>
      <div className="heatmap" style={{ marginTop: 24 }}>
        <div className="heatmap__grid">
          {/* Header row: hour labels */}
          <div className="heatmap__label" />
          {hours.map((h) => (
            <div key={`h-${h}`} className="heatmap__label heatmap__label--hour">
              {h % 3 === 0 ? formatHour(h) : ""}
            </div>
          ))}

          {/* Data rows: one per day */}
          {DAY_LABELS.map((dayLabel, dayIndex) => {
            const dayData = dayMap.get(dayIndex);
            const dayEr = dayData ? dayData.avg_engagement_rate : 0;

            return [
              <div key={`day-${dayIndex}`} className="heatmap__label">
                {dayLabel}
              </div>,
              ...hours.map((h) => {
                const hourData = hourMap.get(h);
                const hourEr = hourData ? hourData.avg_engagement_rate : 0;

                // Approximate cell value: geometric mean of hour and day effects
                const cellValue =
                  hourEr > 0 && dayEr > 0
                    ? Math.sqrt(hourEr * dayEr)
                    : (hourEr + dayEr) / 2;

                return (
                  <div
                    key={`cell-${dayIndex}-${h}`}
                    className="heatmap__cell"
                    style={{ background: getHeatColor(cellValue, maxEr) }}
                    title={`${dayLabel} ${formatHour(h)}: ${cellValue.toFixed(2)}% engagement`}
                  />
                );
              }),
            ];
          })}
        </div>

        {/* Legend */}
        <div className="heatmap__legend">
          <span className="heatmap__legend-label">Lower</span>
          <div className="heatmap__legend-scale">
            {[0.03, 0.15, 0.3, 0.4, 0.6, 0.85].map((opacity, i) => (
              <div
                key={i}
                className="heatmap__legend-swatch"
                style={{
                  background:
                    i === 0
                      ? "rgba(255,255,255,0.03)"
                      : i < 3
                      ? `rgba(167, 139, 250, ${opacity})`
                      : `rgba(232, 86, 127, ${opacity})`,
                }}
              />
            ))}
          </div>
          <span className="heatmap__legend-label">Higher</span>
        </div>
      </div>
    </div>
  );
}
