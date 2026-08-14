/**
 * Boot: bakes every texture, then hands over to the title.
 *
 * There is nothing to load — no image or audio files exist. Everything is drawn
 * with Graphics and baked with generateTexture(), and all sound is synthesised.
 * That is what lets the wrapped app open with no network at all.
 */

import Phaser from 'phaser'

import { generateAllTextures } from '../systems/textures'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot')
  }

  create(): void {
    generateAllTextures(this)
    this.scene.start('title')
  }
}
