const HISTORY_KEY = 'blogger-verify-history'

export interface HistoryItem {
  taskId: string
  shareId: string
  bloggerName: string
  dateRange: string
  holdDays: number
  winRate: number | null
  avgReturn: number | null
  totalRecs: number
  createdAt: string
}

export function getHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch {
    return []
  }
}

export function addHistory(item: HistoryItem) {
  const list = getHistory()
  // 去重
  const filtered = list.filter(h => h.taskId !== item.taskId)
  filtered.unshift(item)
  // 最多保留50条
  localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, 50)))
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY)
}
