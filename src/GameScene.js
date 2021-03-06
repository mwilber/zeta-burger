import Phaser from 'phaser';
import Player from 'Player';
//import { Anims } from './anims';

/**
 * Parent class for all playable scenes
 */
export class GameScene extends Phaser.Scene {
	constructor() {
		super({
			key: "GameScene"
		});

		this.controls = null; // User controls
		this.cursors = null;
		this.player = null;


		// The Anims class is tightly coupled to this GameScene class and
		// is used to break the animation setup code into its own file.
		//this.animsManager = new Anims(this);
	}


	preload() {
		//this.load.image('heart', 'assets/images/heart_full.png');
		//this.animsManager.preload();
		this.load.spritesheet('ship', '../../assets/sprites/anim_ship_spin.png', { frameWidth: 192, frameHeight: 63 });
		this.load.image('landing_gear', '../../assets/sprites/LandingGear.png');
	}

	create(settings) {
		this.cursors = this.input.keyboard.createCursorKeys();

		this.InitAnims();

		this.player = new Player({
			scene: this,
			x: 400,
			y: 300,
			ship: {
				x: 48,
				y: 16,
				asset: 'ship'
			},
			gear: 'gear'
		});
		this.player.ToggleFlightMode();
	}

	update(time, delta) {

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

	InitAnims(){
		this.anims.create({
			key: 'spin',
			frames: this.anims.generateFrameNumbers('ship', { start: 0, end: 3 }),
			frameRate: 10,
			repeat: -1
		});
	}
	
}
