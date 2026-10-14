import { supabase } from '../config/supabase';

export type ContactFormOrigin = 'panel' | 'casas' | 'espacios';

export interface ContactFormPayload {
  name: string;
  email: string;
  message: string;
  origin: ContactFormOrigin;
}

export interface ContactFormResult {
  success: true;
  mode: 'live' | 'dry-run';
}

class ContactService {
  static async sendContactMessage(payload: ContactFormPayload): Promise<ContactFormResult> {
    const { data, error } = await supabase.functions.invoke('send-contact-email', {
      body: payload,
    });

    if (error) {
      throw new Error(error.message);
    }

    const result = data as { success?: boolean; mode?: string; error?: string } | null;
    if (!result?.success) {
      throw new Error(result?.error ?? 'Failed to send contact message');
    }

    return {
      success: true,
      mode: result.mode === 'live' ? 'live' : 'dry-run',
    };
  }
}

export default ContactService;
