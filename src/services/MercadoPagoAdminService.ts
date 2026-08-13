import { supabase } from '../config/supabase';
import type { MercadoPagoLinkStatus } from './UserAdminService';

export interface MercadoPagoAdminActionResult {
  success: boolean;
  message: string;
  mercadoPagoStatus?: MercadoPagoLinkStatus;
  error_code?: string;
  expiresAt?: string;
  linkRequestId?: string;
  note?: string;
}

class MercadoPagoAdminService {
  async sendLink(memberId: string): Promise<MercadoPagoAdminActionResult> {
    const { data, error } = await supabase.functions.invoke('mercado-pago-admin', {
      body: { action: 'send_link', memberId },
    });

    const body = data as MercadoPagoAdminActionResult & { error?: string } | null;

    if (body && body.success === false) {
      return {
        success: false,
        message: body.message || body.error || 'No se pudo enviar el enlace',
        error_code: body.error_code,
        mercadoPagoStatus: body.mercadoPagoStatus,
      };
    }

    if (error) {
      throw new Error(error.message || 'Failed to send Mercado Pago link');
    }

    return {
      success: body?.success === true,
      message: body?.message || (body?.success ? 'Enlace enviado' : 'Error desconocido'),
      mercadoPagoStatus: body?.mercadoPagoStatus ?? 'invite_sent',
      expiresAt: body?.expiresAt,
      linkRequestId: body?.linkRequestId,
    };
  }

  async unlink(memberId: string): Promise<MercadoPagoAdminActionResult> {
    const { data, error } = await supabase.functions.invoke('mercado-pago-admin', {
      body: { action: 'unlink', memberId },
    });

    const body = data as MercadoPagoAdminActionResult & { error?: string } | null;

    if (body && body.success === false) {
      return {
        success: false,
        message: body.message || body.error || 'No se pudo desvincular Mercado Pago',
        error_code: body.error_code,
      };
    }

    if (error) {
      throw new Error(error.message || 'Failed to unlink Mercado Pago');
    }

    return {
      success: body?.success === true,
      message: body?.message || (body?.success ? 'Desvinculado' : 'Error desconocido'),
      mercadoPagoStatus: body?.mercadoPagoStatus ?? 'not_connected',
      note: body?.note,
    };
  }
}

const mercadoPagoAdminService = new MercadoPagoAdminService();
export default mercadoPagoAdminService;
