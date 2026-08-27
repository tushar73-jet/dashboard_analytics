import { getDb, parseDaysParam, DAY_NAMES, MEDIA_TYPE_LABELS } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

interface Insight {
  id: string;
  icon: string;
  title: string;
  description: string;
  type: "positive" | "negative" | "neutral";
  metric?: string;
}

export async function GET(request: NextRequest) {
  try {
    const sql = getDb();
    const days = parseDaysParam(
      request.nextUrl.searchParams.get("days")
    );

    const insights: Insight[] = [];

    // ─── 1. Content type comparison ───
    const byType = await sql`
      SELECT
        p.media_type,
        COUNT(DISTINCT p.post_id) AS post_count,
        ROUND(AVG(pm.engagement_rate) * 100, 2) AS avg_er,
        ROUND(AVG(pm.reach), 0) AS avg_reach,
        ROUND(AVG(pm.saves), 1) AS avg_saves
      FROM posts p
      JOIN post_metrics pm ON p.post_id = pm.post_id
      WHERE p.posted_at >= NOW() - (${days} || ' days')::INTERVAL
        AND pm.snapshot_date = (
          SELECT MAX(pm2.snapshot_date)
          FROM post_metrics pm2
          WHERE pm2.post_id = pm.post_id
        )
      GROUP BY p.media_type
      HAVING COUNT(DISTINCT p.post_id) >= 3
      ORDER BY avg_er DESC
    `;

    if (byType.length >= 2) {
      const best = byType[0];
      const worst = byType[byType.length - 1];
      const ratio = worst.avg_er > 0
        ? (Number(best.avg_er) / Number(worst.avg_er)).toFixed(1)
        : "∞";

      const bestLabel = MEDIA_TYPE_LABELS[best.media_type] || best.media_type;
      const worstLabel = MEDIA_TYPE_LABELS[worst.media_type] || worst.media_type;

      insights.push({
        id: "content-type-winner",
        icon: "🏆",
        title: `${bestLabel}s outperform ${worstLabel}s by ${ratio}×`,
        description: `${bestLabel}s average ${best.avg_er}% engagement rate vs ${worst.avg_er}% for ${worstLabel}s. Consider making more ${bestLabel.toLowerCase()} content.`,
        type: "positive",
        metric: `${ratio}× better`,
      });
    }

    // ─── 2. Best day of week ───
    const byDay = await sql`
      SELECT
        p.day_of_week,
        COUNT(DISTINCT p.post_id) AS post_count,
        ROUND(AVG(pm.engagement_rate) * 100, 2) AS avg_er,
        ROUND(AVG(pm.reach), 0) AS avg_reach
      FROM posts p
      JOIN post_metrics pm ON p.post_id = pm.post_id
      WHERE p.posted_at >= NOW() - (${days} || ' days')::INTERVAL
        AND pm.snapshot_date = (
          SELECT MAX(pm2.snapshot_date)
          FROM post_metrics pm2
          WHERE pm2.post_id = pm.post_id
        )
      GROUP BY p.day_of_week
      HAVING COUNT(DISTINCT p.post_id) >= 2
      ORDER BY avg_er DESC
    `;

    if (byDay.length >= 2) {
      const bestDay = byDay[0];
      const avgEr = byDay.reduce((sum: number, d: Record<string, unknown>) => sum + Number(d.avg_er), 0) / byDay.length;
      const pctAbove = avgEr > 0
        ? Math.round(((Number(bestDay.avg_er) - avgEr) / avgEr) * 100)
        : 0;
      const dayName = DAY_NAMES[bestDay.day_of_week] || `Day ${bestDay.day_of_week}`;

      if (pctAbove > 10) {
        insights.push({
          id: "best-day",
          icon: "📅",
          title: `${dayName} posts get ${pctAbove}% more engagement`,
          description: `Posts on ${dayName} average ${bestDay.avg_er}% engagement rate, which is ${pctAbove}% above your overall average of ${avgEr.toFixed(2)}%.`,
          type: "positive",
          metric: `+${pctAbove}%`,
        });
      }
    }

    // ─── 3. Best posting hour ───
    const byHour = await sql`
      SELECT
        p.posting_hour,
        COUNT(DISTINCT p.post_id) AS post_count,
        ROUND(AVG(pm.engagement_rate) * 100, 2) AS avg_er,
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
      HAVING COUNT(DISTINCT p.post_id) >= 2
      ORDER BY avg_er DESC
    `;

    if (byHour.length >= 3) {
      // Find the best 2-hour window
      const bestHour = Number(byHour[0].posting_hour);
      const endHour = (bestHour + 2) % 24;
      const formatHour = (h: number) => {
        if (h === 0) return "12 AM";
        if (h === 12) return "12 PM";
        return h > 12 ? `${h - 12} PM` : `${h} AM`;
      };

      insights.push({
        id: "best-hour",
        icon: "⏰",
        title: `Best posting time: ${formatHour(bestHour)}–${formatHour(endHour)} IST`,
        description: `Posts around ${formatHour(bestHour)} get the highest engagement at ${byHour[0].avg_er}%. Try scheduling your next posts in this window.`,
        type: "positive",
        metric: `${byHour[0].avg_er}%`,
      });
    }

    // ─── 4. Saves analysis ───
    const savesAnalysis = await sql`
      SELECT
        p.media_type,
        ROUND(AVG(pm.saves), 1) AS avg_saves,
        ROUND(AVG(pm.likes), 1) AS avg_likes
      FROM posts p
      JOIN post_metrics pm ON p.post_id = pm.post_id
      WHERE p.posted_at >= NOW() - (${days} || ' days')::INTERVAL
        AND pm.snapshot_date = (
          SELECT MAX(pm2.snapshot_date)
          FROM post_metrics pm2
          WHERE pm2.post_id = pm.post_id
        )
      GROUP BY p.media_type
      HAVING COUNT(DISTINCT p.post_id) >= 3
      ORDER BY avg_saves DESC
    `;

    if (savesAnalysis.length >= 2) {
      const topSaves = savesAnalysis[0];
      const bottomSaves = savesAnalysis[savesAnalysis.length - 1];
      const ratio = Number(bottomSaves.avg_saves) > 0
        ? (Number(topSaves.avg_saves) / Number(bottomSaves.avg_saves)).toFixed(1)
        : "∞";
      const typeLabel = MEDIA_TYPE_LABELS[topSaves.media_type] || topSaves.media_type;

      if (Number(ratio) > 1.5) {
        insights.push({
          id: "saves-signal",
          icon: "🔖",
          title: `${typeLabel}s drive ${ratio}× more saves`,
          description: `Saves are a strong signal to the algorithm. ${typeLabel}s average ${topSaves.avg_saves} saves per post — lean into this format.`,
          type: "positive",
          metric: `${ratio}× saves`,
        });
      }
    }

    // ─── 5. Reach trend ───
    const reachTrend = await sql`
      WITH recent AS (
        SELECT ROUND(AVG(pm.reach), 0) AS avg_reach
        FROM posts p
        JOIN post_metrics pm ON p.post_id = pm.post_id
        WHERE p.posted_at >= NOW() - (${Math.floor(days / 2)} || ' days')::INTERVAL
          AND pm.snapshot_date = (
            SELECT MAX(pm2.snapshot_date)
            FROM post_metrics pm2
            WHERE pm2.post_id = pm.post_id
          )
      ),
      older AS (
        SELECT ROUND(AVG(pm.reach), 0) AS avg_reach
        FROM posts p
        JOIN post_metrics pm ON p.post_id = pm.post_id
        WHERE p.posted_at >= NOW() - (${days} || ' days')::INTERVAL
          AND p.posted_at < NOW() - (${Math.floor(days / 2)} || ' days')::INTERVAL
          AND pm.snapshot_date = (
            SELECT MAX(pm2.snapshot_date)
            FROM post_metrics pm2
            WHERE pm2.post_id = pm.post_id
          )
      )
      SELECT
        recent.avg_reach AS recent_reach,
        older.avg_reach AS older_reach
      FROM recent, older
    `;

    if (reachTrend.length > 0 && reachTrend[0].recent_reach && reachTrend[0].older_reach) {
      const recent = Number(reachTrend[0].recent_reach);
      const older = Number(reachTrend[0].older_reach);
      const change = older > 0 ? Math.round(((recent - older) / older) * 100) : 0;

      if (Math.abs(change) > 10) {
        insights.push({
          id: "reach-trend",
          icon: change > 0 ? "📈" : "📉",
          title: `Reach is ${change > 0 ? "up" : "down"} ${Math.abs(change)}% recently`,
          description: change > 0
            ? `Average reach grew from ${older} to ${recent} people per post in the last ${Math.floor(days / 2)} days. Keep up what you're doing!`
            : `Average reach dropped from ${older} to ${recent} people per post. Consider experimenting with different content types or posting times.`,
          type: change > 0 ? "positive" : "negative",
          metric: `${change > 0 ? "+" : ""}${change}%`,
        });
      }
    }

    // ─── 6. Posting frequency ───
    const postFreq = await sql`
      SELECT
        COUNT(*) AS total_posts,
        COUNT(DISTINCT DATE(posted_at AT TIME ZONE 'Asia/Kolkata')) AS active_days,
        ROUND(COUNT(*)::NUMERIC / GREATEST(${days}, 1), 1) AS posts_per_day
      FROM posts
      WHERE posted_at >= NOW() - (${days} || ' days')::INTERVAL
    `;

    if (postFreq.length > 0 && Number(postFreq[0].total_posts) > 0) {
      const ppd = Number(postFreq[0].posts_per_day);
      if (ppd < 0.5) {
        insights.push({
          id: "posting-frequency",
          icon: "📊",
          title: `You're posting ${ppd} times per day on average`,
          description: `Consistency matters for the algorithm. Try to post at least once daily — even simple content helps maintain visibility.`,
          type: "neutral",
          metric: `${ppd}/day`,
        });
      }
    }

    return NextResponse.json({
      insights,
      days,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating insights:", error);
    return NextResponse.json(
      { error: "Failed to generate insights" },
      { status: 500 }
    );
  }
}
