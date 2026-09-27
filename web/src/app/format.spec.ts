import { distanceText } from './format';

describe('distanceText', () => {
  it('treats a shared ZIP center as under a mile', () => {
    expect(distanceText(0)).toBe('under 1 mi');
    expect(distanceText(4.2)).toBe('4 mi');
    expect(distanceText(null)).toBe('');
  });
});
