import { convertToParamMap } from '@angular/router';
import { isActive, readQuery, toParams } from './query';

describe('readQuery', () => {
  it('defaults radius and distance when a place is set', () => {
    const query = readQuery(convertToParamMap({ near: 'Salem' }));
    expect(query.near).toBe('Salem');
    expect(query.radius).toBe(25);
    expect(query.sort).toBe('distance');
    expect(isActive(query)).toBe(true);
  });

  it('drops distance sort when there is no place', () => {
    const query = readQuery(convertToParamMap({ sort: 'distance', groups: 'counselor' }));
    expect(query.sort).toBe('name');
    expect(query.groups).toEqual(['counselor']);
  });

  it('round-trips filters through params', () => {
    const query = readQuery(
      convertToParamMap({
        groups: 'counselor,mft',
        near: '97301',
        radius: '10',
        sex: 'F',
        sort: 'name',
      }),
    );
    const again = readQuery(convertToParamMap(toParams(query)));
    expect(again.groups).toEqual(['counselor', 'mft']);
    expect(again.near).toBe('97301');
    expect(again.radius).toBe(10);
    expect(again.sex).toBe('F');
    expect(again.sort).toBe('name');
  });
});
