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
