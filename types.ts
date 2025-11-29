export interface CountryConfig {
  bizCode: string;
  country: string;
  platform: string;
  category: string;
  currency: string;
  referralFeeRate: number;
  storageOtherRate: number;
  defaultReturnRate: number;
  defaultAffiliateRate: number;
  lastMileRule: string;
}

export interface HeadFreightConfig {
  bizCode: string;
  ratePerCbm: number;
  unit: string;
}

export interface ProductConfig {
  sku: string;
  name: string;
  purchasePrice: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightKg: number;
}

export interface CalcInput {
  bizCode: string;
  sku: string;
  salePrice: number;
  adRate: number;
  overrideReturnRate?: number;
}

export interface CalcResult {
  headFreight: number;
  lastMile: number;
  referralFee: number;
  storageOther: number;
  adCost: number;
  returnLoss: number;
  purchaseCost: number;
  totalCost: number;
  netProfit: number;
  margin: number;
  capitalEfficiency: number;
  volumeCbm: number;
  chargeWeight: number;
  sizeTier: string;
  currencyUsed: string;
  appliedReturnRate: number;
}
