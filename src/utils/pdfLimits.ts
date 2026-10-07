import { UserError } from './errors';

/** Larger documents are refused: page-tree bombs claim billions of pages in a few KB. */
export const MAX_PAGES = 10_000;

export const tooManyPages = (): UserError => new UserError('This PDF has too many pages (more than 10,000).', 'Very large or malformed PDFs are not supported in the browser.');
