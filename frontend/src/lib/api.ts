const API_BASE = '/api'

export interface BloggerResult {
  name: string
  wechatId: string
  desc: string
}

export interface AnalyzeRequest {
  blogger_name: string
  date_range: string
  hold_days: number
}

export interface AnalyzeResponse {
  task_id: string
  share_id: string
}

export interface SSEProgress {
  phase: string
  current: number
  total: number
  title?: string
  stocks_found?: number
}

export interface Recommendation {
  stock_name: string
  stock_code: string
  direction: string
  strength: string
  recommend_date: string
  buy_price: number | null
  sell_price: number | null
  return_pct: number | null
  result: string
  article_title: string
  context: string
}

export interface TaskStats {
  totalRecs: number
  completedRecs: number
  pendingRecs: number
  winRate: number | null
  avgReturn: number | null
  bestRec: { name: string; returnPct: number } | null
  worstRec: { name: string; returnPct: number } | null
  maxLoseStreak: number
  distribution: Record<string, number>
}

export interface ReportData {
  task: {
    id: string
    blogger_name: string
    date_range: string
    hold_days: number
    status: string
    articles_found: number
    stocks_found: number
    share_id: string
    created_at: string
  }
  stats: TaskStats
  articles: Array<{ title: string; publish_date: string; stocks_found: number }>
  recommendations: Recommendation[]
}

export async function searchBlogger(query: string): Promise<BloggerResult[]> {
  const resp = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`)
  if (!resp.ok) {
    const err = await resp.json()
    throw new Error(err.error || '搜索失败')
  }
  const data = await resp.json()
  return data.results
}

export async function submitAnalysis(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  const resp = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!resp.ok) {
    const err = await resp.json()
    throw new Error(err.error || '提交失败')
  }
  return resp.json()
}

export function subscribeProgress(taskId: string, onProgress: (data: SSEProgress) => void, onComplete: (data: { task_id: string; share_id: string }) => void, onError: (msg: string) => void): EventSource {
  const es = new EventSource(`${API_BASE}/analyze/${taskId}/sse`)
  es.addEventListener('progress', (e) => onProgress(JSON.parse(e.data)))
  es.addEventListener('complete', (e) => { onComplete(JSON.parse(e.data)); es.close() })
  es.addEventListener('error', (e) => {
    if (e instanceof MessageEvent) onError(JSON.parse(e.data).message)
    else onError('连接中断')
    es.close()
  })
  return es
}

export async function getReport(taskId: string): Promise<ReportData> {
  const resp = await fetch(`${API_BASE}/analyze/${taskId}`)
  if (!resp.ok) throw new Error('获取报告失败')
  return resp.json()
}

export async function getShareData(shareId: string): Promise<any> {
  const resp = await fetch(`${API_BASE}/share/${shareId}`)
  if (!resp.ok) throw new Error('分享不存在或已过期')
  return resp.json()
}
