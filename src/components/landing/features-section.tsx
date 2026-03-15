import {
  Search,
  AlertTriangle,
  FileText,
  SlidersHorizontal,
  Zap,
  Download,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const features = [
  {
    icon: Search,
    title: 'Column Auto-Detection',
    description:
      'Automatically identifies DOB, DOC, KP, depth, and other survey column types with confidence scoring.',
  },
  {
    icon: AlertTriangle,
    title: 'Anomaly Flagging',
    description:
      'Detects outliers, spikes, gaps, and tolerance violations across your datasets using rule-based validation.',
  },
  {
    icon: FileText,
    title: 'Explainable Reports',
    description:
      'Every flagged issue includes context and reasoning — no black-box results. Download annotated PDF reports.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Validation Profiles',
    description:
      'Create reusable validation templates with custom thresholds. Apply the same QC rules across projects.',
  },
  {
    icon: Zap,
    title: 'Async Processing',
    description:
      'Upload and keep working. Validation runs in the background with real-time status notifications.',
  },
  {
    icon: Download,
    title: 'Dataset Export',
    description:
      'Export cleaned datasets with annotations. Download as CSV or Excel with flagged rows highlighted.',
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="scroll-mt-16 bg-muted/30 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Everything you need for survey QC
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Purpose-built tools for pipeline and seabed survey data validation.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="border-0 bg-card shadow-sm">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
                  <feature.icon className="h-5 w-5 text-secondary" />
                </div>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
