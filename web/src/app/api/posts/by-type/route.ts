import { getDb, parseDaysParam } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const sql = getDb();
    const days = parseDaysParam(
      request.nextUrl.searchParams.get("days")
    );

    const rows = await sql`
      SELECT
        p.media_type,
        COUNT(DISTINCT p.post_id) AS post_count,
        ROUND(AVG(pm.engagement_rate) * 100, 2) AS avg_engagement_rate,
        ROUND(AVG(pm.reach), 0) AS avg_reach,
        ROUND(AVG(pm.views), 0) AS avg_views,
        ROUND(AVG(pm.likes), 1) AS avg_likes,
        ROUND(AVG(pm.comments), 1) AS avg_comments,
        ROUND(AVG(pm.saves), 1) AS avg_saves,
        ROUND(AVG(pm.shares), 1) AS avg_shares
      FROM posts p
      JOIN post_metrics pm ON p.post_id = pm.post_id
      WHERE p.posted_at >= NOW() - (${days} || ' days')::INTERVAL
        AND pm.snapshot_date = (
          SELECT MAX(pm2.snapshot_date)
          FROM post_metrics pm2
          WHERE pm2.post_id = pm.post_id
        )
      GROUP BY p.media_type
      ORDER BY avg_engagement_rate DESC
    `;

    return NextResponse.json({
      data: rows,
      days,
    });
  } catch (error) {
    console.error("Error fetching by-type data:", error);
    return NextResponse.json(
      { error: "Failed to fetch by-type data" },
      { status: 500 }
    );
  }
}
