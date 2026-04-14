import { Resend } from 'resend'
import { NotificationEmail } from '@/emails/notification-email'
import type { NotificationType } from '@/lib/types/notifications'

let resend: Resend | null = null

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn(
      '[email] RESEND_API_KEY not set -- skipping email delivery'
    )
    return null
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

export async function sendNotificationEmail(params: {
  to: string
  type: NotificationType
  title: string
  body?: string | null
  linkUrl?: string | null
  actorName?: string | null
}): Promise<{
  data: { id: string } | null
  error: { message: string } | null
}> {
  try {
    const client = getResendClient()
    if (!client) {
      return { data: null, error: null }
    }

    const { data, error } = await client.emails.send({
      from: 'TruQC <notifications@truqc.co.uk>',
      to: [params.to],
      subject: params.title,
      react: NotificationEmail({
        type: params.type,
        title: params.title,
        body: params.body,
        linkUrl: params.linkUrl,
        actorName: params.actorName,
      }),
    })

    if (error) {
      console.error('[email] Send failed:', error)
      return { data: null, error: { message: error.message } }
    }

    return { data: data ?? null, error: null }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown email error'
    console.error('[email] Unexpected error:', message)
    return { data: null, error: { message } }
  }
}
