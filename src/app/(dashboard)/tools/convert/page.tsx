import { Converter } from "./converter"

export default function ConvertPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="animate-fade-up">
        <h1 className="text-xl font-semibold tracking-tight">Format Converter</h1>
        <p className="mt-1 text-sm text-muted-foreground">Convert between survey file formats</p>
      </div>

      <div className="animate-fade-up [animation-delay:80ms] [animation-fill-mode:backwards]">
        <Converter />
      </div>
    </div>
  )
}
