const form = document.getElementById("concern-form");
const titleInput = document.getElementById("title");
const contentInput = document.getElementById("content");
const moodInput = document.getElementById("mood");
const questionInput = document.getElementById("question");
const submitBtn = document.getElementById("submit-btn");
const draftStatus = document.getElementById("draft-status");
const resultBox = document.getElementById("result");
const resultDate = document.getElementById("result-date");
const envelope = document.getElementById("envelope");
const letterBox = document.getElementById("letter-box");
const letterTo = document.getElementById("letter-to");
const letterBody = document.getElementById("letter-body");
const letterSign = document.getElementById("letter-sign");
const resultActions = document.getElementById("result-actions");
const saveLetterBtn = document.getElementById("save-letter-btn");
const shareLetterBtn = document.getElementById("share-letter-btn");
const regenLetterBtn = document.getElementById("regen-letter-btn");
const resultSummary = document.getElementById("result-summary");

const errors = {
  title: document.getElementById("title-error"),
  content: document.getElementById("content-error"),
  mood: document.getElementById("mood-error"),
};

const DRAFT_KEY = "future_letter_draft";
const TIME_CAPSULE_KEY = "future_letter_time_capsule";
const AI_API_ENDPOINT = "/api/generate-letter";

let currentLetter = null;
let regenerateCount = 0;

function trimValue(input) {
  return input.value.trim();
}

function getDateText(date = new Date()) {
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function validate(showError = false) {
  const title = trimValue(titleInput);
  const content = trimValue(contentInput);
  const mood = moodInput.value;

  let valid = true;

  if (!title) {
    valid = false;
    if (showError) errors.title.textContent = "제목을 입력해주세요.";
  } else {
    errors.title.textContent = "";
  }

  if (!content) {
    valid = false;
    if (showError) errors.content.textContent = "고민 내용을 입력해주세요.";
  } else {
    errors.content.textContent = "";
  }

  if (!mood) {
    valid = false;
    if (showError) errors.mood.textContent = "현재 기분을 입력해주세요.";
  } else {
    errors.mood.textContent = "";
  }

  submitBtn.disabled = !valid;
  return valid;
}

function saveDraft() {
  const draft = {
    title: titleInput.value,
    content: contentInput.value,
    mood: moodInput.value,
    question: questionInput.value,
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  draftStatus.textContent = "임시저장 완료";
}

function loadDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return;

  try {
    const draft = JSON.parse(raw);
    titleInput.value = draft.title || "";
    contentInput.value = draft.content || "";
    moodInput.value = draft.mood || "";
    questionInput.value = draft.question || "";
    draftStatus.textContent = "이전 작성 내용이 복원되었습니다";
  } catch {
    localStorage.removeItem(DRAFT_KEY);
  }
}

function persistEntry(entry) {
  const list = JSON.parse(localStorage.getItem(TIME_CAPSULE_KEY) || "[]");
  const item = {
    ...entry,
    capsuleId: entry.capsuleId || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
  list.push(item);
  localStorage.setItem(TIME_CAPSULE_KEY, JSON.stringify(list));
  return item;
}

function getCapsuleList() {
  try {
    const list = JSON.parse(localStorage.getItem(TIME_CAPSULE_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function getCapsuleMetaText(item) {
  const dateText = item.createdDateText || getDateText(new Date(item.createdAt || Date.now()));
  return `${dateText} | 기분: ${item.mood || "미입력"}`;
}

function resetForm() {
  form.reset();
  submitBtn.disabled = true;
  draftStatus.textContent = "임시저장 대기 중";
  localStorage.removeItem(DRAFT_KEY);
}

function renderLetter(entry, bodyText) {
  currentLetter = {
    ...entry,
    aiReplyText: bodyText,
    regeneratedAt: new Date().toISOString(),
  };

  const currentYear = new Date().getFullYear();
  letterTo.textContent = `To. ${currentYear}년의 나`;
  letterBody.textContent = bodyText;
  letterSign.textContent = "늘 응원하는,\n10년 후의 너";
}

async function requestGeneratedLetter(entry, variant = 0) {
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(AI_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ entry, variant }),
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok && data.letter && typeof data.letter === "string") {
      return data.letter;
    }

    const reason = data.reason || data.error || "AI 응답 생성 실패";
    const timeoutLike = /시간이 초과|aborted|timed out/i.test(String(reason));
    const shouldRetry = timeoutLike && attempt < maxAttempts;

    if (!shouldRetry) {
      if (response.ok) {
        throw new Error("AI 응답 형식 오류");
      }
      throw new Error(reason);
    }
  }

  throw new Error("AI 응답 생성 실패");
}

function openLetterAnimation() {
  envelope.hidden = false;
  letterBox.hidden = true;
  resultActions.hidden = true;
  resultSummary.textContent = "AI가 편지를 쓰고 있어요...";

  window.setTimeout(() => {
    envelope.hidden = true;
    letterBox.hidden = false;
    resultActions.hidden = false;
    resultSummary.textContent = "편지가 도착했어요. 저장하거나 다시 생성할 수 있어요.";
  }, 900);
}

function buildShareText(letter) {
  return `${letterTo.textContent}\n\n${letter.aiReplyText}\n\n${letterSign.textContent}`;
}

function copyTextWithFallback(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (!copied) {
        reject(new Error("copy_failed"));
        return;
      }
      resolve();
    } catch (error) {
      document.body.removeChild(textarea);
      reject(error);
    }
  });
}

[titleInput, contentInput, moodInput, questionInput].forEach((el) => {
  el.addEventListener("input", () => {
    validate(false);
    saveDraft();
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!validate(true)) return;

  const entry = {
    title: trimValue(titleInput),
    content: trimValue(contentInput),
    mood: moodInput.value,
    question: trimValue(questionInput),
    createdAt: new Date().toISOString(),
    createdDateText: getDateText(),
  };

  submitBtn.disabled = true;
  submitBtn.textContent = "편지 생성 중...";
  try {
    regenerateCount = 0;
    const aiLetter = await requestGeneratedLetter(entry, regenerateCount);
    renderLetter(entry, aiLetter);
    resultDate.textContent = `작성 날짜: ${entry.createdDateText}`;
    resultBox.hidden = false;
    openLetterAnimation();
    resetForm();
  } catch (error) {
    resultBox.hidden = false;
    resultSummary.textContent = `AI 생성 실패: ${error.message}`;
  } finally {
    submitBtn.textContent = "미래에게 보내기";
    validate(false);
  }
});

saveLetterBtn.addEventListener("click", () => {
  if (!currentLetter) return;
  currentLetter = persistEntry(currentLetter);
  resultSummary.textContent = "타임캡슐에 저장했어요. 아래 버튼으로 타임캡슐 페이지에서 확인해보세요.";
});

shareLetterBtn.addEventListener("click", async () => {
  if (!currentLetter) return;

  const shareText = buildShareText(currentLetter);
  try {
    if (navigator.share) {
      await navigator.share({
        title: "Future Letter",
        text: shareText,
        url: window.location.href,
      });
      resultSummary.textContent = "공유가 완료되었어요.";
      return;
    }

    await copyTextWithFallback(shareText);
    resultSummary.textContent = "편지 내용을 클립보드에 복사했어요.";
  } catch (error) {
    if (String(error?.name || "") === "AbortError") {
      resultSummary.textContent = "공유가 취소되었어요.";
      return;
    }

    // Last-resort fallback: show the text so users can copy manually.
    window.prompt("아래 내용을 복사해주세요.", shareText);
    resultSummary.textContent = "자동 공유가 어려워 수동 복사 창을 열었어요.";
  }
});

regenLetterBtn.addEventListener("click", async () => {
  if (!currentLetter) return;
  regenLetterBtn.disabled = true;
  regenLetterBtn.textContent = "재생성 중...";
  try {
    regenerateCount += 1;
    const regenerated = await requestGeneratedLetter(currentLetter, regenerateCount);
    renderLetter(currentLetter, regenerated);
    openLetterAnimation();
  } catch (error) {
    resultSummary.textContent = `AI 재생성 실패: ${error.message}`;
  } finally {
    regenLetterBtn.disabled = false;
    regenLetterBtn.textContent = "다시 생성";
  }
});

loadDraft();
validate(false);
