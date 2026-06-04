import { ErrorState } from '@/components/common/ErrorState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'

import { useLoginEvents } from '../hooks/useAdmin'
import { deviceLabel, formatRelative } from '../lib/format'

/**
 * 最近登录 —— 谁、什么时候、从哪个 IP / 设备登录（来自 /admin/login-events，
 * admin-only 审计）。比「近 14 天登录活跃」柱状（只有次数）信息更全，管理员可据此
 * 看到具体登录的人。
 */
export function RecentLogins() {
  const { data, isPending, isError, error, refetch } = useLoginEvents(12)

  return (
    <section className="rounded-xl border border-border bg-bg p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">最近登录</h3>
        <span className="text-xs text-text-faint">最近 {data?.length ?? 0} 次</span>
      </div>

      {isPending ? (
        <LoadingSkeleton preset="list" count={5} />
      ) : isError ? (
        <ErrorState title="加载登录记录失败" message={error?.message ?? ''} onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <p className="py-4 text-center text-sm text-text-faint">暂无登录记录</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-text-muted">
                <th className="py-2 pr-3 font-medium">用户</th>
                <th className="hidden py-2 pr-3 font-medium sm:table-cell">设备</th>
                <th className="hidden py-2 pr-3 font-medium md:table-cell">IP</th>
                <th className="py-2 text-right font-medium">时间</th>
              </tr>
            </thead>
            <tbody>
              {data.map((ev) => (
                <tr key={ev.id} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-text">{ev.nickname}</span>
                      <span className="text-xs text-text-faint">{ev.sid}</span>
                    </div>
                  </td>
                  <td className="hidden py-2 pr-3 text-text-muted sm:table-cell">
                    {deviceLabel(ev.userAgent)}
                  </td>
                  <td className="hidden py-2 pr-3 font-mono text-xs text-text-muted md:table-cell">
                    {ev.ip || '—'}
                  </td>
                  <td
                    className="py-2 text-right text-text-faint"
                    title={new Date(ev.at).toLocaleString()}
                  >
                    {formatRelative(ev.at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
