import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface NotificationEmailProps {
  type: string
  title: string
  body?: string | null
  linkUrl?: string | null
  actorName?: string | null
}

export function NotificationEmail({
  title,
  body,
  linkUrl,
  actorName,
}: NotificationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Body
        style={{
          backgroundColor: '#f4f4f5',
          fontFamily: 'DM Sans, sans-serif',
          margin: 0,
          padding: 0,
        }}
      >
        <Container
          style={{
            maxWidth: '480px',
            margin: '0 auto',
            padding: '40px 20px',
          }}
        >
          <Section
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '32px',
            }}
          >
            <Img
              src="https://truqc.co.uk/logo.png"
              alt="TruQC"
              width={120}
              height={32}
              style={{ marginBottom: '24px' }}
            />
            <Heading
              style={{
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: '20px',
                color: '#0f172a',
                margin: '0 0 8px 0',
              }}
            >
              {title}
            </Heading>
            {actorName && (
              <Text
                style={{
                  color: '#64748b',
                  fontSize: '14px',
                  margin: '0 0 12px 0',
                }}
              >
                By {actorName}
              </Text>
            )}
            {body && (
              <Text
                style={{
                  color: '#334155',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  margin: '0 0 16px 0',
                }}
              >
                {body}
              </Text>
            )}
            {linkUrl && (
              <Link
                href={`https://truqc.co.uk${linkUrl}`}
                style={{
                  display: 'inline-block',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  padding: '10px 20px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  textDecoration: 'none',
                  marginTop: '16px',
                }}
              >
                View in TruQC
              </Link>
            )}
          </Section>
          <Text
            style={{
              color: '#94a3b8',
              fontSize: '12px',
              textAlign: 'center' as const,
              marginTop: '24px',
            }}
          >
            <Link
              href="https://truqc.co.uk/settings"
              style={{ color: '#94a3b8' }}
            >
              Manage notification preferences
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
