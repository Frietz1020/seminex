import { describe, expect, it } from 'vitest';
import type { OrgSeminarListingRequest } from './orgTypes';
import type { CursorPage, CursorPageRequest } from './types';

describe('cursor page API types', () => {
  it('models the first page request and continuation cursor', () => {
    const request: CursorPageRequest = { pageSize: 20, search: 'seminar' };
    const orgRequest: OrgSeminarListingRequest = {
      seminars: { pageSize: 10, search: 'published' },
      drafts: { cursor: 'draft-cursor' },
    };
    const page: CursorPage<string> = { items: ['seminar-1'], nextCursor: 'next-page' };

    expect(request.pageSize).toBe(20);
    expect(orgRequest.seminars?.search).toBe('published');
    expect(page.items).toEqual(['seminar-1']);
    expect(page.nextCursor).toBe('next-page');
  });
});
