import { createClient } from 'npm:@supabase/supabase-js@2'
import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.1.0'

const getDatabase = () => {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Database configuration is missing')
  return createClient(url, key)
}

const normalizeEmail = (email: string) => email.trim().toLowerCase()

async function recordSuppression(event: {
  event_id: string
  recipient: string
  message_id?: string | null
  metadata?: Record<string, unknown> | null
}, reason: 'bounce' | 'complaint' | 'unsubscribe') {
  const supabase = getDatabase()
  const email = normalizeEmail(event.recipient)

  const { error: suppressionError } = await supabase.from('suppressed_emails').upsert(
    { email, reason, metadata: event.metadata ?? null },
    { onConflict: 'email' },
  )
  if (suppressionError) {
    throw new Error(`Failed to record email suppression: ${suppressionError.message}`)
  }

  const status = reason === 'bounce' ? 'bounced' : reason === 'complaint' ? 'complained' : 'suppressed'
  const message = reason === 'bounce'
    ? 'Permanent bounce — email address is invalid or rejected'
    : reason === 'complaint'
      ? 'Spam complaint — recipient marked email as spam'
      : 'Recipient unsubscribed'

  const { error: logError } = await supabase.from('email_send_log').insert({
    message_id: event.message_id ?? null,
    template_name: 'system',
    recipient_email: email,
    status,
    error_message: message,
    metadata: event.metadata ?? null,
  })
  if (logError) throw new Error(`Failed to record email event: ${logError.message}`)

  console.log('Email event recorded', { event_id: event.event_id, reason })
}

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  on: {
    'email.bounced': (event) => recordSuppression(event, 'bounce'),
    'email.complaint': (event) => recordSuppression(event, 'complaint'),
    'email.unsubscribed': (event) => recordSuppression(event, 'unsubscribe'),
  },
})

Deno.serve((req) => handler(req))

