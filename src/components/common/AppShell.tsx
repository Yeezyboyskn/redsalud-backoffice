import Sidebar from "./Sidebar"
import Topbar from "./Topbar"

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0 bg-transparent">
        <Topbar />
        <main className="px-6 py-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-8">{children}</div>
        </main>
      </div>
    </div>
  )
}


