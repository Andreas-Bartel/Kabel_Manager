export type Language = 'de' | 'en';

export type TranslationKey = string;

export interface TranslationDictionary {
  [key: string]: string;
}
