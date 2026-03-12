/**
 * 微信文章搜索服务 - 多源策略
 * 优先级：搜狗微信 > Google site:mp.weixin.qq.com > 必应
 * 搜狗被限流时自动降级
 */
const axios = require('axios');
const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// === Cookie管理 ===
let cookieJar = '';
let sogouBlocked = false;

function resetSession() {
  cookieJar = '';
  sogouBlocked = false;
}

async function sogouRequest(url, referer = 'https://weixin.sogou.com/') {
  // 初始化cookie
  if (!cookieJar) {
    try {
      const r = await axios.get('https://weixin.sogou.com/', {
        headers: { 'User-Agent': UA },
        timeout: 10000,
      });
      const sc = r.headers['set-cookie'];
      if (sc) cookieJar = sc.map(c => c.split(';')[0]).join('; ');
    } catch (e) {
      sogouBlocked = true;
      throw new Error('SOGOU_INIT_FAILED');
    }
  }
  
  const resp = await axios.get(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Referer': referer,
      'Cookie': cookieJar,
    },
    maxRedirects: 5,
    timeout: 15000,
    validateStatus: () => true,
  });
  
  // 更新cookies
  const sc = resp.headers['set-cookie'];
  if (sc) {
    const existing = new Map(cookieJar.split('; ').filter(Boolean).map(c => {
      const [k, ...v] = c.split('=');
      return [k, v.join('=')];
    }));
    for (const part of sc.map(c => c.split(';')[0])) {
      const [k, ...v] = part.split('=');
      existing.set(k, v.join('='));
    }
    cookieJar = [...existing.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  
  // 检测限流：返回首页搜索框而不是结果
  if (resp.data.length < 10000 && !resp.data.includes('news-list')) {
    sogouBlocked = true;
    throw new Error('SOGOU_RATE_LIMITED');
  }
  
  return resp;
}

// === 搜索公众号 ===
async function searchBlogger(query) {
  // 搜狗搜索公众号
  if (!sogouBlocked) {
    try {
      const resp = await sogouRequest(
        `https://weixin.sogou.com/weixin?type=1&query=${encodeURIComponent(query)}`
      );
      const $ = cheerio.load(resp.data);
      const results = [];
      $('ul.news-list2 li, .search-list li').each((i, el) => {
        const name = $(el).find('.tit a, h3 a').first().text().trim();
        const wechatId = $(el).find('label[name="em_weixinhao"]').text().trim();
        const desc = $(el).find('.s-p, p.s-p3').first().text().trim();
        if (name) results.push({ name, wechatId, desc: desc.slice(0, 100) });
      });
      if (results.length > 0) return results;
    } catch (e) {
      console.warn('搜狗公众号搜索失败:', e.message);
    }
  }
  
  // 降级：返回用户输入的名称作为唯一结果
  return [{ name: query, wechatId: '', desc: '(直接搜索文章)' }];
}

// === 搜索文章 ===
async function searchArticles(query, timeRange = '3', page = 1) {
  // 尝试搜狗
  if (!sogouBlocked) {
    try {
      const result = await searchArticlesFromSogou(query, timeRange, page);
      if (result.articles.length > 0) return result;
    } catch (e) {
      console.warn('搜狗文章搜索失败，尝试备选源:', e.message);
    }
  }
  
  // 降级到Google
  try {
    return await searchArticlesFromGoogle(query, page);
  } catch (e) {
    console.warn('Google搜索失败:', e.message);
  }
  
  // 再降级到必应
  try {
    return await searchArticlesFromBing(query, page);
  } catch (e) {
    console.warn('必应搜索也失败:', e.message);
  }
  
  return { articles: [], hasMore: false };
}

// --- 搜狗源 ---
async function searchArticlesFromSogou(query, timeRange, page) {
  const resp = await sogouRequest(
    `https://weixin.sogou.com/weixin?type=2&query=${encodeURIComponent(query)}&tsn=${timeRange}&page=${page}`
  );
  
  const html = resp.data;
  if (html.includes('antispider') || html.includes('访问过于频繁')) {
    throw new Error('RATE_LIMITED');
  }
  
  const $ = cheerio.load(html);
  const articles = [];
  
  $('ul.news-list li, .news-list li').each((i, el) => {
    const $a = $(el).find('h3 a').first();
    if (!$a.length) return;
    const title = $a.text().replace(/<!--.*?-->/g, '').trim();
    let sogouUrl = $a.attr('href') || '';
    if (sogouUrl && !sogouUrl.startsWith('http')) {
      sogouUrl = `https://weixin.sogou.com${sogouUrl}`;
    }
    const source = $(el).find('.account').text().trim();
    if (title && sogouUrl) {
      articles.push({ title, sogouUrl, source, date: '', searchEngine: 'sogou' });
    }
  });
  
  return { articles, hasMore: html.includes('sogou_next') };
}

// --- Google源 ---
async function searchArticlesFromGoogle(query, page) {
  const start = (page - 1) * 10;
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}+site:mp.weixin.qq.com&start=${start}&num=10`;
  
  const resp = await axios.get(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
    timeout: 15000,
  });
  
  const $ = cheerio.load(resp.data);
  const articles = [];
  
  // Google搜索结果
  $('div.g, div[data-sokoban-container]').each((i, el) => {
    const $a = $(el).find('a').first();
    const href = $a.attr('href') || '';
    const title = $(el).find('h3').first().text().trim();
    
    if (title && href.includes('mp.weixin.qq.com')) {
      articles.push({
        title,
        sogouUrl: null, // 不需要搜狗跳转
        wxUrl: href,    // 直接就是微信URL
        source: '',
        date: '',
        searchEngine: 'google',
      });
    }
  });
  
  return { articles, hasMore: articles.length >= 10 };
}

// --- 必应源 ---
async function searchArticlesFromBing(query, page) {
  const offset = (page - 1) * 10;
  const url = `https://cn.bing.com/search?q=${encodeURIComponent(query)}+site:mp.weixin.qq.com&first=${offset + 1}`;
  
  const resp = await axios.get(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
    timeout: 15000,
  });
  
  const $ = cheerio.load(resp.data);
  const articles = [];
  
  $('li.b_algo').each((i, el) => {
    const $a = $(el).find('h2 a').first();
    const href = $a.attr('href') || '';
    const title = $a.text().trim();
    
    if (title && href.includes('mp.weixin.qq.com')) {
      articles.push({
        title,
        sogouUrl: null,
        wxUrl: href,
        source: '',
        date: '',
        searchEngine: 'bing',
      });
    }
  });
  
  return { articles, hasMore: articles.length >= 10 };
}

// === 解析微信URL ===
async function resolveWxUrl(sogouUrl) {
  if (!sogouUrl) return null;
  
  const resp = await sogouRequest(sogouUrl, 'https://weixin.sogou.com/weixin');
  const html = resp.data;
  
  const parts = html.match(/url \+= '([^']+)'/g);
  if (parts) {
    return parts.map(p => p.match(/'([^']+)'/)[1]).join('').replace(/@/g, '');
  }
  
  const wxMatch = html.match(/(https?:\/\/mp\.weixin\.qq\.com\/s[^\s"'<>]+)/);
  if (wxMatch) return wxMatch[1];
  
  throw new Error('无法解析微信文章URL');
}

module.exports = { searchBlogger, searchArticles, resolveWxUrl, resetSession };
