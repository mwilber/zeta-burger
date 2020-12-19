export class OrderManager{
	constructor({scene, platforms}){

		this.landingPads = platforms.children.getArray();
		// TODO: set this based on a property value in the platform
		this.restaurantIdx = 0;
		this.orderIdx = 0;
		this.scene = scene;
	}

	PlaceOrder(params){
		params = params || {};

		this.GetNextCustomer();

		this.orderIdx++;
		let orderId = 'order_'+this.orderIdx;
		let order = {id: orderId, value: 7, destination: this.landingPads[this.nextCustomer].id, cb: params.callback};
		// Pass the order object to the source pad (restaurant)
		this.landingPads[0].SetBundle(order);
		// Pass the order id to the destination pad
		this.landingPads[this.nextCustomer].SetOrderId(orderId);

		this.scene.setHudStatus('New order ready!');
	}

	GetNextCustomer(){
		if(!this.nextCustomer) this.nextCustomer = 0;
		// TODO: replace with a random selection
		this.nextCustomer++;

		if(this.nextCustomer >= this.landingPads.length) this.nextCustomer = 1;
	}

}

class Order{
	constructor({value}){
		this.value = value;
	}
}