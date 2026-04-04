import { Upload, Scan, ShieldCheck, FileDown } from "lucide-react"

const steps = [
  {
    number: "1",
    icon: Upload,
    title: "Upload",
    description: "Drop your CSV, Excel, or geospatial files. Up to 50MB, any survey type.",
  },
  {
    number: "2",
    icon: Scan,
    title: "Auto-Detect",
    description: "Columns identified automatically — KP, DOB, DOC, coordinates, depth, and more.",
  },
  {
    number: "3",
    icon: ShieldCheck,
    title: "QC & Fix",
    description: "Validation runs in seconds. Issues flagged with explanations. Auto-fix resolves common errors.",
  },
  {
    number: "4",
    icon: FileDown,
    title: "Report & Export",
    description: "Download annotated PDF reports and clean datasets. Ready for your client.",
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="scroll-mt-16 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            From raw data to client-ready in minutes
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Four steps. No training required. Works with your existing survey data formats.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.number} className="relative flex flex-col items-center text-center">
              {index < steps.length - 1 && (
                <div className="absolute left-[calc(50%+2rem)] top-8 hidden h-px w-[calc(100%-4rem)] bg-border lg:block" />
              )}

              <div className="relative mb-4">
                <span className="text-4xl font-bold text-primary/20">
                  {step.number}
                </span>
                <div className="absolute -bottom-1 -right-3 flex size-8 items-center justify-center rounded-full bg-primary/10">
                  <step.icon className="size-4 text-primary" />
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
