import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { subscribeProgress, type SSEProgress } from '../lib/api'

const PHASE_LABELS: Record<string, string> = {
  crawl: '爬取文章列表',
  analyze: '分析文章内容',
  market: '查询行情数据',
}

export default function Progress() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [progress, setProgress] = useState<SSEProgress>({ phase: 'crawl', current: 0, total: 0 })
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState('')
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!taskId) return
    esRef.current = subscribeProgress(
      taskId,
      (data) => {
        setProgress(data)
        if (data.title) {
          setLogs(prev => [...prev.slice(-20), `正在分析《${data.title}》...`])
        }
      },
      (data) => {
        navigate(`/report/${data.task_id}`, { replace: true })
      },
      (msg) => {
        setError(msg)
      }
    )
    return () => esRef.current?.close()
  }, [taskId, navigate])

  const phaseLabel = PHASE_LABELS[progress.phase] || progress.phase
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
      <div className="max-w-lg mx-auto px-4 w-full">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          {error ? (
            <>
              <div className="text-5xl mb-4">😥</div>
              <h2 className="text-xl font-bold text-red-500 mb-2">分析失败</h2>
              <p className="text-gray-500 mb-6">{error}</p>
              <button
                onClick={() => navigate('/')}
                className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600"
              >
                返回首页
              </button>
            </>
          ) : (
            <>
              {/* Spinner */}
              <div className="mb-6">
                <div className="w-16 h-16 mx-auto border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin" />
              </div>

              <h2 className="text-xl font-bold text-gray-900 mb-2">{phaseLabel}</h2>

              {/* Progress Bar */}
              <div className="w-full bg-gray-100 rounded-full h-3 mb-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-400 to-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <p className="text-sm text-gray-500 mb-1">
                {progress.current}/{progress.total} · {pct}%
              </p>

              {progress.stocks_found !== undefined && (
                <p className="text-sm text-blue-500 font-medium">
                  已发现 {progress.stocks_found} 只推荐股票
                </p>
              )}

              {/* Logs */}
              {logs.length > 0 && (
                <div className="mt-6 text-left bg-gray-50 rounded-xl p-4 max-h-40 overflow-y-auto">
                  {logs.map((log, i) => (
                    <p key={i} className="text-xs text-gray-400 py-0.5">{log}</p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
