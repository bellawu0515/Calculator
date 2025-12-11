export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    // 打个日志（只在 Vercel 的 Functions 日志里看到）
    console.log("ai-product-research: got POST body length:", JSON.stringify(req.body).length);

    // 先返回一个非常小的假结果，结构跟前端期望的 AiResult 一致
    res.status(200).json({
      summary: {
        opportunityScore: 80,
        competitionScore: 40,
        profitPotential: "高",
        riskLevel: "中",
      },
      decisionLabel: "适合小单试水",
      decisionReason: "这是一个用于联通前后端的测试返回结果。",
      candidates: [
        {
          rank: 1,
          id: "TEST-ASIN-123",
          title: "测试用示例产品",
          type: "ASIN",
          price: 39.99,
          monthlySales: 500,
          revenue: 19995,
          reviews: 120,
          rating: 4.3,
          level: "B",
          tag: "测试用占位数据",
          action: "用于验证前端展示逻辑。",
        },
      ],
      modules: {
        "1.1": "测试模块 1.1 文本",
        "1.2": "测试模块 1.2 文本",
        "1.3": "……",
        "1.4": "……",
        "1.5": "……",
        "1.6": "……",

        "2.1": "……",
        "2.2": "……",
        "2.3": "……",

        "3.1": "……",
        "3.2": "……",
        "3.3": "……",
        "3.4": "……",
        "3.5": "……",
        "3.6": "……",
        "3.7": "……",
        "3.8": "……",
        "3.9": "……",
        "3.10": "……",
        "3.11": "……",

        "4.1": "……",
        "4.2": "……",
        "4.3": "……",
        "4.4": "……",
        "4.5": "……",
        "4.6": "……",
        "4.7": "……",

        "5.1": "……",
        "5.2": "……",
        "5.3": "……",
        "5.4": "……",
        "5.5": "……",

        "6.1": "……",
        "6.2": "……",
        "6.3": "……",
        "6.4": "……",

        "7.1": "……",

        "8.1": "……",
      },
      fullReportMarkdown: "这是一个占位用的 Markdown 报告正文，用来验证前端展示。",
    });
  } catch (error: any) {
    console.error("AI product research test error:", error);
    res.status(500).json({ error: "Test handler failed", detail: String(error?.message || error) });
  }
}
