import { ReportsTabNav } from "./reports-tab-nav"

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="space-y-6">
      <ReportsTabNav />
      {children}
    </div>
  )
}
