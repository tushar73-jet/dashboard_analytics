"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale,
  ArcElement,
} from "chart.js";
import "chartjs-adapter-date-fns";

// Register all Chart.js components once
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale,
  ArcElement
);

// Global Chart.js defaults for our dark theme
ChartJS.defaults.color = "#9896a3";
ChartJS.defaults.borderColor = "rgba(255, 255, 255, 0.06)";
ChartJS.defaults.font.family =
  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
ChartJS.defaults.font.size = 12;
ChartJS.defaults.plugins.legend.display = false;
ChartJS.defaults.plugins.tooltip.backgroundColor = "rgba(10, 10, 15, 0.95)";
ChartJS.defaults.plugins.tooltip.borderColor = "rgba(255, 255, 255, 0.1)";
ChartJS.defaults.plugins.tooltip.borderWidth = 1;
ChartJS.defaults.plugins.tooltip.cornerRadius = 8;
ChartJS.defaults.plugins.tooltip.padding = 12;
ChartJS.defaults.plugins.tooltip.titleFont = { weight: "bold" as const, size: 13 };
ChartJS.defaults.plugins.tooltip.bodyFont = { size: 12 };

export { ChartJS };
