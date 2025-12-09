import React, {
  useState,
  useMemo,
  useEffect,
  ChangeEvent,
} from "react";
import * as XLSX from "xlsx";

// ============================================================================
// 类型定义：成本测算相关
// ============================================================================

interface CountryConfig {
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

interface HeadFreightConfig {
  bizCode: string;
  ratePerCbm: number;
  unit: string;
}

interface ProductConfig {
  sku: string;
  name: string;
  purchasePrice: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightKg: number;
}

interface CalcInput {
  bizCode: string;
  sku: string;
  salePrice: number;
  adRate: number;
  cashCycleDays: number; // 现金周期（天）
  overrideReturnRate?: number;
  manualLastMile?: number; // TK-US 手工填写尾程费（USD/件）
}

interface CalcResult {
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
  capitalEfficiency: number; // 年资金效率 X
  volumeCbm: number;
  chargeWeight: number;
  sizeTier: string;
  currencyUsed: string;
  appliedReturnRate: number;
  roi: number; // 单次周转 ROI Y
}

type DataSourceMode = "history" | "upload";

interface ProductSuggestion {
  label: string;
  level: "A" | "B" | "C" | "D";
  desc: string;
  badgeClass: string;
}

// ============================================================================
// 类型定义：AI 选品报告相关
// ============================================================================

interface AiSummary {
  opportunityScore: number;
  competitionScore: number;
  profitPotential: string; // "低" | "中" | "高"
  riskLevel: string; // "低" | "中" | "高"
}

interface AiCandidate {
  rank: number;
  id: string; // ASIN 或关键词
  title: string;
  type: "ASIN" | "Keyword";
  price: number | null;
  monthlySales: number | null;
  revenue: number | null;
  reviews: number | null;
  rating: number | null;
  level: "A" | "B" | "C" | "D";
  tag: string;
  action: string;
}

type AiModules = Record<string, string>;

interface AiResult {
  summary: AiSummary;
  decisionLabel: string;
  decisionReason: string;
  candidates: AiCandidate[];
  modules: AiModules;
  fullReportMarkdown: string;
}

interface AiTocItem {
  key: string; // 如 "1.1"
  title: string;
}

interface AiTocGroup {
  groupKey: string;
  groupTitle: string;
  items: AiTocItem[];
}

// 用来承接前端上传给后端的多报表
interface UploadedFile {
  name: string;
  content: string; // 每个 Excel / CSV 转成的 CSV 文本
}

// ============================================================================
// 维度常量：国家 & 头程
// ============================================================================

const COUNTRY_CONFIGS: CountryConfig[] = [
  {
    bizCode: "AMZ-US",
    country: "US",
    platform: "Amazon",
    category: "Sports & Outdoors",
    currency: "USD",
    referralFeeRate: 0.15,
    storageOtherRate: 0.01,
    defaultReturnRate: 0.03,
    defaultAffiliateRate: 0,
    lastMileRule: "AMZ_US_FBA",
  },
  {
    bizCode: "AMZ-JP",
    country: "JP",
    platform: "Amazon",
    category: "Sports & Outdoors",
    currency: "USD",
    referralFeeRate: 0.1,
    storageOtherRate: 0.01,
    defaultReturnRate: 0.03,
    defaultAffiliateRate: 0,
    lastMileRule: "AMZ_JP_FBA",
  },
  {
    bizCode: "AMZ-EU",
    country: "EU",
    platform: "Amazon",
    category: "Sports & Outdoors",
    currency: "USD",
    referralFeeRate: 0.15,
    storageOtherRate: 0.01,
    defaultReturnRate: 0.03,
    defaultAffiliateRate: 0,
    lastMileRule: "AMZ_EU_FBA",
  },
  {
    bizCode: "TK-US",
    country: "US",
    platform: "TikTok",
    category: "Sports / Fitness",
    currency: "USD",
    referralFeeRate: 0.06,
    storageOtherRate: 0.025,
    defaultReturnRate: 0.05,
    defaultAffiliateRate: 0.1,
    lastMileRule: "AMZ_US_FBA", // 共用 AMZ-US 的尺寸逻辑，但费用由人工填写覆盖
  },
  {
    bizCode: "TK-EU",
    country: "EU",
    platform: "TikTok",
    category: "Sports / Fitness",
    currency: "USD",
    referralFeeRate: 0.09,
    storageOtherRate: 0.025,
    defaultReturnRate: 0.05,
    defaultAffiliateRate: 0.1,
    lastMileRule: "AMZ_EU_FBA",
  },
];

const HEAD_FREIGHT_CONFIGS: HeadFreightConfig[] = [
  { bizCode: "AMZ-US", ratePerCbm: 230, unit: "CBM" },
  { bizCode: "TK-US", ratePerCbm: 135, unit: "CBM" },
  { bizCode: "AMZ-EU", ratePerCbm: 180, unit: "CBM" },
  { bizCode: "TK-EU", ratePerCbm: 180, unit: "CBM" },
  { bizCode: "AMZ-JP", ratePerCbm: 80, unit: "CBM" },
];

const RATE_EUR_TO_USD = 1.16;
const RATE_JPY_TO_USD = 0.0064;
const HISTORY_KEY = "profitCalc_products_csv";

// ============================================================================
// AI 报告目录常量（模仿卖家穿海）
// ============================================================================

const AI_REPORT_TOC: AiTocGroup[] = [
  {
    groupKey: "1",
    groupTitle: "一：产品分析",
    items: [
      { key: "1.1", title: "Listing 概览" },
      { key: "1.2", title: "产品成绩" },
      { key: "1.3", title: "产品关键节点" },
      { key: "1.4", title: "评论真实性" },
      { key: "1.5", title: "库存管理能力" },
      { key: "1.6", title: "模块总结" },
    ],
  },
  {
    groupKey: "2",
    groupTitle: "二：利润分析",
    items: [
      { key: "2.1", title: "价格销量图" },
      { key: "2.2", title: "利润试算" },
      { key: "2.3", title: "盈亏平衡" },
    ],
  },
  {
    groupKey: "3",
    groupTitle: "三：市场分析",
    items: [
      { key: "3.1", title: "概况" },
      { key: "3.2", title: "销量趋势" },
      { key: "3.3", title: "TOP1 ASIN 销售趋势" },
      { key: "3.4", title: "TOP1 ASIN 年度对比" },
      { key: "3.5", title: "Google Trends" },
      { key: "3.6", title: "关键词搜索趋势" },
      { key: "3.7", title: "关键词竞争" },
      { key: "3.8", title: "差断分析" },
      { key: "3.9", title: "新品成功率" },
      { key: "3.10", title: "卖家实力分析" },
      { key: "3.11", title: "模块总结" },
    ],
  },
  {
    groupKey: "4",
    groupTitle: "四：竞品分析",
    items: [
      { key: "4.1", title: "竞品卖点分析" },
      { key: "4.2", title: "竞品运营策略" },
      { key: "4.3", title: "竞品关键词" },
      { key: "4.4", title: "买家购买偏好" },
      { key: "4.5", title: "竞品卖家" },
      { key: "4.6", title: "竞品利润试算" },
      { key: "4.7", title: "模块总结" },
    ],
  },
  {
    groupKey: "5",
    groupTitle: "五：评论分析",
    items: [
      { key: "5.1", title: "消费者画像" },
      { key: "5.2", title: "使用场景" },
      { key: "5.3", title: "产品体验" },
      { key: "5.4", title: "购买动机" },
      { key: "5.5", title: "未满足的需求" },
    ],
  },
  {
    groupKey: "6",
    groupTitle: "六：产品切入点",
    items: [
      { key: "6.1", title: "变体销量分析" },
      { key: "6.2", title: "差异化方案" },
      { key: "6.3", title: "新品 ASIN 成功经验" },
      { key: "6.4", title: "模块总结" },
    ],
  },
  {
    groupKey: "7",
    groupTitle: "七：货源推荐",
    items: [{ key: "7.1", title: "供应链与货源建议" }],
  },
  {
    groupKey: "8",
    groupTitle: "八：合规检测",
    items: [{ key: "8.1", title: "合规风险与注意事项" }],
  },
];

// ============================================================================
// 工具函数：配置 & CSV 解析
// ============================================================================

function getCountryConfig(bizCode: string): CountryConfig | undefined {
  return COUNTRY_CONFIGS.find((c) => c.bizCode === bizCode);
}

function getHeadFreightConfig(bizCode: string): HeadFreightConfig | undefined {
  return HEAD_FREIGHT_CONFIGS.find((c) => c.bizCode === bizCode);
}

// 解析「新品成本核算.csv」
function parseProductsFromCsvText(text: string): ProductConfig[] {
  // 去掉 UTF-8 BOM
  if (text && text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const rawLines = text.split(/\r?\n/);
  const lines = rawLines.map((ln) => ln.trim()).filter((ln) => ln.length > 0);
  const products: ProductConfig[] = [];

  const isNumeric = (s: string | undefined): boolean => {
    if (!s) return false;
    const cleaned = s.replace(/[^0-9.\-]/g, "");
    if (!cleaned) return false;
    return !Number.isNaN(Number(cleaned));
  };

  const toNumber = (s: string | undefined): number => {
    if (!s) return 0;
    const cleaned = s.replace(/[^0-9.\-]/g, "");
    const n = Number(cleaned);
    return Number.isNaN(n) ? 0 : n;
  };

  for (const line of lines) {
    const cols = line.split(",").map((c) => c.trim());
    if (cols.length < 9) continue;

    // 长宽高列必须是数值
    if (!isNumeric(cols[3]) || !isNumeric(cols[4]) || !isNumeric(cols[5])) {
      continue;
    }

    const sku = cols[0]?.trim();
    if (!sku || sku === "合计") continue;

    const lengthCm = toNumber(cols[3]);
    const widthCm = toNumber(cols[4]);
    const heightCm = toNumber(cols[5]);

    // 优先用「单个包装重量/kg」（第 9 列），再退回体积重、产品重量
    let weightKg = 0;
    if (isNumeric(cols[8])) {
      weightKg = toNumber(cols[8]);
    } else if (isNumeric(cols[7])) {
      weightKg = toNumber(cols[7]);
    } else if (isNumeric(cols[6])) {
      weightKg = toNumber(cols[6]);
    }

    // 采购价：从最后一列往前找第一个带 $ 的单元格
    let purchasePrice = 0;
    for (let j = cols.length - 1; j >= 0; j--) {
      const cell = cols[j];
      if (cell.includes("$")) {
        const after = cell.split("$").pop() || "";
        if (isNumeric(after)) {
          purchasePrice = toNumber(after);
          break;
        }
      }
    }

    products.push({
      sku,
      name: sku,
      purchasePrice,
      lengthCm,
      widthCm,
      heightCm,
      weightKg,
    });
  }

  return products;
}

// ============================================================================
// 尾程运费计算（AMZ-US 精确规则 + EU/JP 简化）
// ============================================================================

function calcLastMileUS_Exact(
  lengthCm: number,
  widthCm: number,
  heightCm: number,
  weightKg: number
): { cost: number; tier: string; weight: number } {
  const dims = [lengthCm, widthCm, heightCm];
  const maxSide = Math.max(...dims);
  const minSide = Math.min(...dims);
  const medianSide = [...dims].sort((a, b) => a - b)[1];
  const girth = maxSide + 2 * medianSide + 2 * minSide;

  const chargeWeightKg = weightKg;
  const lb = chargeWeightKg * 2.20462;
  const oz = chargeWeightKg * 35.274;

  let tier = "";

  if (
    maxSide <= 38.1 &&
    medianSide <= 30.48 &&
    minSide <= 1.905 &&
    chargeWeightKg <= 0.4536
  ) {
    tier = "小号标准尺寸";
  } else if (
    maxSide <= 45.72 &&
    medianSide <= 35.56 &&
    minSide <= 20.32 &&
    chargeWeightKg <= 9.072
  ) {
    tier = "大号标准尺寸";
  } else if (maxSide <= 149.86 && girth <= 330.2 && chargeWeightKg <= 22.68) {
    tier = "大号大件";
  } else if (maxSide > 149.86 || girth > 330.2) {
    if (chargeWeightKg > 68.04) tier = "超大件：150磅以上";
    else if (chargeWeightKg >= 31.75) tier = "超大件：70至150磅";
    else if (chargeWeightKg > 22.68) tier = "超大件：50至70磅";
    else tier = "超大件：0至50磅";
  } else {
    tier = "特殊大件";
  }

  let costUsd = 0;

  if (tier === "小号标准尺寸") {
    if (oz <= 2) costUsd = 3.06;
    else if (oz <= 4) costUsd = 3.15;
    else if (oz <= 6) costUsd = 3.24;
    else if (oz <= 8) costUsd = 3.33;
    else if (oz <= 10) costUsd = 3.43;
    else if (oz <= 12) costUsd = 3.53;
    else if (oz <= 14) costUsd = 3.6;
    else costUsd = 3.65;
  } else if (tier === "大号标准尺寸") {
    if (lb <= 0.25) costUsd = 3.68;
    else if (lb <= 0.5) costUsd = 3.9;
    else if (lb <= 0.75) costUsd = 4.15;
    else if (lb <= 1) costUsd = 4.55;
    else if (lb <= 1.25) costUsd = 4.99;
    else if (lb <= 1.5) costUsd = 5.37;
    else if (lb <= 1.75) costUsd = 5.52;
    else if (lb <= 2) costUsd = 5.77;
    else if (lb <= 2.25) costUsd = 5.87;
    else if (lb <= 2.5) costUsd = 6.05;
    else if (lb <= 2.75) costUsd = 6.21;
    else if (lb <= 3) costUsd = 6.62;
    else {
      const extraBlocks = Math.max(Math.ceil((lb - 3) * 4), 0); // 0.25lb 为一个 block
      costUsd = 6.92 + extraBlocks * 0.08;
    }
  } else if (tier === "大号大件") {
    costUsd = 9.61 + Math.max(lb - 1, 0) * 0.38;
  } else if (tier === "超大件：0至50磅") {
    costUsd = 26.33 + Math.max(lb - 1, 0) * 0.38;
  } else if (tier === "超大件：50至70磅") {
    costUsd = 40.12 + Math.max(lb - 51, 0) * 0.75;
  } else if (tier === "超大件：70至150磅") {
    costUsd = 54.81 + Math.max(lb - 71, 0) * 0.75;
  } else if (tier === "超大件：150磅以上") {
    costUsd = 194.95 + Math.max(lb - 151, 0) * 0.19;
  } else {
    costUsd = 0;
  }

  return { cost: costUsd, tier, weight: chargeWeightKg };
}

function calcLastMileEU(
  lengthCm: number,
  widthCm: number,
  heightCm: number,
  weightKg: number
): { cost: number; tier: string; weight: number } {
  const volWeight = (lengthCm * widthCm * heightCm) / 5000;
  const chargeWeight = Math.max(weightKg, volWeight);

  let costEur = 0;
  let tier = "标准包裹";

  if (lengthCm > 120 || weightKg > 12) tier = "大件";

  if (tier === "标准包裹") {
    costEur = 5.5 + (chargeWeight - 1) * 0.6;
  } else {
    costEur = 9.0 + (chargeWeight - 1) * 0.8;
  }

  return { cost: costEur * RATE_EUR_TO_USD, tier, weight: chargeWeight };
}

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
    tier = "60尺寸";
    costJpy = 500;
  } else if (sizeSum <= 100 && weightKg <= 10) {
    tier = "100尺寸";
    costJpy = 900;
  } else if (sizeSum <= 140 && weightKg <= 20) {
    tier = "140尺寸";
    costJpy = 1450;
  } else {
    tier = "160尺寸以上";
    costJpy = 1800 + Math.max(0, weightKg - 25) * 100;
  }

  return { cost: costJpy * RATE_JPY_TO_USD, tier, weight: weightKg };
}

function calcLastMile(
  ruleName: string,
  product: ProductConfig
): { cost: number; tier: string; weight: number } {
  const { lengthCm, widthCm, heightCm, weightKg } = product;

  if (ruleName === "AMZ_US_FBA") {
    return calcLastMileUS_Exact(lengthCm, widthCm, heightCm, weightKg);
  } else if (ruleName.includes("EU")) {
    return calcLastMileEU(lengthCm, widthCm, heightCm, weightKg);
  } else if (ruleName.includes("JP")) {
    return calcLastMileJP(lengthCm, widthCm, heightCm, weightKg);
  }

  return { cost: 0, tier: "-", weight: weightKg };
}

// ============================================================================
// 主计算函数：用现金周期算年资金效率
// ============================================================================

function calculateProfit(
  input: CalcInput,
  productList: ProductConfig[]
): CalcResult {
  const zero: CalcResult = {
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
    roi: 0,
  };

  const countryCfg = getCountryConfig(input.bizCode);
  const productCfg = productList.find((p) => p.sku === input.sku);

  if (!countryCfg || !productCfg || !input.salePrice) return zero;

  const { salePrice, adRate } = input;

  const volumeCbm =
    (productCfg.lengthCm * productCfg.widthCm * productCfg.heightCm) /
    1_000_000;

  const purchaseCost = productCfg.purchasePrice;

  // 头程：ROUNDUP( 体积 * 运价 * 1.05 , 1 )
  const hfCfg = getHeadFreightConfig(input.bizCode);
  let headFreight = 0;
  if (hfCfg) {
    const raw = volumeCbm * hfCfg.ratePerCbm * 1.05;
    headFreight = Math.ceil(raw * 10) / 10;
  }

  // 尾程：
  // TK-US 支持人工输入尾程费，其余按规则自动计算
  let lastMileInfo: { cost: number; tier: string; weight: number };
  const hasManualLastMile =
    input.bizCode === "TK-US" &&
    typeof input.manualLastMile === "number" &&
    !Number.isNaN(input.manualLastMile);

  if (hasManualLastMile) {
    lastMileInfo = {
      cost: input.manualLastMile as number,
      tier: "人工填写",
      weight: productCfg.weightKg,
    };
  } else {
    lastMileInfo = calcLastMile(countryCfg.lastMileRule, productCfg);
  }

  const lastMile = lastMileInfo.cost;

  const referralFee = salePrice * countryCfg.referralFeeRate;
  const storageOther = salePrice * countryCfg.storageOtherRate;
  const adCost = salePrice * adRate;

  const appliedReturnRate =
    input.overrideReturnRate ?? countryCfg.defaultReturnRate;
  const returnLoss = salePrice * appliedReturnRate;

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

  // —— 核心：按现金周期算 ROI & 年资金效率 ——
  const baseCapital = purchaseCost + headFreight;
  const roiPerCycle = baseCapital > 0 ? netProfit / baseCapital : 0; // 预测 ROI（单次周转）
  const cycleDays =
    input.cashCycleDays && input.cashCycleDays > 0
      ? input.cashCycleDays
      : 90; // 防止除 0，给个默认 90 天
  const cyclesPerYear = 365 / cycleDays;
  const capitalEfficiency = roiPerCycle * cyclesPerYear; // 年资金效率

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
    roi: roiPerCycle,
  };
}

// ============================================================================
// 产品建议：A/B/C/D 评级（基于年资金效率 X & 预测 ROI Y）
// ============================================================================

function getProductSuggestion(result: CalcResult): ProductSuggestion {
  const X = result.capitalEfficiency; // 年资金效率
  const Y = result.roi; // 单次周转 ROI

  if (X >= 1.5 && Y >= 0.4) {
    return {
      level: "A",
      label: "A-强烈推荐",
      desc: "年资金效率 ≥ 1.5 且 单次 ROI ≥ 40%，适合作为重点推新品，大胆做体量。",
      badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    };
  }
  if (X >= 1 && Y >= 0.25) {
    return {
      level: "B",
      label: "B-正常可做",
      desc: "年资金效率 ≥ 1 且 单次 ROI ≥ 25%，可作为常规款稳定铺货，控制库存节奏。",
      badgeClass: "bg-blue-50 text-blue-700 border border-blue-200",
    };
  }
  if (X >= 0.5 && Y >= 0.1) {
    return {
      level: "C",
      label: "C-小单试水",
      desc: "年资金效率 ≥ 0.5 且 单次 ROI ≥ 10%，适合小批量测试，重点观察评价与广告表现。",
      badgeClass: "bg-amber-50 text-amber-700 border border-amber-200",
    };
  }
  return {
    level: "D",
    label: "D-不建议",
    desc: "年资金效率和 ROI 偏低，建议谨慎，除非有强运营打法或品牌战略需求。",
    badgeClass: "bg-red-50 text-red-700 border border-red-200",
  };
}

// ============================================================================
// 组件：成本利润测算（原来的主页面）
// ============================================================================

const ProfitCalculator: React.FC = () => {
  const [productList, setProductList] = useState<ProductConfig[]>([]);
  const [selectedBizCode, setSelectedBizCode] = useState<string>(
    COUNTRY_CONFIGS[0].bizCode
  );
  const [selectedSku, setSelectedSku] = useState<string>("");
  const [salePrice, setSalePrice] = useState<number>(39.99);
  const [adRate, setAdRate] = useState<number>(0.15);
  const [overrideReturnRate, setOverrideReturnRate] = useState<string>("");
  const [manualLastMile, setManualLastMile] = useState<string>(""); // TK-US 手动尾程费

  const [cashCycleDays, setCashCycleDays] = useState<number>(90); // 现金周期（天）

  const [dataSourceMode, setDataSourceMode] =
    useState<DataSourceMode>("upload");
  const [hasHistory, setHasHistory] = useState<boolean>(false);

  // 初始化：尝试加载历史 CSV
  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = window.localStorage.getItem(HISTORY_KEY);
    if (!saved) {
      setHasHistory(false);
      return;
    }

    const products = parseProductsFromCsvText(saved);
    if (products.length > 0) {
      setHasHistory(true);
      setProductList(products);
      setSelectedSku(products[0].sku);
      setDataSourceMode("history");
    } else {
      setHasHistory(false);
    }
  }, []);

  const currentCountry = useMemo(
    () => getCountryConfig(selectedBizCode),
    [selectedBizCode]
  );

  const currentProduct = useMemo(
    () => productList.find((p) => p.sku === selectedSku),
    [productList, selectedSku]
  );

  const perUnitVolumeCbm = currentProduct
    ? (currentProduct.lengthCm *
        currentProduct.widthCm *
        currentProduct.heightCm) /
      1_000_000
    : 0;

  const unitsPer40HQ =
    perUnitVolumeCbm > 0 ? Math.ceil(68 / perUnitVolumeCbm) : 0;

  const result = useMemo(() => {
    if (!selectedSku || productList.length === 0) {
      return calculateProfit(
        {
          bizCode: selectedBizCode,
          sku: "",
          salePrice: 0,
          adRate: 0,
          cashCycleDays,
        },
        productList
      );
    }
    const rRate = overrideReturnRate
      ? parseFloat(overrideReturnRate) / 100
      : undefined;

    const manualLastMileValue =
      selectedBizCode === "TK-US" && manualLastMile.trim() !== ""
        ? Number(manualLastMile)
        : undefined;

    return calculateProfit(
      {
        bizCode: selectedBizCode,
        sku: selectedSku,
        salePrice,
        adRate,
        cashCycleDays,
        overrideReturnRate: rRate,
        manualLastMile: manualLastMileValue,
      },
      productList
    );
  }, [
    selectedBizCode,
    selectedSku,
    salePrice,
    adRate,
    overrideReturnRate,
    productList,
    cashCycleDays,
    manualLastMile,
  ]);

  const suggestion = useMemo(() => getProductSuggestion(result), [result]);

  const loadHistoryData = () => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(HISTORY_KEY);
    if (!saved) {
      alert("没有找到历史数据，请先上传一次 CSV。");
      return;
    }
    const products = parseProductsFromCsvText(saved);
    if (products.length === 0) {
      alert("历史数据无法解析，请重新上传 CSV。");
      return;
    }
    setProductList(products);
    setSelectedSku(products[0].sku);
    alert(`已从历史数据加载 ${products.length} 个产品。`);
  };

  const handleDataSourceModeChange = (mode: DataSourceMode) => {
    setDataSourceMode(mode);
    if (mode === "history") {
      loadHistoryData();
    }
  };

  const handleUploadCsv = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = (evt.target?.result as string) || "";
      const products = parseProductsFromCsvText(text);

      if (products.length === 0) {
        alert("CSV 中没有解析到有效产品，请检查表格格式。");
        return;
      }

      setProductList(products);
      setSelectedSku(products[0].sku);
      alert(`已成功导入 ${products.length} 个产品。`);

      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(HISTORY_KEY, text);
          setHasHistory(true);
        }
      } catch {
        // ignore
      }
    };

    reader.readAsText(file, "utf-8");
    e.target.value = "";
  };

  if (!currentCountry) {
    return (
      <div className="p-10 text-center text-red-500">
        配置错误：未找到业务代码对应国家/平台。
      </div>
    );
  }

  const isTkUs = selectedBizCode === "TK-US";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* 左侧：上传 & 参数 */}
      <div className="lg:col-span-4 lg:sticky lg:top-24 h-fit space-y-6">
        {/* 上传 & 数据源选择 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div className="text-sm font-semibold text-slate-800">
              ① 数据源 & 上传
            </div>
            <div className="text-xs text-slate-500 mt-1">
              可以用上一次导入的历史数据，或者上传新的 CSV 覆盖。
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                数据来源
              </label>
              <select
                value={dataSourceMode}
                onChange={(e) =>
                  handleDataSourceModeChange(e.target.value as DataSourceMode)
                }
                className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="history" disabled={!hasHistory}>
                  我没有 Excel，用历史数据
                  {!hasHistory ? "（暂无历史）" : ""}
                </option>
                <option value="upload">上传新的 CSV 文件（覆盖）</option>
              </select>
              {dataSourceMode === "history" && (
                <p className="mt-1 text-[11px] text-slate-500">
                  当前模式：使用最近一次上传的「新品成本核算.csv」。
                </p>
              )}
            </div>

            {dataSourceMode === "upload" && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  选择 CSV 文件
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleUploadCsv}
                  className="block w-full text-xs text-slate-600"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  请从 Excel 将「新品成本核算」导出为 CSV 再上传，上传将覆盖历史数据。
                </p>
              </div>
            )}

            <div className="text-xs text-slate-500">
              当前已导入产品数：{" "}
              <span className="font-mono font-semibold">
                {productList.length}
              </span>
            </div>

            {productList.length > 0 && (
              <div className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded p-2">
                已读取：SKU、包装尺寸、包装毛重、美元采购价，可直接用于测算。
              </div>
            )}
          </div>
        </div>

        {/* 参数输入 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-100 bg-blue-50 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-800">
              ② 测算参数
            </div>
            <div className="text-[11px] text-slate-500">
              业务代码 / SKU / 售价 / 广告 / 现金周期 / 尾程
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                业务代码 (国家/平台)
              </label>
              <select
                value={selectedBizCode}
                onChange={(e) => setSelectedBizCode(e.target.value)}
                className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                {COUNTRY_CONFIGS.map((cfg) => (
                  <option key={cfg.bizCode} value={cfg.bizCode}>
                    {cfg.bizCode} ({cfg.country} - {cfg.platform})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                新品 SKU / 品名
              </label>
              <select
                value={selectedSku}
                onChange={(e) => setSelectedSku(e.target.value)}
                disabled={productList.length === 0}
                className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-slate-100 disabled:text-slate-400"
              >
                {productList.length === 0 && (
                  <option value="">请先选择数据源并导入</option>
                )}
                {productList.map((p) => (
                  <option key={p.sku} value={p.sku}>
                    {p.name}
                  </option>
                ))}
              </select>

              {currentProduct && (
                <div className="mt-2 text-[11px] text-slate-500 bg-slate-50 p-2 rounded space-y-1">
                  <div className="flex justify-between">
                    <span>采购价(USD 含税):</span>
                    <span className="font-mono text-slate-700">
                      ${currentProduct.purchasePrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>包装尺寸 (cm):</span>
                    <span className="font-mono text-slate-700">
                      {currentProduct.lengthCm} × {currentProduct.widthCm} ×{" "}
                      {currentProduct.heightCm}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>单件体积 (CBM):</span>
                    <span className="font-mono text-slate-700">
                      {perUnitVolumeCbm.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>40HQ 装柜数量 (估):</span>
                    <span className="font-mono text-slate-700 text-right w-16">
                      {unitsPer40HQ > 0 ? unitsPer40HQ : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>包装毛重 (kg):</span>
                    <span className="font-mono text-slate-700">
                      {currentProduct.weightKg}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                目标售价 (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400 text-xs">
                  $
                </span>
                <input
                  type="number"
                  value={salePrice}
                  onChange={(e) => setSalePrice(Number(e.target.value))}
                  className="w-full pl-7 p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                预估广告占比 (0-1)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step={0.01}
                  max={1}
                  min={0}
                  value={adRate}
                  onChange={(e) => setAdRate(Number(e.target.value))}
                  className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <span className="text-xs text-slate-500 w-12 text-right">
                  {(adRate * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {isTkUs && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  TK-US 尾程派送费 (USD / 件)
                </label>
                <input
                  type="number"
                  value={manualLastMile}
                  onChange={(e) => setManualLastMile(e.target.value)}
                  placeholder="例如：12.58"
                  className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  TikTok US 尾程费由你根据实际报价手工填写，系统不再按 AMZ
                  规则自动计算金额。
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                现金周期（天）
              </label>
              <input
                type="number"
                value={cashCycleDays}
                onChange={(e) =>
                  setCashCycleDays(Math.max(1, Number(e.target.value)))
                }
                className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                从支付原材料/生产，到货卖出并回款的资金占用天数，用于计算年资金效率。
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                覆盖默认退货率 (%)
              </label>
              <input
                type="number"
                placeholder={
                  "默认: " +
                  (currentCountry.defaultReturnRate * 100).toFixed(1) +
                  "%"
                }
                value={overrideReturnRate}
                onChange={(e) => setOverrideReturnRate(e.target.value)}
                className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                留空则使用维度表中的默认退货率。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧：结果 */}
      <div className="lg:col-span-8 space-y-6">
        {/* KPI 卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 净利润 + 净利润率 同一张卡片 */}
          <div
            className={`p-4 rounded-xl border shadow-sm ${
              result.netProfit >= 0
                ? "bg-emerald-50 border-emerald-100"
                : "bg-red-50 border-red-100"
            }`}
          >
            <div className="flex items-baseline justify-between mb-1">
              <div className="text-xs text-slate-500">单件净利润 (USD)</div>
              <div className="text-xs text-slate-500 text-right">
                净利润率：
                <span
                  className={
                    result.margin >= 0
                      ? "text-emerald-700 font-semibold ml-1"
                      : "text-red-700 font-semibold ml-1"
                  }
                >
                  {(result.margin * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            <div
              className={`text-3xl font-bold ${
                result.netProfit >= 0 ? "text-emerald-700" : "text-red-700"
              }`}
            >
              ${result.netProfit.toFixed(2)}
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs text-slate-500 mb-1">
              单次 ROI（净利 / (采购+头程)）
            </div>
            <div
              className={`text-3xl font-bold ${
                result.roi >= 0.4
                  ? "text-blue-600"
                  : result.roi > 0.25
                  ? "text-emerald-600"
                  : result.roi > 0
                  ? "text-amber-500"
                  : "text-red-600"
              }`}
            >
              {(result.roi * 100).toFixed(1)}%
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs text-slate-500 mb-1">
              年资金效率（基于现金周期 {cashCycleDays} 天）
            </div>
            <div className="text-3xl font-bold text-slate-700">
              {result.capitalEfficiency.toFixed(2)}
            </div>
          </div>
        </div>

        {/* 产品建议卡片 */}
        {productList.length > 0 && selectedSku && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800">
                ③ 产品建议（自动评级）
              </div>
              <div className="text-[11px] text-slate-500">
                X = 年资金效率，Y = 单次 ROI，基于你设置的现金周期
              </div>
            </div>
            <div className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${suggestion.badgeClass}`}
              >
                {suggestion.label}
              </div>
              <div className="text-xs text-slate-600 flex-1">
                <p>{suggestion.desc}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  单次 ROI：{(result.roi * 100).toFixed(1)}% ｜ 年资金效率：
                  {result.capitalEfficiency.toFixed(2)}（现金周期 {cashCycleDays}{" "}
                  天）
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 成本明细表 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-semibold text-slate-700 text-sm">
              成本明细表
            </h3>
            <div className="text-[11px] bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
              尾程：{result.sizeTier} / 计费重：
              {result.chargeWeight.toFixed(2)} kg
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                <tr>
                  <th className="px-6 py-3">成本项</th>
                  <th className="px-6 py-3">金额 (USD)</th>
                  <th className="px-6 py-3">占售价比例</th>
                  <th className="px-6 py-3">说明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-6 py-3 font-medium text-slate-700">
                    采购成本
                  </td>
                  <td className="px-6 py-3">
                    ${result.purchaseCost.toFixed(2)}
                  </td>
                  <td className="px-6 py-3 text-slate-500">
                    {salePrice
                      ? ((result.purchaseCost / salePrice) * 100).toFixed(1)
                      : "0.0"}
                    %
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-400">
                    来源：新品成本核算 CSV (USD 采购价)
                  </td>
                </tr>

                <tr>
                  <td className="px-6 py-3 font-medium text-slate-700">
                    头程运费
                  </td>
                  <td className="px-6 py-3">
                    ${result.headFreight.toFixed(2)}
                  </td>
                  <td className="px-6 py-3 text-slate-500">
                    {salePrice
                      ? ((result.headFreight / salePrice) * 100).toFixed(1)
                      : "0.0"}
                    %
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-400">
                    {result.volumeCbm.toFixed(4)} CBM × 运价
                  </td>
                </tr>

                <tr>
                  <td className="px-6 py-3 font-medium text-slate-700">
                    尾程运费
                  </td>
                  <td className="px-6 py-3">
                    ${result.lastMile.toFixed(2)}
                  </td>
                  <td className="px-6 py-3 text-slate-500">
                    {salePrice
                      ? ((result.lastMile / salePrice) * 100).toFixed(1)
                      : "0.0"}
                    %
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-400">
                    规则：
                    {isTkUs ? "人工填写（TikTok US）" : currentCountry.lastMileRule}
                  </td>
                </tr>

                <tr>
                  <td className="px-6 py-3 font-medium text-slate-700">
                    平台佣金
                  </td>
                  <td className="px-6 py-3">
                    ${result.referralFee.toFixed(2)}
                  </td>
                  <td className="px-6 py-3 text-slate-500">
                    {salePrice
                      ? ((result.referralFee / salePrice) * 100).toFixed(1)
                      : "0.0"}
                    %
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-400">
                    佣金率：
                    {(currentCountry.referralFeeRate * 100).toFixed(1)}%
                  </td>
                </tr>

                <tr>
                  <td className="px-6 py-3 font-medium text-slate-700">
                    仓储及杂费
                  </td>
                  <td className="px-6 py-3">
                    ${result.storageOther.toFixed(2)}
                  </td>
                  <td className="px-6 py-3 text-slate-500">
                    {salePrice
                      ? ((result.storageOther / salePrice) * 100).toFixed(1)
                      : "0.0"}
                    %
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-400">
                    杂费率：
                    {(currentCountry.storageOtherRate * 100).toFixed(1)}%
                  </td>
                </tr>

                <tr>
                  <td className="px-6 py-3 font-medium text-slate-700">
                    广告费
                  </td>
                  <td className="px-6 py-3 text-orange-600">
                    ${result.adCost.toFixed(2)}
                  </td>
                  <td className="px-6 py-3 text-slate-500">
                    {salePrice
                      ? ((result.adCost / salePrice) * 100).toFixed(1)
                      : "0.0"}
                    %
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-400">
                    人工设置广告占比
                  </td>
                </tr>

                <tr>
                  <td className="px-6 py-3 font-medium text-slate-700">
                    退货损耗
                  </td>
                  <td className="px-6 py-3 text-orange-600">
                    ${result.returnLoss.toFixed(2)}
                  </td>
                  <td className="px-6 py-3 text-slate-500">
                    {salePrice
                      ? ((result.returnLoss / salePrice) * 100).toFixed(1)
                      : "0.0"}
                    %
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-400">
                    按退货率 {(result.appliedReturnRate * 100).toFixed(1)}%
                  </td>
                </tr>

                <tr className="bg-slate-50 font-bold">
                  <td className="px-6 py-3 text-slate-900">总成本</td>
                  <td className="px-6 py-3 text-slate-900">
                    ${result.totalCost.toFixed(2)}
                  </td>
                  <td className="px-6 py-3 text-slate-900">
                    {salePrice
                      ? ((result.totalCost / salePrice) * 100).toFixed(1)
                      : "0.0"}
                    %
                  </td>
                  <td className="px-6 py-3" />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 组件：AI 选品报告（支持多 Excel + 导出 PDF）
// ============================================================================

const AiProductResearch: React.FC = () => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeModuleKey, setActiveModuleKey] = useState<string>("1.1");

// 处理多文件上传（Excel / CSV），全部转成 CSV 文本
const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
  const input = e.target;
  const fileList = input.files;
  if (!fileList || fileList.length === 0) return;

  try {
    const uploaded: UploadedFile[] = await Promise.all(
      Array.from(fileList).map(
        (file) =>
          new Promise<UploadedFile>((resolve, reject) => {
            const ext = file.name.split(".").pop()?.toLowerCase();
            const reader = new FileReader();

            if (ext === "xlsx" || ext === "xls") {
              // Excel → 读成 ArrayBuffer → 转 CSV
              reader.onload = (evt) => {
                try {
                  const data = evt.target?.result as ArrayBuffer;
                  const wb = XLSX.read(data, { type: "array" });
                  const firstSheetName = wb.SheetNames[0];
                  const sheet = wb.Sheets[firstSheetName];
                  const csv = XLSX.utils.sheet_to_csv(sheet);
                  resolve({ name: file.name, content: csv });
                } catch (err) {
                  reject(err);
                }
              };
              reader.onerror = () =>
                reject(reader.error || new Error("读取 Excel 失败"));
              reader.readAsArrayBuffer(file);
            } else {
              // 普通 CSV / TXT 直接读文本
              reader.onload = (evt) => {
                const text = (evt.target?.result as string) || "";
                resolve({ name: file.name, content: text });
              };
              reader.onerror = () =>
                reject(reader.error || new Error("读取文件失败"));
              reader.readAsText(file, "utf-8");
            }
          })
      )
    );

    // ✅ 关键：在原有的 files 基础上追加，而不是覆盖
    setFiles((prev) => {
      const merged = [...prev];

      for (const f of uploaded) {
        const idx = merged.findIndex((x) => x.name === f.name);
        if (idx >= 0) {
          // 同名文件：用最新的覆盖旧的
          merged[idx] = f;
        } else {
          merged.push(f);
        }
      }

      return merged;
    });

    setResult(null);
    setError(null);
  } catch (err: any) {
    console.error(err);
    setError("解析报表失败，请检查文件格式（可上传 Excel 或 CSV）");
  } finally {
    // 允许用户再次选择同一个文件
    input.value = "";
  }
};


  const handleSubmit = async () => {
  if (files.length === 0) {
    setError("请先上传至少一个 Excel / CSV 报表。");
    return;
  }
  setError(null);
  setResult(null);
  setLoading(true);

  try {
    // 不要写死域名，直接用同源的相对路径
    const res = await fetch("/api/ai-product-research", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        csvList: files.map((f) => ({
          name: f.name,
          content: f.content,
        })),
        note,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "AI 分析失败");
    }

    const data = (await res.json()) as AiResult;
    setResult(data);
  } catch (err: any) {
    setError(err.message || "请求失败");
  } finally {
    setLoading(false);
  }
};

  const renderMarkdown = (md: string) => {
    if (!md) {
      return (
        <p className="text-xs text-slate-400">
          （该模块当前没有返回内容，可以在后端 AiResult.modules["小节编号"]
          中补充。）
        </p>
      );
    }
    return (
      <pre className="whitespace-pre-wrap text-xs md:text-sm font-sans bg-slate-50 p-3 rounded-lg border border-slate-100">
        {md}
      </pre>
    );
  };

  const scrollToModule = (key: string) => {
    setActiveModuleKey(key);
    const el = document.getElementById(`module-${key}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const levelBadgeClass = (level: AiCandidate["level"]) => {
    switch (level) {
      case "A":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200";
      case "B":
        return "bg-blue-50 text-blue-700 border border-blue-200";
      case "C":
        return "bg-amber-50 text-amber-700 border border-amber-200";
      case "D":
      default:
        return "bg-red-50 text-red-700 border border-red-200";
    }
  };

  const handleExportPdf = () => {
    if (typeof window === "undefined") return;
    window.print(); // 浏览器选择“另存为 PDF”
  };

  return (
    <div className="space-y-6 pb-10">
      {/* 标题 + 导出 PDF */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          AI 选品中心（报表版 V0）
        </h2>
        <button
          onClick={handleExportPdf}
          disabled={!result}
          className="rounded-full border border-slate-300 px-4 py-1.5 text-xs bg-white hover:bg-slate-50 disabled:opacity-40"
        >
          导出 PDF
        </button>
      </div>

      {/* 上传区域 */}
      <div className="grid gap-4 md:grid-cols-[320px,1fr]">
        <section className="space-y-3 border rounded-xl bg-white p-4 shadow-sm">
          <div className="space-y-1">
            <div className="text-sm font-medium text-slate-800">
              1. 上传数据报表
            </div>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.txt"
              multiple
              onChange={handleFileChange}
              className="text-sm"
            />
            {files.length > 0 && (
              <div className="mt-1 text-[11px] text-slate-500">
                已选择 {files.length} 个文件：
                <ul className="list-disc list-inside mt-1 space-y-0.5 max-h-24 overflow-y-auto">
                  {files.map((f) => (
                    <li key={f.name}>{f.name}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-slate-500">
              支持上传多个报表，例如：
              <span className="font-mono">
                具体分析表.xlsx / TopASIN_30days.xlsx / 关键词趋势.csv
              </span>
              。前端会自动转成 CSV 列表传给 AI。
            </p>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium text-slate-800">
              2. 场景备注（可选）
            </div>
            <textarea
              className="border rounded-md px-2 py-1 text-sm w-full h-16"
              placeholder="例如：无线战绳 · Amazon US · 最近30天数据；目标客单 50-80 美金；排除大牌"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <p className="text-xs text-slate-400">
              会一并发送给 AI，帮助更贴近你的选品思路（如：限定价格区间、只看 FBA、
              排除大牌等）。
            </p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || files.length === 0}
            className="w-full rounded-md bg-slate-900 text-white text-sm py-2 disabled:opacity-60"
          >
            {loading ? "AI 正在分析…" : "生成 AI 选品全流程报告"}
          </button>

          {error && (
            <p className="text-xs text-red-500 whitespace-pre-wrap">{error}</p>
          )}

          {!error && !result && !loading && (
            <p className="text-xs text-slate-500">
              小提示：可以先用「无线战绳 / 引体向上」这类你熟悉的类目试水，对比一下和你之前手动分析的感觉是否一致。
            </p>
          )}
        </section>

        {!result && !loading && (
          <section className="text-sm text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4">
            上传报表后，我会自动生成：
            <ul className="mt-1 list-disc list-inside space-y-1 text-xs">
              <li>产品分析（Listing 概况、产品成绩、库存能力等）</li>
              <li>利润分析（价格销量图、利润试算、盈亏平衡等）</li>
              <li>市场分析（销量趋势、TOP ASIN、Google Trends、搜索热度等）</li>
              <li>竞品分析 / 评论分析 / 产品切入点 / 货源建议 / 合规检测</li>
            </ul>
            <p className="mt-2 text-xs text-slate-400">
              当前版本先用文字 + 结构化卡片呈现，后续可以逐步接入可视化图表（ECharts）
              以及和你的成本核算工具联动。
            </p>
          </section>
        )}

        {loading && (
          <section className="flex items-center justify-center text-sm text-slate-600 bg-slate-50 border rounded-xl">
            AI 正在分析报表并生成各模块内容…
          </section>
        )}
      </div>

      {/* 整页报告区域：左侧目录 + 右侧内容 */}
      {result && (
        <div className="grid gap-4 lg:grid-cols-[260px,1fr]">
          {/* 左侧：模块目录 */}
          <aside className="bg-white border rounded-xl shadow-sm p-3 h-fit lg:sticky lg:top-24">
            <div className="text-xs font-semibold text-slate-700 mb-2">
              报告目录
            </div>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {AI_REPORT_TOC.map((group) => (
                <div key={group.groupKey}>
                  <div className="text-xs font-semibold text-slate-800 mb-1">
                    {group.groupTitle}
                  </div>
                  <ul className="space-y-0.5">
                    {group.items.map((item) => {
                      const active = activeModuleKey === item.key;
                      return (
                        <li key={item.key}>
                          <button
                            type="button"
                            onClick={() => scrollToModule(item.key)}
                            className={`w-full text-left text-[11px] px-2 py-1 rounded-md ${
                              active
                                ? "bg-slate-900 text-white"
                                : "text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            {item.key} {item.title}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </aside>

          {/* 右侧：报告主体 */}
          <section className="space-y-6">
            {/* 顶部：总体概览 */}
            <div className="bg-white border rounded-xl shadow-sm p-4 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <div className="text-xs text-slate-500 uppercase">
                    AI PRODUCT RESEARCH SUMMARY
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    本次选品报告 · 概览
                  </div>
                </div>
                <div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-900 text-white">
                    {result.decisionLabel}
                  </span>
                </div>
              </div>

              {/* 指标卡片 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="border rounded-lg p-3 bg-slate-50">
                  <div className="text-[11px] text-slate-500 mb-1">
                    市场机会评分
                  </div>
                  <div className="text-xl font-semibold text-slate-900">
                    {result.summary.opportunityScore}/100
                  </div>
                </div>
                <div className="border rounded-lg p-3 bg-slate-50">
                  <div className="text-[11px] text-slate-500 mb-1">
                    竞争强度（越低越好）
                  </div>
                  <div className="text-xl font-semibold text-slate-900">
                    {result.summary.competitionScore}/100
                  </div>
                </div>
                <div className="border rounded-lg p-3 bg-slate-50">
                  <div className="text-[11px] text-slate-500 mb-1">
                    利润潜力
                  </div>
                  <div className="text-xl font-semibold text-slate-900">
                    {result.summary.profitPotential}
                  </div>
                </div>
                <div className="border rounded-lg p-3 bg-slate-50">
                  <div className="text-[11px] text-slate-500 mb-1">
                    整体风险
                  </div>
                  <div className="text-xl font-semibold text-slate-900">
                    {result.summary.riskLevel}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-600">
                {result.decisionReason}
              </p>
            </div>

            {/* Top 候选款列表 */}
            {result.candidates && result.candidates.length > 0 && (
              <div className="bg-white border rounded-xl shadow-sm p-4 space-y-3">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-sm font-semibold text-slate-900">
                    核心候选款 / 关键词
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    共 {result.candidates.length} 条，按综合优先级排序
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs md:text-sm">
                    <thead className="bg-slate-50 text-[11px] text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">序</th>
                        <th className="px-3 py-2 text-left">ID</th>
                        <th className="px-3 py-2 text-left">标题</th>
                        <th className="px-3 py-2 text-left">类型</th>
                        <th className="px-3 py-2 text-right">价格</th>
                        <th className="px-3 py-2 text-right">月销</th>
                        <th className="px-3 py-2 text-right">月销售额</th>
                        <th className="px-3 py-2 text-right">评论</th>
                        <th className="px-3 py-2 text-right">评分</th>
                        <th className="px-3 py-2 text-left">等级</th>
                        <th className="px-3 py-2 text-left">标签</th>
                        <th className="px-3 py-2 text-left">建议动作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.candidates.map((c) => (
                        <tr key={c.rank + c.id}>
                          <td className="px-3 py-2 text-slate-500">
                            {c.rank}
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-700">
                            {c.id}
                          </td>
                          <td className="px-3 py-2 max-w-[260px]">
                            <div className="line-clamp-2">{c.title}</div>
                          </td>
                          <td className="px-3 py-2 text-slate-500">
                            {c.type}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {c.price != null ? `$${c.price.toFixed(2)}` : "-"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {c.monthlySales != null ? c.monthlySales : "-"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {c.revenue != null ? `$${c.revenue}` : "-"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {c.reviews != null ? c.reviews : "-"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {c.rating != null ? c.rating.toFixed(1) : "-"}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={
                                "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold " +
                                levelBadgeClass(c.level)
                              }
                            >
                              {c.level}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {c.tag}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {c.action}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 模块详细分析 */}
            <div className="space-y-4">
              {AI_REPORT_TOC.map((group) => (
                <div key={group.groupKey}>
                  <h3 className="text-xs font-semibold text-slate-700 mb-2">
                    {group.groupTitle}
                  </h3>
                  <div className="space-y-3">
                    {group.items.map((item) => {
                      const content =
                        (result.modules && result.modules[item.key]) || "";
                      return (
                        <div
                          key={item.key}
                          id={`module-${item.key}`}
                          className="bg-white border rounded-xl shadow-sm p-3 md:p-4"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs font-semibold text-slate-900">
                              {item.key} {item.title}
                            </div>
                            <button
                              type="button"
                              onClick={() => scrollToModule(item.key)}
                              className="text-[11px] text-slate-400 hover:text-slate-600"
                            >
                              回到目录
                            </button>
                          </div>
                          {renderMarkdown(content)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* 完整长文报告 */}
            {result.fullReportMarkdown && (
              <div className="bg-white border rounded-xl shadow-sm p-4 space-y-2">
                <div className="text-sm font-semibold text-slate-900">
                  七：完整长文报告（适合导出给老板/团队）
                </div>
                {renderMarkdown(result.fullReportMarkdown)}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 主 App：顶部导航 + Tab 切换
// ============================================================================

type MainTab = "profit" | "ai";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MainTab>("profit");

  return (
    <>
      {/* 打印时可以按需扩展样式，这里只简单隐藏浏览器默认背景 */}
      <style>{`@media print { body { background: #ffffff !important; } }`}</style>

      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-10">
        {/* 顶部导航 */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 text-white p-1.5 rounded-lg text-xs font-bold">
                ND
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  NeuroDesk · 产品决策工作台
                </h1>
                <p className="text-xs text-slate-500">
                  成本利润测算 + AI 选品报告（内部使用）
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                className={`px-3 py-1.5 rounded-full border ${
                  activeTab === "profit"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200"
                }`}
                onClick={() => setActiveTab("profit")}
              >
                成本 & ROI 测算
              </button>
              <button
                className={`px-3 py-1.5 rounded-full border ${
                  activeTab === "ai"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200"
                }`}
                onClick={() => setActiveTab("ai")}
              >
                AI 选品报告
              </button>
            </div>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === "profit" ? (
            <ProfitCalculator />
          ) : (
            <AiProductResearch />
          )}
        </div>
      </div>
    </>
  );
};

export default App;
