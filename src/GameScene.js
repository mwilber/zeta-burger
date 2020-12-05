import Phaser from 'phaser';
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
	}

	create(settings) {

	}

	update(time, delta) {


	}
	
}
