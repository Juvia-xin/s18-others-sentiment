function analyzeUserProfile(comments) {
  if (!comments || comments.length === 0) {
    return {
      total_users: 0,
      avg_engagement: 0,
      active_users: 0,
      profile_distribution: {},
    };
  }

  const totalUsers = new Set(comments.map(c => c.author_id || c.author).filter(Boolean)).size;
  const totalLikes = comments.reduce((sum, c) => sum + (c.likes || 0), 0);
  const totalReplies = comments.reduce((sum, c) => sum + (c.replies || 0), 0);

  const activeThreshold = Math.ceil(totalLikes / Math.max(comments.length, 1)) * 1.5;
  const activeUsers = comments.filter(c => (c.likes || 0) > activeThreshold).length;

  const sentimentDistribution = {
    high_engagement: comments.filter(c => (c.likes || 0) + (c.replies || 0) > 10).length,
    medium_engagement: comments.filter(c => {
      const total = (c.likes || 0) + (c.replies || 0);
      return total > 3 && total <= 10;
    }).length,
    low_engagement: comments.filter(c => (c.likes || 0) + (c.replies || 0) <= 3).length,
  };

  return {
    total_users: totalUsers,
    total_comments: comments.length,
    avg_likes: Math.round(totalLikes / Math.max(comments.length, 1) * 10) / 10,
    avg_replies: Math.round(totalReplies / Math.max(comments.length, 1) * 10) / 10,
    active_users: activeUsers,
    profile_distribution: {
      high_engagement_pct: Math.round(sentimentDistribution.high_engagement / Math.max(comments.length, 1) * 100),
      medium_engagement_pct: Math.round(sentimentDistribution.medium_engagement / Math.max(comments.length, 1) * 100),
      low_engagement_pct: Math.round(sentimentDistribution.low_engagement / Math.max(comments.length, 1) * 100),
    },
  };
}

module.exports = { analyzeUserProfile };
