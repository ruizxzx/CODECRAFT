export function formatDisplayDate(dateInput: any): string {
  if (!dateInput) return 'Just now';
  
  let dateObj: Date | null = null;

  if (typeof dateInput === 'object' && typeof dateInput.toDate === 'function') {
    try {
      dateObj = dateInput.toDate();
    } catch {
      dateObj = null;
    }
  } else if (typeof dateInput === 'number') {
    dateObj = new Date(dateInput);
  } else if (typeof dateInput === 'string') {
    const parsed = new Date(dateInput);
    if (!isNaN(parsed.getTime())) {
      dateObj = parsed;
    }
  }

  if (!dateObj || isNaN(dateObj.getTime())) return 'Recently';

  try {
    return dateObj.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }) + ' IST';
  } catch {
    return dateObj.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }) + ' IST';
  }
}

export function formatDisplayDateTime(dateInput: any): string {
  return formatDisplayDate(dateInput);
}
