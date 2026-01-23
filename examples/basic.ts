import "dotenv/config";
import OpenAI from "openai";

import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { StructuredAgent } from "../dist/index.js";
// import Anthropic from "@anthropic-ai/sdk";

const inputSchema = z.object({
  noticia: z.string(),
})

const outputSchema = z.object({
  mainCharacter: z.string(),
  otherCharacters: z.array(z.string()),
  mainEvent: z.string(),
  conclusion: z.string(),
})

const prompt = `Analyze the following news article and extract the main character, other characters, main event, and conclusion.`;

const noticia = `
A Magazine Luiza anunciou nesta sexta-feira (14) a compra da startup mineira Softbox, especializada em soluções para empresas de varejo e indústria de bens de consumo que desejam fazer vendas digitais a consumidor final.
Com a aquisição, a Magazine Luiza amplia movimento para se tornar uma plataforma digital presente desde a venda online até a entrega ao cliente final.
O valor do negócio não foi informado. A Softbox tem 256 funcionários e atende em torno de 80 clientes, como Unilever, Coca-Cola e Basf.
A Softbox é a terceira startup adquirida pelo Magazine Luiza em cerca de um ano. Além, da mineira, a varejista comprou a Integra, especializada na integração de operações de comércio eletrônico e marketplaces, e a Logbee, de tecnologia logística.
"Na nossa opinião, a aquisição está alinhada com os objetivos da empresa de se tornar um negócio totalmente digital e multicanal, ficando à frente de seus principais concorrentes no caminho digital", disse a equipe da corretora Brasil Plural, em nota a clientes em que reitera recomendação "overweight" para a ação.
Em apresentação a investidores, o presidente-executivo do Magazine Luiza, Frederico Trajano, afirmou que a aquisição da Softbox permitirá à empresa "turbinar projeto" de criação de plataforma digital.
`;

const openAiInstance = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const googleGenAIInstance = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENAI_API_KEY,
})

// const anthropicInstance = new Anthropic({
//   apiKey: process.env.ANTHROPIC_API_KEY,
// })

const deepSeekInstance = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
})



const agentConfig = {
  generator: {
    llmService: deepSeekInstance,
    model: "deepseek-chat",
  },
  reviewer: {
    llmService: googleGenAIInstance,
    model: "gemini-flash-latest",
  },
  inputSchema,
  outputSchema,
  systemPrompt: prompt,
};

async function main() {
  try {
    console.log("Starting agents...");
    const agent = new StructuredAgent(agentConfig)
    const result = await agent.run({ noticia })
    console.log("Output:", JSON.stringify(result.output, null, 2))
    console.log("Metadata:", JSON.stringify(result.metadata, null, 2))
  } catch (error) {
    console.error("Error executing agent:", error)
  }
}

main();
