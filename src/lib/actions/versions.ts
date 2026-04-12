import type { DatasetVersion, VersionDiff } from "@/lib/types/versions"

export async function fetchVersions(datasetId: string): Promise<DatasetVersion[]> {
  const res = await fetch(`/api/versions?datasetId=${encodeURIComponent(datasetId)}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch versions: ${res.statusText}`)
  }
  const data = await res.json()
  return data.versions
}

export async function fetchVersionDiff(
  datasetId: string,
  versionA: number,
  versionB: number,
  page: number = 1
): Promise<VersionDiff> {
  const res = await fetch("/api/version-diff", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      datasetId,
      versionA,
      versionB,
      page,
      pageSize: 50,
    }),
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch version diff: ${res.statusText}`)
  }
  return res.json()
}
