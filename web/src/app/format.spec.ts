import { credentialLine, distanceText, streetCase } from './format';

describe('distanceText', () => {
  it('treats a shared ZIP center as under a mile', () => {
    expect(distanceText(0)).toBe('under 1 mi');
    expect(distanceText(4.2)).toBe('4 mi');
    expect(distanceText(null)).toBe('');
  });

  it('keeps street directionals and spaces credentials', () => {
    expect(streetCase('3710 SW US VETERANS HOSPITAL RD')).toBe('3710 SW US Veterans Hospital Rd');
    expect(streetCase('V3-SATP')).toBe('V3-SATP');
    expect(credentialLine('M.D.,PH.D.')).toBe('MD, PhD');
  });
});
