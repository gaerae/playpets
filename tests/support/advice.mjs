// Words that tell a person how to pick, eat or cook a wild plant, per language. The spring shoots
// are only to be looked at: no string, page or guide text about them may carry this kind of advice.
export const ADVICE = {
  en: /\b(eat|edible|cook|tast|delicious|recipe|safe|poison|toxic|forag)/i,
  ko: /(먹|요리|맛|독|식용|채취)/,
  ja: /(食|料理|味|毒)/,
  'zh-hans': /(吃|食|做菜|菜谱|味|毒)/,
};
