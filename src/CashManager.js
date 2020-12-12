export class CashManager{
	constructor(){
		this.bank = 0;
		// TODO: remove this
		window.cash = this;
	}

	Deposit(amount){
		this.bank += amount || 0;
	}
	
	ClearBank(){
		this.bank = 0;
	}
}