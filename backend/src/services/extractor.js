/**
 * AI提取推荐股票
 * 从公众号文章正文中提取明确推荐的股票
 */
const { chat } = require('./ai-provider');

const SYSTEM_PROMPT = `你是一个专业的金融文本分析助手。你的任务是从公众号文章中提取作者**明确推荐或建议关注**的A股股票。

提取规则：
1. 只提取作者明确推荐买入、建议关注、看好的股票
2. 纯分析/举例/对比/回顾的不算推荐
3. 必须包含具体股票代码或名称
4. 区分推荐强度：strong(强烈推荐/重点关注)、normal(建议关注/可以关注)、mention(提及看好)
5. 方向：bullish(看多买入)、bearish(看空卖出)、neutral(中性/观望)

输出JSON数组格式，每个元素：
{
  "stock_code": "600519",      // 6位代码，不确定可为空
  "stock_name": "贵州茅台",     // 股票名称
  "direction": "bullish",      // bullish/bearish/neutral
  "strength": "strong",        // strong/normal/mention  
  "context": "原文推荐片段..."  // 原文中的推荐语句（50字以内）
}

如果文章中没有任何推荐，返回空数组 []
只输出JSON，不要其他文字。`;

/**
 * 从文章正文中提取推荐股票
 * @param {string} content - 文章正文
 * @param {string} title - 文章标题
 * @returns {Array<{stock_code, stock_name, direction, strength, context}>}
 */
async function extractStocks(content, title = '') {
  // 限制正文长度（避免超token）
  const truncated = content.length > 6000 ? content.slice(0, 6000) + '...(截断)' : content;
  
  const userMessage = `文章标题：${title}\n\n文章正文：\n${truncated}`;
  
  const result = await chat(SYSTEM_PROMPT, userMessage);
  
  // 解析JSON
  try {
    // 清理可能的markdown代码块
    const cleaned = result.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
    const stocks = JSON.parse(cleaned);
    
    if (!Array.isArray(stocks)) {
      console.warn('AI返回非数组:', result.slice(0, 100));
      return [];
    }
    
    return stocks.map(s => ({
      stock_code: (s.stock_code || '').toString().padStart(6, '0'),
      stock_name: s.stock_name || '',
      direction: ['bullish', 'bearish', 'neutral'].includes(s.direction) ? s.direction : 'neutral',
      strength: ['strong', 'normal', 'mention'].includes(s.strength) ? s.strength : 'mention',
      context: (s.context || '').slice(0, 100),
    }));
  } catch (e) {
    console.error('AI返回解析失败:', result.slice(0, 200));
    return [];
  }
}

module.exports = { extractStocks };
