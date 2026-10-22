/**
 * In-Flight Trie-Based Content Moderation Pipeline with Leetspeak Normalization
 * Executes synchronously in O(M) time within the Socket.io message processing chain.
 */

export class TrieNode {
  public children: Map<string, TrieNode>;
  public isEndOfWord: boolean;
  public word: string;

  constructor() {
    this.children = new Map<string, TrieNode>();
    this.isEndOfWord = false;
    this.word = '';
  }
}

export class Trie {
  private root: TrieNode;

  constructor() {
    this.root = new TrieNode();
  }

  public insert(word: string): void {
    const normalized = word.trim().toLowerCase();
    if (!normalized) return;

    let current = this.root;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];
      if (!current.children.has(char)) {
        current.children.set(char, new TrieNode());
      }
      current = current.children.get(char)!;
    }
    current.isEndOfWord = true;
    current.word = normalized;
  }

  public insertMany(words: string[]): void {
    for (const w of words) {
      this.insert(w);
    }
  }

  public getRoot(): TrieNode {
    return this.root;
  }
}

// Leetspeak Mapping: maps obfuscated characters to potential alphabet characters
// Handles @ -> a, $ -> s, 0 -> o, 3 -> e, ! -> i, 1 -> l and i
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
  '1': ['l', 'i'], // Supports both 1 -> l (bu11shit, s1ut) and 1 -> i (d1ck, b1tch)
  '0': ['o'],
  '$': ['s'],
  '5': ['s'],
  '7': ['t'],
  '+': ['t'],
  'v': ['u'],
};

// Base Lexicon of Prohibited Profanities and Slurs
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

export class ModerationPipeline {
  private trie: Trie;

  constructor(lexicon: string[] = DEFAULT_LEXICON) {
    this.trie = new Trie();
    this.trie.insertMany(lexicon);
  }

  private isAlphaNumeric(char: string | undefined): boolean {
    if (!char) return false;
    const code = char.charCodeAt(0);
    return (
      (code >= 48 && code <= 57) || // 0-9
      (code >= 65 && code <= 90) || // A-Z
      (code >= 97 && code <= 122)   // a-z
    );
  }

  /**
   * Synchronously sanitizes text:
   * 1. Normalizes leetspeak representations (@ -> a, $ -> s, 0 -> o, 3 -> e, ! -> i, 1 -> l/i)
   * 2. Scans using the Trie structure in O(M) time
   * 3. Replaces offending sequences with exact-length asterisks (****)
   * 4. Preserves surrounding whitespace and punctuation
   */
  public sanitizeMessage(rawText: string): string {
    if (!rawText || typeof rawText !== 'string') {
      return '';
    }

    const n = rawText.length;
    if (n === 0) return '';

    const intervals: Array<{ start: number; end: number }> = [];

    // Scan raw text with Trie
    for (let i = 0; i < n; i++) {
      // Must be at a word boundary in raw text to prevent false positives (e.g. "classic", "pass", "assessment")
      const prevRawChar = i > 0 ? rawText[i - 1] : undefined;
      if (this.isAlphaNumeric(prevRawChar)) {
        continue;
      }

      // Check Trie matches starting from index i
      const matchEnd = this.searchLongestMatch(rawText, i, n);
      if (matchEnd !== -1) {
        intervals.push({ start: i, end: matchEnd });
        i = matchEnd; // Advance past matched word
      }
    }

    if (intervals.length === 0) {
      return rawText;
    }

    // Merge overlapping intervals
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

    // Replace matched ranges with asterisks matching original character length
    const resultChars = rawText.split('');
    for (const { start, end } of merged) {
      for (let p = start; p <= end; p++) {
        resultChars[p] = '*';
      }
    }

    return resultChars.join('');
  }

  /**
   * Traverses Trie with support for leetspeak branch candidates
   */
  private searchLongestMatch(rawText: string, startIndex: number, n: number): number {
    let lastMatchEnd = -1;

    // Helper dfs/bfs traversal for leetspeak candidates
    const dfs = (node: TrieNode, idx: number): void => {
      if (node.isEndOfWord) {
        // Verify end word boundary against raw text punctuation
        const nextRawChar = idx < n ? rawText[idx] : undefined;
        if (!this.isAlphaNumeric(nextRawChar)) {
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

    dfs(this.trie.getRoot(), startIndex);
    return lastMatchEnd;
  }

  public addWords(words: string[]): void {
    this.trie.insertMany(words);
  }
}

export const moderationPipeline = new ModerationPipeline();
export const sanitizeMessage = (text: string): string => moderationPipeline.sanitizeMessage(text);
