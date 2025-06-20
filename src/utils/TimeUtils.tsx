// src/utils/timeUtils.ts
import { formatDistanceToNow, parseISO, differenceInDays, format } from 'date-fns';
import { es } from 'date-fns/locale'; // Spanish locale

export const formatRelativeTime = (isoDateString: string | undefined): string => {
  if (!isoDateString) return '';
  try {
    const date = parseISO(isoDateString);
    const now = new Date();
    
    if (differenceInDays(now, date) < 1 && now.getDate() === date.getDate()) { // Today
      return formatDistanceToNow(date, { addSuffix: true, locale: es });
    } else if (differenceInDays(now, date) < 2 && now.getDate() - 1 === date.getDate()) { // Yesterday
      return 'Ayer';
    } else if (differenceInDays(now, date) < 7) { // Within a week
        return format(date, 'eeee', { locale: es }); // Day name e.g. "Lunes"
    } else { // Older
      return format(date, 'dd/MM/yyyy', { locale: es });
    }
  } catch (error) {
    console.error("Error formatting date:", error);
    return isoDateString; // Fallback to original string on error
  }
};