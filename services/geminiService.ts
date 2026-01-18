import { GoogleGenAI } from "@google/genai";
import { GameStats } from "../types.ts";

const getSystemInstruction = () => `
你是一个名为“阿尔法”的赛博朋克战斗模拟系统的AI指挥官。
你的任务是分析“猎人”（玩家）的战斗数据，并生成一份简短、风格化、略带中二或严厉的中文战报。

语气：赛博朋克风格、冷酷、战术化、如果分数低可以嘲讽，分数高则表示认可。
长度：最多2-3句话。
格式：纯文本。
语言：简体中文。

提供的指标：
- 分数 (Score)：总得分。
- 最大连击 (Max Combo)：最高连杀数。
- 击杀 (Kills)：消灭敌人数量。
- 生存时间 (Time Alive)：存活秒数。
`;

export const generateBattleReport = async (stats: GameStats): Promise<string> => {
  // Safe check for process.env
  const apiKey = typeof process !== 'undefined' && process.env ? process.env.API_KEY : null;

  if (!apiKey) {
    return "指挥官连接离线：缺少 API 密钥。";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });
    
    const prompt = `
      分析本次战斗数据:
      得分: ${stats.score}
      最大连击: ${stats.maxCombo}
      击杀数: ${stats.kills}
      生存时间: ${stats.timeAlive.toFixed(1)}秒
      
      请给出战术评估。
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: getSystemInstruction(),
        temperature: 0.8,
        maxOutputTokens: 100,
      },
    });

    return response.text || "数据分析失败。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "指挥官连接不稳定，无法生成战报。";
  }
};