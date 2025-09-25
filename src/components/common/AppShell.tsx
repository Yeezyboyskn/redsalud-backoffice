import Sidebar from "./Sidebar"
import Topbar from "./Topbar"

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <Topbar />
        <main className="p-4">{children}</main>
      </div>
    </div>
  )
}
