import Phaser from 'phaser';

export default class Platform extends Phaser.GameObjects.Rectangle{
	constructor({ scene, x, y, width, height, fill, stroke }){
		super(scene, x, y, width, height, fill, stroke);

		this.defaultFill = fill;
		this.landedFill = 0x990000;
		this.holdFill = 0xcccc00;
		this.hold = null;
	}

	SetBundle(bundle){
		this.hold = bundle;
		this.setFillStyle(this.holdFill);
	}

	GetBundle(){
		if(!this.hold) return null;
		let bundle = {...this.hold};
		this.hold = null;
		this.setFillStyle(this.landedFill);
		return bundle;
	}

	Touchdown(ship){
		if(ship.flightmode !== ship.FLIGHT_MODES.landed){
			ship.Land(this);
		}
	}

	Release(ship){
		this.setFillStyle(this.defaultFill);
		ship.Takeoff();
	}
}