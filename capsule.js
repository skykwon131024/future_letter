const TIME_CAPSULE_KEY = "future_letter_time_capsule";

const capsuleEmpty = document.getElementById("capsule-empty");
const capsuleList = document.getElementById("capsule-list");
const capsuleDetail = document.getElementById("capsule-detail");
const capsuleDetailTitle = document.getElementById("capsule-detail-title");
const capsuleDetailMeta = document.getElementById("capsule-detail-meta");
const capsuleDetailContent = document.getElementById("capsule-detail-content");
const capsuleDetailReply = document.getElementById("capsule-detail-reply");

function getDateText(date = new Date()) {
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getCapsuleMetaText(item) {
  const dateText = item.createdDateText || getDateText(new Date(item.createdAt || Date.now()));
  return `${dateText} | 기분: ${item.mood || "미입력"}`;
}

function ensureCapsuleIds(list) {
  let changed = false;
  const normalized = list.map((item, index) => {
    if (item && item.capsuleId) {
      return item;
    }

    changed = true;
    return {
      ...item,
      capsuleId: `${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
    };
  });

  if (changed) {
    localStorage.setItem(TIME_CAPSULE_KEY, JSON.stringify(normalized));
  }

  return normalized;
}

function getCapsuleList() {
  try {
    const raw = JSON.parse(localStorage.getItem(TIME_CAPSULE_KEY) || "[]");
    if (!Array.isArray(raw)) {
      return [];
    }

    return ensureCapsuleIds(raw);
  } catch {
    return [];
  }
}

function renderCapsuleDetail(item) {
  capsuleDetailTitle.textContent = item.title || "(제목 없음)";
  capsuleDetailMeta.textContent = getCapsuleMetaText(item);
  capsuleDetailContent.textContent = item.content || "";
  capsuleDetailReply.textContent = item.aiReplyText || "";
  capsuleDetail.hidden = false;
}

function renderCapsuleList() {
  const list = getCapsuleList().sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });

  capsuleList.innerHTML = "";

  if (list.length === 0) {
    capsuleList.hidden = true;
    capsuleEmpty.hidden = false;
    capsuleDetail.hidden = true;
    return;
  }

  for (const item of list) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "capsule-item";
    btn.dataset.capsuleId = item.capsuleId;
    btn.innerHTML = `
      <span class="capsule-item-title">${item.title || "(제목 없음)"}</span>
      <span class="capsule-item-meta">${getCapsuleMetaText(item)}</span>
    `;
    li.appendChild(btn);
    capsuleList.appendChild(li);
  }

  capsuleEmpty.hidden = true;
  capsuleList.hidden = false;
  renderCapsuleDetail(list[0]);
}

capsuleList.addEventListener("click", (event) => {
  const target = event.target.closest("button[data-capsule-id]");
  if (!target) {
    return;
  }

  const list = getCapsuleList();
  const item = list.find((entry) => String(entry.capsuleId) === String(target.dataset.capsuleId));
  if (!item) {
    return;
  }

  renderCapsuleDetail(item);
});

renderCapsuleList();
