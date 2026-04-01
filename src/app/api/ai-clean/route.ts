import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import Anthropic from "@anthropic-ai/sdk"

interface AiCleanRequest {
  /** Unresolved issues from auto-clean */
  issues: {
    type: string
    severity: string
    row?: number
    column?: string
    message: string
  }[]
  /** Surrounding rows for context (header + nearby data) */
  contextRows: string[][]
  /** All column headers */
  headers: string[]
  /** File name for context */
  fileName: string
}

interface AiSuggestion {
  row: number
  column: string
  currentValue: string
  suggestedValue: string
  confidence: number // 0-1
  explanation: string
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
      { error: "AI cleaning is not configured. Contact support." },
      { status: 503 }
    )
  }

  try {
    const body: AiCleanRequest = await request.json()
    const { issues, contextRows, headers, fileName } = body

    if (!issues || issues.length === 0) {
      return NextResponse.json({ suggestions: [] })
    }

    // Limit context to prevent huge prompts
    const maxIssues = 15
    const limitedIssues = issues.slice(0, maxIssues)

    // Format context rows as a readable table
    const contextTable = contextRows
      .map((row, i) =>
        i === 0
          ? `| ${row.join(" | ")} |`
          : `| ${row.join(" | ")} |`
      )
      .join("\n")

    const anthropic = new Anthropic({ apiKey })

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `You are a survey data QC specialist analyzing pipeline/seabed survey data from "${fileName}".

The following issues could not be resolved by automated cleaning. For each issue, suggest a fix with a confidence score (0.0-1.0) and explanation.

**Column headers:** ${headers.join(", ")}

**Data context (surrounding rows):**
${contextTable}

**Unresolved issues:**
${limitedIssues
  .map(
    (issue, i) =>
      `${i + 1}. [${issue.severity.toUpperCase()}] ${issue.message}${
        issue.row ? ` (Row ${issue.row})` : ""
      }${issue.column ? ` [Column: ${issue.column}]` : ""}`
  )
  .join("\n")}

For each issue, respond in this exact JSON format (array of suggestions):
\`\`\`json
[
  {
    "row": <row number>,
    "column": "<column name>",
    "currentValue": "<what's there now>",
    "suggestedValue": "<your suggestion>",
    "confidence": <0.0-1.0>,
    "explanation": "<why this fix makes sense, referencing surrounding data>"
  }
]
\`\`\`

Rules:
- Only suggest fixes where you have reasonable confidence (>0.3)
- For missing values across wide gaps, use surrounding data trends
- For suspicious outliers, consider if the value could be legitimate (e.g., seabed type change)
- For KP issues, consider survey line direction
- Reference specific nearby values in your explanations
- If you cannot suggest a fix, omit that issue from the response`,
        },
      ],
    })

    // Extract JSON from response
    const responseText =
      message.content[0].type === "text" ? message.content[0].text : ""

    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/)
    const jsonStr = jsonMatch ? jsonMatch[1] : responseText

    let suggestions: AiSuggestion[] = []
    try {
      const parsed = JSON.parse(jsonStr.trim())
      suggestions = Array.isArray(parsed) ? parsed : []
    } catch {
      // If JSON parsing fails, return empty suggestions
      suggestions = []
    }

    // Validate and sanitize suggestions
    suggestions = suggestions
      .filter(
        (s) =>
          typeof s.row === "number" &&
          typeof s.column === "string" &&
          typeof s.confidence === "number" &&
          s.confidence >= 0 &&
          s.confidence <= 1
      )
      .map((s) => ({
        row: s.row,
        column: s.column,
        currentValue: String(s.currentValue ?? ""),
        suggestedValue: String(s.suggestedValue ?? ""),
        confidence: Math.round(s.confidence * 100) / 100,
        explanation: String(s.explanation ?? ""),
      }))

    return NextResponse.json({ suggestions })
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI cleaning failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
