import Phaser from 'phaser';
import ShipSprite from "./sprites/ShipSprite";

export default class Player extends Phaser.GameObjects.Container{
	constructor({ scene, x, y, ship, gear }){
		super(scene, x, y);

		this.FLIGHT_MODES = {
			omicron: 'omicron',
			delta: 'delta',
			landed: 'landed'
		};

		this.acceleration = 500;
		this.omicrondrag = 0.5;
		this.rollmax = 15;

		this.flightmode = this.FLIGHT_MODES.omicron;
		this.flightmodehandlers = [];

		this.ship = new ShipSprite({
			...ship,
			game: scene
		  });

		this.gear = scene.add.sprite(0, ship.height, 'landing_gear');
		this.gear.visible = true;
		this.relax = 0;

		this.add([this.ship, this.gear]);

		this.setActive(true);
		this.setScale(0.25);
		scene.physics.world.enable(this, 0);
		this.setSize(ship.width, ship.height);
		this.body.setSize(ship.width, ship.height, true);
		this.body.setMass(500);
		this.body.setBounce(0.5);
		//this.body.setGravity(1,1);
		this.body.setAllowDrag(true);
		this.body.setDrag(0, 70);
		//this.body.setFriction(1, 0);
		this.body.setCollideWorldBounds(true);
		//this.body.allowGravity = false;
		//this.body.width = 192;
		
		scene.add.existing(this);
	}

	SteerUp(){
		if(this.flightmode === this.FLIGHT_MODES.landed){
			this.TakeOff();
		}else{
			if(this.flightmode === this.FLIGHT_MODES.delta){
				this.body.setAccelerationY(-this.acceleration);
			}else if(this.flightmode === this.FLIGHT_MODES.omicron){
				this.body.setAccelerationY(-(this.acceleration * this.omicrondrag));
			}
		}
	}

	SteerDown(){
		if(this.flightmode !== this.FLIGHT_MODES.landed){
			this.body.setAccelerationY(this.acceleration);
		}
	}

	SteerLeft(){
		if(this.flightmode !== this.FLIGHT_MODES.landed){
			if(this.flightmode === this.FLIGHT_MODES.delta){
				this.body.setAccelerationX(-this.acceleration);
				if(this.angle > -this.rollmax){
					this.setAngle(this.angle-1);
				}
			}else if(this.flightmode === this.FLIGHT_MODES.omicron){
				// this.body.setAccelerationX(-(this.acceleration * this.omicrondrag));
				// if(this.angle > -(this.rollmax * this.omicrondrag)){
				// 	this.setAngle(this.angle-1);
				// }
			}
		}
	}

	SteerRight(){
		if(this.flightmode !== this.FLIGHT_MODES.landed){
			if(this.flightmode === this.FLIGHT_MODES.delta){
				this.body.setAccelerationX(this.acceleration);
				if(this.angle < this.rollmax){
					this.setAngle(this.angle+1);
				}
			}else if(this.flightmode === this.FLIGHT_MODES.omicron){
				// this.body.setAccelerationX((this.acceleration * this.omicrondrag));
				// if(this.angle < (this.rollmax * this.omicrondrag)){
				// 	this.setAngle(this.angle+1);
				// }
			}
		}
	}

	SteerRelax(){
		if(Math.abs(this.angle) < 1){
			this.setAngle(0);
		}else{
			this.setAngle(this.angle*0.7);
		}
		this.body.setAcceleration(0);
	}

	Idle(){
		if(this.relax !== 0){
			this.relax = Math.abs(this.relax) - 1;
		}
	}

	RetractGear(){
		//this.body.allowGravity = true;
		this.gear.visible = false;
		this.body.setSize(this.ship.width, this.ship.height, true);
	}

	ExtendGear(){
		//this.body.allowGravity = false;
		//this.body.setVelocityY(0);
		this.gear.visible = true;
		this.body.setSize(this.ship.width, (this.ship.height + 55), true);
	}

	ChangeFlightMode(newMode){
		if(newMode !== this.flightmode && this.relax === 0){
			this.relax = 10;
			this.flightmode = newMode;
			switch(this.flightmode){
				case this.FLIGHT_MODES.delta:
					this.RetractGear();
					break;
				case this.FLIGHT_MODES.omicron:
					this.ExtendGear();
					break;
				case this.FLIGHT_MODES.landed:
					break;
				default:
			}
			this.Publish('flightmodechange', this.flightmode);
		}
	}

	ToggleFlightMode(){
		if(this.flightmode === this.FLIGHT_MODES.delta){
			this.ChangeFlightMode(this.FLIGHT_MODES.omicron);
		}else{
			this.ChangeFlightMode(this.FLIGHT_MODES.delta);
		}
	}

	Land(){
		//this.body.allowGravity = true;
		this.body.setVelocityX(0);
		this.ChangeFlightMode(this.FLIGHT_MODES.landed);
	}

	TakeOff(){
		this.ChangeFlightMode(this.FLIGHT_MODES.delta);
	}

	Subscribe(event, handler, context) {
		if (typeof context === 'undefined') { context = handler; }
		this.flightmodehandlers.push({ event: event, handler: handler.bind(context) });
	}

	Publish(event, args) {
		this.flightmodehandlers.forEach(topic => {
		  if (topic.event === event) {
			topic.handler(args)
		  }
		})
	}
}