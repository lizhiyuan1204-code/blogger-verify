/**
 * AI统一接口 - 支持智谱GLM/DeepSeek/Gemini切换
 * 通过 AI_PROVIDER 环境变量配置
 */
const axios = require('axios');

const PROVIDERS = {
  zhipu: {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4-flash',
    getKey: () => process.env.ZHIPU_API_KEY,
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
    getKey: () => process.env.DEEPSEEK_API_KEY,
  },
  gemini: {
    // Gemini用OpenAI兼容接口
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-2.0-flash',
    getKey: () => process.env.GEMINI_API_KEY,
  },
};

function getProvider() {
  const name = (process.env.AI_PROVIDER || 'zhipu').toLowerCase();
  const provider = PROVIDERS[name];
  if (!provider) throw new Error(`Unknown AI provider: ${name}`);
  
  const key = provider.getKey();
  if (!key) throw new Error(`Missing API key for ${name}. Set ${name.toUpperCase()}_API_KEY env var.`);
  
  return { ...provider, name, key };
}

/**
 * 调用AI接口
 * @param {string} systemPrompt - 系统提示词
 * @param {string} userMessage - 用户消息
 * @returns {string} AI回复内容
 */
async function chat(systemPrompt, userMessage) {
  const provider = getProvider();
  
  const resp = await axios.post(provider.baseUrl, {
    model: provider.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.1, // 低温度保证提取稳定
    max_tokens: 4096,
  }, {
    headers: {
      'Authorization': `Bearer ${provider.key}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });
  
  return resp.data.choices[0].message.content;
}

module.exports = { chat, getProvider };
