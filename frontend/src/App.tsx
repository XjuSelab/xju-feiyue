import { DesignSystemPage } from '@/pages/_dev/DesignSystemPage'

export default function App() {
  // R3 起会接 router；本轮 dev 直挂 design-system 页面用于视觉对照。
  if (import.meta.env.DEV) {
    return <DesignSystemPage />
  }
  return (
    <main className="grid min-h-screen place-items-center font-mono text-2xl">
      LabNotes
    </main>
  )
}
