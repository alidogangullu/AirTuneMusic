import i18n from '../../../i18n';

/**
 * Formats a duration in milliseconds to a mm:ss string.
 */
export function formatDuration(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formats an ISO date string to a relative date (Today, Yesterday, x days ago)
 * or a localized short date string.
 */
export function formatRelativeDate(isoDate: string | undefined): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';

  const { t } = i18n;
  const now = new Date();
  
  // Set times to midnight for accurate day difference count
  const dateMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const diffTime = nowMidnight.getTime() - dateMidnight.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return t('detail.today');
  }
  if (diffDays === 1) {
    return t('detail.yesterday');
  }
  if (diffDays > 1 && diffDays < 7) {
    return t('detail.daysAgo', { count: diffDays });
  }

  // Fallback to localized date string
  return formatFullDate(isoDate);
}

/**
 * Formats an ISO date string to a localized full date (e.g., "Oct 15, 2023" or "15 Eki 2023").
 */
export function formatFullDate(isoDate: string | undefined): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  
  const language = i18n.language === 'tr' ? 'tr-TR' : 'en-US';
  
  try {
    return date.toLocaleDateString(language, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return date.toDateString();
  }
}
