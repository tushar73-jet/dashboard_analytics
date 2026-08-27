"use client";

import { useState, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════════════
   Type Definitions
   ═══════════════════════════════════════════════════════════════════════ */

export interface AccountMetrics {
  latest: {
    snapshot_date: string;
    followers: number;
    follows: number;
    profile_views: number;
    reach: number;
  } | null;
  engagement: {
    avg_engagement_rate: number;
    avg_reach: number;
    total_likes: number;
    total_comments: number;
    total_saves: number;
    total_shares: number;
    posts_analyzed: number;
  } | null;
  bestMediaType: {
    media_type: string;
    avg_engagement_rate: number;
  } | null;
}

export interface FollowerData {
  snapshot_date: string;
  followers: number;
  follows: number;
  profile_views: number;
  reach: number;
}

export interface ByTypeData {
  media_type: string;
  post_count: number;
  avg_engagement_rate: number;
  avg_reach: number;
  avg_views: number;
  avg_likes: number;
  avg_comments: number;
  avg_saves: number;
  avg_shares: number;
}

export interface ByHourData {
  posting_hour: number;
  post_count: number;
  avg_engagement_rate: number;
  avg_reach: number;
}

export interface ByDayData {
  day_of_week: number;
  post_count: number;
  avg_engagement_rate: number;
  avg_reach: number;
}

export interface PostData {
  post_id: string;
  caption: string;
  media_type: string;
  permalink: string;
  media_url: string;
  posted_at: string;
  hashtags: string[];
  posting_hour: number;
  day_of_week: number;
  reach: number;
  views: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  engagement_rate: number;
  snapshot_date: string;
}

export interface Insight {
  id: string;
  icon: string;
  title: string;
  description: string;
  type: "positive" | "negative" | "neutral";
  metric?: string;
}

/* ═══════════════════════════════════════════════════════════════════════
   Custom Hook — useDashboardData
   ═══════════════════════════════════════════════════════════════════════ */

interface DashboardData {
  accountMetrics: AccountMetrics | null;
  followers: FollowerData[];
  byType: ByTypeData[];
  byHour: ByHourData[];
  byDay: ByDayData[];
  topPosts: PostData[];
  bottomPosts: PostData[];
  insights: Insight[];
  loading: boolean;
  error: string | null;
}

export function useDashboardData(days: number): DashboardData {
  const [data, setData] = useState<DashboardData>({
    accountMetrics: null,
    followers: [],
    byType: [],
    byHour: [],
    byDay: [],
    topPosts: [],
    bottomPosts: [],
    insights: [],
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    setData((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const [
        accountRes,
        followersRes,
        byTypeRes,
        byHourRes,
        byDayRes,
        topPostsRes,
        bottomPostsRes,
        insightsRes,
      ] = await Promise.allSettled([
        fetch(`/api/metrics/account?days=${days}`).then((r) => r.json()),
        fetch(`/api/metrics/followers?days=${days}`).then((r) => r.json()),
        fetch(`/api/posts/by-type?days=${days}`).then((r) => r.json()),
        fetch(`/api/posts/by-hour?days=${days}`).then((r) => r.json()),
        fetch(`/api/posts/by-day?days=${days}`).then((r) => r.json()),
        fetch(`/api/posts?sort=top&days=${days}&limit=10`).then((r) => r.json()),
        fetch(`/api/posts?sort=bottom&days=${days}&limit=10`).then((r) => r.json()),
        fetch(`/api/insights/summary?days=${days}`).then((r) => r.json()),
      ]);

      setData({
        accountMetrics:
          accountRes.status === "fulfilled" ? accountRes.value : null,
        followers:
          followersRes.status === "fulfilled"
            ? followersRes.value.data || []
            : [],
        byType:
          byTypeRes.status === "fulfilled" ? byTypeRes.value.data || [] : [],
        byHour:
          byHourRes.status === "fulfilled" ? byHourRes.value.data || [] : [],
        byDay:
          byDayRes.status === "fulfilled" ? byDayRes.value.data || [] : [],
        topPosts:
          topPostsRes.status === "fulfilled"
            ? topPostsRes.value.data || []
            : [],
        bottomPosts:
          bottomPostsRes.status === "fulfilled"
            ? bottomPostsRes.value.data || []
            : [],
        insights:
          insightsRes.status === "fulfilled"
            ? insightsRes.value.insights || []
            : [],
        loading: false,
        error: null,
      });
    } catch (err) {
      setData((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load data",
      }));
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return data;
}
