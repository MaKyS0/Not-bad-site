import { describe, expect, it } from 'vitest';
import { chunkPages, formatPageList, parsePageList, parseRangeGroups } from '../src/utils/pageRanges';

describe('page ranges', () => {
  it('parses groups, open and reversed ranges', () => {
    expect(parseRangeGroups('1-3, 5, 8-', 10)).toEqual([[1, 2, 3], [5], [8, 9, 10]]);
    expect(parseRangeGroups('-2', 5)).toEqual([[1, 2]]);
    expect(parseRangeGroups('4-2', 5)).toEqual([[4, 3, 2]]);
  });
  it('rejects out-of-range and garbage', () => {
    expect(() => parseRangeGroups('0', 5)).toThrow();
    expect(() => parseRangeGroups('6', 5)).toThrow();
    expect(() => parseRangeGroups('a-b', 5)).toThrow();
    expect(() => parseRangeGroups('', 5)).toThrow();
  });
  it('flattens without duplicates and formats back', () => {
    expect(parsePageList('1-3,2,5', 9)).toEqual([1, 2, 3, 5]);
    expect(formatPageList([5, 1, 2, 3, 9, 8])).toBe('1-3, 5, 8-9');
    expect(chunkPages(5, 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
