/**
 * ILIKE treats % and _ as wildcards and backslash as its escape character, so
 * all three are escaped to keep a user's search term literal.
 */
export function escapeLike(term: string) {
  return term.replace(/[\\%_]/g, (c) => "\\" + c);
}
