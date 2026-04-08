import Link from "next/link"

export const metadata = {
  title: "Terms of Service — TruQC",
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <img src="/logo.png" alt="TruQC" className="h-8 w-auto" />
      </Link>

      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: 8 April 2026
      </p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">1. Service description</h2>
          <p>
            TruQC provides an automated quality control platform for subsea and pipeline survey data.
            The service includes data upload, validation, anomaly detection, automated fixing, report
            generation, and data export capabilities.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">2. Your data</h2>
          <ul className="ml-4 list-disc space-y-2">
            <li>
              <span className="font-medium text-foreground">You own your data.</span> All survey files, datasets,
              and reports you create remain your intellectual property.
            </li>
            <li>
              <span className="font-medium text-foreground">Limited licence.</span> By uploading data, you grant
              TruQC a limited licence to process, store, and display your data solely for the purpose of providing
              the QC service to you.
            </li>
            <li>
              <span className="font-medium text-foreground">No secondary use.</span> We will never use your survey
              data for training AI models, analytics products, or any purpose other than delivering the service.
            </li>
            <li>
              <span className="font-medium text-foreground">Deletion.</span> When you delete data or your account,
              it is permanently removed. See our{" "}
              <Link href="/privacy" className="text-teal-600 hover:underline dark:text-teal-400">
                Privacy Policy
              </Link>{" "}
              for retention details.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">3. Acceptable use</h2>
          <p>You agree not to:</p>
          <ul className="ml-4 mt-2 list-disc space-y-1">
            <li>Upload malicious files or attempt to compromise the service</li>
            <li>Share account credentials or allow unauthorised access</li>
            <li>Reverse-engineer or scrape the platform</li>
            <li>Use the service to process data you do not have rights to</li>
            <li>Exceed reasonable usage limits (file size, request volume)</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">4. Service limitations</h2>
          <ul className="ml-4 list-disc space-y-2">
            <li>
              <span className="font-medium text-foreground">QC is advisory.</span> Validation results and
              auto-fixes are provided as recommendations. TruQC does not guarantee that all data errors will
              be detected. Final responsibility for data quality remains with you.
            </li>
            <li>
              <span className="font-medium text-foreground">Availability.</span> We aim for high availability
              but do not guarantee uninterrupted service. Scheduled maintenance will be communicated in advance.
            </li>
            <li>
              <span className="font-medium text-foreground">File limits.</span> Individual file uploads are
              limited to 50MB during the current release.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">5. Subscription &amp; billing</h2>
          <ul className="ml-4 list-disc space-y-1">
            <li>Free tier includes basic QC functionality with usage limits.</li>
            <li>Paid plans are billed monthly in GBP. Prices are shown on the pricing page.</li>
            <li>You may cancel at any time. Access continues until the end of the billing period.</li>
            <li>Refunds are handled on a case-by-case basis.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">6. Liability</h2>
          <p>
            To the maximum extent permitted by UK law, TruQC shall not be liable for any indirect,
            incidental, or consequential damages arising from use of the service. Our total liability
            is limited to the amount paid by you in the 12 months preceding the claim.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">7. Governing law</h2>
          <p>
            These terms are governed by the laws of England and Wales. Any disputes will be resolved
            in the courts of England and Wales.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">8. Contact</h2>
          <p>
            Questions about these terms? Email us at{" "}
            <a href="mailto:hello@truqc.co.uk" className="text-teal-600 hover:underline dark:text-teal-400">
              hello@truqc.co.uk
            </a>.
          </p>
        </section>
      </div>
    </div>
  )
}
