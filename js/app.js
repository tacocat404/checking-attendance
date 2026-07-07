/* ============================================================
   공용 동작 — 시계 / 스크롤 리빌 / 이메일 저장 / Google Forms 제출
   ============================================================ */

/* ── 시계 ── */
function startClock() {
  const el = document.getElementById("clock");
  if (!el) return;
  const tick = () => {
    const t = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    const [h, m, s] = t.split(":");
    el.innerHTML = `${h}:${m}<span class="sec-d">:${s}</span>`;
  };
  tick();
  setInterval(tick, 1000);
}

/* ── 마스트헤드 날짜 ── */
function renderMastDate() {
  const el = document.querySelector("[data-mast-date]");
  if (!el) return;
  const now = new Date();
  const week = ["일", "월", "화", "수", "목", "금", "토"][now.getDay()];
  el.textContent = `${now.getFullYear()}. ${String(now.getMonth() + 1).padStart(2, "0")}. ${String(now.getDate()).padStart(2, "0")}. ${week}요일`;
}

/* ── 스크롤 리빌 + 카운트업 ── */
function startReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      e.target.querySelectorAll("[data-count]").forEach((el) => {
        if (el.dataset.done) return;
        el.dataset.done = 1;
        const target = +el.dataset.count, t0 = performance.now(), dur = 1400;
        const step = (now) => {
          const p = Math.min((now - t0) / dur, 1), eased = 1 - Math.pow(1 - p, 4);
          el.textContent = Math.round(target * eased);
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      io.unobserve(e.target);
    });
  }, { threshold: 0.25, rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".fx").forEach((el) => io.observe(el));
}

/* 데이터 렌더 후에 .fx 를 추가한 경우 다시 관찰 */
function revealNow(el) { el.classList.add("in"); }

/* 데이터 주입 후 카운트업 재실행 (리빌이 먼저 지나간 경우 대비) */
function animateCounters(root) {
  (root || document).querySelectorAll("[data-count]").forEach((el) => {
    if (el.dataset.done) return;
    el.dataset.done = 1;
    const target = +el.dataset.count, t0 = performance.now(), dur = 1400;
    const step = (now) => {
      const p = Math.min((now - t0) / dur, 1), eased = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(target * eased);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/* ── 내 정보: 이름 + 이메일 (localStorage) ── */
const EMAIL_KEY = "attendance-my-email";
const NAME_KEY = "attendance-my-name";
function getMyEmail() { return localStorage.getItem(EMAIL_KEY) || ""; }
function getMyName() { return localStorage.getItem(NAME_KEY) || ""; }
function syncProfileUI() {
  const email = getMyEmail(), name = getMyName();
  document.querySelectorAll("[data-my-email]").forEach((el) => {
    el.textContent = email || "이메일 미설정";
  });
  document.querySelectorAll("[data-my-name]").forEach((el) => {
    el.textContent = name || "이름 미설정";
  });
  /* 마스트헤드 상단 이메일 표시 (있으면) */
  document.querySelectorAll("[data-mast-email]").forEach((el) => {
    el.textContent = email ? email.toUpperCase() : "이메일을 설정하세요";
  });
}

/* 프로필 카드: 편집 폼 ↔ 저장된 표시 전환 */
function showProfileView() {
  const form = document.querySelector("[data-profile-form]");
  const view = document.querySelector("[data-profile-view]");
  if (!form || !view) return;
  const hasProfile = getMyName() && getMyEmail();
  form.hidden = hasProfile;
  view.hidden = !hasProfile;
}

function bindProfileEditors() {
  const form = document.querySelector("[data-profile-form]");
  if (!form) return;                       // 홈이 아닌 페이지엔 프로필 카드 없음
  const nameInput = form.querySelector("[data-name-input]");
  const emailInput = form.querySelector("[data-email-input]");
  const saveBtn = form.querySelector("[data-profile-save]");
  const hint = form.querySelector("[data-profile-hint]");
  const editBtn = document.querySelector("[data-profile-edit]");

  /* 저장돼 있던 값을 입력칸에 미리 채움 */
  nameInput.value = getMyName();
  emailInput.value = getMyEmail();

  const save = () => {
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    if (!name) { hint.className = "pf-hint err"; hint.textContent = "이름을 입력해 주세요."; nameInput.focus(); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      hint.className = "pf-hint err"; hint.textContent = "이메일 형식을 확인해 주세요."; emailInput.focus(); return;
    }
    localStorage.setItem(NAME_KEY, name);
    localStorage.setItem(EMAIL_KEY, email);
    hint.className = "pf-hint ok"; hint.textContent = "저장되었습니다.";
    syncProfileUI();
    showProfileView();
  };

  saveBtn.addEventListener("click", save);
  /* 두 칸 어디서든 Enter 치면 함께 저장 */
  [nameInput, emailInput].forEach((el) =>
    el.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }));

  editBtn?.addEventListener("click", () => {
    nameInput.value = getMyName();
    emailInput.value = getMyEmail();
    hint.textContent = "";
    showProfileView();
    document.querySelector("[data-profile-form]").hidden = false;
    document.querySelector("[data-profile-view]").hidden = true;
    nameInput.focus();
  });

  showProfileView();
}

/* ── Google Forms 제출 ──
   CONFIG.FORM.id 가 비어 있으면 데모 모드(제출 흉내)로 동작 */
async function submitAttendance(kind) {   // kind: "in" | "out"
  const email = getMyEmail();
  const name = getMyName();
  if (!email || (CONFIG.FORM.fields.name && !name)) throw new Error("NO_PROFILE");

  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");

  if (!CONFIG.FORM.id) {                   // 데모 모드
    await new Promise((r) => setTimeout(r, 600));
    return { demo: true, time: `${hh}:${mm}` };
  }

  const f = CONFIG.FORM.fields;
  const body = new URLSearchParams();
  if (f.name) body.append(f.name.entry, name);
  body.append(f.type.entry, CONFIG.FORM.typeValues[kind]);
  if (f.time.kind === "time") {            // 폼의 '시간' 질문은 시/분이 나뉨
    body.append(`${f.time.entry}_hour`, String(now.getHours()));
    body.append(`${f.time.entry}_minute`, String(now.getMinutes()));
  } else {
    body.append(f.time.entry, `${hh}:${mm}`);
  }
  body.append(f.email.entry, email);

  await fetch(`https://docs.google.com/forms/d/e/${CONFIG.FORM.id}/formResponse`, {
    method: "POST", mode: "no-cors",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return { demo: false, time: `${hh}:${mm}` };
}

/* ── 펀치 버튼 바인딩 (홈에서만 존재) ── */
function bindPunchButtons() {
  const btnIn = document.querySelector("[data-check-in]");
  const btnOut = document.querySelector("[data-check-out]");
  const msg = document.querySelector("[data-punch-msg]");
  const myState = document.querySelector("[data-my-state]");
  if (!btnIn || !btnOut) return;

  const todayKey = new Date().toISOString().slice(0, 10);
  const saved = JSON.parse(localStorage.getItem("attendance-punch-" + todayKey) || "{}");
  const refreshState = () => {
    if (!myState) return;
    if (saved.out) { myState.textContent = `퇴근 완료 ${saved.out}`; myState.classList.remove("warn"); }
    else if (saved.in) { myState.textContent = `출근 완료 ${saved.in}`; myState.classList.remove("warn"); }
    else { myState.textContent = "미출근"; }
  };
  refreshState();

  const punch = async (kind, btn) => {
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `기록 중… <span class="arr">·</span>`;
    msg.className = "p-msg";
    msg.textContent = "";
    try {
      const res = await submitAttendance(kind);
      saved[kind] = res.time;
      localStorage.setItem("attendance-punch-" + todayKey, JSON.stringify(saved));
      msg.className = "p-msg ok";
      msg.textContent = (res.demo ? "[데모] " : "") +
        `${kind === "in" ? "출근" : "퇴근"} ${res.time} — Google Forms에 기록되었습니다.`;
      refreshState();
    } catch (e) {
      msg.className = "p-msg err";
      msg.textContent = e.message === "NO_PROFILE"
        ? "먼저 오른쪽에서 본인 이름과 이메일을 설정해 주세요."
        : "기록에 실패했습니다. 잠시 후 다시 시도해 주세요.";
    } finally {
      btn.disabled = false;
      btn.innerHTML = label;
    }
  };
  btnIn.addEventListener("click", () => punch("in", btnIn));
  btnOut.addEventListener("click", () => punch("out", btnOut));
}

/* ── 상태 표기 도우미 ── */
function stMark(status) {
  const cls = status === "정상" ? "ok" : status === "지각" ? "late" : "abs";
  return `<span class="st"><i class="sq ${cls}"></i>${status}</span>`;
}

/* ── 데모 모드 안내 띠 ── */
function showDemoBand(demo) {
  const band = document.querySelector("[data-demo-band]");
  if (band && demo) band.classList.add("show");
}

/* ── 공통 초기화 ── */
document.addEventListener("DOMContentLoaded", () => {
  startClock();
  renderMastDate();
  syncProfileUI();
  bindProfileEditors();
  bindPunchButtons();
  startReveal();
});
