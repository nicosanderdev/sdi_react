import { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import { getCurrentUserId } from '../services/SupabaseHelpers';

/**
 * True when the current user may mutate calendar blocks / iCal for the property
 * (platform admin, personal owner, or company Admin/Manager). Company Member is false.
 */
export function useCanManagePropertyCalendar(propertyId: string | undefined): boolean {
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    if (!propertyId) {
      setCanManage(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const userId = await getCurrentUserId();
        const { data, error } = await supabase.rpc('is_property_owner', {
          p_user_id: userId,
          p_property_id: propertyId,
        });
        if (!cancelled) {
          setCanManage(!error && data === true);
        }
      } catch {
        if (!cancelled) setCanManage(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  return canManage;
}
