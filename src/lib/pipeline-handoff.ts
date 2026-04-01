// Pipeline → Tool handoff via sessionStorage
// Stores the current pipeline file so tools can pre-load it

const HANDOFF_KEY = "pipeline-tool-handoff"

interface HandoffData {
  fileName: string
  csvContent: string
  timestamp: number
}

/** Store the current pipeline data for tool consumption */
export function setPipelineHandoff(fileName: string, parsedData: string[][]): void {
  try {
    const csvContent = parsedData
      .map((row) =>
        row.map((cell) => {
          if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
            return `"${cell.replace(/"/g, '""')}"`
          }
          return cell
        }).join(",")
      )
      .join("\n")

    const data: HandoffData = { fileName, csvContent, timestamp: Date.now() }
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(data))
  } catch {
    // Storage full or unavailable — tool will fall back to upload
  }
}

/** Consume the pipeline handoff data. Returns a File or null. Clears after read. */
export function consumePipelineHandoff(): File | null {
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY)
    if (!raw) return null

    const data: HandoffData = JSON.parse(raw)

    // Expire after 10 minutes
    if (Date.now() - data.timestamp > 10 * 60 * 1000) {
      sessionStorage.removeItem(HANDOFF_KEY)
      return null
    }

    sessionStorage.removeItem(HANDOFF_KEY)

    const blob = new Blob([data.csvContent], { type: "text/csv" })
    return new File([blob], data.fileName)
  } catch {
    return null
  }
}
