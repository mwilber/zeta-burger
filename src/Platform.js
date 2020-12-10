import Phaser from 'phaser';

export default class Platform extends Phaser.GameObjects.Rectangle{
	constructor({ scene, x, y, width, height, fill, stroke }){
		super(scene, x, y, width, height, fill, stroke);

		this.defaultFill = fill;
		this.landedFill = 0x990000;
		this.holdFill = 0xcccc00;
		this.orderFill = 0x0000ff;
		this.processFill = 0xff00ff;
		this.hold = null;
		this.orderId = null;
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

	ProcessBundle(bundle){
		console.log("🚀 ~ file: Platform.js ~ line 27 ~ Platform ~ ProcessBundle ~ bundle", bundle, this.orderId);
		this.setFillStyle(this.processFill);
	}

	SetOrderId(id){
		this.orderId = id;
		this.setFillStyle(this.orderFill);
	}

	Touchdown(ship){
		if(ship.flightmode !== ship.FLIGHT_MODES.landed){
			ship.Land(this);
			let bundle = null;
			if(this.orderId == ship.GetBundleId()) bundle = ship.DeliverBundle();
			if(bundle) this.ProcessBundle(bundle);
		}
	}

	Release(ship){
		this.setFillStyle(this.defaultFill);
		ship.Takeoff();
	}
}