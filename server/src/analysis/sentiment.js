const positiveWords = new Set([
  '好', '棒', '牛', '赞', '不错', '喜欢', '期待', '支持', '顶级', '优秀', '厉害', '用心', '良心',
  '必玩', '神作', '好玩', '爽', '炸裂', '惊艳', '诚意', 'nb', '666', '爱了', '绝了', '封神',
  '起飞', '冲', '入手', '推荐', '好评', '满分', '到位', '完美', '突破', '创新', '领先', '超越',
  '看好', '预定', '预购', '白嫖', '免费', '不氪', '公平',
  '优化好', '画质好', '手感好', '打击感',
  '沉浸', '品质', '真实', '硬核', '很爽', '上头', '过瘾', '值得',
]);

const negativeWords = new Set([
  '差', '烂', '垃圾', '坑', '骗', '失望', '恶心', '无聊', '抄袭', '缝合', '辣鸡', 'lj',
  '垃圾游戏', '不好玩', '没意思', '劝退', '别玩', '卸载', '弃坑', '退坑', '后悔',
  'bug', '卡顿', '掉帧', '闪退', '发热', '优化差', '画质差', '手感差', '延迟',
  '氪金', '骗氪', '逼氪', '概率欺诈', '暗改',
  '外挂', '挂', '透视', '自瞄',
  '服务器', '排队', '掉线', '维护',
  '狗屎', '屎', '粪', 'sb', '傻逼', '煞笔', '废物', '一坨',
  '乱封', '误封', '封号', '黑屋', '200踢',
  '扫盘', '爆率低', '人机',
]);

const negationPatterns = [
  /不([\u4e00-\u9fff]{1,3})好/,
  /不([\u4e00-\u9fff]{1,3})行/,
  /不([\u4e00-\u9fff]{1,3})值/,
  /不([\u4e00-\u9fff]{1,3})推/,
  /不([\u4e00-\u9fff]{1,3})喜/,
  /别玩/,
  /快跑/,
  /千万别/,
  /不要玩/,
  /不建议/,
  /不推荐/,
  /不如/,
];

function analyzeSentiment(text, votedUp) {
  if (votedUp !== undefined && votedUp !== null) {
    const s = votedUp ? 'positive' : 'negative';
    const score = votedUp ? 2 : -2;
    const kw = votedUp ? 'steam推荐' : 'steam不推荐';
    return { sentiment: s, score, keywords: kw };
  }

  if (!text || text.trim().length === 0) {
    return { sentiment: 'neutral', score: 0, keywords: '' };
  }

  const cleaned = text.toLowerCase().trim();

  let negated = false;
  for (const pattern of negationPatterns) {
    if (pattern.test(cleaned)) {
      negated = true;
      break;
    }
  }

  let positiveCount = 0;
  let negativeCount = 0;
  const matchedKeywords = [];

  for (const word of positiveWords) {
    if (cleaned.includes(word)) {
      if (negated) {
        negativeCount++;
        matchedKeywords.push('不' + word);
      } else {
        positiveCount++;
        matchedKeywords.push(word);
      }
    }
  }

  for (const word of negativeWords) {
    if (cleaned.includes(word)) {
      negativeCount++;
      matchedKeywords.push(word);
    }
  }

  const hasExclamation = /[！!]{1,}/.test(cleaned);
  const hasStrongNegative = /傻逼|废物|狗屎|一坨|垃圾|屎|粪|sb/.test(cleaned);

  let netScore = positiveCount - negativeCount;
  if (hasStrongNegative) netScore -= 1;
  if (hasExclamation) netScore *= 1.2;

  let sentiment = 'neutral';
  if (netScore >= 1.5) sentiment = 'positive';
  else if (netScore <= -1.5) sentiment = 'negative';
  else if (netScore > 0.3) sentiment = 'positive';
  else if (netScore < -0.3) sentiment = 'negative';

  return {
    sentiment,
    score: Math.round(netScore * 100) / 100,
    keywords: [...new Set(matchedKeywords)].slice(0, 10).join(','),
  };
}

function batchAnalyze(comments) {
  return comments.map(c => {
    const analysis = analyzeSentiment(c.content, c.voted_up);
    return {
      comment_id: c.id || c.comment_id,
      ...analysis,
      analysis: { text_length: (c.content || '').length },
    };
  });
}

function batchAnalyzePosts(posts) {
  return posts.map(p => {
    const metrics = p.metrics_json ? JSON.parse(p.metrics_json || '{}') : (p.metrics || {});
    const votedUp = metrics.voted_up;
    const content = p.content || p.title || '';
    const analysis = analyzeSentiment(content, votedUp);
    return {
      post_id: p.id,
      ...analysis,
      analysis: { text_length: content.length },
    };
  });
}

function generateSummaryText(positivePct, neutralPct, negativePct, hotTopics) {
  let summary = `舆情概况：正面 ${positivePct}%，中性 ${neutralPct}%，负面 ${negativePct}%。`;

  if (negativePct > 40) {
    summary += '负面声量较高，需重点关注。';
  } else if (negativePct > 20) {
    summary += '存在部分负面反馈，建议关注。';
  } else if (positivePct > 60) {
    summary += '整体口碑积极。';
  } else {
    summary += '舆论表现平稳。';
  }

  if (hotTopics && hotTopics.length > 0) {
    summary += ` 热门话题：${hotTopics.slice(0, 5).map(t => t.keywords).join('、')}。`;
  }

  return summary;
}

module.exports = { analyzeSentiment, batchAnalyze, batchAnalyzePosts, generateSummaryText };
