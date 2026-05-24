export type HealingContext =
  | "职场焦虑"
  | "学业压力"
  | "容貌焦虑"
  | "年龄焦虑"
  | "亲密关系"
  | "孤独感"
  | "深夜疲惫"
  | "自我怀疑";

export type HealingCardId = string;

export interface HealingCard {
  id: HealingCardId;
  context: HealingContext;
  title: string;
  source: string;
  quote: string;
  /**
   * 小时候读到这里的“直觉理解”（更天真、更表层）。
   * 用于与成年后的重读解析形成明显对照。
   */
  childhoodTake: string;
  /**
   * 成年后重读解析（更克制、更有“多年后才懂”的顿悟感）。
   */
  reinterpretation: string;
  comfort: string;
  microAction: string;
}
