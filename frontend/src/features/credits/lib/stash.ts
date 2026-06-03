import { getApiBase } from '@/api/client'

/** 后端中转端点（挂在已被代理的 /notes 下）。 */
const STASH_PATH = '/notes/transcript-stash'
const TOKEN_KEY = 'labnotes.auth.token'

/**
 * 取回后端暂存的成绩单 PDF（仅本人，取后即删）；无暂存件返回 null。
 * 供「自动导入」按钮轮询与进入页面时一次性自动取回复用。
 */
export async function fetchStashedTranscript(): Promise<File | null> {
  const token = localStorage.getItem(TOKEN_KEY)
  const res = await fetch(`${getApiBase()}${STASH_PATH}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  })
  if (res.status !== 200) return null
  const buf = await res.arrayBuffer()
  return new File([buf], '查看成绩.pdf', { type: 'application/pdf' })
}
