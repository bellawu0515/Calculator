// api/ai-product-research.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 系统提示：告诉模型要写“整页 HTML 市场报告”
const SYSTEM_PROMPT = `
你是一名拥有 8 年以上经验的跨境电商市场分析负责人，长期负责 Amazon（US/JP/EU）和 TikTok Shop 的品类规划与竞品分析。
你擅长把各种报表（卖家精灵 / Helium10 / 店铺后台导出）转成结构化、好读的「市场洞察报告」。

【任务】
用户会给你 1~N 个报表文件（前端已经把 Excel 转成 CSV 文本），以及一段场景备注。
请你基于这些信息，生成一份完整的「市场与竞品洞察报告」，输出为 **完整 HTML 页面**，布局风格参考「Sportsroyals Power Tower」那份报告：
- 顶部有标题、子标题、报告标签、生成时间
- 页面是卡片式布局，模块清晰，例如：
  - 1. 品类与竞品概况
  - 2. 头部竞品画像（销量、价格区间、星级、评论等）
  - 3. 价格 & 销量结构（区间判断即可）
  - 4. 运营与内容配置（页面要素、视频、A+、品牌资产等）
  - 5. 用户评价与痛点机会
  - 6. 机会 & 风险
  - 7. 选品 / 开发建议

【重要要求】
- 语言：简体中文，风格偏专业、决策导向，但不要太学术。
- 可以做**区间判断**（如「月销 1000–2000 单」）和**相对判断**（如「明显高于类目均价」），但不要编造非常精确的数字。
- 如报表中有品牌 / ASIN / 关键词，可以引用；不存在就用泛称（如「头部竞品」「腰部卖家」）。
- 输出必须是 **完整 HTML 文本**：从 <!DOCTYPE html> 开始，到 </html> 结束。
  - 自己在 <head> 里写好 <meta charset="utf-8">、<title>，以及内联 <style>。
  - 在 <body> 里写出卡片式布局，视觉上类似你之前那份 Sportsroyals 报告（有标题区、信息卡片、列表、强调文本等）。
- 只输出 HTML，不要 Markdown，不要任何解释文字。
`.trim();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  // 前端会发 { csvList, note }
  const { csvList, note } = req.body as {
    csvList?: { name: string; content: string }[];
    note?: string;
  };

  if (!csvList || csvList.length === 0) {
    res.status(400).json({ error: "csvList is required" });
    return;
  }

  // 每个文件做一个简短片段，避免文本过长
  const MAX_CHARS_PER_FILE = 12000;

  const csvBlocks = csvList
    .map((item, idx) => {
      const snippet = (item.content || "").slice(0, MAX_CHARS_PER_FILE);
      return `【表 ${idx + 1}：${item.name}】\n${snippet}`;
    })
    .join("\n\n----------------------\n\n");

  const userPrompt = `
下面是若干个报表文件的 CSV 文本片段，以及用户给出的一段场景备注。
请按照系统提示中的要求，写一份完整 HTML 市场报告页面。

===== 场景备注 =====
${note || "（用户没有填写场景备注）"}

===== 报表文本片段（1~N 个文件，可能已截断） =====
${csvBlocks}
===== 报表文本结束 =====
`.trim();

  try {
    const completion = await openai.chat.completions.create({
      // 建议先用 4.1-mini，稳定；如果你后面想改成 gpt-4.1 也可以
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const html = completion.choices[0].message?.content;
    if (!html) {
      res.status(500).json({ error: "Empty response from OpenAI" });
      return;
    }

    // 前端用 { html } 来渲染 iframe
    res.status(200).json({ html });
  } catch (error: any) {
    console.error("AI product research error:", error);
    res.status(500).json({
      error: "Failed to generate AI report",
      detail: error?.message ?? String(error),
    });
  }
}
