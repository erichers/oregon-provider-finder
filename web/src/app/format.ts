const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const upperWords = new Set(['SW', 'SE', 'NW', 'NE', 'N', 'S', 'E', 'W', 'US', 'PO']);

const credentialWords: Record<string, string> = {
  'M.D.': 'MD',
  'D.O.': 'DO',
  'PH.D.': 'PhD',
  'PHD': 'PhD',
  'PSYD': 'PsyD',
};

export function streetCase(value: string | null): string {
  if (!value) {
    return '';
  }
  const trimmed = value.trim();
  if (trimmed !== trimmed.toUpperCase()) {
    return trimmed;
  }
  if (/^[A-Z0-9]+-[A-Z0-9]+$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed.toLowerCase().replace(/\b[a-z0-9]+\b/g, (word) => {
    const upper = word.toUpperCase();
    if (upperWords.has(upper)) {
      return upper;
    }
    if (/^\d/.test(word)) {
      return word;
    }
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

export function credentialLine(value: string | null): string {
  if (!value) {
    return '';
  }
  return value
    .split(',')
    .map((part) => {
      const token = part.trim();
      return credentialWords[token.toUpperCase()] ?? token;
    })
    .filter((token) => token.length > 0)
    .join(', ');
}

export function placeCase(value: string | null): string {
  if (!value) {
    return '';
  }
  if (value !== value.toUpperCase()) {
    return value;
  }
  return value.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function phoneText(digits: string | null): string {
  if (!digits || digits.length !== 10) {
    return digits ?? '';
  }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function distanceText(miles: number | null): string {
  if (miles === null) {
    return '';
  }
  if (miles < 1) {
    return 'under 1 mi';
  }
  return `${Math.round(miles)} mi`;
}

export function formatDate(value: string | null): string {
  if (!value || value.length < 10) {
    return '';
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (!year || !month || !day) {
    return value.slice(0, 10);
  }
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}
