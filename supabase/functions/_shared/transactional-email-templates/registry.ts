import type { ComponentType } from 'npm:react@18.3.1'
import { AppNotificationEmail } from './app-notification.tsx'
import { StatsAvailableEmail } from './stats-available.tsx'
import { InvitationEmail } from './invitation.tsx'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'app-notification': {
    component: AppNotificationEmail,
    subject: (data: Record<string, any>) => data.title || 'Nouvelle notification',
    displayName: 'Notification app',
    previewData: {
      siteName: 'CocoriCoach Club',
      siteUrl: 'https://cocoricoachclub.com',
      title: 'Nouvelle notification',
      message: 'Tu as reçu une nouvelle notification.',
      ctaLabel: "Ouvrir l'application",
      ctaUrl: 'https://cocoricoachclub.com',
    },
  },
  'stats-available': {
    component: StatsAvailableEmail,
    subject: (data: Record<string, any>) =>
      `📊 Stats disponibles — ${data.matchLabel || 'compétition'}`,
    displayName: 'Stats de compétition',
    previewData: {
      siteName: 'CocoriCoach Club',
      matchLabel: 'Match vs Opponent',
      competitionName: 'Championnat',
      matchDate: '15 mai 2026',
      categoryName: 'U18',
      appUrl: 'https://cocoricoachclub.com',
    },
  },
  'invitation': {
    component: InvitationEmail,
    subject: (data: Record<string, any>) => {
      switch (data.invitationType) {
        case 'club_admin':
          return 'Invitation à rejoindre CocoriCoach Club en tant qu\'administrateur'
        case 'collaborator':
          return `${data.inviterName || 'Votre club'} vous invite à rejoindre ${data.clubName || 'l\'équipe'}`
        case 'category_member':
          return `Invitation à rejoindre ${data.categoryName || 'une catégorie'} sur CocoriCoach Club`
        case 'athlete':
        default:
          return `${data.clubName || 'CocoriCoach Club'} — Active ton compte athlète`
      }
    },
    displayName: 'Invitation (collaboration / athlète)',
    previewData: {
      invitationType: 'collaborator',
      inviterName: 'Jean Dupont',
      clubName: 'Peyrehorade',
      categoryName: 'U18',
      roleLabel: 'Coach',
      invitationLink: 'https://cocoricoachclub.com/accept-invitation?token=demo',
    },
  },
}
