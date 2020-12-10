export class OrderManager{
	constructor(landingPads){

		this.landingPads = landingPads.children.getArray();
	}

	PlaceOrder(){
		let order = {value: 7};
		this.landingPads[0].SetBundle(order);
	}

}

class Order{
	constructor({value}){
		this.value = value;
	}
}