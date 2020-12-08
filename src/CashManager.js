export class CashManager{
	constructor(){
		this.bank = 0;
	}

	Deposit(amount){
		this.bank += amount || 0;
	}
	
	ClearBank(){
		this.bank = 0;
	}
}