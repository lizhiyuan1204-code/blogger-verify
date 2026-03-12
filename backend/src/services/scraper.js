/**
 * 微信文章正文抓取服务
 * 通过HTTP请求抓取微信公众号文章正文
 */
const axios = require('axios');
const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * 抓取微信文章正文
 * @param {string} url - 微信文章URL (mp.weixin.qq.com)
 * @returns {{title, content, publishDate, author}}
 */
async function scrapeArticle(url) {
  const resp = await axios.get(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
    timeout: 15000,
    maxRedirects: 5,
  });
  
  const html = resp.data;
  const $ = cheerio.load(html);
  
  // 提取标题
  const title = $('h1#activity-name, h1.rich_media_title').first().text().trim()
    || $('h1').first().text().trim()
    || '';
  
  // 提取正文
  let content = '';
  const $content = $('#js_content');
  if ($content.length) {
    // 移除图片、脚本等非文本元素
    $content.find('script, style, img, iframe').remove();
    content = $content.text().trim();
    // 清理多余空白
    content = content.replace(/\s+/g, ' ').replace(/\n{3,}/g, '\n\n');
  }
  
  // 提取发布日期
  let publishDate = '';
  // 微信文章页面通常在meta或script中有发布时间
  const dateMatch = html.match(/var ct\s*=\s*"(\d+)"/) 
    || html.match(/"create_time"\s*:\s*"?(\d+)"?/)
    || html.match(/data-time="(\d+)"/);
  if (dateMatch) {
    const ts = parseInt(dateMatch[1]) * 1000;
    publishDate = new Date(ts).toISOString().split('T')[0];
  }
  
  // 备选：从页面元素提取日期
  if (!publishDate) {
    const dateText = $('#publish_time, .rich_media_meta_text').first().text().trim();
    if (dateText) publishDate = dateText;
  }
  
  // 提取作者
  const author = $('a#js_name, .rich_media_meta_nickname a').first().text().trim()
    || $('meta[property="og:article:author"]').attr('content')
    || '';
  
  if (!content) {
    throw new Error('SCRAPE_FAILED: 无法提取文章正文');
  }
  
  return { title, content, publishDate, author };
}

module.exports = { scrapeArticle };
