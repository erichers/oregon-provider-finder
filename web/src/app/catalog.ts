export const GROUPS: { key: string; label: string }[] = [
  { key: 'physician', label: 'Physicians (MD, DO)' },
  { key: 'nurse_practitioner', label: 'Nurse practitioners' },
  { key: 'physician_assistant', label: 'Physician assistants' },
  { key: 'psychologist', label: 'Psychologists' },
  { key: 'counselor', label: 'Counselors (LPC and others)' },
  { key: 'social_worker', label: 'Social workers' },
  { key: 'mft', label: 'Marriage and family therapists' },
];

export const PRESETS: { key: string; label: string }[] = [
  { key: 'psychiatry', label: 'Psychiatry' },
  { key: 'therapy', label: 'Therapy and counseling' },
  { key: 'primary_care', label: 'Primary care' },
  { key: 'children', label: 'Children and teens' },
  { key: 'substance_use', label: 'Substance use' },
];

export function groupLabel(key: string): string {
  return GROUPS.find((item) => item.key === key)?.label ?? key;
}
