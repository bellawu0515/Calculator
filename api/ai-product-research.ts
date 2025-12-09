// api/ai-product-research.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 这个系统提示让模型直接输出前端需要的 AiResult 结构：
 *
 * interface AiSummary {
 *   opportunityScore: number;      // 0-100，越高机会越大
 *   competitionScore: number;      // 0-100，越高竞争越激烈（前端文案是“越低越好”）
 *   profitPotential: "低" | "中" | "高";
 *   riskLevel: "低" | "中" | "高";
 * }
 *
 * interface AiCandidate {
 *   rank: number;
 *   id: string;                    // ASIN 或 关键词
 *   title: string;
 *   type: "ASIN" | "Keyword";
 *   price: number | null;
 *   monthlySales: number | null;
 *   revenue: number | null;
 *   reviews: number | null;
 *   rating: number | null;
 *   level: "A" | "B" | "C" | "D";
 *   tag: string;
 *   action: string;
 * }
 *
 * interface AiResult {
 *   summary: AiSummary;
 *   decisionLabel: string;
 *   decisionReason: string;
 *   candidates: AiCandidate[];
 *   modules: Record<string, string>;
 *   fullReportMarkdown: string;
 * }
 */
const SYSTEM_PROMPT = `
你是一位拥有 8 年以上经验的跨境电商品类规划负责人，长期负责 Amazon（US/JP/EU）和 TikTok Shop 的新品立项与品牌规划。

现在的任务是：根据一份选品 CSV 报表 + 用户给出的场景备注，输出一份「结构化的 AI 选品报告」，用于前端仪表盘展示。你不需要做精确的 Excel 计算，而是做**方向性的判断和归纳**。

你必须输出一个 JSON 对象，结构 **严格** 为：

{
  "summary": {
    "opportunityScore": number,           // 0-100，市场机会感知：需求空间 + 增长 +利润
    "competitionScore": number,           // 0-100，竞争强度：越高越卷；前端会标注“越低越好”
    "profitPotential": "低" | "中" | "高", // 利润空间粗略判断
    "riskLevel": "低" | "中" | "高"        // 整体风险：供需不稳、类目政策、价格战等
  },
  "decisionLabel": "字符串，短句，例如：建议：可以小单切入，逐步放量",
  "decisionReason": "字符串，2-4 句话，总结为什么给出这个结论（用中文）",
  "candidates": [
    {
      "rank": number,                     // 1 开始的排序
      "id": "字符串，ASIN 或关键词",
      "title": "字符串，产品标题或关键词",
      "type": "ASIN" | "Keyword",
      "price": number | null,             // 单价，无法确定就用 null
      "monthlySales": number | null,      // 月销量，倾向性估计，实在看不出就 null
      "revenue": number | null,           // 月销售额，倾向性估计，可以是整数，无法判断就 null
      "reviews": number | null,           // 评论数，看不出就 null
      "rating": number | null,            // 评分（例如 4.3），看不出就 null
      "level": "A" | "B" | "C" | "D",     // 你自己的综合评级，A 最高
      "tag": "字符串，简短中文标签，如：细分高客单 / 竞争激烈 / 价格带空档",
      "action": "字符串，建议动作，如：重点深挖、观察竞品、仅做配角等"
    }
  ],
  "modules": {
    "1.1": "字符串，Markdown 文本，产品 Listing 概览分析",
    "1.2": "字符串，产品成绩与亮点/问题",
    "2.1": "字符串，价格与销量结构分析",
    "3.1": "字符串，市场容量与趋势概述",
    "4.1": "字符串，竞品卖点与差异化机会",
    "5.1": "字符串，消费者画像与使用场景",
    "6.2": "字符串，新品差异化与切入建议",
    "7.1": "字符串，供应链与货源建议",
    "8.1": "字符串，合规风险与注意事项",
    "...": "可以包含更多 key，例如 1.3、3.2 等；前端取不到内容时会显示占位提示"
  },
  "fullReportMarkdown": "字符串，一篇较完整的中文长文报告，使用 Markdown 小标题分段即可"
}

重要要求：
1. **只能输出一个 JSON 对象**，不能有任何额外解释文字、注释或 Markdown 代码块。
2. 所有字段都必须存在：
   - 如果确实没有候选款，可让 "candidates" 为 []。
   - modules 中至少要包含 "1.1"、"1.2"、"2.1"、"3.1"、"4.1"、"5.1"、"6.2"、"7.1"、"8.1" 这些 key，其它可选。
3. 数值字段：
   - opportunityScore / competitionScore 用 0–100 的整数或 1 位小数。
   - 避免假装非常精确，请以“区间感知”为主，不要编造看起来像真实后台数据的具体数字。
   - CSV 中看不出的数值一律用 null，不要瞎编。
4. 分析逻辑建议（非强制）：
   - 可以在内部使用 D-P-E-C 框架（Demand / Product / Economics / Content）来帮助你判断 summary 与每个候选款的 level，但**不要**在 JSON 里直接输出 DPEC 字段。
   - candidates 数量建议 3-8 个，优先选择你认为「值得重点关注的 ASIN / 关键词」，而不是机械地取前几行。
5. 语言全部使用简体中文。
`.trim();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  // 前端现在发送 { csvText, note }，旧版本可能是 { csvText, scenarioText }
const { csvText, note, scenarioText } = req.body as {
  csvText?: string;
  note?: string;
  scenarioText?: string;
};

if (!csvText) {
  res.status(400).json({ error: "csvText is required" });
  return;
}

// 防止 CSV 太长，简单按字符做一下截断
const MAX_CHARS = 12000;
const csvSnippet = csvText.slice(0, MAX_CHARS);

// 统一一份“场景备注”文本，优先级：note > scenarioText > 默认文案
const sceneText =
  note ??
  scenarioText ??
  "（用户没有填写场景备注，例如：无线战绳 · Amazon US · 最近30天数据；目标客单 50-80 美金）";

const userPrompt = `
下面是一份选品报表的 CSV 文本（已做截断）以及用户给出的场景备注。
请基于这些信息，按照系统提示中给出的 JSON 结构，输出一份「AI 选品报告」。

===== 场景备注 =====
${sceneText}

===== CSV 文本开始（可能已截断） =====
${csvSnippet}
===== CSV 文本结束 =====
`.trim();


  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini', // 你账号里可用的轻量模型，也可以换成别的
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = completion.choices[0].message?.content;
    if (!content) {
      res.status(500).json({ error: 'Empty response from OpenAI' });
      return;
    }

    // OpenAI 已经保证是 JSON 对象字符串，这里再 parse 一次返回给前端
    const json = JSON.parse(content);
    res.status(200).json(json);
  } catch (error: any) {
    console.error('AI product research error:', error);
    res.status(500).json({
      error: 'Failed to generate AI report',
      detail: error?.message ?? String(error),
    });
  }
}
