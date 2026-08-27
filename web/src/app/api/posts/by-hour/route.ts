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
        p.posting_hour,
        COUNT(DISTINCT p.post_id) AS post_count,
        ROUND(AVG(pm.engagement_rate) * 100, 2) AS avg_engagement_rate,
        ROUND(AVG(pm.reach), 0) AS avg_reach
      FROM posts p
      JOIN post_metrics pm ON p.post_id = pm.post_id
      WHERE p.posted_at >= NOW() - (${days} || ' days')::INTERVAL
        AND pm.snapshot_date = (
          SELECT MAX(pm2.snapshot_date)
          FROM post_metrics pm2
          WHERE pm2.post_id = pm.post_id
        )
      GROUP BY p.posting_hour
      ORDER BY p.posting_hour
    `;

    return NextResponse.json({
      data: rows,
      days,
    });
  } catch (error) {
    console.error("Error fetching by-hour data:", error);
    return NextResponse.json(
      { error: "Failed to fetch by-hour data" },
      { status: 500 }
    );
  }
}
