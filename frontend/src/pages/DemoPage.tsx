import '@/features/demo/demo.css'

import { SectionShell } from '@/features/demo/components/SectionShell'
import { Finale } from '@/features/demo/sections/Finale'
import { HeroReveal } from '@/features/demo/sections/HeroReveal'
import { OdometerStats } from '@/features/demo/sections/OdometerStats'
import { ParallaxCards } from '@/features/demo/sections/ParallaxCards'
import { ParticleSculpture } from '@/features/demo/sections/ParticleSculpture'
import { RadarBloom } from '@/features/demo/sections/RadarBloom'
import { StrokeWriting } from '@/features/demo/sections/StrokeWriting'
import { TypePlayground } from '@/features/demo/sections/TypePlayground'
import { usePageProgressVar } from '@/features/demo/lib/motion'

/**
 * /demo — Motion Lab 动效炫技场。
 * 八个章节各展示一种动画技术（WAAPI / SVG / rAF / Canvas / variable font…），
 * 零动画库，全部走 CSS 变量 + compositor；prefers-reduced-motion 整页降级。
 */
export function DemoPage() {
  const pageRef = usePageProgressVar<HTMLDivElement>('--pp')

  return (
    <div ref={pageRef} data-page="demo" className="overflow-x-clip">
      <div
        aria-hidden
        className="demo-progress fixed left-0 right-0 top-14 z-30 h-[2px] origin-left bg-link"
      />

      <HeroReveal />

      <div className="divide-y divide-border border-t border-border">
        <SectionShell
          index={1}
          tech="SVG · STROKE-DASHOFFSET"
          title="一篇笔记，从落笔开始"
          desc="stroke-dasharray 扫出每个字的轮廓，fill 在 55% 处接力淡入；每字一个 tspan 级联，颜色循环七大板块。"
        >
          <StrokeWriting />
        </SectionShell>

        <SectionShell
          index={2}
          tech="RAF PARALLAX · PERSPECTIVE"
          title="七大板块，各有各的速度"
          desc="rAF 把滚动进度写成一个 CSS 变量，七张卡按各自 --speed 差速漂移，渲染全部交给 compositor —— JS 不碰 layout。"
        >
          <ParallaxCards />
        </SectionShell>

        <SectionShell
          tone="subtle"
          index={3}
          tech="CANVAS · SPRING PHYSICS"
          title="聚墨成字"
          desc="三千颗粒子从离屏字形采样而来，弹簧积分落位、落定时轻轻震颤；指针划过如墨被推开，移开后缓缓回流。"
        >
          <ParticleSculpture />
        </SectionShell>

        <SectionShell
          index={4}
          tech="ODOMETER · RAF EASING"
          title="把积累变成数字"
          desc="0–9 数字带 translateY 差速滚动，easeOutCubic 收尾恰好落位；tabular-nums 保证一像素不抖。"
        >
          <OdometerStats />
        </SectionShell>

        <SectionShell
          tone="subtle"
          index={5}
          tech="VARIABLE FONT · POINTER MAP"
          title="排版乐器"
          desc="指针 X 控制字距，Y 同时驱动可变字重与行高 —— 字体本身就是动画；松手后 typed custom properties 平滑回弹。"
        >
          <TypePlayground />
        </SectionShell>

        <SectionShell
          index={6}
          tech="SVG · POLYGON LERP"
          title="板块热度雷达"
          desc="同心网格由内向外弹出，数据多边形从圆心逐帧生长到真实坐标；顶点可悬停、可聚焦。"
        >
          <RadarBloom />
        </SectionShell>

        <Finale />

        <div className="px-6 py-10">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-8 gap-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-text-faint">
              Motion Lab · 8 sections · 0 animation libraries
            </p>
            <p className="font-mono text-[11px] uppercase tracking-wider text-text-faint">
              waapi · clip-path · dashoffset · raf spring · canvas 2d · odometer · variable font ·
              polygon lerp · text-stroke · magnetic
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
