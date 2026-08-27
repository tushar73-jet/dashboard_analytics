"use client";

import type { PostData } from "@/lib/hooks";

const TYPE_LABELS: Record<string, string> = {
  IMAGE: "Image",
  VIDEO: "Reel",
  CAROUSEL_ALBUM: "Carousel",
};

const TYPE_ICONS: Record<string, string> = {
  IMAGE: "🖼️",
  VIDEO: "🎬",
  CAROUSEL_ALBUM: "📸",
};

interface PostsTableProps {
  posts: PostData[];
  title: string;
  loading?: boolean;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function truncateCaption(caption: string, maxLen: number = 60): string {
  if (!caption) return "—";
  if (caption.length <= maxLen) return caption;
  return caption.substring(0, maxLen).trim() + "…";
}

export function PostsTable({ posts, title, loading }: PostsTableProps) {
  if (loading) {
    return (
      <div className="table-wrapper">
        <table className="posts-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Post</th>
              <th>Type</th>
              <th>Date</th>
              <th style={{ textAlign: "right" }}>Engagement</th>
              <th style={{ textAlign: "right" }}>Reach</th>
              <th style={{ textAlign: "right" }}>Likes</th>
              <th style={{ textAlign: "right" }}>Saves</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }, (_, i) => (
              <tr key={i}>
                {Array.from({ length: 9 }, (_, j) => (
                  <td key={j}>
                    <div className="skeleton skeleton--text" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="empty-state" style={{ padding: "2rem" }}>
        <div className="empty-state__icon">📋</div>
        <div className="empty-state__desc">No post data available for this period.</div>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <table className="posts-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Post</th>
            <th>Type</th>
            <th>Date</th>
            <th style={{ textAlign: "right" }}>Engagement</th>
            <th style={{ textAlign: "right" }}>People reached</th>
            <th style={{ textAlign: "right" }}>Likes</th>
            <th style={{ textAlign: "right" }}>Saves</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post, i) => (
            <tr key={post.post_id}>
              <td className="posts-table__rank">{i + 1}</td>
              <td className="posts-table__caption" title={post.caption}>
                {truncateCaption(post.caption)}
              </td>
              <td>
                <span className={`posts-table__type posts-table__type--${post.media_type}`}>
                  {TYPE_ICONS[post.media_type] || "📄"}{" "}
                  {TYPE_LABELS[post.media_type] || post.media_type}
                </span>
              </td>
              <td style={{ whiteSpace: "nowrap" }}>
                {formatDate(post.posted_at)}
              </td>
              <td className="posts-table__metric posts-table__er">
                {(Number(post.engagement_rate) * 100).toFixed(2)}%
              </td>
              <td className="posts-table__metric">
                {Number(post.reach).toLocaleString()}
              </td>
              <td className="posts-table__metric">
                {Number(post.likes).toLocaleString()}
              </td>
              <td className="posts-table__metric">
                {Number(post.saves).toLocaleString()}
              </td>
              <td>
                {post.permalink && (
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="posts-table__link"
                  >
                    View ↗
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
