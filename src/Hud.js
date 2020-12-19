import Phaser from 'phaser';

export default class Hud {

	constructor({ scene }){

		this.scene = scene;

		this.borderThickness = 5;
		this.borderColor = 0xffffff;
		this.borderAlpha = 1;
		this.windowAlpha = 0.95;
		this.windowColor = 0x000000;
		this.windowHeight = 75;
		this.padding = 12;
		this.dialogSpeed = 3;
		this.scrollFactor = 0; //scrollFactor of 0 fixes to the camera

		// if the dialog window is shown
		this.visible = false;
		// the text that will be displayed in the window
		this.background = null;
		this.graphics = {
			flightMode: null,
			money: null,
			orderStatus: null
		};

		// Create the dialog window
		this._drawBackground();
		this._drawText();
	}

	// Hide/Show the dialog window
	Display(showMe) {
		if(typeof showMe === 'undefined') this.visible = !this.visible;
		else this.visible = showMe;

		if (this.graphics.text) this.graphics.text.visible = this.visible;
		if (this.background) this.background.visible = this.visible;
	}

	SetMoneyText(value) {
		this.graphics.money.setText(value);
	}

	SetFlightModeText(value) {
		this.graphics.flightMode.setText(value);
	}

	SetStatusText(value) {
		console.log("SetStatusText", value)
		this.graphics.orderStatus.setText(value);
	}

	// Calculates where to place the dialog window based on the game size
	_calculateWindowDimensions() {
		var gameHeight = this.scene.sys.game.config.height;
		var gameWidth = this.scene.sys.game.config.width;
		var x = (gameWidth * 0.6);
		var y = this.padding;
		var width = (gameWidth * 0.4) - this.padding;
		var height = this.windowHeight;
		return {
			x,
			y,
			width,
			height
		};
	}

	// Creates the dialog window
	_drawBackground() {
		let dimensions = this._calculateWindowDimensions();
		this.background = this.scene.add.graphics().setScrollFactor(this.scrollFactor);

		this.background.lineStyle(this.borderThickness, this.borderColor, this.borderAlpha);
		this.background.fillStyle(this.windowColor, this.windowAlpha);
		this.background.strokeRoundedRect(dimensions.x, dimensions.y, dimensions.width, dimensions.height, 5);
		this.background.fillRoundedRect(dimensions.x, dimensions.y, dimensions.width, dimensions.height, 5);

		// Ensure the dialog box renders above everything else
		this.background.setDepth(1000);
	}

	// Creates text holder within the dialog window
	_drawText() {
		let dimensions = this._calculateWindowDimensions();
		let columnWidth = ((dimensions.width - (this.padding * 2)) * 0.5);
		let x = dimensions.x + this.padding;
		let y = dimensions.y + (this.padding * 0.5);
		let lineHeight = 22;
		let fontSize = 12;
		let style = {
			wordWrap: { width: columnWidth - this.padding },
			//fontFamily: 'pressstart',
			fontSize: fontSize+'px',
			lineSpacing: '12'
		};

		let row = 0;
		this.graphics.flightModeLabel = this.scene.make.text({ x, y:(y + (lineHeight * row)), text:'Flight Mode:', style }).setScrollFactor(this.scrollFactor);
		this.graphics.flightMode = this.scene.make.text({ x:(x+columnWidth), y:(y + (lineHeight * row)), text:'VALUE', style }).setScrollFactor(this.scrollFactor);
		row++;
		this.graphics.moneyLabel = this.scene.make.text({ x, y:(y + (lineHeight * row)), text:'Credits:', style }).setScrollFactor(this.scrollFactor);
		this.graphics.money = this.scene.make.text({ x:(x+columnWidth), y:(y + (lineHeight * row)), text:'VALUE', style }).setScrollFactor(this.scrollFactor);
		row++;
		this.graphics.orderStatusLabel = this.scene.make.text({ x, y:(y + (lineHeight * row)), text:'Comm:', style }).setScrollFactor(this.scrollFactor);
		this.graphics.orderStatus = this.scene.make.text({ x:(x+columnWidth), y:(y + (lineHeight * row)), text:'VALUE', style }).setScrollFactor(this.scrollFactor);

		// Ensure the dialog text renders above the background
		for( let field in this.graphics){
			if( this.graphics[field] ) this.graphics[field].setDepth(1010);
		}
	}
}