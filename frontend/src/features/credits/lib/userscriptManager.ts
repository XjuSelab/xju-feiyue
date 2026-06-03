/**
 * 检测浏览器里的「用户脚本管理器」(脚本猫/暴力猴)与「飞跃导入」脚本是否已安装，
 * 供「从教务系统导入」引导向导决定下一步（none → manager → ready 逐级前进）。
 *
 * 三种信号、可靠性递减：
 * - 我们的脚本是否已装(最可靠)：import.user.js 也 @match 飞跃站点，装上后会在本页
 *   设置 `window.__feiyueImporterReady` / `<html data-feiyue-importer>`（任何管理器下都生效，
 *   含篡改猴），同步可读。
 * - 「裸」管理器是否在场：对暴露了**静态** web_accessible_resources 的管理器可探测
 *   —— 脚本猫 `/src/install.html`(matches <all_urls>，非动态 URL)、暴力猴 `injected-web.js`。
 * - 篡改猴 MV3 用动态 URL，无法用固定 URL 探测 → 只能靠上面的「自报」或向导里的
 *   「手动下一步」兜底（装篡改猴的人，装上我们脚本后即被「自报」可靠识别）。
 */

declare global {
  interface Window {
    __feiyueImporterReady?: boolean
  }
}

// Chrome 应用商店稳定 ID。
const SCRIPTCAT_ID = 'ndcooeababalnlpkfedmmbbbgkljhpjf'
const VIOLENTMONKEY_ID = 'jinjaccalgkegednnccohejagnlnfdag'

/** 各管理器的「静态」可访问资源 URL（能取到即代表该扩展在场）。 */
const MANAGER_PROBES = [
  `chrome-extension://${SCRIPTCAT_ID}/src/install.html`,
  `chrome-extension://${VIOLENTMONKEY_ID}/injected-web.js`,
]

/** 我们的导入脚本是否已安装（任何管理器下都生效，同步）。 */
export function isImporterInstalled(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.__feiyueImporterReady === true ||
    document.documentElement.hasAttribute('data-feiyue-importer')
  )
}

async function resourceExists(url: string, timeoutMs = 1500): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(url, { signal: ctrl.signal })
    window.clearTimeout(timer)
    return res.ok
  } catch {
    return false
  }
}

/** 是否检测到「裸」用户脚本管理器（脚本猫/暴力猴；篡改猴不可固定 URL 探测）。 */
export async function detectManager(): Promise<boolean> {
  const hits = await Promise.all(MANAGER_PROBES.map((u) => resourceExists(u)))
  return hits.some(Boolean)
}

/** 当前安装进度。 */
export type InstallState = 'none' | 'manager' | 'ready'

/** 综合判断：ready(脚本已装) > manager(有管理器没脚本) > none。 */
export async function detectInstallState(): Promise<InstallState> {
  if (isImporterInstalled()) return 'ready'
  return (await detectManager()) ? 'manager' : 'none'
}
