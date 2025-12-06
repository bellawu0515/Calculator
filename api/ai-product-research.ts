// 一个非常简单的 Vercel Serverless Function，返回 mock 的 AI 选品报告
// 放在 api/ai-product-research.ts，部署后对应路径就是 /api/ai-product-research

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Only POST is allowed" });
    return;
  }

  // 兼容一下 body 可能是字符串 / 对象两种情况
  let body: any = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const { csvText, note } = body || {};

  if (!csvText || typeof csvText !== "string") {
    res.status(400).json({ error: "csvText is required" });
    return;
  }

  // ====== 这里开始是 mock 出来的 AiResult，结构要和前端接口一致 ======
  const mockResult = {
    summary: {
      opportunityScore: 78,
      competitionScore: 62,
      profitPotential: "中偏高",
      riskLevel: "中等",
    },
    decisionLabel: "建议：可小单切入，逐步放量",
    decisionReason:
      "根据报表中的价格分布、月销量、评论结构和搜索热度，本类目具备一定的增长空间，但竞争和同质化程度不低，适合用差异化方案+控盘策略小批量切入，再根据实际投放与评价反馈决定是否放量。",
    candidates: [
      {
        rank: 1,
        id: "B0-CORE-001",
        title:
          "Cordless Battle Rope · Wireless Training Rope for Home Gym · Core Model",
        type: "ASIN",
        price: 59.99,
        monthlySales: 1200,
        revenue: 72000,
        reviews: 850,
        rating: 4.5,
        level: "A",
        tag: "标杆款 / 高销量",
        action: "重点跟踪：作为结构与定价标杆，研究其主图、视频与评论节奏。",
      },
      {
        rank: 2,
        id: "B0-NICHE-002",
        title:
          "Cordless Battle Rope with Pink Handles · For Women & Small Space",
        type: "ASIN",
        price: 64.99,
        monthlySales: 520,
        revenue: 33700,
        reviews: 210,
        rating: 4.4,
        level: "B",
        tag: "细分人群 / 女性向",
        action:
          "可作为差异化方向参考：颜色与人群定位更清晰，适合规划女性向变体。",
      },
      {
        rank: 3,
        id: "Keyword: cordless battle rope",
        title: "cordless battle rope",
        type: "Keyword",
        price: null,
        monthlySales: null,
        revenue: null,
        reviews: null,
        rating: null,
        level: "B",
        tag: "核心关键词",
        action:
          "建议重点布局：用于标题、五点与广告投放核心词；结合长尾词拓展投放。",
      },
    ],
    modules: {
      "1.1":
        "本节从 Listing 维度快速扫一眼：\n\n- 大部分畅销款主图统一突出“无线 / 不占地 / 低噪音”三个卖点；\n- 价格带主要集中在 49–79 美金，中位数约 59.99；\n- 头部卖家基本都上了视频与真人演示，纯渲染图 Listing 转化明显偏低；\n- 文案中高频出现的关键词包括：full body workout, low impact, joint friendly, apartment friendly 等。",
      "1.2":
        "从销量与评价结构看：\n\n- TOP10 中有 3–4 个 ASIN 长期稳定在高销量区间，属于成熟选手；\n- 新进入的 ASIN 只要切中差异化卖点（如颜色、小空间、女性向），也有机会在 2–3 个月内爬升到中腰部；\n- 留评率整体偏低，这意味着真实销量大于表面数据，且运营普遍对留评没有强推策略，给了后进者空间。",
      "2.1":
        "价格-销量散点来看，49–69 美金是主战场区域，过低价格会卷毛利，过高价格需强品牌背书或明显差异化功能。",
      "3.1":
        "市场整体增速平稳偏上，季节性不算特别强，更多受健身趋势与短视频内容带动。",
      "4.1":
        "竞品卖点高度集中在：不占地、低冲击、保护关节、小空间适用、适合新手与女性用户等，说明用户对“替代传统战绳”的认知已经基本形成。",
      "5.3":
        "用户在体验上重点提到：握把舒适度、弹簧回弹是否顺畅、噪音大小，以及长时间使用后手腕/肩部的疲劳感。",
      "6.2":
        "潜在的差异化方向：\n\n1）女性向 / 居家美学配色（白+灰、奶油色、马卡龙色）；\n2）更静音的结构设计，用于公寓用户；\n3）对“关节友好 / 康复训练”场景做更清晰的引导和说明。",
      "7.1":
        "供应链建议：\n\n- 优先选择有弹簧类产品经验的工厂，关注弹簧寿命与一致性；\n- 手柄表面材质建议做 1–2 个版本测试（橡胶纹理 / TPU 包胶），用评论反馈来决策。",
      "8.1":
        "合规方面：\n\n- 需在说明书与包装上补充：使用前热身、心血管疾病及关节问题人群建议咨询医生；\n- 明确儿童使用需监护，避免将产品理解为“玩具跳绳”。",
    },
    fullReportMarkdown:
      "## 无线战绳类目整体判断\n\n- **市场空间**：处于稳定上升期，受短视频与居家健身趋势拉动，中短期内仍有新增需求；\n- **竞争格局**：头部玩家已有，但品牌集中度不算极高，中腰部仍然较分散；\n- **利润潜力**：在合理的供应链与运费控制下，做到 30–40% 单次 ROI 是可达成的目标；\n- **推荐策略**：先以 1–2 个差异化明确的款式小批量切入（颜色 / 人群 / 静音方向），结合你的成本测算工具控制好资金周转与备货深度，再根据首轮评价与广告表现决定是否放量和扩展变体。",
  };

  res.status(200).json(mockResult);
}
