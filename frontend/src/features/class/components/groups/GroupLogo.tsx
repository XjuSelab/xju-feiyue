import { resolveAssetUrl } from '@/api/client'
import { cn } from '@/lib/cn'

import { logoColor, logoInitials } from '../../lib/logoColor'

type Props = {
  gid: string
  name: string
  /** 优先 thumb（服务端 160px），原图兜底。 */
  logo?: string | null | undefined
  logoThumb?: string | null | undefined
  /** tailwind 尺寸类，默认 size-12（卡片）。 */
  className?: string
}

/**
 * 小组 Logo —— 有图走 `resolveAssetUrl`（跨源 rebase，防 CORS 挂起）；
 * 无图 fallback 为组名前两字 + gid 哈希底色（同组永远同色）。
 */
export function GroupLogo({ gid, name, logo, logoThumb, className }: Props) {
  const src = logoThumb ?? logo
  if (src) {
    return (
      <img
        src={resolveAssetUrl(src)}
        alt={`${name} Logo`}
        className={cn('size-12 shrink-0 rounded-lg object-cover', className)}
      />
    )
  }
  return (
    <div
      aria-hidden
      className={cn(
        'grid size-12 shrink-0 select-none place-content-center rounded-lg text-sm font-medium text-white',
        className,
      )}
      style={{ backgroundColor: logoColor(gid) }}
    >
      {logoInitials(name)}
    </div>
  )
}
