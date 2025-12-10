// api/ai-product-research.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

// -------- 统一 CORS 头 --------
function setCorsHeaders(res: VercelResponse) {
  // 如果以后只从某个域名调用，可以改成具体域名
  // res.setHeader("Access-Control-Allow-Origin", "https://www.neurodesktech.com");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// -------- 懒加载 OpenAI 客户端，避免顶层报错 --------
let openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("MISSING_OPENAI_API_KEY");
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// -------- System Prompt --------
const SYSTEM_PROMPT = `
你是一位拥有 8 年以上经验的跨境电商选品总监，长期负责 Amazon / TikTok / Temu 等平台的新品立项与市场研究。

输入：一份或多份选品相关数据报表（CSV 文本，已经按字符做了截断）+ 我的场景备注。
任务：基于这些信息，生成一份结构化的「AI 选品研究报告」。

⚠️ 你必须只返回一个 JSON 对象，字段结构严格为（字段名必须完全一致）：

{
  "summary": {
    "opportunityScore": 0-100,
    "competitionScore": 0-100,
    "profitPotential": "低" | "中" | "高",
    "riskLevel": "低" | "中" | "高"
  },
  "decisionLabel": "字符串，例如：适合重点做 / 小单试水 / 暂不建议",
  "decisionReason": "50-150 字中文总结",
  "candidates": [
    {
      "rank": 1,
      "id": "ASIN 或核心关键词",
      "title": "产品标题或关键词",
      "type": "ASIN" | "Keyword",
      "price": 价格数字或 null,
      "monthlySales": 月销量数字或 null,
      "revenue": 销售额数字或 null,
      "reviews": 评论数或 null,
      "rating": 评分数字或 null,
      "level": "A" | "B" | "C" | "D",
      "tag": "一句话标签",
      "action": "一句话运营动作建议"
    }
  ],
  "modules": {
    "1.1": "Listing 概览的分析内容",
    "1.2": "产品成绩",
    "1.3": "产品关键节点",
    "1.4": "评论真实性",
    "1.5": "库存管理能力",
    "1.6": "产品分析模块小结",

    "2.1": "价格销量图的解读",
    "2.2": "利润试算 / 利润空间判断",
    "2.3": "盈亏平衡和对广告依赖判断",

    "3.1": "市场整体概况",
    "3.2": "销量趋势",
    "3.3": "TOP1 ASIN 销售趋势",
    "3.4": "TOP1 ASIN 年度对比",
    "3.5": "Google Trends / 关键词趋势判断",
    "3.6": "关键词搜索趋势",
    "3.7": "关键词竞争格局",
    "3.8": "差异化机会点",
    "3.9": "新品成功率判断",
    "3.10": "卖家实力分析",
    "3.11": "市场分析模块小结",

    "4.1": "竞品卖点分析",
    "4.2": "竞品运营策略",
    "4.3": "竞品关键词与流量结构",
    "4.4": "买家购买偏好",
    "4.5": "重点竞品卖家画像",
    "4.6": "竞品利润空间判断",
    "4.7": "竞品分析模块小结",

    "5.1": "消费者画像",
    "5.2": "主要使用场景",
    "5.3": "产品体验反馈",
    "5.4": "购买动机",
    "5.5": "未满足的需求与吐槽点",

    "6.1": "变体销量分析",
    "6.2": "差异化切入方案",
    "6.3": "成功新品 ASIN 的共性经验",
    "6.4": "产品切入点模块小结",

    "7.1": "供应链与货源建议",

    "8.1": "合规风险与注意事项"
  },
  "fullReportMarkdown": "把以上要点串成一篇 800-1500 字的 Markdown 报告。"
}

重要要求：
- 所有字段都必须给出，不能缺 key。
- modules 每个 key 都要返回可直接展示在网页上的中文文本。
- 禁止输出 JSON 之外的任何内容。
`.trim();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 每个请求先打上 CORS 头
  setCorsHeaders(res);

  // 预检请求
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    const client = getOpenAIClient(); // 这里才真正 new OpenAI

    const { csvText, note, csvList } = req.body as {
      csvText?: string;
      note?: string;
      csvList?: { name: string; content: string }[];
    };

    let mergedText = "";
    if (Array.isArray(csvList) && csvList.length > 0) {
      mergedText = csvList
        .map((item) => {
          const name = item.name || "未命名报表";
          const content = item.content || "";
          return `【文件：${name}】\n${content}`;
        })
        .join("\n\n================ 报表分隔线 ================\n\n");
    } else if (typeof csvText === "string") {
      mergedText = csvText;
    }

    if (!mergedText) {
      res.status(400).json({ error: "csvText 或 csvList 不能为空" });
      return;
    }

    const MAX_CHARS = 16000;
    const snippet = mergedText.slice(0, MAX_CHARS);

    const sceneText =
      note ||
      "（用户没有填写场景备注，例如：无线战绳 · Amazon US · 最近30天数据；目标客单 50-80 美金；排除大牌）";

    const userPrompt = `
下面是一份或多份选品数据报表的文本（CSV 形式，已按字符做截断）以及用户填写的场景备注。
请严格按照 system 提示给出的 JSON 结构，输出一份 AI 选品报告。

===== 场景备注 =====
${sceneText}

===== 报表文本开始（可能已截断） =====
${snippet}
===== 报表文本结束 =====
    `.trim();

    const completion = await client.chat.completions.create({
      // 如果你的账号还没有 gpt-5，可以先用 gpt-4.1 或 gpt-4.1-mini
      model: "gpt-4.1",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const content = completion.choices[0].message?.content;
    if (!content) {
      res.status(500).json({ error: "OpenAI 返回内容为空" });
      return;
    }

    let json: any;
    try {
      json = JSON.parse(content);
    } catch (e) {
      console.error("ai-product-research JSON parse error:", e, content);
      res.status(500).json({ error: "OpenAI 返回了非 JSON 内容" });
      return;
    }

    res.status(200).json(json);
  } catch (error: any) {
    console.error("AI product research error:", error);

    if (error?.message === "MISSING_OPENAI_API_KEY") {
      res.status(500).json({
        error: "服务端缺少 OPENAI_API_KEY 环境变量，请在 Vercel 项目中配置。",
      });
      return;
    }

    res.status(500).json({
      error: "Failed to generate AI report",
      detail: error?.message ?? String(error),
    });
  }
}
