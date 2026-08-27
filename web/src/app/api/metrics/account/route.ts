import { getDb, parseDaysParam } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const sql = getDb();
    const days = parseDaysParam(
      request.nextUrl.searchParams.get("days")
    );

    // Get latest account metrics
    const latest = await sql`
      SELECT * FROM account_metrics
      ORDER BY snapshot_date DESC
      LIMIT 1
    `;

    // Get overall engagement rate (average across all posts in the period)
    const engagement = await sql`
      SELECT
        ROUND(AVG(pm.engagement_rate) * 100, 2) AS avg_engagement_rate,
        ROUND(AVG(pm.reach), 0) AS avg_reach,
        SUM(pm.likes) AS total_likes,
        SUM(pm.comments) AS total_comments,
        SUM(pm.saves) AS total_saves,
        SUM(pm.shares) AS total_shares,
        COUNT(DISTINCT pm.post_id) AS posts_analyzed
      FROM post_metrics pm
      JOIN posts p ON p.post_id = pm.post_id
      WHERE p.posted_at >= NOW() - (${days} || ' days')::INTERVAL
        AND pm.snapshot_date = (
          SELECT MAX(snapshot_date) FROM post_metrics WHERE post_id = pm.post_id
        )
    `;

    // Find best performing media type
    const bestType = await sql`
      SELECT
        p.media_type,
        ROUND(AVG(pm.engagement_rate) * 100, 2) AS avg_engagement_rate
      FROM posts p
      JOIN post_metrics pm ON p.post_id = pm.post_id
      WHERE p.posted_at >= NOW() - (${days} || ' days')::INTERVAL
        AND pm.snapshot_date = (
          SELECT MAX(snapshot_date) FROM post_metrics WHERE post_id = pm.post_id
        )
      GROUP BY p.media_type
      ORDER BY avg_engagement_rate DESC
      LIMIT 1
    `;

    return NextResponse.json({
      latest: latest[0] || null,
      engagement: engagement[0] || null,
      bestMediaType: bestType[0] || null,
      days,
    });
  } catch (error) {
    console.error("Error fetching account metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch account metrics" },
      { status: 500 }
    );
  }
}
