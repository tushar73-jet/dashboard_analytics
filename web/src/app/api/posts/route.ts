import { getDb, parseDaysParam } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const sql = getDb();
    const searchParams = request.nextUrl.searchParams;
    const days = parseDaysParam(searchParams.get("days"));
    const sort = searchParams.get("sort") || "top"; // "top" or "bottom"
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);

    const orderDir = sort === "bottom" ? "ASC" : "DESC";

    // We need to use raw query for dynamic ORDER BY
    const rows = await sql`
      SELECT
        p.post_id,
        p.caption,
        p.media_type,
        p.permalink,
        p.media_url,
        p.posted_at,
        p.hashtags,
        p.posting_hour,
        p.day_of_week,
        pm.reach,
        pm.views,
        pm.likes,
        pm.comments,
        pm.saves,
        pm.shares,
        pm.engagement_rate,
        pm.snapshot_date
      FROM post_metrics pm
      JOIN posts p ON p.post_id = pm.post_id
      WHERE p.posted_at >= NOW() - (${days} || ' days')::INTERVAL
        AND pm.snapshot_date = (
          SELECT MAX(pm2.snapshot_date)
          FROM post_metrics pm2
          WHERE pm2.post_id = pm.post_id
        )
      ORDER BY
        CASE WHEN ${sort} = 'bottom' THEN pm.engagement_rate END ASC,
        CASE WHEN ${sort} != 'bottom' THEN pm.engagement_rate END DESC
      LIMIT ${limit}
    `;

    return NextResponse.json({
      data: rows,
      sort,
      days,
      count: rows.length,
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch posts" },
      { status: 500 }
    );
  }
}
