import type { ComponentType } from 'npm:react@18.3.1'
import { AppNotificationEmail } from './app-notification.tsx'
import { StatsAvailableEmail } from './stats-available.tsx'

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
}
