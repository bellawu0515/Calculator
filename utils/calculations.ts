import { 
  CalcInput, 
  CalcResult, 
  ProductConfig, 
  CountryConfig, 
  HeadFreightConfig 
} from '../types';
import { COUNTRY_CONFIGS, HEAD_FREIGHT_CONFIGS } from '../constants';

const RATE_EUR_TO_USD = 1.16;
const RATE_JPY_TO_USD = 0.0064;
const LB_TO_KG = 0.45359237;

export function getCountryConfig(bizCode: string): CountryConfig | undefined {
  return COUNTRY_CONFIGS.find((c) => c.bizCode === bizCode);
}

export function getHeadFreightConfig(bizCode: string): HeadFreightConfig | undefined {
  return HEAD_FREIGHT_CONFIGS.find((c) => c.bizCode === bizCode);
}

export function getProductConfigFromList(
  products: ProductConfig[],
  sku: string
): ProductConfig | undefined {
  return products.find((p) => p.sku === sku);
}

function calcHeadFreight(bizCode: string, volumeCbm: number): number {
  const cfg = getHeadFreightConfig(bizCode);
  if (!cfg) return 0;
  return cfg.ratePerCbm * volumeCbm;
}

// US Last Mile Calculation (Simplified)
function calcLastMileUS(
  lengthCm: number,
  widthCm: number,
  heightCm: number,
  weightKg: number,
  platform: string
): { cost: number; tier: string; weight: number } {
  let tier = "Standard Size";
  const girth = lengthCm + 2 * (widthCm + heightCm);

  if (weightKg > 23 || lengthCm > 150 || girth > 330) {
    tier = "Large Bulky";
  } else if (lengthCm > 45 || widthCm > 35 || heightCm > 20 || weightKg > 9) {
    tier = "Large Standard";
  }

  const volWeight = (lengthCm * widthCm * heightCm) / 5000;
  const chargeWeightKg = Math.max(weightKg, volWeight);
  const chargeWeightLb = chargeWeightKg / LB_TO_KG;

  let costUsd = 0;

  if (platform === "TikTok") {
    costUsd = 6.0 + (chargeWeightLb > 1 ? (chargeWeightLb - 1) * 0.9 : 0);
  } else {
    if (tier.includes("Standard")) {
      if (chargeWeightLb <= 1) costUsd = 4.2;
      else costUsd = 5.5 + (chargeWeightLb - 1) * 0.45;
    } else {
      costUsd = 10.0 + (chargeWeightLb - 1) * 0.55;
    }
  }

  return { cost: costUsd, tier, weight: chargeWeightKg };
}

// EU Last Mile Calculation (Simplified)
function calcLastMileEU(
  lengthCm: number,
  widthCm: number,
  heightCm: number,
  weightKg: number
): { cost: number; tier: string; weight: number } {
  const volWeight = (lengthCm * widthCm * heightCm) / 5000;
  const chargeWeight = Math.max(weightKg, volWeight);

  let costEur = 0;
  let tier = "Standard Parcel";

  if (lengthCm > 120 || weightKg > 12) tier = "Oversize";

  if (tier === "Standard Parcel") {
    costEur = 5.5 + (chargeWeight - 1) * 0.6;
  } else {
    costEur = 9.0 + (chargeWeight - 1) * 0.8;
  }

  return { cost: costEur * RATE_EUR_TO_USD, tier, weight: chargeWeight };
}

// JP Last Mile Calculation (Simplified)
function calcLastMileJP(
  lengthCm: number,
  widthCm: number,
  heightCm: number,
  weightKg: number
): { cost: number; tier: string; weight: number } {
  const sizeSum = lengthCm + widthCm + heightCm;
  let costJpy = 0;
  let tier = "";

  if (sizeSum <= 60 && weightKg <= 2) {
    tier = "Size 60";
    costJpy = 500;
  } else if (sizeSum <= 100 && weightKg <= 10) {
    tier = "Size 100";
    costJpy = 900;
  } else if (sizeSum <= 140 && weightKg <= 20) {
    tier = "Size 140";
    costJpy = 1450;
  } else {
    tier = "Size 160+";
    costJpy = 1800 + Math.max(0, weightKg - 25) * 100;
  }

  return { cost: costJpy * RATE_JPY_TO_USD, tier, weight: weightKg };
}

function calcLastMile(
  ruleName: string,
  product: ProductConfig,
  countryCfg: CountryConfig
): { cost: number; tier: string; weight: number } {
  const { lengthCm, widthCm, heightCm, weightKg } = product;

  if (ruleName.includes("US")) {
    return calcLastMileUS(lengthCm, widthCm, heightCm, weightKg, countryCfg.platform);
  } else if (ruleName.includes("EU")) {
    return calcLastMileEU(lengthCm, widthCm, heightCm, weightKg);
  } else if (ruleName.includes("JP")) {
    return calcLastMileJP(lengthCm, widthCm, heightCm, weightKg);
  }
  return { cost: 0, tier: "-", weight: weightKg };
}

export function calculateProfit(
  input: CalcInput,
  products: ProductConfig[]
): CalcResult {
  const { bizCode, sku, salePrice, adRate } = input;

  const countryCfg = getCountryConfig(bizCode);
  const productCfg = getProductConfigFromList(products, sku);

  const zeroResult: CalcResult = {
    headFreight: 0,
    lastMile: 0,
    referralFee: 0,
    storageOther: 0,
    adCost: 0,
    returnLoss: 0,
    purchaseCost: 0,
    totalCost: 0,
    netProfit: 0,
    margin: 0,
    capitalEfficiency: 0,
    volumeCbm: 0,
    chargeWeight: 0,
    sizeTier: "-",
    currencyUsed: "USD",
    appliedReturnRate: 0,
  };

  if (!countryCfg || !productCfg || salePrice <= 0) return zeroResult;

  const volumeCbm =
    (productCfg.lengthCm * productCfg.widthCm * productCfg.heightCm) / 1000000;

  const purchaseCost = productCfg.purchasePrice;
  const headFreight = calcHeadFreight(bizCode, volumeCbm);
  const lastMileInfo = calcLastMile(countryCfg.lastMileRule, productCfg, countryCfg);
  const lastMile = lastMileInfo.cost;
  const referralFee = salePrice * countryCfg.referralFeeRate;
  const storageOther = salePrice * countryCfg.storageOtherRate;
  const adCost = salePrice * adRate;

  const appliedReturnRate =
    input.overrideReturnRate !== undefined
      ? input.overrideReturnRate
      : countryCfg.defaultReturnRate;

  // Assuming partial recovery on return, simplified to 80% loss of sales price equivalent in loss? 
  // Original logic: returnLoss = salePrice * appliedReturnRate * 0.8;
  const returnLoss = salePrice * appliedReturnRate * 0.8;

  const totalCost =
    purchaseCost +
    headFreight +
    lastMile +
    referralFee +
    storageOther +
    adCost +
    returnLoss;

  const netProfit = salePrice - totalCost;
  const margin = salePrice > 0 ? netProfit / salePrice : 0;

  const capitalEfficiency = margin * 4;

  return {
    headFreight,
    lastMile,
    referralFee,
    storageOther,
    adCost,
    returnLoss,
    purchaseCost,
    totalCost,
    netProfit,
    margin,
    capitalEfficiency,
    volumeCbm,
    chargeWeight: lastMileInfo.weight,
    sizeTier: lastMileInfo.tier,
    currencyUsed: countryCfg.currency,
    appliedReturnRate,
  };
}
