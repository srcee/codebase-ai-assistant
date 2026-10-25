import type { LANGUAGES } from '../constants/languages';

export type Language = (typeof LANGUAGES)[number]['id'];
