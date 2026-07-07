# 출결기록실 · Attendance Archive

> 규칙 기반(VBA) vs LLM 증강(Make + Gemini) 출결 관리 시스템 — 프론트엔드
> 실무프로젝트 1 (실프랩 1) · 2026

Google Forms → Sheets → Make.com → Gemini → Gmail 로 이어지는 자동화 출결 파이프라인의
**웹 프론트엔드**입니다. 직원이 버튼 한 번으로 출퇴근을 기록하면 Google Forms에 제출되고,
판정·안내 메일 발송까지 자동으로 처리됩니다. 축적된 Google Sheets 데이터를 화면에서
통계·명단·메일 이력으로 보여줍니다.

## 화면 구성

| # | 페이지 | 설명 |
|---|--------|------|
| 01 | **오늘** (`index.html`) | 실시간 시계 + 출근/퇴근 체크 버튼, 오늘 출결 요약, 확인이 필요한 인원(지각·결근) 원장 |
| 02 | **근태 내역** (`history.html`) | 전체 출결 기록 원장 — 상태·날짜·이름 필터 |
| 03 | **통계** (`stats.html`) | 일별 출결 현황, 개인별 누적 기록 |
| 04 | **메일 이력** (`mail.html`) | Gemini가 작성하고 Gmail이 보낸 안내 메일 발송 대장 |

## 자동화 파이프라인

```
[출결기록실 웹]  →  Google Forms  →  Google Sheets  →  Make.com  →  Gemini  →  Gmail
   출근 버튼          응답 수집         자동 기록        판정        문구 생성    안내 발송
       ↑                                    │
       └──────────  화면에 통계·명단으로 표시  ←──────────┘
```

## 디자인

에디토리얼(신문 지면) 컨셉 · "인주 스탬프" 색감 — 웜 페이퍼 배경, 차콜 잉크, 도장 인주색 포인트.
직각 레이아웃, 괘선 구획, 스크롤에 따라 천천히 떠오르는 리빌 애니메이션.

- 폰트: [Pretendard](https://github.com/orioncactus/pretendard)
- 차트/라이브러리 의존성 없음 (순수 HTML/CSS/JS)

## 설정 — `js/config.js`

연동 정보는 **`js/config.js` 한 파일에만** 있습니다. 값을 비워두면 데모 데이터로 작동합니다.

- **FORM** — Google Forms ID + 질문별 entry 번호 (이름·이메일·출퇴근 구분·시간)
- **SHEET** — Google Sheets ID + 탭 gid (폼 응답 / 판정·발송 로그 / VBA 판정)
- **WORK** — 출근 마감 시각 (지각 판정 기준)

## 실행

정적 사이트입니다. 로컬에서 보려면 폴더에서:

```bash
python -m http.server 4173
# 브라우저에서 http://localhost:4173 접속
```

> ⚠️ **공개 저장소 주의** — `js/config.js`의 Google Forms/Sheets ID가 코드에 포함되어 있습니다.
> 연동된 시트는 "링크가 있는 사용자 열람" 상태여야 통계가 표시됩니다. 민감 정보(실명·이메일)가
> 담긴 운영 데이터를 다룰 때는 시트 공개 범위를 검토하세요.

## 폴더 구조

```
출결기록실/
├── index.html        오늘 (홈)
├── history.html      근태 내역
├── stats.html        통계
├── mail.html         메일 이력
├── css/style.css     공용 스타일
├── js/
│   ├── config.js     연동 설정 (여기만 수정)
│   ├── data.js       데이터 계층 (Sheets 읽기 + 데모 폴백)
│   └── app.js        공용 동작 (시계·리빌·프로필·폼 제출)
└── docs/DEVLOG.md    개발 로그
```

## 팀 구성

| 역할 | 담당 |
|------|------|
| UI/UX (2) | 홈페이지 디자인, 관리자 통계 화면 설계 |
| 백엔드 (2) | Forms 수집·판정, Gemini 안내 문구, Gmail 발송, 시트 분류 |
| 프론트엔드 / 팀장 (1) | 출퇴근 버튼 ↔ Forms 연동, 화면 ↔ Sheets 데이터 연결, 결과물 병합·발표 |

---

© 2026 출결기록실 — 실무프로젝트 1
