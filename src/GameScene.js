import Phaser from 'phaser';
import Player from './Player';
//import { Anims } from './anims';
import Platform from './Platform';
import { OrderManager } from './OrderManager';

/**
 * Parent class for all playable scenes
 */
export class GameScene extends Phaser.Scene {
	constructor () {
		super({
			key: "GameScene"
		});

		this.controls = null; // User controls
		this.cursors = null;
		this.player = null;

		this.shipSprite = {
			url: 'assets/sprites/anim_ship_spin.png',
			width: 192,
			height: 63
		}

		this.orderManager = null;


		// The Anims class is tightly coupled to this GameScene class and
		// is used to break the animation setup code into its own file.
		//this.animsManager = new Anims(this);
	}


	preload () {
		//this.load.image('heart', 'assets/images/heart_full.png');
		//this.animsManager.preload();
		this.load.spritesheet('ship', this.shipSprite.url, { frameWidth: this.shipSprite.width, frameHeight: this.shipSprite.height });
		this.load.image('landing_gear', 'assets/sprites/LandingGear.png');
	}

	create (settings) {
		this.cursors = this.input.keyboard.createCursorKeys();

		this.InitAnims();

		this.player = new Player({
			scene: this,
			x: 400,
			y: 400,
			ship: {
				x: 0,
				y: 0,
				width: this.shipSprite.width, 
				height: this.shipSprite.height,
				asset: 'ship'
			},
			gear: 'gear'
		});
		this.player.ToggleFlightMode();

		// Add landing platform
		let platforms = this.physics.add.staticGroup();
		let platform = new Platform({
			scene: this, 
			x: 400, 
			y: 200, 
			width: 200, 
			height: 25, 
			fill: 0x7bb951
		});
		platforms.add( platform, true);
		this.physics.add.collider(this.player, platforms, this.HitLandingPad);
		this.orderManager = new OrderManager(platforms);

		this.orderManager.PlaceOrder();

		window.ship = this.player;
		window.platform = platform;
	}

	update (time, delta) {
		if( this.cursors.up.isDown || this.cursors.down.isDown || this.cursors.left.isDown || this.cursors.right.isDown ){
			if (this.cursors.up.isDown) this.player.SteerUp();
			if (this.cursors.down.isDown) this.player.SteerDown();
			if (this.cursors.left.isDown) this.player.SteerLeft(); 
			else if (this.cursors.right.isDown) this.player.SteerRight();
		}else{
			this.player.SteerRelax();
		}
		this.player.Idle();

		if(this.cursors.space.isDown){
			this.player.ToggleFlightMode();
		}
	}

	InitAnims () {
		this.anims.create({
			key: 'spin',
			frames: this.anims.generateFrameNumbers('ship', { start: 0, end: 3 }),
			frameRate: 10,
			repeat: -1
		});
	}

	HitLandingPad (player, platform) {
		if( !player.gear.visible || 
			player.body.touching.up || 
			player.body.touching.left || 
			player.body.touching.right
		){
			player.Destruct();
		}else{
			platform.Touchdown(player);
		}
	}

	EndGame () {
		console.log('DEAD!');
		this.scene.restart();
	}
	
}
