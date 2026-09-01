import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendTemplateEmail, type SendTemplateEmailOptions, type SendTemplateEmailResult } from './send-email.ts'

type EmailLogClient = ReturnType<typeof createClient>


export async function sendTemplateEmailWithLog(
  supabase: EmailLogClient,
  templateName: string,
  recipientEmail: string,
  options: SendTemplateEmailOptions = {},
): Promise<SendTemplateEmailResult> {
  try {
    const result = await sendTemplateEmail(templateName, recipientEmail, options)
    const { error } = await supabase.from('email_send_log').insert({
      message_id: null,
      template_name: templateName,
      recipient_email: recipientEmail,
      status: result.sent ? 'sent' : 'suppressed',
    })

    if (error) {
      console.error('[email] Failed to record delivery outcome', {
        templateName,
        error: error.message ?? 'Unknown database error',
      })
    }

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const { error: logError } = await supabase.from('email_send_log').insert({
      message_id: null,
      template_name: templateName,
      recipient_email: recipientEmail,
      status: 'failed',
      error_message: errorMessage.slice(0, 1000),
    })

    if (logError) {
      console.error('[email] Failed to record send failure', {
        templateName,
        error: logError.message ?? 'Unknown database error',
      })
    }

    throw error
  }
}
