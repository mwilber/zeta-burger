import Phaser from 'phaser';

export default class Platform extends Phaser.GameObjects.Rectangle{
	constructor({ scene, x, y, width, height, fill, stroke }){
		super(scene, x, y, width, height, fill, stroke);

		this.defaultFill = fill;
		this.landedFill = 0x990000;
	}

	Touchdown(ship){
		this.setFillStyle(this.landedFill);
		ship.Land(this);
	}

	Release(ship){
		this.setFillStyle(this.defaultFill);
		ship.Takeoff();
	}
}