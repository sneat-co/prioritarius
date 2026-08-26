/**
 * Locale registry. Add a locale module here after writing it against the Copy
 * contract — and see languages.ts for the other four steps it needs.
 */
import type { LangCode } from '../languages';
import type { Copy } from './types';
import { en } from './en';
import { ru } from './ru';

const COPY: Record<LangCode, Copy> = { en, ru };

export const getCopy = (locale: LangCode): Copy => COPY[locale];

export type { Copy };
