/** Everything an upgrade can change. One axis per upgrade. */
export interface PlayerStats {
  fireInterval: number
  damage: number
  bulletSpeed: number
  speed: number
  /** extra symmetric side shots per volley (0, 1 or 2 pairs) */
  sidePairs: number
  /** a rear-facing shot at reduced damage */
  rearShot: boolean
  /** shots pass through enemies */
  pierce: boolean
  /** weak homing, radians/sec */
  homing: number
  /** dash grants invulnerability frames */
  dashInvuln: boolean
  /** kills release a small blast */
  killBlast: boolean
  /** pickups fly to you from further away */
  magnet: boolean
  /** near-misses build the chain */
  graze: boolean
  maxHp: number
}
