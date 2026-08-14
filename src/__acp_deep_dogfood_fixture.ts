export interface DogfoodResult {
  value: number
  label: string
}

export class LiveAcpCalculator {
  constructor(private readonly factor: number) {}
  calculate(input: number): DogfoodResult {
    return { value: input * this.factor, label: 'acp-live-patched' }
  }
}

export function runDogfoodProbe(input: number): DogfoodResult {
  const calculator = new LiveAcpCalculator(3)
  return calculator.calculate(input)
}

export const DOGFOOD_EXPECTED_VALUE = runDogfoodProbe(7).value
export const unsafeDogfood: any = DOGFOOD_EXPECTED_VALUE
