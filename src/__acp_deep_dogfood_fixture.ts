export interface DogfoodResult { value: number; label: string }

export class AcpDogfoodCalculator {
constructor(private readonly factor:number){}
calculate(input:number):DogfoodResult{return {value:input*this.factor,label:'acp-live'}}
}

export function runDogfoodProbe(input:number):DogfoodResult {
const calculator=new AcpDogfoodCalculator(3)
return calculator.calculate(input)
}
