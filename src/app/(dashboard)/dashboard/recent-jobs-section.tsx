"use client"

import { JobHistoryTable } from "@/components/jobs/job-history-table"

export function RecentJobsSection() {
  return <JobHistoryTable limit={10} />
}
