import type { HealingContext } from "./types";

export type HealingFeedback =
  | "hit"
  | "tooSoup"
  | "dislike"
  | "save"
  | "reroll"
  | string
  | null
  | undefined;

/**
 * 为后续调用大模型生成 prompt（当前不实际调用模型）。
 *
 * 目标：根据用户刚刚刷到的焦虑内容，生成一张「多年后才读懂」的文学治愈卡片。
 * 输出必须是 JSON（仅输出 JSON，不要夹杂解释性文字）。
 */
export function generateHealingCardPrompt(params: {
  context: HealingContext;
  feedback?: HealingFeedback;
}) {
  const { context, feedback } = params;

  const feedbackHint = (() => {
    if (!feedback) return "（无）";
    if (feedback === "hit") return "用户觉得“被击中了”，这种语气可以保留。";
    if (feedback === "tooSoup") return "用户觉得“太鸡汤了”，下一句要更克制、更具体、更少口号。";
    if (feedback === "dislike") return "用户“不想看这个”，请换一个切入角度与意象，避免重复。";
    if (feedback === "save") return "用户点了收藏，说明语言击中，保持风格稳定。";
    if (feedback === "reroll") return "用户想再刷到一句，保持同一气质但换不同句子。";
    return `用户反馈：${String(feedback)}`;
  })();

  return `你是一个“信息流治愈卡片”的写作者。用户刚刚连续刷到了很多关于「${context}」的内容，因此内心被焦虑、比较、内耗轻轻推着走。

你的任务：写一张短小、克制、温柔、有文学感的「多年后才读懂」治愈卡。它不是鸡汤，不说教，不做心理诊断，不鼓励过度正能量。它要像从童年课本/经典文本/熟悉意象里递出的一句话——小时候读不懂，长大后突然被击中。

【重要】你必须只输出 JSON，且 JSON 只能包含以下字段，值都是字符串（不要多字段、不要注释、不要 markdown 代码块）：
{
  "title": "",
  "source": "",
  "quote": "",
  "childhoodTake": "",
  "reinterpretation": "",
  "comfort": "",
  "microAction": ""
}

字段写作要求：
- title：12~22 字，像“多年后才读懂……”的标题，含文学感但不要堆砌辞藻。
- source：作品名/作者/课本出处，简短即可（例如“朱自清《匆匆》六年级下册”）。
- quote：一句可引用的原句或近似引文（不要太长，建议 14~34 字），要有“被引用”的质感。
- childhoodTake：1 句。“小时候读到这句时的直觉理解”，更天真、更表层、甚至有点功利（比如“考点/背诵/写景真美”），长度 14~34 字。
- reinterpretation：1~2 句，写“长大后才懂”的重读解释，具体、克制、不过度煽情。
- comfort：1 句，像递给用户的一句话，温柔但不命令，不要“你一定可以/加油”等口号。
- microAction：1 句轻提示，不像任务命令；用“也许可以/不妨/试着”开头更好，长度 10~18 字。

内容约束：
- 不要使用“抑郁/焦虑症/创伤/人格”等诊断类词汇。
- 不要使用“你应该/你必须/立刻/马上”等强命令。
- 避免“宇宙/命运/一切都会好起来”这类廉价句式。
- 适配信息流卡片：短、清楚、留白。

用户反馈参考（可选）：${feedbackHint}

现在开始输出 JSON：`;
}
