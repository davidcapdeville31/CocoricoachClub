/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface AppNotificationEmailProps {
  siteName?: string
  siteUrl?: string
  title?: string
  message?: string
  ctaLabel?: string
  ctaUrl?: string
}

export const AppNotificationEmail = ({
  siteName = 'CocoriCoach Club',
  siteUrl = 'https://cocoricoachclub.com',
  title = 'Nouvelle notification',
  message = 'Tu as reçu une nouvelle notification dans ton espace CocoriCoach Club.',
  ctaLabel = 'Ouvrir l\'application',
  ctaUrl = 'https://cocoricoachclub.com',
}: AppNotificationEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>{title} — {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://mbloebaovvvgfwxsdzgo.supabase.co/storage/v1/object/public/email-assets/cocoricoach-logo.png"
          alt={siteName}
          width="160"
          style={logo}
        />
        <Heading style={h1}>{title}</Heading>
        <Text style={text}>{message}</Text>
        <Button style={button} href={ctaUrl}>
          {ctaLabel}
        </Button>
        <Text style={footer}>
          Tu reçois cet email car tu as activé les notifications par email dans tes préférences.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default AppNotificationEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const logo = { margin: '0 0 24px', display: 'block' }
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#0B1F3A',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: '#1F2933',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const link = { color: '#17A2B8', textDecoration: 'underline' }
const button = {
  backgroundColor: '#0B1F3A',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '12px',
  padding: '14px 24px',
  textDecoration: 'none',
  display: 'inline-block',
  margin: '8px 0 16px',
}
const footer = {
  fontSize: '12px',
  color: '#6B7280',
  margin: '32px 0 0',
  lineHeight: '1.5',
}