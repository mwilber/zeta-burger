import Phaser from 'phaser';

export default class Platform extends Phaser.GameObjects.Rectangle{
	constructor({ scene, id, x, y, width, height, fill, stroke }){
		super(scene, x, y, width, height, fill, stroke);

		this.id = id;
		this.fontSize = 16;
		this.defaultFill = fill;
		this.landedFill = 0x990000;
		this.holdFill = 0xcccc00;
		this.orderFill = 0x0000ff;
		this.processFill = 0xff00ff;
		this.hold = null;
		this.orderId = null;

		this.scene.make.text({ x:(x-(width*0.5)), y:(y-(this.fontSize*0.5)), text:this.id, style:{ align: 'center', fontSize: (this.fontSize+'px'), fixedWidth: width } }).setDepth(100);
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
		this.setFillStyle(this.processFill);
		this.scene.setHudStatus('Thanks!');
		if(bundle.cb) bundle.cb(bundle);
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