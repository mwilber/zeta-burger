import Phaser from 'phaser'

export default class ShipSprite extends Phaser.GameObjects.Sprite {
  constructor ({ game, x, y, width, height, asset }) {
    super(game, x, y, asset);
    this.width = width;
    this.height = height;
    game.add.existing(this);
    this.anims.play('spin', true);
  }
}