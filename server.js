const path = require("path");
const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-chat-latest";
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT;
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || "2024-10-21";
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 60000);
const AI_MAX_OUTPUT_TOKENS = Number(process.env.AI_MAX_OUTPUT_TOKENS || 320);
const AI_REASONING_EFFORT = process.env.AI_REASONING_EFFORT || "low";
const AI_TIMEOUT_RETRY_COUNT = Number(process.env.AI_TIMEOUT_RETRY_COUNT || 2);

app.use(express.json());
app.use(express.static(path.join(__dirname)));

function buildPrompt(entry) {
  return [
    "너는 사용자의 '10년 후의 나'로서 답장을 쓰는 AI다.",
    "답장은 한국어로 쓰고, 따뜻한 공감-현실 조언-응원 순서를 반드시 지켜라.",
    "문체는 쉽고 짧은 문장 위주로 하고, 비난/공포 조장/단정적 예언은 금지한다.",
    "3~4단락의 짧은 편지 형식으로 작성하라.",
    "각 단락은 2~3문장 이내로 간결하게 작성하라.",
    "아래는 사용자 정보다:",
    `- 제목: ${entry.title}`,
    `- 고민 내용: ${entry.content}`,
    `- 현재 기분: ${entry.mood}`,
    `- 미래에게 질문: ${entry.question || "(없음)"}`,
  ].join("\n");
}

function buildResponseRequestBody(prompt, model) {
  return {
    model,
    input: prompt,
    max_output_tokens: AI_MAX_OUTPUT_TOKENS,
    reasoning: {
      effort: AI_REASONING_EFFORT,
    },
    text: {
      verbosity: "low",
    },
  };
}

function isTimeoutAbortError(error) {
  return error?.name === "AbortError" || /aborted/i.test(String(error?.message || ""));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = AI_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (isTimeoutAbortError(error)) {
      throw new Error(`AI 요청 시간이 초과되었습니다. (${timeoutMs}ms)`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isTimeoutError(error) {
  return /시간이 초과되었습니다/i.test(String(error?.message || ""));
}

async function fetchWithTimeoutRetry(url, options = {}) {
  let lastError;
  for (let attempt = 0; attempt <= AI_TIMEOUT_RETRY_COUNT; attempt += 1) {
    const timeoutMs = AI_TIMEOUT_MS + attempt * 10000;
    try {
      return await fetchWithTimeout(url, options, timeoutMs);
    } catch (error) {
      lastError = error;
      if (!isTimeoutError(error) || attempt === AI_TIMEOUT_RETRY_COUNT) {
        throw error;
      }
    }
  }

  throw lastError;
}

function hasAzureConfig() {
  return Boolean(AZURE_OPENAI_ENDPOINT && AZURE_OPENAI_API_KEY && AZURE_OPENAI_DEPLOYMENT);
}

function normalizeEndpoint(endpoint) {
  return endpoint
    .replace(/\/+$/, "")
    .replace(/\/openai\/v1\/responses$/i, "")
    .replace(/\/openai\/v1$/i, "")
    .replace(/\/openai$/i, "");
}

function extractLetterText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (Array.isArray(data?.output)) {
    const chunks = [];
    for (const item of data.output) {
      if (!Array.isArray(item?.content)) continue;
      for (const content of item.content) {
        if (typeof content?.text === "string" && content.text.trim()) {
          chunks.push(content.text.trim());
        }
      }
    }
    if (chunks.length > 0) {
      return chunks.join("\n\n");
    }
  }

  const messageContent = data?.choices?.[0]?.message?.content;
  if (typeof messageContent === "string" && messageContent.trim()) {
    return messageContent.trim();
  }

  return "";
}

async function callAzureResponses(prompt) {
  const endpoint = normalizeEndpoint(AZURE_OPENAI_ENDPOINT);
  const requestBody = buildResponseRequestBody(prompt, AZURE_OPENAI_DEPLOYMENT);
  const attemptConfigs = [
    {
      url: `${endpoint}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/responses?api-version=${AZURE_OPENAI_API_VERSION}`,
      body: {
        input: requestBody.input,
        max_output_tokens: requestBody.max_output_tokens,
        reasoning: requestBody.reasoning,
        text: requestBody.text,
      },
    },
    {
      url: `${endpoint}/openai/v1/responses`,
      body: requestBody,
    },
  ];

  let lastErrorText = "";
  for (const attempt of attemptConfigs) {
    const response = await fetchWithTimeoutRetry(attempt.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": AZURE_OPENAI_API_KEY,
      },
      body: JSON.stringify(attempt.body),
    });

    if (response.ok) {
      return response;
    }

    lastErrorText = await response.text();
    if (response.status !== 404) {
      throw new Error(`Azure API error (${response.status}): ${lastErrorText}`);
    }
  }

  throw new Error(`Azure API error (404): ${lastErrorText}`);
}

app.post("/api/generate-letter", async (req, res) => {
  const { entry } = req.body || {};

  if (!entry || !entry.title || !entry.content || !entry.mood) {
    return res.status(400).json({ error: "필수 입력값이 부족합니다." });
  }

  if (!hasAzureConfig() && !OPENAI_API_KEY) {
    return res.status(500).json({ error: "AI 환경 변수가 설정되지 않았습니다." });
  }

  try {
    let response;
    if (hasAzureConfig()) {
      response = await callAzureResponses(buildPrompt(entry));
    } else {
      response = await fetchWithTimeoutRetry("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify(buildResponseRequestBody(buildPrompt(entry), OPENAI_MODEL)),
      });
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI API error: ${text}`);
    }

    const data = await response.json();
    const letter = extractLetterText(data);

    if (!letter) {
      throw new Error("모델 응답 텍스트가 비어 있습니다.");
    }

    return res.json({ letter, fallback: false });
  } catch (error) {
    return res.status(502).json({ error: "AI 생성에 실패했습니다.", reason: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Future Letter server is running: http://localhost:${PORT}`);
});
