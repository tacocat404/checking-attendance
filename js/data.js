/* ============================================================
   데이터 계층
   - Google Sheets(gviz JSON)에서 읽고, 실패 시 데모 데이터로 폴백
   - 시트 탭 구조 (2026-07-06 확인):
     · 폼 응답(gid 88862461): A타임스탬프 B이름 C이메일 D구분 E시간 F횟수
     · VBA 판정(gid 1061791224): A날짜 B학번 C이름 D VBA최종판정
     · 판정·발송 로그(gid 276345751): A타임스탬프 B학번 C이름
       D Make판정결과 E VBA판정결과 F일치여부 G Gemini발송문구
   ============================================================ */

/* ── 공용: gviz JSON 요청 ── */
async function fetchGviz(gid) {
  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET.id}/gviz/tq?tqx=out:json&gid=${gid}&headers=1`;
  const text = await (await fetch(url)).text();
  const json = JSON.parse(text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1));
  return json.table.rows.map((row) => row.c.map((cell) => cell ?? null));
}

/* 셀 → 날짜키 "YYYY-MM-DD"
   폼 타임스탬프는 "2026. 7. 6 오후 9:30:26" 형식(f),
   Make가 쓴 행은 epoch 초(v 숫자)로 들어옴 — 둘 다 처리 */
function cellToDateKey(cell) {
  if (!cell) return null;
  if (cell.f && /^\d{4}\.\s*\d{1,2}\.\s*\d{1,2}/.test(cell.f)) {
    const [y, m, d] = cell.f.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/).slice(1).map(Number);
    return `${y}-${pad(m)}-${pad(d)}`;
  }
  if (typeof cell.v === "number" && cell.v > 1e9) {
    const t = new Date(cell.v * 1000);
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  }
  return null;
}

/* 셀 → "HH:MM" (24시간)
   '시간' 질문 값은 v="Date(1899,11,30,9,20,0)" / f="오전 9:20:00" */
function cellToTime(cell) {
  if (!cell) return null;
  const m = typeof cell.v === "string" && cell.v.match(/Date\(\d+,\d+,\d+,(\d+),(\d+)/);
  if (m) return `${pad(+m[1])}:${pad(+m[2])}`;
  if (cell.f) {
    const t = cell.f.match(/(오전|오후)?\s*(\d{1,2}):(\d{2})/);
    if (t) {
      let h = +t[2];
      if (t[1] === "오후" && h < 12) h += 12;
      if (t[1] === "오전" && h === 12) h = 0;
      return `${pad(h)}:${pad(+t[3])}`;
    }
  }
  if (typeof cell.v === "number" && cell.v > 1e9) {
    const d = new Date(cell.v * 1000);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return null;
}

/* ── 폼 응답 → 하루 단위 출결 기록 ──
   출근/퇴근 사건을 (날짜, 이름)으로 묶고 출근 시간으로 지각 판정.
   ※ 최종 판정은 백엔드(VBA·Make) 몫 — 화면 표시는 09:00 기준 근사 */
async function fetchAttendance() {
  const rows = await fetchGviz(CONFIG.SHEET.gid);
  const byKey = new Map();

  rows.forEach((c) => {
    const date = cellToDateKey(c[0]);
    const name = c[1] && c[1].v;
    const type = c[3] && c[3].v;
    if (!date || !name || !type) return;          // Make가 쓴 빈 행 등 제외

    const key = `${date}|${name}`;
    if (!byKey.has(key)) byKey.set(key, {
      date, name, email: (c[2] && c[2].v) || "", status: "정상", timeIn: null, timeOut: null,
    });
    const rec = byKey.get(key);
    const time = cellToTime(c[4]);
    if (type === "출근" && time && (!rec.timeIn || time < rec.timeIn)) rec.timeIn = time;
    if (type === "퇴근" && time && (!rec.timeOut || time > rec.timeOut)) rec.timeOut = time;
    if (c[2] && c[2].v) rec.email = c[2].v;
  });

  return [...byKey.values()].map((rec) => {
    if (rec.timeIn && rec.timeIn > CONFIG.WORK.start) rec.status = "지각";
    return rec;
  });
}

/* ── 판정·발송 로그 → 메일 이력 ── */
async function fetchMailLog() {
  const rows = await fetchGviz(CONFIG.SHEET.mailGid);
  return rows
    .filter((c) => c[2] && c[2].v)                 // 이름 없는 행 제외
    .map((c) => {
      const date = cellToDateKey(c[0]);
      const type = (c[3] && c[3].v) || "지각";
      const gemini = c[6] && c[6].v;
      return {
        date, name: c[2].v, email: "",
        type,
        subject: gemini ? gemini.slice(0, 60) + (gemini.length > 60 ? "…" : "")
                        : `[근태 안내] ${c[2].v}님 ${type} 안내`,
        sentAt: cellToTime(c[0]) || "—",
        state: "발송됨",
        vba: c[4] && c[4].v,                       // VBA 판정 (비교 실험용)
        match: c[5] && c[5].v,                     // 일치 여부
      };
    })
    .reverse();
}

/* ============================================================
   데모 데이터 (시트를 못 읽을 때의 폴백)
   ============================================================ */
const DEMO_PEOPLE = [
  { name: "김민서", email: "minseo@example.com" },
  { name: "박준호", email: "junho@example.com" },
  { name: "최유진", email: "yujin@example.com" },
  { name: "오지훈", email: "jihoon@example.com" },
  { name: "정하늘", email: "haneul@example.com" },
  { name: "이서연", email: "seoyeon@example.com" },
  { name: "강도윤", email: "doyun@example.com" },
  { name: "홍길동", email: "hong@example.com" },
];

function seedHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}
function pad(n) { return String(n).padStart(2, "0"); }

function recentWorkdays(n) {
  const days = [];
  const d = new Date();
  while (days.length < n) {
    if (d.getDay() !== 0 && d.getDay() !== 6) days.unshift(new Date(d));
    d.setDate(d.getDate() - 1);
  }
  return days;
}

function buildDemoRecords() {
  const records = [];
  const days = recentWorkdays(10);
  const todayStr = days[days.length - 1].toDateString();
  days.forEach((day) => {
    const dateKey = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
    const isToday = day.toDateString() === todayStr;
    DEMO_PEOPLE.forEach((p) => {
      const r = seedHash(dateKey + p.name);
      let status, timeIn = null, timeOut = null;
      if (r < 0.08) { status = "결근"; }
      else if (r < 0.22) {
        const late = 1 + Math.floor(seedHash(p.name + dateKey) * 39);
        status = "지각"; timeIn = `09:${pad(late)}`;
      } else {
        const early = 31 + Math.floor(r * 100) % 29;
        status = "정상"; timeIn = `08:${pad(early)}`;
      }
      if (timeIn && !isToday) timeOut = `18:${pad(Math.floor(seedHash(dateKey + p.email) * 50))}`;
      records.push({ date: dateKey, name: p.name, email: p.email, status, timeIn, timeOut });
    });
  });
  return records;
}

function buildDemoMails(records) {
  return records
    .filter((r) => r.status !== "정상")
    .map((r, i) => {
      let sentAt, state;
      if (r.status === "지각") {
        const [h, m] = r.timeIn.split(":").map(Number);
        sentAt = `${pad(h)}:${pad(m + 3)}`; state = "발송됨";
      } else { sentAt = "10:00"; state = i % 7 === 6 ? "대기 중" : "발송됨"; }
      return {
        date: r.date, name: r.name, email: r.email, type: r.status,
        subject: `[근태 안내] ${r.name}님 ${r.date.slice(5).replace("-", "/")} ${r.status} 안내`,
        sentAt, state,
      };
    })
    .reverse();
}

/* ── 공개 API: 페이지에서 이것만 사용 ── */
async function loadData() {
  let records = null, mails = null, demo = false;

  if (CONFIG.SHEET.id) {
    try { records = await fetchAttendance(); } catch (e) { console.warn("출결 시트 읽기 실패", e); }
    try { mails = await fetchMailLog(); } catch (e) { console.warn("발송 로그 읽기 실패", e); }
  }
  if (!records || !records.length) {
    records = buildDemoRecords();
    mails = buildDemoMails(records);
    demo = true;
  }
  if (!mails) mails = [];

  const dates = [...new Set(records.map((r) => r.date))].sort();
  const today = dates[dates.length - 1];

  return {
    demo, records, dates, today,
    todayRecords: records.filter((r) => r.date === today),
    mails,
    count: (list, status) => list.filter((r) => r.status === status).length,
  };
}
