// api/ai-product-research.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 让模型直接产出前端需要的 AiResult 结构
const SYSTEM_PROMPT = `
你是一位拥有 8 年以上经验的跨境电商选品总监，长期负责 Amazon / TikTok / Temu 等平台的新品立项与市场研究。

输入：一份或多份选品相关数据报表（CSV 文本，已经按字符做了截断）+ 我的场景备注。
任务：基于这些信息，生成一份结构化的「AI 选品研究报告」。

⚠️ 你必须只返回一个 JSON 对象，字段结构严格为（字段名必须完全一致）：

{
  "summary": {
    "opportunityScore": 0-100,        // 市场机会评分，越高越好
    "competitionScore": 0-100,        // 竞争强度，数值越高表示竞争越激烈
    "profitPotential": "低" | "中" | "高",
    "riskLevel": "低" | "中" | "高"
  },
  "decisionLabel": "字符串，例如：适合重点做 / 小单试水 / 暂不建议",
  "decisionReason": "50-150 字中文总结，解释为什么给出这个结论（参考价格带、销量集中度、评分、评论等）",
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
      "level": "A" | "B" | "C" | "D",   // A 最优先，D 最不推荐
      "tag": "一句话标签，例如：高客单刚需 / 低价红海 / 品牌集中度高",
      "action": "一句话运营动作建议，例如：重点自营 / 适合小单试水 / 暂时不做等"
    }
  ],
  "modules": {
    "1.1": "Listing 概览的分析内容（使用 Markdown 列表分点叙述）",
    "1.2": "产品成绩（销量、销售额、价格带、评价等的整体判断）",
    "1.3": "产品关键节点（例如：爆点卖点、功能分布、价格分层）",
    "1.4": "评论真实性与水分（刷评痕迹、评分分布等）",
    "1.5": "库存管理能力（断货频率、稳定性等）",
    "1.6": "产品分析模块小结",

    "2.1": "价格销量图的解读（哪段价格带量最好）",
    "2.2": "利润试算 / 大致利润空间判断（只做区间级别判断，不报具体数字）",
    "2.3": "盈亏平衡和对广告依赖的大致判断",

    "3.1": "市场整体概况（总体容量与阶段）",
    "3.2": "销量趋势（近 30 天或近 12 个月）",
    "3.3": "TOP1 ASIN 或头部款的销售趋势和稳定性",
    "3.4": "TOP1 ASIN 的年度对比情况（如果数据不足就说明不充分）",
    "3.5": "Google Trends / 关键词趋势大致判断（有数据就结合，没有就说明）",
    "3.6": "关键词搜索趋势与热度分布",
    "3.7": "关键词竞争格局（头部品牌集中度、价格带分布等）",
    "3.8": "差异化机会点（功能 / 价格 / 目标人群等）",
    "3.9": "新品成功率大致判断",
    "3.10": "卖家实力分析（大卖占比、工厂型卖家比例等）",
    "3.11": "市场分析模块小结",

    "4.1": "竞品卖点分析",
    "4.2": "竞品运营策略（广告、主图、视频、A+、coupon 等的使用情况）",
    "4.3": "竞品关键词与流量结构",
    "4.4": "买家购买偏好（从评论和属性看出来的偏好）",
    "4.5": "重点竞品卖家画像（工厂 / 品牌 / 小卖家等）",
    "4.6": "竞品利润空间大致判断",
    "4.7": "竞品分析模块小结",

    "5.1": "消费者画像（性别 / 年龄 / 场景大致推断）",
    "5.2": "主要使用场景",
    "5.3": "产品体验反馈（舒适度、耐用性、安装难度等）",
    "5.4": "购买动机（减脂 / 增肌 / 康复 / 送礼等）",
    "5.5": "未满足的需求与吐槽点",

    "6.1": "变体销量分析（不同颜色 / 规格 / 套装的表现）",
    "6.2": "差异化切入方案（功能组合、卖点组合、包装方案等）",
    "6.3": "成功新品 ASIN 的共性经验",
    "6.4": "产品切入点模块小结",

    "7.1": "供应链与货源建议（适合工厂直供 / 贸易公司 / 代工模式等）",

    "8.1": "合规风险与注意事项（承重、包装警示语、安全标准、专利风险等）"
  },
  "fullReportMarkdown": "把以上要点串成一篇 800-1500 字的 Markdown 报告，按章节分标题，适合直接导出为 PDF 给老板或团队阅读。"
}

重要要求：
- 所有字段都必须给出，即使信息不足也要据报表做「合理推断」，不要省略字段或设为 null（除了 candidates 中的价格/销量等确实缺失时可以为 null）。
- modules 每个 key 都要返回一段可直接展示在网页上的中文文本，推荐使用有序/无序列表做分点说明。
- 禁止输出任何 JSON 之外的内容：不要加注释、不要加额外说明、不要包裹在 \`\`\`json 里。
`.trim();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    // 兼容现在前端发的 { csvText, note }，以后如果扩展为多个报表也可以用 csvList
    const { csvText, note, csvList } = req.body as {
      csvText?: string;
      note?: string;
      csvList?: { name: string; content: string }[];
    };

    // 把多个报表（如果有的话）先拼起来
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

    // 防止报表过长，简单按字符截断
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

    const completion = await openai.chat.completions.create({
      // 想要更聪明可以改成 "gpt-4.1"，成本会更高一些
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
    res.status(500).json({
      error: "Failed to generate AI report",
      detail: error?.message ?? String(error),
    });
  }
}
