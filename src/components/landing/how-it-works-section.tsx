import { Upload, Scan, CheckCircle, FileDown } from 'lucide-react'

const steps = [
  {
    number: '1',
    icon: Upload,
    title: 'Upload',
    description: 'Drop your CSV or Excel files',
  },
  {
    number: '2',
    icon: Scan,
    title: 'Auto-detect',
    description: 'Columns are automatically identified',
  },
  {
    number: '3',
    icon: CheckCircle,
    title: 'Validate',
    description: 'QC checks run in the background',
  },
  {
    number: '4',
    icon: FileDown,
    title: 'Report',
    description: 'Download your annotated results',
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="scroll-mt-16 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            How it works
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            From raw data to validated results in four simple steps.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.number} className="relative flex flex-col items-center text-center">
              {/* Connector line (desktop only, between steps) */}
              {index < steps.length - 1 && (
                <div className="absolute left-[calc(50%+2rem)] top-8 hidden h-px w-[calc(100%-4rem)] bg-border lg:block" />
              )}

              {/* Step number + icon */}
              <div className="relative mb-4">
                <span className="text-4xl font-bold text-primary/20">
                  {step.number}
                </span>
                <div className="absolute -bottom-1 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-secondary/10">
                  <step.icon className="h-4 w-4 text-secondary" />
                </div>
              </div>

              <h3 className="mb-2 text-lg font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
