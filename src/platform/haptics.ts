/**
 * Haptics adapter. Uses the Capacitor plugin when running wrapped, falls back
 * to navigator.vibrate on Android web, and is a no-op on iOS Safari (which has
 * no vibration API).
 *
 * Never vibrate on a repeating action such as firing.
 */

type ImpactStyle = 'light' | 'medium' | 'heavy'

interface CapacitorHapticsPlugin {
  impact(options: { style: string }): Promise<void>
  selectionStart?(): Promise<void>
}

interface CapacitorGlobal {
  Plugins?: { Haptics?: CapacitorHapticsPlugin }
  isNativePlatform?: () => boolean
}

function cap(): CapacitorGlobal | undefined {
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor
}

const WEB_PATTERN: Record<ImpactStyle, number> = {
  light: 10,
  medium: 24,
  heavy: 44,
}

let enabled = true

export const haptics = {
  setEnabled(v: boolean): void {
    enabled = v
  },

  get available(): boolean {
    return Boolean(cap()?.Plugins?.Haptics) || typeof navigator.vibrate === 'function'
  },

  impact(style: ImpactStyle): void {
    if (!enabled) return

    const plugin = cap()?.Plugins?.Haptics
    if (plugin) {
      // Capacitor's ImpactStyle enum values are capitalised strings.
      const name = style.charAt(0).toUpperCase() + style.slice(1)
      void plugin.impact({ style: name }).catch(() => {})
      return
    }

    if (typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(WEB_PATTERN[style])
      } catch {
        /* ignore */
      }
    }
  },
}
