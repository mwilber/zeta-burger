export class OrderManager{
	constructor(landingPads){

		this.currentorder = 0;
		// Discount the restaurant (pad 0).
		this.landingPadCount = landingPads.length;

	}

	ChooseOrderPad(){
		this.currentorder = Math.floor(Math.random()*(this.landingPadCount))+1;
	}
	
	ClearOrderPad(){
		this.currentorder = 0;
	}
}