import Phaser from 'phaser';
import Player from './Player';
//import { Anims } from './anims';
import Platform from './Platform';
import { OrderManager } from './OrderManager';
import { CashManager } from './CashManager';
import Hud from './Hud';

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
		this.cashManager = null;


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
		
		this.hud = new Hud({scene: this});
		this.setHudStatus = this.hud.SetStatusText.bind(this.hud);

		// Add landing platform
		let platforms = this.physics.add.staticGroup();
		platforms.add(this.CreatePlatform("Restaurant", 200, 150), true);
		platforms.add(this.CreatePlatform("4", 200, 325), true);
		platforms.add(this.CreatePlatform("3", 600, 325), true);
		platforms.add(this.CreatePlatform("2", 200, 500), true);
		platforms.add(this.CreatePlatform("1", 600, 500), true);
		this.physics.add.collider(this.player, platforms, this.HitLandingPad);

		this.cashManager = new CashManager();
		this.orderManager = new OrderManager({scene: this, platforms});

		this.player.Subscribe('flightmodechange', this.hud.SetFlightModeText.bind(this.hud), this.hud);
		// Toggle the flight mode here so the status gets passed to the hud
		this.player.ToggleFlightMode();

		this.hud.SetMoneyText(0);
		this.orderManager.PlaceOrder({callback: this.HandleOrderCallback.bind(this)});

		// TODO: remove this
		window.ship = this.player;
	}

	HandleOrderCallback(bundle){
		// Artificial delay before next order
		window.setTimeout(() => {
			this.cashManager.Deposit(bundle.value);
			this.hud.SetMoneyText(this.cashManager.bank);
			this.orderManager.PlaceOrder({callback: this.HandleOrderCallback.bind(this)});
		}, 3000);
	}

	CreatePlatform(id, x, y){
		return new Platform({
			scene: this, 
			id: id,
			x: x, 
			y: y, 
			width: 200, 
			height: 25, 
			fill: 0x7bb951
		});
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
