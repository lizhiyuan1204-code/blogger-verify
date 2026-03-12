/**
 * 微信文章搜索服务 - 多源策略
 * 优先级：搜狗微信 > Google site:mp.weixin.qq.com > 必应
 * 搜狗被限流时自动降级
 */
const axios = require('axios');
const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9',
};

// === Cookie管理 ===
let cookieJar = '';

function resetSession() {
  cookieJar = '';
}

async function ensureCookies() {
  if (cookieJar) return;
  const r = await axios.get('https://weixin.sogou.com/', {
    headers: HEADERS,
    timeout: 10000,
  });
  const sc = r.headers['set-cookie'];
  if (sc) cookieJar = sc.map(c => c.split(';')[0]).join('; ');
}

// === 搜索公众号 ===
async function searchBlogger(query) {
  try {
    await ensureCookies();
    const resp = await axios.get(
      `https://weixin.sogou.com/weixin?type=1&query=${encodeURIComponent(query)}`,
      { headers: { ...HEADERS, Cookie: cookieJar, Referer: 'https://weixin.sogou.com/' }, validateStatus: () => true, timeout: 15000 }
    );
    
    if (!resp.data.includes('news-list') && !resp.data.includes('txt-box')) {
      return [{ name: query, wechatId: '', desc: '(直接搜索文章)' }];
    }
    
    const $ = cheerio.load(resp.data);
    const results = [];
    $('ul.news-list2 li, .search-list li').each((i, el) => {
      const name = $(el).find('.tit a, h3 a').first().text().trim();
      const wechatId = $(el).find('label[name="em_weixinhao"]').text().trim();
      const desc = $(el).find('.s-p, p.s-p3').first().text().trim();
      if (name) results.push({ name, wechatId, desc: desc.slice(0, 100) });
    });
    return results.length > 0 ? results : [{ name: query, wechatId: '', desc: '(直接搜索文章)' }];
  } catch (e) {
    console.warn('搜狗公众号搜索失败:', e.message);
    return [{ name: query, wechatId: '', desc: '(直接搜索文章)' }];
  }
}

// === 搜索文章（多源） ===
async function searchArticles(query, timeRange = '3', page = 1) {
  // 1. 搜狗
  try {
    const result = await searchArticlesFromSogou(query, timeRange, page);
    if (result.articles.length > 0) return result;
  } catch (e) {
    console.warn('搜狗:', e.message);
  }

  // 2. Google
  try {
    const result = await searchArticlesFromGoogle(query, page);
    if (result.articles.length > 0) return result;
  } catch (e) {
    console.warn('Google:', e.message);
  }

  return { articles: [], hasMore: false };
}

// --- 搜狗源 ---
async function searchArticlesFromSogou(query, timeRange, page) {
  await ensureCookies();
  
  const resp = await axios.get(
    `https://weixin.sogou.com/weixin?type=2&query=${encodeURIComponent(query)}&tsn=${timeRange}&page=${page}`,
    {
      headers: { ...HEADERS, Cookie: cookieJar, Referer: 'https://weixin.sogou.com/' },
      validateStatus: () => true,
      timeout: 15000,
    }
  );
  
  // 更新cookies
  const sc = resp.headers['set-cookie'];
  if (sc) {
    const parts = sc.map(c => c.split(';')[0]);
    const existing = new Map(cookieJar.split('; ').filter(Boolean).map(c => { const [k, ...v] = c.split('='); return [k, v.join('=')]; }));
    for (const p of parts) { const [k, ...v] = p.split('='); existing.set(k, v.join('=')); }
    cookieJar = [...existing.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  
  const html = resp.data;
  
  // 限流检测
  if (!html.includes('news-list') || html.length < 10000) {
    throw new Error('SOGOU_RATE_LIMITED');
  }
  
  if (html.includes('antispider') || html.includes('访问过于频繁')) {
    throw new Error('SOGOU_ANTISPIDER');
  }
  
  const $ = cheerio.load(html);
  const articles = [];
  
  $('.news-list li').each((i, el) => {
    const $a = $(el).find('h3 a').first();
    if (!$a.length) return;
    const title = $a.text().replace(/<!--.*?-->/g, '').trim();
    let sogouUrl = $a.attr('href') || '';
    if (sogouUrl && !sogouUrl.startsWith('http')) sogouUrl = `https://weixin.sogou.com${sogouUrl}`;
    const source = $(el).find('.account').text().trim();
    if (title && sogouUrl) {
      articles.push({ title, sogouUrl, wxUrl: null, source, date: '', searchEngine: 'sogou' });
    }
  });
  
  return { articles, hasMore: html.includes('sogou_next') };
}

// --- Google源 ---
async function searchArticlesFromGoogle(query, page) {
  const start = (page - 1) * 10;
  const resp = await axios.get(
    `https://www.google.com/search?q=${encodeURIComponent(query)}+site:mp.weixin.qq.com&start=${start}&num=10`,
    { headers: HEADERS, timeout: 15000 }
  );
  const $ = cheerio.load(resp.data);
  const articles = [];
  $('a').each((i, el) => {
    const href = $(el).attr('href') || '';
    if (href.includes('mp.weixin.qq.com/s')) {
      const title = $(el).find('h3').text().trim() || $(el).text().trim().slice(0, 60);
      if (title && title.length > 5) {
        articles.push({ title, sogouUrl: null, wxUrl: href, source: '', date: '', searchEngine: 'google' });
      }
    }
  });
  // 去重
  const seen = new Set();
  const unique = articles.filter(a => { if (seen.has(a.wxUrl)) return false; seen.add(a.wxUrl); return true; });
  return { articles: unique, hasMore: unique.length >= 8 };
}

// === 解析搜狗跳转URL ===
async function resolveWxUrl(sogouUrl) {
  if (!sogouUrl) return null;
  await ensureCookies();
  
  const resp = await axios.get(sogouUrl, {
    headers: { ...HEADERS, Cookie: cookieJar, Referer: 'https://weixin.sogou.com/weixin' },
    validateStatus: () => true,
    timeout: 15000,
  });
  
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
