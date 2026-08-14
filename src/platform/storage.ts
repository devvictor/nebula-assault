/**
 * The only place that knows how persistence works.
 *
 * Game code calls storage.get/set and never touches localStorage — iOS clears
 * some web storage aggressively, and the native build should be backed by
 * @capacitor/preferences instead. Swapping the backend happens here, alone.
 */

const PREFIX = 'nebula-assault:'

function available(): boolean {
  try {
    const k = `${PREFIX}__probe`
    localStorage.setItem(k, '1')
    localStorage.removeItem(k)
    return true
  } catch {
    // Private browsing, disabled storage, or a locked-down WebView.
    return false
  }
}

const ok = available()
const memory = new Map<string, string>()

export const storage = {
  get(key: string): string | null {
    if (!ok) return memory.get(key) ?? null
    try {
      return localStorage.getItem(PREFIX + key)
    } catch {
      return null
    }
  },

  set(key: string, value: string): void {
    if (!ok) {
      memory.set(key, value)
      return
    }
    try {
      localStorage.setItem(PREFIX + key, value)
    } catch {
      /* full or blocked — a lost high score must never break the game */
    }
  },

  getNumber(key: string, fallback: number): number {
    const raw = this.get(key)
    if (raw === null) return fallback
    const n = Number(raw)
    return Number.isFinite(n) ? n : fallback
  },

  getBool(key: string, fallback: boolean): boolean {
    const raw = this.get(key)
    if (raw === null) return fallback
    return raw === '1' || raw === 'true'
  },
}
