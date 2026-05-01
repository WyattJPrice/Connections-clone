import { Filter } from 'bad-words';

const filter = new Filter();

export function containsProfanity(text: string): boolean {
  try {
    return filter.isProfane(text);
  } catch {
    return false;
  }
}
