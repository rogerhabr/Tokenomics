// All data is illustrative and based on publicly available estimates and analyst forecasts.
// Sources: Company filings, earnings calls, Omdia, IDC, and public analyst reports.

export const YEARS = ['2022', '2023', '2024', '2025', '2026E', '2027E', '2028E', '2029E', '2030E'];
export const FORECAST_YEARS = ['2026E', '2027E', '2028E', '2029E', '2030E'];

// ─── Hardware Installed Base ────────────────────────────────────────────────
// B200-equivalent GPU units (thousands), normalized by FP8 throughput vs B200

export const hyperscalerGPUs = [
  { year: '2022', Microsoft: 16,  Google: 25,  Amazon: 13,  Meta: 16,  Oracle: 2  },
  { year: '2023', Microsoft: 47,  Google: 66,  Amazon: 30,  Meta: 33,  Oracle: 6  },
  { year: '2024', Microsoft: 153, Google: 184, Amazon: 106, Meta: 113, Oracle: 23 },
  { year: '2025',Microsoft: 288, Google: 328, Amazon: 213, Meta: 203, Oracle: 59 },
  { year: '2026E',Microsoft: 431, Google: 513, Amazon: 341, Meta: 319, Oracle:106 },
  { year: '2027E',Microsoft: 613, Google: 725, Amazon: 488, Meta: 453, Oracle:159 },
  { year: '2028E',Microsoft: 828, Google: 969, Amazon: 650, Meta: 619, Oracle:225 },
  { year: '2029E',Microsoft:1076, Google:1260, Amazon: 845, Meta: 805, Oracle:293 },
  { year: '2030E',Microsoft:1345, Google:1575, Amazon:1056, Meta:1006, Oracle:366 },
];

export const hyperscalerColors: Record<string, string> = {
  Microsoft: '#0078d4',
  Google:    '#4285f4',
  Amazon:    '#ff9900',
  Meta:      '#0668e1',
  Oracle:    '#f80000',
};

export const foundationLabGPUs = [
  { year: '2022', OpenAI:  6, Anthropic:  2, xAI: 0,  DeepSeek:  1, 'Thinking Machines': 0 },
  { year: '2023', OpenAI:  9, Anthropic:  3, xAI: 3,  DeepSeek:  2, 'Thinking Machines': 1 },
  { year: '2024', OpenAI: 30, Anthropic:  9, xAI:13,  DeepSeek: 15, 'Thinking Machines': 3 },
  { year: '2025',OpenAI: 59, Anthropic: 20, xAI:41,  DeepSeek: 44, 'Thinking Machines': 8 },
  { year: '2026E',OpenAI: 97, Anthropic: 39, xAI:78,  DeepSeek: 72, 'Thinking Machines':17 },
  { year: '2027E',OpenAI:138, Anthropic: 61, xAI:125, DeepSeek:106, 'Thinking Machines':28 },
  { year: '2028E',OpenAI:200, Anthropic: 88, xAI:181, DeepSeek:154, 'Thinking Machines': 41 },
  { year: '2029E',OpenAI:270, Anthropic:119, xAI:244, DeepSeek:208, 'Thinking Machines': 55 },
  { year: '2030E',OpenAI:338, Anthropic:149, xAI:305, DeepSeek:260, 'Thinking Machines': 69 },
];

export const foundationLabColors: Record<string, string> = {
  OpenAI:               '#10b981',
  Anthropic:            '#f97316',
  xAI:                  '#8b5cf6',
  DeepSeek:             '#3b82f6',
  'Thinking Machines':  '#f59e0b',
};

export const neocloudGPUs = [
  { year: '2022', CoreWeave:  5, Nebius: 1, Crusoe:  1, 'Lambda Labs':  2 },
  { year: '2023', CoreWeave: 14, Nebius: 2, Crusoe:  2, 'Lambda Labs':  4 },
  { year: '2024', CoreWeave: 61, Nebius: 6, Crusoe:  4, 'Lambda Labs': 11 },
  { year: '2025',CoreWeave:150, Nebius:23, Crusoe: 15, 'Lambda Labs': 27 },
  { year: '2026E',CoreWeave:244, Nebius:45, Crusoe: 31, 'Lambda Labs': 50 },
  { year: '2027E',CoreWeave:338, Nebius:75, Crusoe: 55, 'Lambda Labs': 81 },
  { year: '2028E',CoreWeave:459, Nebius:102, Crusoe: 75, 'Lambda Labs':110 },
  { year: '2029E',CoreWeave:597, Nebius:133, Crusoe: 98, 'Lambda Labs':143 },
  { year: '2030E',CoreWeave:746, Nebius:166, Crusoe:122, 'Lambda Labs':179 },
];

export const neocloudColors: Record<string, string> = {
  CoreWeave:     '#06b6d4',
  Nebius:        '#8b5cf6',
  Crusoe:        '#10b981',
  'Lambda Labs': '#f59e0b',
};

// CapEx by hyperscaler ($B)
export const hyperscalerCapex = [
  { year: '2022', Microsoft: 22, Google: 25, Amazon: 32, Meta: 15, Oracle: 4  },
  { year: '2023', Microsoft: 28, Google: 32, Amazon: 48, Meta: 28, Oracle: 8  },
  { year: '2024', Microsoft: 53, Google: 52, Amazon: 75, Meta: 38, Oracle: 14 },
  { year: '2025', Microsoft: 65, Google: 91, Amazon: 105, Meta: 70, Oracle: 30 },
  { year: '2026E',Microsoft:115, Google:108, Amazon:138, Meta: 92, Oracle: 50 },
  { year: '2027E',Microsoft:150, Google:143, Amazon:175, Meta:120, Oracle: 70 },
  { year: '2028E',Microsoft:190, Google:185, Amazon:215, Meta:155, Oracle: 90 },
  { year: '2029E',Microsoft:228, Google:222, Amazon:258, Meta:186, Oracle:108 },
  { year: '2030E',Microsoft:269, Google:262, Amazon:305, Meta:220, Oracle:127 },
];

// ─── Hardware Specs ──────────────────────────────────────────────────────────

export interface HardwareSpec {
  name: string;
  vendor: string;
  chip: string;
  fp8TFLOPS: number;
  hbmTB: number;
  hbmBWTBs: number;
  powerW: number;
  b200Equiv: number;
  releaseYear: number;
}

export const hardwareSpecs: HardwareSpec[] = [
  // ── Hopper (single chip) ──────────────────────────────────────────────────────
  { name: 'H100',          vendor: 'NVIDIA', chip: 'H100',  fp8TFLOPS:  3958, hbmTB: 0.080, hbmBWTBs:   3.35, powerW:    700, b200Equiv:  0.31, releaseYear: 2022 },
  { name: 'H200',          vendor: 'NVIDIA', chip: 'H200',  fp8TFLOPS:  3958, hbmTB: 0.141, hbmBWTBs:   4.80, powerW:    700, b200Equiv:  0.44, releaseYear: 2024 },
  // ── Blackwell (single chip) ───────────────────────────────────────────────────
  { name: 'B200',          vendor: 'NVIDIA', chip: 'B200',  fp8TFLOPS:  4500, hbmTB: 0.192, hbmBWTBs:   8.00, powerW:   1000, b200Equiv:  1.00, releaseYear: 2025 },
  { name: 'B300',          vendor: 'NVIDIA', chip: 'B300',  fp8TFLOPS:  6750, hbmTB: 0.288, hbmBWTBs:   8.00, powerW:   1200, b200Equiv:  1.50, releaseYear: 2026 },
  // ── Grace Blackwell NVL racks (fp8TFLOPS = NVL72 rack total; GB200=720 PFLOPS per NVIDIA spec) ─
  { name: 'GB200',          vendor: 'NVIDIA', chip: 'GB200', fp8TFLOPS: 720000, hbmTB:13.824, hbmBWTBs: 576.00, powerW: 120000, b200Equiv: 12.50, releaseYear: 2025 },
  { name: 'GB300',          vendor: 'NVIDIA', chip: 'GB300', fp8TFLOPS:1080000, hbmTB:20.736, hbmBWTBs: 576.00, powerW: 130000, b200Equiv: 18.75, releaseYear: 2026 },
  // ── Vera Rubin NVL72 rack (72 R100 packages / 144 dies; FP8=1.2 EFLOPS, FP4=3.6 EFLOPS; 72×22 TB/s HBM4=1,584 TB/s; 72×288 GB=20.736 TB; 190–230 kW) ──
  { name: 'VR200',          vendor: 'NVIDIA', chip: 'R100',  fp8TFLOPS:1200000, hbmTB:20.736, hbmBWTBs:1584.00, powerW: 210000, b200Equiv: 80.00, releaseYear: 2027 },
  // ── Google TPU ───────────────────────────────────────────────────────────────
  { name: 'TPU v5p',         vendor: 'Google', chip: 'TPUv5p', fp8TFLOPS:   459, hbmTB: 0.095, hbmBWTBs:   2.76, powerW:    175, b200Equiv:  0.28, releaseYear: 2023 },
  { name: 'TPU v7 Ironwood', vendor: 'Google', chip: 'TPUv7',  fp8TFLOPS:  4614, hbmTB: 0.192, hbmBWTBs:   7.37, powerW:    200, b200Equiv:  1.41, releaseYear: 2025 },
  // ── Amazon Trainium ───────────────────────────────────────────────────────────
  { name: 'Trainium 2',      vendor: 'Amazon', chip: 'Trn2',   fp8TFLOPS:  2832, hbmTB: 0.096, hbmBWTBs:   2.90, powerW:    700, b200Equiv:  0.47, releaseYear: 2024 },
  { name: 'Trainium 3',      vendor: 'Amazon', chip: 'Trn3',   fp8TFLOPS:  5664, hbmTB: 0.192, hbmBWTBs:   9.60, powerW:    700, b200Equiv:  0.94, releaseYear: 2026 },
  // ── AMD Instinct ──────────────────────────────────────────────────────────────
  { name: 'MI300X',          vendor: 'AMD',    chip: 'MI300X', fp8TFLOPS:  2614, hbmTB: 0.192, hbmBWTBs:   5.30, powerW:    750, b200Equiv:  0.56, releaseYear: 2024 },
  { name: 'MI350X',          vendor: 'AMD',    chip: 'MI350X', fp8TFLOPS:  5220, hbmTB: 0.288, hbmBWTBs:   9.60, powerW:    750, b200Equiv:  1.09, releaseYear: 2025 },
];

// ─── Model Architectures ─────────────────────────────────────────────────────

export interface ModelSpec {
  name: string;
  provider: string;
  params: number;
  activeParams: number;
  contextK: number;
  type: 'dense' | 'moe';
  released: string;
}

export const modelSpecs: ModelSpec[] = [
  { name: 'GPT-4o',          provider: 'OpenAI',    params: 87,   activeParams: 87,  contextK: 128, type: 'dense', released: '2024-05' },
  { name: 'GPT-5',           provider: 'OpenAI',    params: 500,  activeParams: 500, contextK: 200, type: 'dense', released: '2025-02' },
  { name: 'Claude Sonnet 4', provider: 'Anthropic', params: 70,   activeParams: 70,  contextK: 200, type: 'dense', released: '2025-02' },
  { name: 'Claude Opus 4.8', provider: 'Anthropic', params: 200,  activeParams: 200, contextK: 200, type: 'dense', released: '2025-06' },
  { name: 'DeepSeek V3',     provider: 'DeepSeek',  params: 671,  activeParams: 37,  contextK: 128, type: 'moe',   released: '2024-12' },
  { name: 'DeepSeek R2',     provider: 'DeepSeek',  params: 800,  activeParams: 40,  contextK: 128, type: 'moe',   released: '2025-06' },
  { name: 'Kimi K2',         provider: 'Moonshot',  params: 1000, activeParams: 32,  contextK: 128, type: 'moe',   released: '2025-07' },
  { name: 'Llama 4 Maverick',provider: 'Meta',      params: 400,  activeParams: 17,  contextK: 256, type: 'moe',   released: '2025-04' },
  { name: 'Gemini 2.5 Pro',  provider: 'Google',    params: 175,  activeParams: 175, contextK: 128, type: 'dense', released: '2025-03' },
];

// ─── Token Throughput Matrix ─────────────────────────────────────────────────
// Tokens/second per chip for inference (output tokens, batchsize ~32, fp8)

export const throughputMatrix: Record<string, Record<string, number>> = {
  'H100':            { 'GPT-4o': 320, 'GPT-5': 88,  'Claude Sonnet 4': 385, 'Claude Opus 4.8': 135, 'Fable 5': 108, 'DeepSeek V3': 430, 'Kimi K2': 400, 'Gemini 2.5 Pro': 260 },
  'H200':            { 'GPT-4o': 460, 'GPT-5': 125, 'Claude Sonnet 4': 555, 'Claude Opus 4.8': 195, 'Fable 5': 155, 'DeepSeek V3': 620, 'Kimi K2': 575, 'Gemini 2.5 Pro': 375 },
  'B200':            { 'GPT-4o': 780, 'GPT-5': 210, 'Claude Sonnet 4': 940, 'Claude Opus 4.8': 330, 'Fable 5': 263, 'DeepSeek V3':1050, 'Kimi K2': 970, 'Gemini 2.5 Pro': 635 },
  'B300':            { 'GPT-4o':1170, 'GPT-5': 315, 'Claude Sonnet 4':1410, 'Claude Opus 4.8': 495, 'Fable 5': 395, 'DeepSeek V3':1575, 'Kimi K2':1455, 'Gemini 2.5 Pro': 955 }, // 1.5× B200
  'GB200':     { 'GPT-4o':1850, 'GPT-5': 495, 'Claude Sonnet 4':2230, 'Claude Opus 4.8': 780, 'Fable 5': 624, 'DeepSeek V3':2490, 'Kimi K2':2300, 'Gemini 2.5 Pro':1510 },
  'GB300':     { 'GPT-4o':2775, 'GPT-5': 745, 'Claude Sonnet 4':3345, 'Claude Opus 4.8':1170, 'Fable 5': 940, 'DeepSeek V3':3735, 'Kimi K2':3450, 'Gemini 2.5 Pro':2265 }, // 1.5× GB200
  'VR200':    { 'GPT-4o':5550, 'GPT-5':1485, 'Claude Sonnet 4':6690, 'Claude Opus 4.8':2340, 'Fable 5':1872, 'DeepSeek V3':7470, 'Kimi K2':6900, 'Gemini 2.5 Pro':4530 }, // 3× GB200; R100 22 TB/s HBM4 vs B200 8 TB/s (×2.75 BW) + NVLink 6; NVIDIA claims 5× Blackwell at rack level
  'TPU v5p':         { 'GPT-4o': 290, 'GPT-5': 79,  'Claude Sonnet 4': 350, 'Claude Opus 4.8': 123, 'Fable 5': 98,  'DeepSeek V3': 390, 'Kimi K2': 360, 'Gemini 2.5 Pro': 235 },
  'TPU v7 Ironwood': { 'GPT-4o': 640, 'GPT-5': 172, 'Claude Sonnet 4': 770, 'Claude Opus 4.8': 270, 'Fable 5': 216, 'DeepSeek V3': 860, 'Kimi K2': 795, 'Gemini 2.5 Pro': 520 },
  'Trainium 2':      { 'GPT-4o': 280, 'GPT-5': 76,  'Claude Sonnet 4': 340, 'Claude Opus 4.8': 119, 'Fable 5': 95,  'DeepSeek V3': 375, 'Kimi K2': 348, 'Gemini 2.5 Pro': 228 },
  'Trainium 3':      { 'GPT-4o': 525, 'GPT-5': 141, 'Claude Sonnet 4': 635, 'Claude Opus 4.8': 222, 'Fable 5': 178, 'DeepSeek V3': 705, 'Kimi K2': 655, 'Gemini 2.5 Pro': 428 },
  'MI300X':          { 'GPT-4o': 410, 'GPT-5': 110, 'Claude Sonnet 4': 495, 'Claude Opus 4.8': 173, 'Fable 5': 139, 'DeepSeek V3': 555, 'Kimi K2': 513, 'Gemini 2.5 Pro': 334 },
  'MI350X':          { 'GPT-4o': 720, 'GPT-5': 193, 'Claude Sonnet 4': 870, 'Claude Opus 4.8': 305, 'Fable 5': 244, 'DeepSeek V3': 970, 'Kimi K2': 898, 'Gemini 2.5 Pro': 586 },
};

// ─── Workload Characteristics ────────────────────────────────────────────────

export interface WorkloadSpec {
  name: string;
  icon: string;
  avgInputTokens: number;
  avgOutputTokens: number;
  sessionsPerUserPerDay: number;
  adoptionShare2025: number;
  adoptionShare2027: number;
  color: string;
}

export const workloads: WorkloadSpec[] = [
  { name: 'Chat / Q&A',          icon: '💬', avgInputTokens: 200,   avgOutputTokens: 500,  sessionsPerUserPerDay: 4,   adoptionShare2025: 38, adoptionShare2027: 30, color: '#3b82f6' },
  { name: 'Coding',              icon: '⌨️', avgInputTokens: 600,   avgOutputTokens: 1200, sessionsPerUserPerDay: 8,   adoptionShare2025: 22, adoptionShare2027: 28, color: '#10b981' },
  { name: 'Document Analysis',   icon: '📄', avgInputTokens: 12000, avgOutputTokens: 600,  sessionsPerUserPerDay: 2,   adoptionShare2025: 18, adoptionShare2027: 20, color: '#f97316' },
  { name: 'Agentic / Reasoning', icon: '🤖', avgInputTokens: 3000,  avgOutputTokens: 2500, sessionsPerUserPerDay: 2,   adoptionShare2025: 12, adoptionShare2027: 15, color: '#8b5cf6' },
  { name: 'Image / Multimodal',  icon: '🖼️', avgInputTokens: 800,   avgOutputTokens: 400,  sessionsPerUserPerDay: 1.5, adoptionShare2025: 10, adoptionShare2027: 7,  color: '#f59e0b' },
];

// ─── Token Economy TAM ───────────────────────────────────────────────────────
// Revenue ($B)

export const tokenEconomyTAM = [
  { year: '2022', consumerApps: 0.4,  apiInference: 0.3, tokenSoftware: 0.1 },
  { year: '2023', consumerApps: 1.5,  apiInference: 1.2, tokenSoftware: 0.3 },
  { year: '2024', consumerApps: 5.2,  apiInference: 4.8, tokenSoftware: 2.0 },
  { year: '2025',consumerApps: 14.5, apiInference:13.8, tokenSoftware: 7.2 },
  { year: '2026E',consumerApps: 36.0, apiInference:36.5, tokenSoftware:18.5 },
  { year: '2027E',consumerApps: 79.0, apiInference:82.0, tokenSoftware:40.0 },
  { year: '2028E',consumerApps:158.0, apiInference:165.0,tokenSoftware:80.0 },
  { year: '2029E',consumerApps:240.0, apiInference:252.0, tokenSoftware:132.0 },
  { year: '2030E',consumerApps:352.0, apiInference:372.0, tokenSoftware:200.0 },
];

// Key consumer applications
export interface TokenApp {
  name: string;
  provider: string;
  type: 'consumer' | 'api' | 'software';
  mau2024M: number;
  mau2025M: number;
  tokensPerUserPerDay: number;
  pricingModel: string;
  revenueRunRate2025B: number;
  color: string;
}

export const tokenApps: TokenApp[] = [
  { name: 'ChatGPT',             provider: 'OpenAI',    type: 'consumer', mau2024M: 180, mau2025M: 400,  tokensPerUserPerDay: 8000,  pricingModel: '$20/mo + API', revenueRunRate2025B: 11.6, color: '#10b981' },
  { name: 'Google AI Overviews', provider: 'Google',    type: 'consumer', mau2024M:1200, mau2025M:2200,  tokensPerUserPerDay: 2000,  pricingModel: 'Ad-supported',  revenueRunRate2025B: 0,    color: '#4285f4' },
  { name: 'Grok',                provider: 'xAI',       type: 'consumer', mau2024M: 45,  mau2025M: 120,  tokensPerUserPerDay: 6000,  pricingModel: '$8-16/mo',      revenueRunRate2025B: 1.0,  color: '#8b5cf6' },
  { name: 'Meta AI',             provider: 'Meta',      type: 'consumer', mau2024M: 400, mau2025M: 800,  tokensPerUserPerDay: 1500,  pricingModel: 'Free (bundled)', revenueRunRate2025B: 0,    color: '#0668e1' },
  { name: 'Gemini',              provider: 'Google',    type: 'consumer', mau2024M: 90,  mau2025M: 220,  tokensPerUserPerDay: 7500,  pricingModel: '$20/mo + API',  revenueRunRate2025B: 4.0,  color: '#4285f4' },
  { name: 'Claude (API)',        provider: 'Anthropic', type: 'api',      mau2024M: 25,  mau2025M: 75,   tokensPerUserPerDay: 25000, pricingModel: 'Per token',     revenueRunRate2025B: 3.0,  color: '#f97316' },
  { name: 'Perplexity',         provider: 'Perplexity',type: 'software', mau2024M: 15,  mau2025M: 40,   tokensPerUserPerDay: 5000,  pricingModel: '$20/mo',        revenueRunRate2025B: 0.5,  color: '#f59e0b' },
  { name: 'Cursor',             provider: 'Cursor',    type: 'software', mau2024M: 1.5, mau2025M: 5,    tokensPerUserPerDay: 40000, pricingModel: '$20/mo',        revenueRunRate2025B: 0.5,  color: '#06b6d4' },
  { name: 'Windsurf',           provider: 'Codeium',   type: 'software', mau2024M: 0.8, mau2025M: 2.5,  tokensPerUserPerDay: 38000, pricingModel: '$15/mo',        revenueRunRate2025B: 0.2,  color: '#6366f1' },
  { name: 'Harvey',             provider: 'Harvey',    type: 'software', mau2024M: 0.05,mau2025M: 0.15, tokensPerUserPerDay: 60000, pricingModel: 'Enterprise',    revenueRunRate2025B: 0.1,  color: '#ec4899' },
];

// ─── SAAS Disruption Tracker ─────────────────────────────────────────────────

export interface SaasDisruption {
  company: string;
  sector: string;
  revenue2024B: number;
  revenueAtRiskPct: number;
  seatModel: boolean;
  aiResponse: string;
  threatLevel: 'Adapting' | 'Medium' | 'High' | 'Critical';
  disruptors: string[];
  timelineYears: number;
}

export const saasDisruptions: SaasDisruption[] = [
  { company: 'Salesforce',  sector: 'CRM',          revenue2024B: 34.9, revenueAtRiskPct: 35, seatModel: true,  aiResponse: 'Agentforce platform', threatLevel: 'High',     disruptors: ['Decagon', 'Salesforce Agentforce', 'Anthropic agents'], timelineYears: 3 },
  { company: 'ServiceNow',  sector: 'IT Workflows',  revenue2024B: 10.9, revenueAtRiskPct: 50, seatModel: true,  aiResponse: 'Now Assist AI agents', threatLevel: 'Critical', disruptors: ['Moveworks', 'Aisera', 'OpenAI GPTs'], timelineYears: 2 },
  { company: 'Adobe',       sector: 'Creative',      revenue2024B: 21.5, revenueAtRiskPct: 45, seatModel: true,  aiResponse: 'Adobe Firefly & Gen AI', threatLevel: 'Critical', disruptors: ['Midjourney', 'Sora', 'OpenAI', 'Runway'], timelineYears: 2 },
  { company: 'Atlassian',   sector: 'Dev Tools',     revenue2024B: 4.4,  revenueAtRiskPct: 55, seatModel: true,  aiResponse: 'Rovo AI, Jira AI', threatLevel: 'Critical', disruptors: ['Cursor', 'GitHub Copilot', 'Linear AI'], timelineYears: 2 },
  { company: 'Workday',     sector: 'HCM / ERP',     revenue2024B: 7.3,  revenueAtRiskPct: 30, seatModel: true,  aiResponse: 'Workday AI agents', threatLevel: 'Medium',   disruptors: ['Rippling', 'TriNet', 'AI HR agents'], timelineYears: 4 },
  { company: 'SAP',         sector: 'ERP',           revenue2024B: 35.4, revenueAtRiskPct: 25, seatModel: true,  aiResponse: 'SAP Business AI', threatLevel: 'Medium',   disruptors: ['AI-native ERP startups', 'Microsoft Copilot'], timelineYears: 5 },
  { company: 'Microsoft',   sector: 'Productivity',  revenue2024B:211.9, revenueAtRiskPct: 15, seatModel: true,  aiResponse: 'Copilot across all products', threatLevel: 'Adapting', disruptors: ['Internal disruption'], timelineYears: 5 },
  { company: 'Oracle',      sector: 'Database / ERP',revenue2024B: 53.0, revenueAtRiskPct: 20, seatModel: true,  aiResponse: 'Oracle AI Data Platform', threatLevel: 'Adapting', disruptors: ['Snowflake', 'AI-native databases'], timelineYears: 4 },
];

// Token-consuming software companies (emerging)
export interface TokenConsumer {
  name: string;
  category: string;
  founded: number;
  arr2025M: number;
  revenueModel: string;
  tokensPerDollarRevenue: number;
  growthPctYoY: number;
  clusterMaxRating: string;
}

export const tokenConsumers: TokenConsumer[] = [
  { name: 'Cursor',            category: 'AI Coding',     founded: 2022, arr2025M: 500,  revenueModel: 'Subscription + usage', tokensPerDollarRevenue: 4200000, growthPctYoY: 400, clusterMaxRating: 'A+' },
  { name: 'Windsurf (Codeium)',category: 'AI Coding',     founded: 2021, arr2025M: 200,  revenueModel: 'Subscription',         tokensPerDollarRevenue: 3800000, growthPctYoY: 350, clusterMaxRating: 'A'  },
  { name: 'Harvey',            category: 'Legal AI',      founded: 2022, arr2025M: 100,  revenueModel: 'Enterprise seat + usage', tokensPerDollarRevenue: 8500000, growthPctYoY: 300, clusterMaxRating: 'B+' },
  { name: 'Perplexity',        category: 'AI Search',     founded: 2022, arr2025M: 150,  revenueModel: 'Sub + ads',            tokensPerDollarRevenue: 5200000, growthPctYoY: 280, clusterMaxRating: 'A'  },
  { name: 'Glean',             category: 'Enterprise AI', founded: 2019, arr2025M: 120,  revenueModel: 'Enterprise SaaS',      tokensPerDollarRevenue: 6100000, growthPctYoY: 250, clusterMaxRating: 'B+' },
  { name: 'Sierra',            category: 'AI Agents',     founded: 2023, arr2025M: 80,   revenueModel: 'Usage-based',          tokensPerDollarRevenue: 9800000, growthPctYoY: 500, clusterMaxRating: 'A'  },
  { name: 'Aisera',            category: 'IT Support AI', founded: 2017, arr2025M: 70,   revenueModel: 'Enterprise SaaS',      tokensPerDollarRevenue: 7200000, growthPctYoY: 180, clusterMaxRating: 'B'  },
  { name: 'Writer',            category: 'Enterprise AI', founded: 2020, arr2025M: 90,   revenueModel: 'Enterprise seat',      tokensPerDollarRevenue: 4900000, growthPctYoY: 220, clusterMaxRating: 'B+' },
];

// ─── Compute Supply vs Demand ─────────────────────────────────────────────────
// B200-equivalent EFLOPS (millions), annualized

export const supplyDemand = [
  { year: '2022', inferenceSupply: 0.25, trainingSupply: 0.13, inferenceDemand: 0.19, trainingDemand: 0.16 },
  { year: '2023', inferenceSupply: 0.69, trainingSupply: 0.34, inferenceDemand: 0.56, trainingDemand: 0.44 },
  { year: '2024', inferenceSupply: 2.13, trainingSupply: 1.00, inferenceDemand: 1.84, trainingDemand: 1.19 },
  { year: '2025',inferenceSupply: 5.16, trainingSupply: 2.34, inferenceDemand: 4.63, trainingDemand: 2.88 },
  { year: '2026E',inferenceSupply:10.63, trainingSupply: 4.69, inferenceDemand:10.16, trainingDemand: 5.78 },
  { year: '2027E',inferenceSupply:20.00, trainingSupply: 8.44, inferenceDemand:19.06, trainingDemand:10.00 },
  { year: '2028E',inferenceSupply:35.94, trainingSupply:15.00, inferenceDemand:35.00, trainingDemand:16.25 },
  { year: '2029E',inferenceSupply:57.50, trainingSupply:24.06, inferenceDemand:56.25, trainingDemand:26.00 },
  { year: '2030E',inferenceSupply:89.69, trainingSupply:37.50, inferenceDemand:87.50, trainingDemand:40.63 },
];

// Supply breakdown by provider type
export const supplyByType = [
  { year: '2022', hyperscalers: 0.28, foundationLabs: 0.06, neoclouds: 0.03 },
  { year: '2023', hyperscalers: 0.75, foundationLabs: 0.19, neoclouds: 0.09 },
  { year: '2024', hyperscalers: 2.34, foundationLabs: 0.56, neoclouds: 0.22 },
  { year: '2025',hyperscalers: 5.56, foundationLabs: 1.41, neoclouds: 0.53 },
  { year: '2026E',hyperscalers:11.56, foundationLabs: 2.81, neoclouds: 0.94 },
  { year: '2027E',hyperscalers:21.88, foundationLabs: 4.69, neoclouds: 1.88 },
  { year: '2028E',hyperscalers:39.38, foundationLabs: 8.13, neoclouds: 3.44 },
  { year: '2029E',hyperscalers:63.13, foundationLabs:13.00, neoclouds: 5.50 },
  { year: '2030E',hyperscalers:98.44, foundationLabs:20.31, neoclouds: 8.75 },
];

// ─── ROIC Data ───────────────────────────────────────────────────────────────

export const roicByEntity = [
  { year: '2022', hyperscalers: -8,  foundationLabs: -55, neoclouds: 12 },
  { year: '2023', hyperscalers: -3,  foundationLabs: -42, neoclouds: 17 },
  { year: '2024', hyperscalers:  9,  foundationLabs: -28, neoclouds: 22 },
  { year: '2025',hyperscalers: 19,  foundationLabs: -12, neoclouds: 26 },
  { year: '2026E',hyperscalers: 26,  foundationLabs:   4, neoclouds: 30 },
  { year: '2027E',hyperscalers: 29,  foundationLabs:  17, neoclouds: 34 },
  { year: '2028E',hyperscalers: 31,  foundationLabs:  25, neoclouds: 36 },
  { year: '2029E',hyperscalers: 33,  foundationLabs:  30, neoclouds: 37 },
  { year: '2030E',hyperscalers: 35,  foundationLabs:  34, neoclouds: 38 },
];

// ─── Revenue & Profit ────────────────────────────────────────────────────────
// Revenue by business model ($B)

export const revenueByModel = [
  { year: '2022', rental: 4,    model: 0.5, software: 1    },
  { year: '2023', rental: 8,    model: 2,   software: 5    },
  { year: '2024', rental: 22,   model: 10,  software: 18   },
  { year: '2025',rental: 48,   model: 30,  software: 55   },
  { year: '2026E',rental: 95,   model: 70,  software: 130  },
  { year: '2027E',rental: 175,  model: 145, software: 280  },
  { year: '2028E',rental: 300,  model: 280, software: 520  },
  { year: '2029E',rental: 415,  model: 448, software:  837 },
  { year: '2030E',rental: 560,  model: 672, software: 1268 },
];

// Operating margins by revenue type (%)
export const marginsByModel = [
  { year: '2022', rental: 28, model: -80, software: 45 },
  { year: '2023', rental: 31, model: -65, software: 40 },
  { year: '2024', rental: 35, model: -30, software: 38 },
  { year: '2025',rental: 38, model:  -5, software: 42 },
  { year: '2026E',rental: 40, model:  18, software: 48 },
  { year: '2027E',rental: 42, model:  28, software: 52 },
  { year: '2028E',rental: 43, model:  35, software: 56 },
  { year: '2029E',rental: 44, model:  40, software: 58 },
  { year: '2030E',rental: 45, model:  44, software: 60 },
];

// ─── Hardware Demand Forecast ─────────────────────────────────────────────────
// GPU units shipped (B200-eq, thousands) for inference vs training

export const hardwareDemandForecast = [
  { year: '2022', inferenceGPUs:   56, trainingGPUs:   38, total:   94 },
  { year: '2023', inferenceGPUs:  150, trainingGPUs:  100, total:  250 },
  { year: '2024', inferenceGPUs:  406, trainingGPUs:  219, total:  625 },
  { year: '2025',inferenceGPUs:  969, trainingGPUs:  438, total: 1406 },
  { year: '2026E',inferenceGPUs: 1938, trainingGPUs:  719, total: 2656 },
  { year: '2027E',inferenceGPUs: 3594, trainingGPUs: 1094, total: 4688 },
  { year: '2028E',inferenceGPUs: 6094, trainingGPUs: 1563, total: 7656 },
  { year: '2029E',inferenceGPUs: 9453, trainingGPUs: 2188, total:11641 },
  { year: '2030E',inferenceGPUs:13974, trainingGPUs: 2953, total:16927 },
];

// By accelerator vendor market share (%)
export const vendorMarketShare = [
  { year: '2022', NVIDIA: 92, AMD: 4, Google: 2, Amazon: 1, Other: 1 },
  { year: '2023', NVIDIA: 90, AMD: 5, Google: 3, Amazon: 1, Other: 1 },
  { year: '2024', NVIDIA: 85, AMD: 8, Google: 4, Amazon: 2, Other: 1 },
  { year: '2025',NVIDIA: 80, AMD:10, Google: 6, Amazon: 3, Other: 1 },
  { year: '2026E',NVIDIA: 75, AMD:12, Google: 7, Amazon: 4, Other: 2 },
  { year: '2027E',NVIDIA: 70, AMD:14, Google: 9, Amazon: 5, Other: 2 },
  { year: '2028E',NVIDIA: 65, AMD:16, Google:11, Amazon: 6, Other: 2 },
  { year: '2029E',NVIDIA: 60, AMD:18, Google:13, Amazon: 7, Other: 2 },
  { year: '2030E',NVIDIA: 56, AMD:20, Google:15, Amazon: 8, Other: 1 },
];

// ─── ROIC Calculator Defaults ─────────────────────────────────────────────────

export interface ROICInputs {
  hardware: string;
  numGPUs: number;
  costPerGPU: number;
  utilizationPct: number;
  revenuePerMTokens: number;
  tokensPerGPUPerSec: number;
  powerW: number;
  pue: number;
  powerCostPerKWh: number;
  opexPctCapex: number;
  amortizationYears: number;
  fixedAnnualOverheadM: number;
}

export const defaultROICInputs: ROICInputs = {
  hardware: 'GB200',
  numGPUs: 72,
  costPerGPU: 41667, // $3M NVL72 rack ÷ 72 GPU dies
  utilizationPct: 82,
  revenuePerMTokens: 1.50,
  tokensPerGPUPerSec: 800,
  powerW: 1667,
  pue: 1.20,
  powerCostPerKWh: 0.04,
  opexPctCapex: 10,
  amortizationYears: 3,
  fixedAnnualOverheadM: 0.5,
};

export const hardwareDefaults: Record<string, Partial<ROICInputs>> = {
  'H100':            { costPerGPU: 30000, tokensPerGPUPerSec: 350, powerW: 700,    revenuePerMTokens: 2.50 },
  'H200':            { costPerGPU: 40000, tokensPerGPUPerSec: 510, powerW: 700,    revenuePerMTokens: 2.00 },
  'B200':            { costPerGPU: 55000,  tokensPerGPUPerSec:  860, powerW: 1000,  revenuePerMTokens: 1.75 },
  'B300':            { costPerGPU: 75000,  tokensPerGPUPerSec: 1300, powerW: 1200,  revenuePerMTokens: 1.50 }, // est. ~$75k/chip; 1.5× B200 throughput
  'GB200':     { costPerGPU: 41667,  tokensPerGPUPerSec:  800, powerW: 1667,  revenuePerMTokens: 1.50 }, // $3M NVL72 rack ÷ 72 GPU dies
  'GB300':     { costPerGPU: 85000,  tokensPerGPUPerSec: 1200, powerW: 1806,  revenuePerMTokens: 1.25 }, // est. ~$6.1M rack ÷ 72; 130kW ÷ 72 ≈ 1806W/GPU
  'VR200':    { costPerGPU: 122222, tokensPerGPUPerSec: 2800, powerW: 2917,  revenuePerMTokens: 1.00 }, // est. ~$8.8M rack ÷ 72 packages; 210kW ÷ 72 ≈ 2917W/package
  'TPU v5p':         { costPerGPU: 10000, tokensPerGPUPerSec: 320, powerW: 175,    revenuePerMTokens: 3.00 },
  'TPU v7 Ironwood': { costPerGPU: 35000, tokensPerGPUPerSec: 700, powerW: 200,    revenuePerMTokens: 2.00 },
  'Trainium 2':      { costPerGPU: 22000, tokensPerGPUPerSec: 310, powerW: 700,    revenuePerMTokens: 2.60 },
  'Trainium 3':      { costPerGPU: 30000, tokensPerGPUPerSec: 580, powerW: 700,    revenuePerMTokens: 2.20 },
  'MI300X':          { costPerGPU: 25000, tokensPerGPUPerSec: 460, powerW: 750,    revenuePerMTokens: 2.80 },
  'MI350X':          { costPerGPU: 38000, tokensPerGPUPerSec: 790, powerW: 750,    revenuePerMTokens: 2.00 },
};

export function calcROIC(inputs: ROICInputs) {
  const capex = inputs.numGPUs * inputs.costPerGPU;
  const secPerYear = 86400 * 365;
  const annualTokens = inputs.numGPUs * inputs.tokensPerGPUPerSec * secPerYear * (inputs.utilizationPct / 100);
  const annualRevenue = (annualTokens / 1e6) * inputs.revenuePerMTokens;
  const annualPowerCost = (inputs.numGPUs * inputs.powerW * inputs.pue / 1000) * 24 * 365 * inputs.powerCostPerKWh;
  const annualOpex = (inputs.opexPctCapex / 100) * capex;
  const annualAmortization = capex / inputs.amortizationYears;
  const annualFixedOverhead = inputs.fixedAnnualOverheadM * 1e6;
  const annualTotalCost = annualPowerCost + annualOpex + annualAmortization + annualFixedOverhead;
  const annualProfit = annualRevenue - annualTotalCost;
  const roic = (annualProfit / capex) * 100;
  const paybackMonths = annualProfit > 0 ? Math.min(120, (capex / annualProfit) * 12) : Infinity;
  const grossMarginPct = annualRevenue > 0
    ? ((annualRevenue - annualPowerCost - annualOpex - annualFixedOverhead - annualAmortization) / annualRevenue) * 100 : 0;

  return {
    capex,
    annualRevenue,
    annualPowerCost,
    annualOpex,
    annualAmortization,
    annualFixedOverhead,
    annualTotalCost,
    annualProfit,
    roic,
    paybackMonths,
    annualTokensB: annualTokens / 1e9,
    grossMarginPct,
  };
}

// ─── Hardware Refresh Sensitivity ────────────────────────────────────────────

export interface RefreshInputs {
  gen0Hardware: string;
  gen1Hardware: string;
  numGPUs: number;
  utilizationPct: number;
  revenuePerMTokensY0: number;
  tokenPriceDecayPctPerYr: number;
  powerCostPerKWh: number;
  pue: number;
  opexPctCapex: number;
  refreshCycleYears: number;
  resalePct: number;
  analysisPeriodYears: number;
}

export interface RefreshYearData {
  year: number;
  hardware: string;
  capexOut: number;
  saleProceeds: number;
  revenue: number;
  opex: number;
  fcf: number;
  cumFCF: number;
  tokensB: number;
  tokenPrice: number;
}

export interface RefreshScenario {
  id: string;
  label: string;
  color: string;
  years: RefreshYearData[];
  totalCapex: number;
  totalSaleProceeds: number;
  netCapex: number;
  totalRevenue: number;
  totalOpex: number;
  totalFCF: number;
}

export const defaultRefreshInputs: RefreshInputs = {
  gen0Hardware: 'B200',
  gen1Hardware: 'VR200',
  numGPUs: 512,
  utilizationPct: 82,
  revenuePerMTokensY0: 1.75,
  tokenPriceDecayPctPerYr: 40,
  powerCostPerKWh: 0.04,
  pue: 1.20,
  opexPctCapex: 10,
  refreshCycleYears: 3,
  resalePct: 25,
  analysisPeriodYears: 6,
};

export function calcRefreshCycle(inputs: RefreshInputs): {
  noRefresh: RefreshScenario;
  refreshRetire: RefreshScenario;
  refreshResale: RefreshScenario;
} {
  const d0 = hardwareDefaults[inputs.gen0Hardware] ?? {};
  const d1 = hardwareDefaults[inputs.gen1Hardware] ?? {};
  const costG0 = d0.costPerGPU ?? 55000;
  const costG1 = d1.costPerGPU ?? 105000;
  const thrG0  = d0.tokensPerGPUPerSec ?? 860;
  const thrG1  = d1.tokensPerGPUPerSec ?? 2800;
  const pwrG0  = d0.powerW ?? 1000;
  const pwrG1  = d1.powerW ?? 1500;
  const capexG0 = inputs.numGPUs * costG0;
  const capexG1 = inputs.numGPUs * costG1;
  const util = inputs.utilizationPct / 100;
  const secPerYear = 86400 * 365;

  function build(id: string, label: string, color: string, withRefresh: boolean, withResale: boolean): RefreshScenario {
    const years: RefreshYearData[] = [];
    let cumFCF = -capexG0;

    years.push({
      year: 0, hardware: inputs.gen0Hardware,
      capexOut: capexG0, saleProceeds: 0, revenue: 0, opex: 0,
      fcf: -capexG0, cumFCF,
      tokensB: 0, tokenPrice: inputs.revenuePerMTokensY0,
    });

    for (let y = 1; y <= inputs.analysisPeriodYears; y++) {
      const refreshed     = withRefresh && y > inputs.refreshCycleYears;
      const isRefreshYear = withRefresh && y === inputs.refreshCycleYears + 1;

      const hw   = refreshed ? inputs.gen1Hardware : inputs.gen0Hardware;
      const thr  = refreshed ? thrG1 : thrG0;
      const pwr  = refreshed ? pwrG1 : pwrG0;
      const base = refreshed ? capexG1 : capexG0;

      const tokenPrice   = inputs.revenuePerMTokensY0 * Math.pow(1 - inputs.tokenPriceDecayPctPerYr / 100, y - 1);
      const revenue      = (inputs.numGPUs * thr * secPerYear * util / 1e6) * tokenPrice;
      const powerCost    = (inputs.numGPUs * pwr / 1000) * 24 * 365 * inputs.powerCostPerKWh * inputs.pue;
      const otherOpex    = (inputs.opexPctCapex / 100) * base;
      const opex         = powerCost + otherOpex;
      const capexOut     = isRefreshYear ? capexG1 : 0;
      const saleProceeds = isRefreshYear && withResale ? capexG0 * (inputs.resalePct / 100) : 0;
      const fcf          = revenue - opex - capexOut + saleProceeds;
      cumFCF += fcf;

      years.push({
        year: y, hardware: hw, capexOut, saleProceeds,
        revenue, opex, fcf, cumFCF,
        tokensB: inputs.numGPUs * thr * secPerYear * util / 1e9,
        tokenPrice,
      });
    }

    const totalCapex       = capexG0 + (withRefresh ? capexG1 : 0);
    const totalSaleProceeds = withRefresh && withResale ? capexG0 * (inputs.resalePct / 100) : 0;
    const netCapex         = totalCapex - totalSaleProceeds;
    const totalRevenue     = years.reduce((s, r) => s + r.revenue, 0);
    const totalOpex        = years.reduce((s, r) => s + r.opex, 0);
    const totalFCF         = totalRevenue - totalOpex - netCapex;

    return { id, label, color, years, totalCapex, totalSaleProceeds, netCapex, totalRevenue, totalOpex, totalFCF };
  }

  return {
    noRefresh:     build('no-refresh',     'No Refresh',       '#64748b', false, false),
    refreshRetire: build('refresh-retire', 'Refresh + Retire', '#f97316', true,  false),
    refreshResale: build('refresh-resale', 'Refresh + Resale', '#10b981', true,  true),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function fmt(n: number, decimals = 0): string {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toFixed(decimals);
}

export function fmtB(n: number): string {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}T`;
  if (Math.abs(n) >= 1) return `$${n.toFixed(1)}B`;
  return `$${(n * 1000).toFixed(0)}M`;
}

export function fmtPct(n: number): string {
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
}

export const CHART_COLORS = [
  '#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b',
  '#06b6d4', '#ec4899', '#84cc16', '#6366f1', '#14b8a6',
];

// ─── Token Pricing Trends ─────────────────────────────────────────────────────

export interface ModelPricing {
  date: string;
  quarter: string;
  model: string;
  provider: string;
  inputPerM: number;
  outputPerM: number;
  contextK: number;
  color: string;
}

export const modelPricing: ModelPricing[] = [
  { date: '2023-03', quarter: 'Q1 2023', model: 'GPT-4 (8K)',       provider: 'OpenAI',    inputPerM: 30.00, outputPerM: 60.00, contextK: 8,   color: '#10b981' },
  { date: '2023-06', quarter: 'Q2 2023', model: 'Claude 2',          provider: 'Anthropic', inputPerM: 8.00,  outputPerM: 24.00, contextK: 100, color: '#f97316' },
  { date: '2023-11', quarter: 'Q4 2023', model: 'GPT-4 Turbo',       provider: 'OpenAI',    inputPerM: 10.00, outputPerM: 30.00, contextK: 128, color: '#10b981' },
  { date: '2024-03', quarter: 'Q1 2024', model: 'Claude 3 Opus',     provider: 'Anthropic', inputPerM: 15.00, outputPerM: 75.00, contextK: 200, color: '#f97316' },
  { date: '2024-03', quarter: 'Q1 2024', model: 'Claude 3 Sonnet',   provider: 'Anthropic', inputPerM: 3.00,  outputPerM: 15.00, contextK: 200, color: '#fb923c' },
  { date: '2024-03', quarter: 'Q1 2024', model: 'Claude 3 Haiku',    provider: 'Anthropic', inputPerM: 0.25,  outputPerM: 1.25,  contextK: 200, color: '#fdba74' },
  { date: '2024-05', quarter: 'Q2 2024', model: 'GPT-4o',            provider: 'OpenAI',    inputPerM: 5.00,  outputPerM: 15.00, contextK: 128, color: '#34d399' },
  { date: '2024-06', quarter: 'Q2 2024', model: 'Claude 3.5 Sonnet', provider: 'Anthropic', inputPerM: 3.00,  outputPerM: 15.00, contextK: 200, color: '#f97316' },
  { date: '2024-07', quarter: 'Q3 2024', model: 'GPT-4o mini',       provider: 'OpenAI',    inputPerM: 0.15,  outputPerM: 0.60,  contextK: 128, color: '#6ee7b7' },
  { date: '2024-08', quarter: 'Q3 2024', model: 'Gemini 1.5 Flash',  provider: 'Google',    inputPerM: 0.075, outputPerM: 0.30,  contextK: 1000,color: '#4285f4' },
  { date: '2024-10', quarter: 'Q4 2024', model: 'Gemini 1.5 Pro',    provider: 'Google',    inputPerM: 1.25,  outputPerM: 5.00,  contextK: 1000,color: '#60a5fa' },
  { date: '2024-12', quarter: 'Q4 2024', model: 'DeepSeek V3',       provider: 'DeepSeek',  inputPerM: 0.27,  outputPerM: 1.10,  contextK: 128, color: '#3b82f6' },
  { date: '2025-01', quarter: 'Q1 2025', model: 'DeepSeek R1',       provider: 'DeepSeek',  inputPerM: 0.55,  outputPerM: 2.19,  contextK: 128, color: '#2563eb' },
  { date: '2025-02', quarter: 'Q1 2025', model: 'Claude Sonnet 4',   provider: 'Anthropic', inputPerM: 3.00,  outputPerM: 15.00, contextK: 200, color: '#f97316' },
  { date: '2025-02', quarter: 'Q1 2025', model: 'GPT-5',             provider: 'OpenAI',    inputPerM: 10.00, outputPerM: 40.00, contextK: 200, color: '#10b981' },
  { date: '2025-03', quarter: 'Q1 2025', model: 'Gemini 2.5 Pro',    provider: 'Google',    inputPerM: 1.25,  outputPerM: 10.00, contextK: 1000,color: '#4285f4' },
  { date: '2025-03', quarter: 'Q1 2025', model: 'Gemini 2.5 Flash',  provider: 'Google',    inputPerM: 0.075, outputPerM: 0.30,  contextK: 1000,color: '#93c5fd' },
  { date: '2025-04', quarter: 'Q2 2025', model: 'Llama 4 Maverick',  provider: 'Meta',      inputPerM: 0.19,  outputPerM: 0.49,  contextK: 256, color: '#0668e1' },
  { date: '2025-06', quarter: 'Q2 2025', model: 'Claude Opus 4.8',   provider: 'Anthropic', inputPerM: 15.00, outputPerM: 75.00, contextK: 200, color: '#ea580c' },
  { date: '2025-06', quarter: 'Q2 2025', model: 'Claude Haiku 4.5',  provider: 'Anthropic', inputPerM: 0.80,  outputPerM: 4.00,  contextK: 200, color: '#fbbf24' },
  { date: '2025-07', quarter: 'Q3 2025', model: 'Kimi K2',           provider: 'Moonshot',  inputPerM: 0.15,  outputPerM: 0.60,  contextK: 128, color: '#8b5cf6' },
  { date: '2025-07', quarter: 'Q3 2025', model: 'DeepSeek R2',       provider: 'DeepSeek',  inputPerM: 0.80,  outputPerM: 3.20,  contextK: 128, color: '#1d4ed8' },
];

// Price compression over time (median + frontier prices)
export const priceCompression = [
  { quarter: 'Q1 2023', medianInput: 19.0, frontierInput: 30.0, cheapestInput: 8.0,   tokensPerDollar: 12000   },
  { quarter: 'Q2 2023', medianInput: 11.0, frontierInput: 30.0, cheapestInput: 4.0,   tokensPerDollar: 25000   },
  { quarter: 'Q4 2023', medianInput: 9.0,  frontierInput: 10.0, cheapestInput: 1.0,   tokensPerDollar: 100000  },
  { quarter: 'Q1 2024', medianInput: 5.5,  frontierInput: 15.0, cheapestInput: 0.25,  tokensPerDollar: 400000  },
  { quarter: 'Q2 2024', medianInput: 3.0,  frontierInput: 5.0,  cheapestInput: 0.075, tokensPerDollar: 1500000 },
  { quarter: 'Q3 2024', medianInput: 1.5,  frontierInput: 5.0,  cheapestInput: 0.075, tokensPerDollar: 2000000 },
  { quarter: 'Q4 2024', medianInput: 0.8,  frontierInput: 3.0,  cheapestInput: 0.05,  tokensPerDollar: 5000000 },
  { quarter: 'Q1 2025', medianInput: 1.2,  frontierInput: 15.0, cheapestInput: 0.075, tokensPerDollar: 3000000 },
  { quarter: 'Q2 2025', medianInput: 0.9,  frontierInput: 15.0, cheapestInput: 0.075, tokensPerDollar: 4000000 },
  { quarter: 'Q3 2025', medianInput: 0.5,  frontierInput: 10.0, cheapestInput: 0.05,  tokensPerDollar: 6000000 },
  { quarter: 'Q4 2025',medianInput: 0.35, frontierInput: 8.0,  cheapestInput: 0.03,  tokensPerDollar: 10000000 },
  { quarter: 'Q2 2026E',medianInput: 0.20, frontierInput: 5.0,  cheapestInput: 0.02,  tokensPerDollar: 18000000 },
];

// ─── AI Tokenomics: 5-Class Token Taxonomy & Cost Model ───────────────────────
// Source: Zhu (2026), "AI Tokenomics" (arXiv:2606.24616). Ttot = TI + TC + TR + TO + TH.
// Billing reality (verified against OpenAI/Anthropic/Google API docs, June 2026):
//   • Input (TI) and Retrieval (TR) bill at the INPUT rate (retrieval context is just input)
//   • Cached context (TC) bills at the discounted CACHED rate
//   • Output (TO) and Hidden reasoning (TH) bill at the OUTPUT rate
//     (thinking tokens are billed as output even when not returned to the user)

export interface TokenWorkload {
  name: string;
  icon: string;
  description: string;
  inputTokens: number;     // TI — prompt + system
  cachedTokens: number;    // TC — cache-hit context
  retrievalTokens: number; // TR — RAG / retrieved context (billed as input)
  outputTokens: number;    // TO — visible response
  hiddenTokens: number;    // TH — chain-of-thought / extended thinking (billed as output)
}

export interface TokenPrices {
  inputPerM: number;
  outputPerM: number;
  cachedPerM: number;
}

// Default reference prices ($/M tokens) when no live model is selected.
// Mirrors Claude Opus 4.8 list pricing; cached ≈ 10% of input (cache-read tier).
export const defaultTokenPrices: TokenPrices = {
  inputPerM: 5.0,
  outputPerM: 25.0,
  cachedPerM: 0.5,
};

// Representative workloads from the paper's Section 6 case studies. Token counts
// use the midpoint of each cited range so totals are reproducible.
export const tokenWorkloads: TokenWorkload[] = [
  {
    name: 'Legal Contract Analysis', icon: '⚖️',
    description: '10 contracts × 50 pages × 200 tok/page ingest; clause/risk reasoning; 1k summary',
    inputTokens: 100_000, cachedTokens: 0, retrievalTokens: 0, outputTokens: 1_000, hiddenTokens: 100_000,
  },
  {
    name: 'Software Engineering', icon: '⌨️',
    description: 'Spec → code-gen → verify → test → repair; QA stages dominate token use',
    inputTokens: 500, cachedTokens: 0, retrievalTokens: 0, outputTokens: 5_000, hiddenTokens: 60_000,
  },
  {
    name: 'RAG Research', icon: '🔎',
    description: '500-tok query; 50 docs × 1k retrieved; reason → synthesize → recommend',
    inputTokens: 500, cachedTokens: 0, retrievalTokens: 50_000, outputTokens: 2_000, hiddenTokens: 40_000,
  },
  {
    name: 'Multi-Agent Cycle', icon: '🤖',
    description: 'Planner → retriever → executor → monitor → replanner; one full cycle',
    inputTokens: 10_000, cachedTokens: 0, retrievalTokens: 50_000, outputTokens: 50_000, hiddenTokens: 100_000,
  },
  {
    name: 'Simple Chat Q&A', icon: '💬',
    description: 'Short prompt, short answer, negligible hidden reasoning',
    inputTokens: 500, cachedTokens: 0, retrievalTokens: 0, outputTokens: 500, hiddenTokens: 200,
  },
];

export function calcTokenCost(w: TokenWorkload, p: TokenPrices) {
  // TI + TR bill at input rate; TC at cached rate; TO + TH at output rate.
  const inputCost     = ((w.inputTokens + w.retrievalTokens) / 1e6) * p.inputPerM;
  const cachedCost    = (w.cachedTokens / 1e6) * p.cachedPerM;
  const outputCost    = (w.outputTokens / 1e6) * p.outputPerM;
  const hiddenCost    = (w.hiddenTokens / 1e6) * p.outputPerM; // thinking billed as output
  const total         = inputCost + cachedCost + outputCost + hiddenCost;
  const totalTokens   = w.inputTokens + w.cachedTokens + w.retrievalTokens + w.outputTokens + w.hiddenTokens;
  const visibleTokens = w.inputTokens + w.cachedTokens + w.retrievalTokens + w.outputTokens;
  return {
    inputCost, cachedCost, outputCost, hiddenCost, total,
    totalTokens, visibleTokens,
    hiddenTokens: w.hiddenTokens,
    // The paper's central insight: hidden reasoning's COST share exceeds its TOKEN share,
    // because thinking tokens bill at the (higher) output rate.
    hiddenCostShare:  total > 0 ? (hiddenCost / total) * 100 : 0,
    hiddenTokenShare: totalTokens > 0 ? (w.hiddenTokens / totalTokens) * 100 : 0,
    priceRatio: p.inputPerM > 0 ? p.outputPerM / p.inputPerM : 0,
  };
}

// ─── AI Tokenomics: Workflow Allocation (multiplicative quality propagation) ────
// Each stage produces a quality q ∈ (0,1]; final quality q_final = Π q_i.
// Marginal downstream impact of stage i = ∂q_final/∂q_i = Π_{j≠i} q_j = q_final / q_i.
// This reproduces the paper's result: a stage's value depends on its position in the
// dependency graph, NOT its token volume.

export interface WorkflowStage {
  name: string;
  icon: string;
  tokens: number;
  quality: number; // q_i ∈ (0,1]
  color: string;
}

export interface WorkflowTemplate {
  id: string;
  label: string;
  description: string;
  stages: WorkflowStage[];
}

export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: 'multi-agent',
    label: 'Autonomous Multi-Agent',
    description: 'Planner → retriever → executor → monitor → replanner. Execution consumes the most tokens, but planning has the highest downstream marginal value.',
    stages: [
      { name: 'Planner',    icon: '🧭', tokens: 10_000,  quality: 0.70, color: '#f97316' },
      { name: 'Retriever',  icon: '🔎', tokens: 50_000,  quality: 0.90, color: '#3b82f6' },
      { name: 'Executor',   icon: '⚙️', tokens: 100_000, quality: 0.85, color: '#8b5cf6' },
      { name: 'Monitor',    icon: '👁️', tokens: 20_000,  quality: 0.80, color: '#10b981' },
    ],
  },
  {
    id: 'software',
    label: 'Software Engineering',
    description: 'Spec → code-gen → verify → test → repair. Verification and testing carry more marginal value than the visible code-generation stage.',
    stages: [
      { name: 'Code-gen',     icon: '⌨️', tokens: 5_000,  quality: 0.63, color: '#3b82f6' },
      { name: 'Verification', icon: '✅', tokens: 25_000, quality: 0.87, color: '#10b981' },
      { name: 'Testing',      icon: '🧪', tokens: 25_000, quality: 0.87, color: '#f59e0b' },
      { name: 'Repair',       icon: '🔧', tokens: 10_000, quality: 0.63, color: '#8b5cf6' },
    ],
  },
  {
    id: 'rag',
    label: 'RAG Research',
    description: 'Retrieve → reason → synthesize → recommend. Once retrieval quality saturates, marginal value shifts to reasoning.',
    stages: [
      { name: 'Retrieval',     icon: '🔎', tokens: 50_000, quality: 0.98, color: '#3b82f6' },
      { name: 'Reasoning',     icon: '🧠', tokens: 30_000, quality: 0.70, color: '#f97316' },
      { name: 'Synthesis',     icon: '🔗', tokens: 8_000,  quality: 0.80, color: '#10b981' },
      { name: 'Recommendation',icon: '📋', tokens: 2_000,  quality: 0.85, color: '#8b5cf6' },
    ],
  },
];

export function calcWorkflowAllocation(stages: WorkflowStage[]) {
  const totalTokens = stages.reduce((s, x) => s + x.tokens, 0);
  const qFinal = stages.reduce((p, x) => p * x.quality, 1);
  const rows = stages.map(s => {
    const marginalImpact = s.quality > 0 ? qFinal / s.quality : 0; // ∂q_final/∂q_i
    return {
      ...s,
      tokenShare: totalTokens > 0 ? (s.tokens / totalTokens) * 100 : 0,
      marginalImpact,
    };
  });
  const maxImpact = Math.max(...rows.map(r => r.marginalImpact), 0);
  // Efficiency = marginal value per token share; high = under-resourced relative to its value.
  return {
    rows: rows.map(r => ({
      ...r,
      impactShare: maxImpact > 0 ? (r.marginalImpact / maxImpact) * 100 : 0,
      valuePerTokenShare: r.tokenShare > 0 ? r.marginalImpact / (r.tokenShare / 100) : 0,
    })),
    totalTokens,
    qFinal,
  };
}

// ─── Foundation Lab Financials ────────────────────────────────────────────────

export const labRevenue = [
  { year: '2022', OpenAI: 0.4,  Anthropic: 0.05, xAI: 0,    DeepSeek: 0.01 },
  { year: '2023', OpenAI: 1.6,  Anthropic: 0.15, xAI: 0.04, DeepSeek: 0.03 },
  { year: '2024', OpenAI: 3.7,  Anthropic: 1.0,  xAI: 0.30, DeepSeek: 0.10 },
  { year: '2025',OpenAI: 11.6, Anthropic: 3.0,  xAI: 1.00, DeepSeek: 0.30 },
  { year: '2026E',OpenAI: 28.0, Anthropic: 8.0,  xAI: 3.00, DeepSeek: 1.00 },
  { year: '2027E',OpenAI: 58.0, Anthropic: 18.0, xAI: 7.00, DeepSeek: 3.00 },
  { year: '2028E',OpenAI:110, Anthropic: 38, xAI:14, DeepSeek: 6 },
  { year: '2029E',OpenAI:198, Anthropic: 72, xAI:26, DeepSeek:12 },
  { year: '2030E',OpenAI:340, Anthropic:130, xAI:46, DeepSeek:22 },
];

export const labOperatingIncome = [
  { year: '2022', OpenAI: -0.50, Anthropic: -0.30, xAI:  0.00, DeepSeek: -0.05 },
  { year: '2023', OpenAI: -0.54, Anthropic: -0.40, xAI: -0.20, DeepSeek: -0.10 },
  { year: '2024', OpenAI: -1.50, Anthropic: -0.60, xAI: -0.50, DeepSeek: -0.30 },
  { year: '2025',OpenAI: -2.00, Anthropic: -0.50, xAI: -0.80, DeepSeek: -0.40 },
  { year: '2026E',OpenAI:  2.00, Anthropic:  0.50, xAI: -0.50, DeepSeek: -0.20 },
  { year: '2027E',OpenAI: 12.00, Anthropic:  3.50, xAI:  0.50, DeepSeek:  0.20 },
  { year: '2028E',OpenAI: 28.00, Anthropic:  9.00, xAI: 2.00, DeepSeek: 0.80 },
  { year: '2029E',OpenAI: 58.00, Anthropic: 20.00, xAI: 5.00, DeepSeek: 2.00 },
  { year: '2030E',OpenAI:110.00, Anthropic: 40.00, xAI:10.00, DeepSeek: 5.00 },
];

export interface FundingRound {
  company: string;
  date: string;
  amountB: number;
  valuationB: number;
  type: string;
  leadInvestors: string;
  color: string;
}

export const fundingRounds: FundingRound[] = [
  { company: 'OpenAI',    date: '2023-01', amountB: 10.0, valuationB:  29, type: 'Strategic',  leadInvestors: 'Microsoft',              color: '#10b981' },
  { company: 'Anthropic', date: '2023-05', amountB:  1.3, valuationB:   5, type: 'Series C',   leadInvestors: 'Google',                 color: '#f97316' },
  { company: 'Anthropic', date: '2023-09', amountB:  1.3, valuationB:   5, type: 'Strategic',  leadInvestors: 'Amazon',                 color: '#f97316' },
  { company: 'xAI',       date: '2023-11', amountB:  0.5, valuationB:  20, type: 'Series A',   leadInvestors: 'Sequoia, a16z',          color: '#8b5cf6' },
  { company: 'Anthropic', date: '2024-03', amountB:  2.8, valuationB:  18, type: 'Series D',   leadInvestors: 'Amazon (primary)',        color: '#f97316' },
  { company: 'xAI',       date: '2024-05', amountB:  6.0, valuationB:  24, type: 'Series B',   leadInvestors: 'Fidelity, Prince Alwaleed',color: '#8b5cf6' },
  { company: 'OpenAI',    date: '2024-10', amountB:  6.6, valuationB: 157, type: 'Series X',   leadInvestors: 'Thrive, SoftBank, Tiger', color: '#10b981' },
  { company: 'Anthropic', date: '2025-03', amountB:  3.5, valuationB:  61, type: 'Series E',   leadInvestors: 'Amazon, Google',          color: '#f97316' },
  { company: 'xAI',       date: '2025-02', amountB: 20.0, valuationB: 120, type: 'Series C',   leadInvestors: 'Andreessen, Sequoia',     color: '#8b5cf6' },
  { company: 'OpenAI',    date: '2025-03', amountB: 40.0, valuationB: 340, type: 'Strategic',  leadInvestors: 'SoftBank (lead)',         color: '#10b981' },
];

export const labValuations = [
  { year: '2022', OpenAI: 29,  Anthropic: 4.5, xAI: 0,   DeepSeek: 0   },
  { year: '2023', OpenAI: 90,  Anthropic: 5,   xAI: 20,  DeepSeek: 0   },
  { year: '2024', OpenAI: 157, Anthropic: 18,  xAI: 24,  DeepSeek: 0   },
  { year: '2025',OpenAI: 340, Anthropic: 62,  xAI: 120, DeepSeek: 30  },
  { year: '2026E',OpenAI: 600, Anthropic: 140, xAI: 200, DeepSeek: 80  },
  { year: '2027E',OpenAI: 1100,Anthropic: 300, xAI: 380, DeepSeek: 200 },
  { year: '2028E',OpenAI:1800, Anthropic: 550, xAI: 650, DeepSeek:350 },
  { year: '2029E',OpenAI:2800, Anthropic: 900, xAI:1000, DeepSeek:550 },
  { year: '2030E',OpenAI:4200, Anthropic:1450, xAI:1550, DeepSeek:850 },
];

export const labHeadcount = [
  { year: '2022', OpenAI: 375,  Anthropic: 150,  xAI: 0,    DeepSeek: 50   },
  { year: '2023', OpenAI: 770,  Anthropic: 380,  xAI: 200,  DeepSeek: 150  },
  { year: '2024', OpenAI: 1800, Anthropic: 900,  xAI: 800,  DeepSeek: 300  },
  { year: '2025',OpenAI: 3500, Anthropic: 1600, xAI: 2000, DeepSeek: 500  },
  { year: '2026E',OpenAI: 6000, Anthropic: 2800, xAI: 3500, DeepSeek: 900  },
  { year: '2027E',OpenAI: 9000, Anthropic: 4500, xAI: 6500, DeepSeek:1500 },
  { year: '2028E',OpenAI:13000, Anthropic: 7000, xAI:10000, DeepSeek:2200 },
  { year: '2029E',OpenAI:17000, Anthropic: 9500, xAI:14000, DeepSeek:3000 },
  { year: '2030E',OpenAI:21000, Anthropic:12500, xAI:18500, DeepSeek:4000 },
];

// ─── Data Center Cost Breakdown (annualized OpEx vs CapEx, driven by formulae) ──
// Every line item is computed from user-adjustable inputs — nothing is a fixed
// lump-sum total. capacityGW and energyCostPerKWh are the two inputs the user
// must set explicitly; every other field below is a labeled "estimate" default
// (industry unit-cost assumption) that the user can override with a slider.
// Defaults are calibrated so that, at their starting values, the model
// reproduces Epoch.ai's published annualized 1 GW hyperscaler cost structure —
// but every downstream number is recomputed live from the formulae, not looked
// up from that baseline.

export interface DataCenterCostInputs {
  // Required — the user must set these explicitly.
  capacityGW: number;        // IT (critical load) capacity, GW
  energyCostPerKWh: number;  // $/kWh, all-in industrial rate

  // Utilization & efficiency
  pue: number;               // Power Usage Effectiveness (total facility power / IT power)
  utilizationPct: number;    // Average IT load factor, %

  // Servers — CapEx, $ per kW of IT capacity, amortized over serverAmortYears
  serverCostPerKW: number;
  serverAmortYears: number;

  // Facility / Network / Utility / Land — CapEx, $ per kW of IT capacity,
  // amortized over a shared infraAmortYears (building/infra lifespan)
  facilityCostPerKW: number;
  networkCostPerKW: number;
  utilityCostPerKW: number;
  landCostPerKW: number;
  infraAmortYears: number;

  // Recurring OpEx rates
  taxRatePctOfCapex: number;        // Property tax, % of total annualized CapEx
  maintenanceRatePctOfCapex: number; // % of total annualized CapEx
  laborCostPerFTE: number;          // $/employee/year
  fteDensityPerGW: number;          // Staff headcount per GW of IT capacity
  waterUseEffectivenessLPerKWh: number; // Liters of water per kWh consumed
  waterPricePerM3: number;          // $ per cubic meter
}

export const defaultDataCenterCostInputs: DataCenterCostInputs = {
  capacityGW: 1,
  energyCostPerKWh: 0.055,

  pue: 1.2,
  utilizationPct: 100,

  serverCostPerKW: 15_000,
  serverAmortYears: 3,

  facilityCostPerKW: 20_800,
  networkCostPerKW: 17_500,
  utilityCostPerKW: 300,
  landCostPerKW: 195,
  infraAmortYears: 15,

  taxRatePctOfCapex: 1.88,
  maintenanceRatePctOfCapex: 1.58,
  laborCostPerFTE: 150_000,
  fteDensityPerGW: 267,
  waterUseEffectivenessLPerKWh: 0.30,
  waterPricePerM3: 1.80,
};

export const DC_COST_LABELS = {
  opex: {
    energy: 'Energy', taxes: 'Taxes', maintenance: 'Maintenance', labor: 'Labor', water: 'Water',
  },
  capex: {
    servers: 'Servers', facility: 'Facility', networkInfrastructure: 'Network Infrastructure',
    utilityWorks: 'Utility Works', land: 'Land',
  },
};

export function calcDataCenterCost(inputs: DataCenterCostInputs) {
  const capacityKW = inputs.capacityGW * 1_000_000;
  const annualEnergyKWh = capacityKW * inputs.pue * (inputs.utilizationPct / 100) * 8760;

  const energy = annualEnergyKWh * inputs.energyCostPerKWh;
  const water = (annualEnergyKWh * inputs.waterUseEffectivenessLPerKWh / 1000) * inputs.waterPricePerM3;

  const serverCapex   = (capacityKW * inputs.serverCostPerKW) / inputs.serverAmortYears;
  const facilityCapex = (capacityKW * inputs.facilityCostPerKW) / inputs.infraAmortYears;
  const networkCapex  = (capacityKW * inputs.networkCostPerKW) / inputs.infraAmortYears;
  const utilityCapex  = (capacityKW * inputs.utilityCostPerKW) / inputs.infraAmortYears;
  const landCapex     = (capacityKW * inputs.landCostPerKW) / inputs.infraAmortYears;

  const capex = {
    servers: serverCapex, facility: facilityCapex, networkInfrastructure: networkCapex,
    utilityWorks: utilityCapex, land: landCapex,
  };
  const totalCapex = serverCapex + facilityCapex + networkCapex + utilityCapex + landCapex;

  const taxes = totalCapex * (inputs.taxRatePctOfCapex / 100);
  const maintenance = totalCapex * (inputs.maintenanceRatePctOfCapex / 100);
  const numFTEs = inputs.fteDensityPerGW * inputs.capacityGW;
  const labor = numFTEs * inputs.laborCostPerFTE;

  const opex = { energy, taxes, maintenance, labor, water };
  const totalOpex = energy + taxes + maintenance + labor + water;
  const totalAnnual = totalOpex + totalCapex;

  return {
    opex, capex, totalOpex, totalCapex, totalAnnual,
    annualEnergyKWh, numFTEs,
    serverShareOfCapex: totalCapex > 0 ? (serverCapex / totalCapex) * 100 : 0,
    serverShareOfTotal: totalAnnual > 0 ? (serverCapex / totalAnnual) * 100 : 0,
    capexPerOpexDollar: totalOpex > 0 ? totalCapex / totalOpex : 0,
  };
}

