import { CategoryGrid } from '@/features/home/sections/CategoryGrid'
import { HotCarousel } from '@/features/home/sections/HotCarousel'
import { LatestFeed } from '@/features/home/sections/LatestFeed'
import { WelcomeSection } from '@/features/home/sections/WelcomeSection'

export function HomePage() {
  return (
    <section
      data-page="home"
      className="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-10"
    >
      <WelcomeSection />
      <CategoryGrid />
      <HotCarousel />
      <LatestFeed />
    </section>
  )
}
