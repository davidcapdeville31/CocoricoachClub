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
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

type InvitationType = 'club_admin' | 'collaborator' | 'category_member' | 'athlete'

interface InvitationEmailProps {
  invitationType?: InvitationType
  inviterName?: string
  clubName?: string
  categoryName?: string
  roleLabel?: string
  athleteName?: string
  invitationLink?: string
}

const SITE_NAME = 'CocoriCoach Club'
const LOGO_URL =
  'https://mbloebaovvvgfwxsdzgo.supabase.co/storage/v1/object/public/email-assets/cocoricoach-logo.png'

function buildCopy(props: InvitationEmailProps) {
  const inviter = props.inviterName?.trim()
  const club = props.clubName?.trim()
  const category = props.categoryName?.trim()
  const role = props.roleLabel?.trim()
  const athlete = props.athleteName?.trim()

  switch (props.invitationType) {
    case 'club_admin':
      return {
        heading: 'Bienvenue sur CocoriCoach Club',
        intro: inviter
          ? `${inviter} vous invite à rejoindre CocoriCoach Club en tant qu'Administrateur de club.`
          : `Vous êtes invité(e) à rejoindre CocoriCoach Club en tant qu'Administrateur de club.`,
        details:
          "En acceptant cette invitation, vous pourrez créer et gérer votre club, vos équipes et vos collaborateurs.",
        cta: 'Accepter l\'invitation',
      }
    case 'collaborator':
      return {
        heading: 'Vous êtes invité(e) à rejoindre une équipe',
        intro: `${inviter || 'L\'administrateur'} vous invite à rejoindre ${
          club || 'le club'
        } sur CocoriCoach Club${role ? ` en tant que ${role}` : ''}.`,
        details:
          'Cliquez sur le bouton ci-dessous pour créer votre compte et accéder aux données du club.',
        cta: 'Rejoindre l\'équipe',
      }
    case 'category_member':
      return {
        heading: 'Accès à une nouvelle catégorie',
        intro: `${inviter || 'L\'administrateur'} vous donne accès à la catégorie ${
          category || ''
        }${club ? ` du club ${club}` : ''}${role ? ` en tant que ${role}` : ''}.`,
        details:
          'Cliquez ci-dessous pour rejoindre la catégorie et accéder à ses données.',
        cta: 'Accéder à la catégorie',
      }
    case 'athlete':
    default:
      return {
        heading: athlete ? `Bonjour ${athlete}` : 'Bienvenue dans l\'équipe',
        intro: `Un compte athlète a été créé pour toi sur CocoriCoach Club${
          club ? ` au sein de ${club}` : ''
        }${category ? ` (catégorie ${category})` : ''}.`,
        details:
          'Active ton compte pour accéder à ton espace personnel : entraînements, matchs, suivi physique et santé.',
        cta: 'Activer mon compte',
      }
  }
}

export const InvitationEmail = (props: InvitationEmailProps) => {
  const copy = buildCopy(props)
  const ctaUrl = props.invitationLink || 'https://cocoricoachclub.com'

  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>{copy.heading} — {SITE_NAME}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="160" style={logo} />
          <Heading style={h1}>{copy.heading}</Heading>
          <Text style={text}>{copy.intro}</Text>
          <Text style={text}>{copy.details}</Text>
          <Button style={button} href={ctaUrl}>
            {copy.cta}
          </Button>
          <Text style={footer}>
            Ce lien d'invitation est valable 48 heures. Si tu n'as pas demandé cette invitation, tu peux ignorer cet email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default InvitationEmail

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
  margin: '0 0 16px',
}
const link = { color: '#17A2B8', textDecoration: 'underline' }
const button = {
  backgroundColor: '#0B1F3A',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = {
  fontSize: '12px',
  color: '#6B7280',
  margin: '32px 0 0',
  lineHeight: '1.5',
}
