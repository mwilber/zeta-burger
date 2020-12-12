export class OrderManager{
	constructor(landingPads){

		this.landingPads = landingPads.children.getArray();
	}

	PlaceOrder(params){
		params = params || {};
		let orderId = 'test';
		let order = {id: orderId, value: 7, cb: params.callback};
		// Pass the order object to the source pad (restaurant)
		this.landingPads[0].SetBundle(order);
		// Pass the order id to the destination pad
		this.landingPads[1].SetOrderId(orderId);
	}

}

class Order{
	constructor({value}){
		this.value = value;
	}
}