/**
 * 成绩单生成服务
 * AI一句话评价 + 统计汇总
 */
const { chat } = require('./ai-provider');

/**
 * 生成AI评价
 * @param {object} stats - 统计数据
 * @param {string} bloggerName - 博主名称
 * @returns {string} AI评价（3-5句，100字以内）
 */
async function generateComment(stats, bloggerName) {
  const prompt = `根据以下荐股博主统计数据，给出3-5句客观评价，100字以内，中性语气：

博主：${bloggerName}
总推荐数：${stats.totalRecs}只
已验证：${stats.completedRecs}只
胜率：${stats.winRate !== null ? stats.winRate + '%' : '暂无数据'}
平均收益：${stats.avgReturn !== null ? stats.avgReturn + '%' : '暂无数据'}
最佳推荐：${stats.bestRec ? stats.bestRec.name + '(' + stats.bestRec.returnPct + '%)' : '暂无'}
最差推荐：${stats.worstRec ? stats.worstRec.name + '(' + stats.worstRec.returnPct + '%)' : '暂无'}
最长连亏：${stats.maxLoseStreak}次

要求：客观中性，不做推荐或批评，只陈述事实和分析风格特征。`;

  try {
    const comment = await chat('你是一个客观中性的金融分析评价助手。', prompt);
    return comment.trim().slice(0, 200);
  } catch (e) {
    console.error('AI评价生成失败:', e.message);
    return '暂无法生成AI评价';
  }
}

/**
 * 生成收益分布
 */
function calcDistribution(recommendations) {
  const completed = recommendations.filter(r => r.return_pct !== null);
  const bins = {
    '>10%': 0, '5~10%': 0, '0~5%': 0,
    '0~-5%': 0, '-5~-10%': 0, '<-10%': 0,
  };
  
  for (const r of completed) {
    const pct = r.return_pct;
    if (pct > 10) bins['>10%']++;
    else if (pct > 5) bins['5~10%']++;
    else if (pct >= 0) bins['0~5%']++;
    else if (pct > -5) bins['0~-5%']++;
    else if (pct > -10) bins['-5~-10%']++;
    else bins['<-10%']++;
  }
  
  return bins;
}

module.exports = { generateComment, calcDistribution };
