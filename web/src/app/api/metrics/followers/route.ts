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
        snapshot_date,
        followers,
        follows,
        profile_views,
        reach
      FROM account_metrics
      WHERE snapshot_date >= CURRENT_DATE - ${days}
      ORDER BY snapshot_date ASC
    `;

    return NextResponse.json({
      data: rows,
      days,
    });
  } catch (error) {
    console.error("Error fetching follower data:", error);
    return NextResponse.json(
      { error: "Failed to fetch follower data" },
      { status: 500 }
    );
  }
}
