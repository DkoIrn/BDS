import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import Anthropic from "@anthropic-ai/sdk"
import type { AISummaryResponse } from "@/lib/ai/types"

interface AISummaryRequest {
  clusters: { severity: string; label: string; count: number }[]
  passRate: number
  totalIssues: number
  rowCount: number
  fileName: string
}

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI summary is not configured. Contact support." },
      { status: 503 }
    )
  }

  try {
    const body: AISummaryRequest = await request.json()
    const { clusters, passRate, totalIssues, rowCount, fileName } = body

    if (!clusters || clusters.length === 0) {
      return NextResponse.json({
        summary: "No issues detected in this dataset.",
        topBlockers: [],
        recommendation: "accept",
        confidence: 100,
        reasoning: "No validation issues were found.",
      } satisfies AISummaryResponse)
    }

    // Cap clusters to prevent oversized prompts
    const limitedClusters = clusters.slice(0, 30)

    const clusterList = limitedClusters
      .map((c) => `- [${c.severity.toUpperCase()}] ${c.label} (${c.count} instances)`)
      .join("\n")

    const anthropic = new Anthropic({ apiKey })

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `You are a survey data QC specialist. Analyze these validation results and provide:
1) A 2-3 sentence plain-English summary of the dataset quality.
2) The top 3 most impactful issues (blockers) as short phrases.
3) An accept/reject recommendation with confidence 0-100.

Respond in JSON only:
\`\`\`json
{
  "summary": "...",
  "topBlockers": ["...", "...", "..."],
  "recommendation": "accept" or "reject",
  "confidence": 0-100,
  "reasoning": "..."
}
\`\`\`

**File:** ${fileName}
**Rows:** ${rowCount}
**Pass rate:** ${passRate.toFixed(1)}%
**Total issues:** ${totalIssues}

**Issue clusters:**
${clusterList}`,
        },
      ],
    })

    // Extract JSON from response
    const responseText =
      message.content[0].type === "text" ? message.content[0].text : ""

    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/)
    const jsonStr = jsonMatch ? jsonMatch[1] : responseText

    let parsed: AISummaryResponse
    try {
      const raw = JSON.parse(jsonStr.trim())
      // Validate response shape
      parsed = {
        summary: typeof raw.summary === "string" ? raw.summary : "Unable to generate summary.",
        topBlockers: Array.isArray(raw.topBlockers)
          ? raw.topBlockers.filter((b: unknown) => typeof b === "string").slice(0, 3)
          : [],
        recommendation:
          raw.recommendation === "accept" || raw.recommendation === "reject"
            ? raw.recommendation
            : "reject",
        confidence:
          typeof raw.confidence === "number"
            ? Math.max(0, Math.min(100, raw.confidence))
            : 50,
        reasoning: typeof raw.reasoning === "string" ? raw.reasoning : "",
      }
    } catch {
      // Fallback if JSON parsing fails
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      )
    }

    return NextResponse.json(parsed)
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI summary failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
