import Link from "next/link"

export const metadata = {
  title: "Privacy Policy — TruQC",
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <img src="/logo.png" alt="TruQC" className="h-8 w-auto" />
      </Link>

      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: 8 April 2026
      </p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">1. Who we are</h2>
          <p>
            TruQC (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the truqc.co.uk platform — an automated quality
            control service for subsea and pipeline survey data. This policy explains how we collect,
            use, store, and protect your information.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">2. Information we collect</h2>
          <p className="mb-2 font-medium text-foreground">Account information</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Email address (used for authentication and account communications)</li>
            <li>Full name (optional, for profile display)</li>
            <li>Password (hashed, never stored in plain text)</li>
          </ul>

          <p className="mb-2 mt-4 font-medium text-foreground">Survey data you upload</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>CSV, Excel, and geospatial files uploaded for quality checking</li>
            <li>Parsed metadata (column types, row counts, validation results)</li>
            <li>QC reports generated from your data</li>
          </ul>

          <p className="mb-2 mt-4 font-medium text-foreground">Usage data</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Audit logs of actions performed (uploads, validation runs, exports)</li>
            <li>Basic analytics (page views, feature usage) for service improvement</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">3. How we protect your data</h2>
          <p className="mb-3">
            Survey data is often commercially sensitive. We treat every file you upload as confidential.
          </p>
          <ul className="ml-4 list-disc space-y-2">
            <li>
              <span className="font-medium text-foreground">Encryption at rest</span> — All files and database
              records are encrypted using AES-256 via our infrastructure provider (Supabase).
            </li>
            <li>
              <span className="font-medium text-foreground">Encryption in transit</span> — All connections use
              TLS/HTTPS. No data is transmitted unencrypted.
            </li>
            <li>
              <span className="font-medium text-foreground">Row-level security</span> — Database access controls
              ensure you can only access your own projects, datasets, and reports. No cross-account data access
              is possible.
            </li>
            <li>
              <span className="font-medium text-foreground">Scoped file storage</span> — Uploaded files are stored
              in isolated user-scoped paths with access controlled by security policies.
            </li>
            <li>
              <span className="font-medium text-foreground">Signed download URLs</span> — File downloads use
              time-limited signed URLs (5-minute expiry) that cannot be shared or reused.
            </li>
            <li>
              <span className="font-medium text-foreground">No data sharing</span> — Your survey data is never
              shared with other users, used for training AI models, or sold to third parties.
            </li>
            <li>
              <span className="font-medium text-foreground">No third-party analytics on file contents</span> — We
              do not send your survey data to external analytics or tracking services.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">4. Infrastructure &amp; sub-processors</h2>
          <p className="mb-3">We use the following services to operate TruQC:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li><span className="font-medium text-foreground">Supabase</span> — Authentication, database, and file storage (SOC 2 Type II)</li>
            <li><span className="font-medium text-foreground">Vercel</span> — Frontend hosting and API routes (SOC 2)</li>
            <li><span className="font-medium text-foreground">Railway</span> — Backend processing service (data processed in memory, not persisted)</li>
            <li><span className="font-medium text-foreground">Resend</span> — Transactional email delivery (OTP codes, notifications)</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">5. Data retention</h2>
          <ul className="ml-4 list-disc space-y-1">
            <li>Your data is retained for as long as your account is active.</li>
            <li>When you delete a project, all associated jobs, datasets, files, and reports are permanently deleted.</li>
            <li>When you delete your account, all data is permanently removed within 30 days.</li>
            <li>Audit logs are retained for 12 months for compliance purposes, then automatically purged.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">6. Your rights</h2>
          <p className="mb-2">Under UK GDPR, you have the right to:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Export your data in a portable format</li>
            <li>Object to processing of your data</li>
          </ul>
          <p className="mt-3">
            To exercise any of these rights, contact us at{" "}
            <a href="mailto:privacy@truqc.co.uk" className="text-teal-600 hover:underline dark:text-teal-400">
              privacy@truqc.co.uk
            </a>.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">7. Cookies</h2>
          <p>
            We use essential cookies only — for authentication session management. We do not use
            advertising or tracking cookies. No cookie consent banner is required as these are
            strictly necessary for the service to function.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">8. Changes to this policy</h2>
          <p>
            We may update this policy from time to time. Material changes will be communicated via
            email to registered users. The &quot;last updated&quot; date at the top of this page reflects the
            most recent revision.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">9. Contact</h2>
          <p>
            Questions about this policy? Email us at{" "}
            <a href="mailto:privacy@truqc.co.uk" className="text-teal-600 hover:underline dark:text-teal-400">
              privacy@truqc.co.uk
            </a>.
          </p>
        </section>
      </div>
    </div>
  )
}
