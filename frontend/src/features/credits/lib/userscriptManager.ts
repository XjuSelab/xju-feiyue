/**
 * 检测用户脚本管理器(脚本猫/暴力猴/篡改猴)与「飞跃导入」脚本是否已安装。
 * 供「从教务系统导入」引导向导决定起始步骤 / 自动前进。
 *
 * 调研结论(2026,见 sources):
 * - **我们的脚本是否已装** —— 最可靠。import.user.js @match 飞跃站点，在本页设
 *   `window.__feiyueImporterReady` / `<html data-feiyue-importer>`。注意:用户脚本只在
 *   **页面加载时**运行 —— "刚装好还没刷新"时该标记尚未出现，刷新后才有。所以向导**不**
 *   强依赖它推进，只用它把"老用户 / 已刷新"直接带到最后一步。
 * - **脚本猫**可靠探测:其 web_accessible_resources 暴露静态 `/src/install.html`
 *   (matches <all_urls>、无 use_dynamic_url，已对照其构建配置确认)，fetch 得到即已装。
 *   **必须同时试 Chrome 商店 ID 与 Edge 商店 ID(两者不同!)**。暴力猴同理(injected-web.js)。
 * - **篡改猴**:MV3 下没有对普通页面开放的固定资源/接口 → **无法从网页可靠探测**。
 *   只能靠"装上我们脚本后自报"或向导里的"手动下一步"兜底。
 * - `window.external.{Tampermonkey,Violentmonkey}` 仅对 TM 白名单的"合作页面"(如 GreasyFork)
 *   开放，我们不在白名单 → 多半 undefined，只当一个零成本的额外信号。
 *
 * sources: chromewebstore/edge addons(确切ID)、scriptscat/scriptcat manifest+rspack(无动态URL)、
 * developer.chrome.com web-accessible-resources(use_dynamic_url)、greasyfork install.js(window.external)。
 */

declare global {
  interface Window {
    __feiyueImporterReady?: boolean
  }
}

// 各商店稳定 ID —— 同一管理器在 Chrome 与 Edge 商店的 ID 不同。
const SCRIPTCAT_IDS = [
  'ndcooeababalnlpkfedmmbbbgkljhpjf', // Chrome Web Store
  'liilgpjgabokdklappibcjfablkpcekh', // Microsoft Edge Add-ons
]
const VIOLENTMONKEY_ID = 'jinjaccalgkegednnccohejagnlnfdag' // Chrome

/** 静态可访问资源 URL(能取到即代表该扩展在场)。 */
const MANAGER_PROBES = [
  ...SCRIPTCAT_IDS.map((id) => `chrome-extension://${id}/src/install.html`),
  `chrome-extension://${VIOLENTMONKEY_ID}/injected-web.js`,
]

/** 我们的导入脚本是否已装(仅当本次页面加载时它已运行 → 已自报)。 */
export function isImporterInstalled(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.__feiyueImporterReady === true ||
    document.documentElement.hasAttribute('data-feiyue-importer')
  )
}

/** 零成本同步信号:个别管理器对"合作页面"暴露 window.external.{Tampermonkey,Violentmonkey}。 */
function managerViaExternal(): boolean {
  try {
    const ext = window.external as unknown as
      | { Tampermonkey?: unknown; Violentmonkey?: unknown }
      | undefined
    return Boolean(ext && (ext.Tampermonkey || ext.Violentmonkey))
  } catch {
    return false
  }
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

/** 是否检测到用户脚本管理器(脚本猫/暴力猴可靠;篡改猴探不到 → false,靠手动兜底)。 */
export async function detectManager(): Promise<boolean> {
  if (managerViaExternal()) return true
  const hits = await Promise.all(MANAGER_PROBES.map((u) => resourceExists(u)))
  return hits.some(Boolean)
}

/** 当前安装进度。 */
export type InstallState = 'none' | 'manager' | 'ready'

/** 综合判断:ready(脚本已装) > manager(有管理器没脚本) > none。 */
export async function detectInstallState(): Promise<InstallState> {
  if (isImporterInstalled()) return 'ready'
  return (await detectManager()) ? 'manager' : 'none'
}
