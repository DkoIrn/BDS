import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PipelineWorkflow } from "./pipeline-workflow"

export const metadata: Metadata = {
  title: "Pipeline",
}

export default async function PipelinePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <PipelineWorkflow
      user={{ id: user.id, email: user.email ?? "" }}
    />
  )
}
