import Phaser from 'phaser'

export default class ShipSprite extends Phaser.GameObjects.Sprite {
  constructor ({ game, x, y, asset }) {
    super(game, x, y, asset);
    game.add.existing(this);
    this.anims.play('spin', true);
  }
}