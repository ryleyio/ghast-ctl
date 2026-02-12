/**
 * Timeline history tracking for command execution
 */

export interface HistoryEntry {
  timestamp: string;
  command: string;
  urlBefore: string;
  urlAfter: string;
  result: unknown;
  success: boolean;
}

export class History {
  private entries: HistoryEntry[] = [];

  record(params: {
    command: string;
    urlBefore: string;
    urlAfter: string;
    result: unknown;
    success: boolean;
  }): void {
    this.entries.push({
      timestamp: new Date().toISOString(),
      ...params
    });
  }

  getAll(): HistoryEntry[] {
    return this.entries;
  }

  clear(): void {
    this.entries = [];
  }

  get length(): number {
    return this.entries.length;
  }
}
