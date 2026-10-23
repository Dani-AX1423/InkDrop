/**
 * Client-Side In-Flight Moderation Sanitizer
 * Pre-sanitizes optimistic messages immediately upon Enter so banned words never flash or appear in chat.
 */

class TrieNode {
  public children: Map<string, TrieNode> = new Map();
  public isEndOfWord: boolean = false;
  public word: string = '';
}

const LEETSPEAK_CANDIDATES: Record<string, string[]> = {
  '@': ['a'],
  '4': ['a'],
  '8': ['b'],
  '(': ['c'],
  '[': ['c'],
  '<': ['c'],
  '3': ['e'],
  '€': ['e'],
  '!': ['i'],
  '|': ['i', 'l'],
  '1': ['l', 'i'],
  '0': ['o'],
  '$': ['s'],
  '5': ['s'],
  '7': ['t'],
  '+': ['t'],
  'v': ['u'],
};

const DEFAULT_LEXICON: string[] = [
  'ass',
  'asshole',
  'bastard',
  'bitch',
  'bitches',
  'bitching',
  'blowjob',
  'bullshit',
  'cock',
  'cocksucker',
  'cunt',
  'damn',
  'dick',
  'dickhead',
  'dipshit',
  'dumbass',
  'fack',
  'fag',
  'faggot',
  'feck',
  'fuck',
  'fucked',
  'fucker',
  'fucking',
  'fucks',
  'handjob',
  'jackass',
  'motherfucker',
  'motherfucking',
  'nigga',
  'nigger',
  'prick',
  'pussy',
  'retard',
  'shit',
  'shitty',
  'slut',
  'twat',
  'wanker',
  'whore',
];

class ClientModerationPipeline {
  private root = new TrieNode();

  constructor(lexicon: string[] = DEFAULT_LEXICON) {
    for (const word of lexicon) {
      const normalized = word.trim().toLowerCase();
      if (!normalized) continue;
      let curr = this.root;
      for (const char of normalized) {
        if (!curr.children.has(char)) {
          curr.children.set(char, new TrieNode());
        }
        curr = curr.children.get(char)!;
      }
      curr.isEndOfWord = true;
      curr.word = normalized;
    }
  }

  private isAlphaNumeric(char: string | undefined): boolean {
    if (!char) return false;
    const code = char.charCodeAt(0);
    return (
      (code >= 48 && code <= 57) ||
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122)
    );
  }

  public sanitizeMessage(rawText: string): string {
    if (!rawText || typeof rawText !== 'string') return '';
    const n = rawText.length;
    if (n === 0) return '';

    const intervals: Array<{ start: number; end: number }> = [];

    for (let i = 0; i < n; i++) {
      const prevChar = i > 0 ? rawText[i - 1] : undefined;
      if (this.isAlphaNumeric(prevChar)) continue;

      const matchEnd = this.searchLongestMatch(rawText, i, n);
      if (matchEnd !== -1) {
        intervals.push({ start: i, end: matchEnd });
        i = matchEnd;
      }
    }

    if (intervals.length === 0) return rawText;

    const merged: Array<{ start: number; end: number }> = [];
    for (const curr of intervals) {
      if (merged.length === 0) {
        merged.push({ ...curr });
      } else {
        const prev = merged[merged.length - 1];
        if (curr.start <= prev.end) {
          prev.end = Math.max(prev.end, curr.end);
        } else {
          merged.push({ ...curr });
        }
      }
    }

    const chars = rawText.split('');
    for (const { start, end } of merged) {
      for (let p = start; p <= end; p++) {
        chars[p] = '*';
      }
    }
    return chars.join('');
  }

  private searchLongestMatch(rawText: string, startIndex: number, n: number): number {
    let lastMatchEnd = -1;

    const dfs = (node: TrieNode, idx: number): void => {
      if (node.isEndOfWord) {
        const nextChar = idx < n ? rawText[idx] : undefined;
        if (!this.isAlphaNumeric(nextChar)) {
          if (idx - 1 > lastMatchEnd) {
            lastMatchEnd = idx - 1;
          }
        }
      }

      if (idx >= n) return;

      const rawChar = rawText[idx];
      const lower = rawChar.toLowerCase();
      const candidates = LEETSPEAK_CANDIDATES[lower] ?? [lower];

      for (const char of candidates) {
        const nextNode = node.children.get(char);
        if (nextNode) {
          dfs(nextNode, idx + 1);
        }
      }
    };

    dfs(this.root, startIndex);
    return lastMatchEnd;
  }
}

const pipeline = new ClientModerationPipeline();
export const clientSanitizeMessage = (text: string): string => pipeline.sanitizeMessage(text);
