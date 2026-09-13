# 팀 스파이더 — 건설 현장 근로자 관리 시스템

현장 출역·서류 제출·공수 정산을 하나로 묶은 웹 시스템.
설치 없이 브라우저에서 동작하며, 추후 앱 전환을 전제로 설계함.

---

## 1. 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 로그인 · 근로자 가입 · 채용공고(비로그인 지원) |
| `worker.html` | 근로자 — 출퇴근, 내 공수, 서류, 게시판, 공고 |
| `admin.html` | 관리자 — 대시보드, 출역, 공수계산기, 서류함, 공지, 게시판, 구인, 근로자, 기준정보 |
| `assets/config.js` | **환경 설정** — Firebase 연결값, 요율·단가 기본값, 서류 항목 |
| `assets/gongsu.js` | 공수 계산 엔진 (외부 의존성 없음 → Cloud Functions 이전 가능) |
| `assets/store.js` | 데이터 계층 — 데모(localStorage) ↔ Firestore 자동 전환 |
| `assets/app.js` | 공통 UI, 세션 가드, 공지 팝업, 메일 발송 |
| `assets/auth.js` | 아이디·비밀번호 인증 (운영 모드 전용, SMS 인증 코드 포함) |
| `firestore.rules` | Firestore 보안 규칙 |
| `storage.rules` | Cloud Storage 보안 규칙 |
| `functions/` | 서류 자동발송 Cloud Function |
| `manifest.json` | PWA 설정 (홈 화면 추가) |

---

## 2. 이용자 구분

| 구분 | 권한 |
|---|---|
| **개발자** | 전체 권한 — 기준정보, 요율·단가, 계정 관리, 전 현장 조회 |
| **직영팀장** | 담당 팀 범위 — 출역 입력·승인, 공수계산기, 서류 확인, 공지, 구인 |
| **근로자** | 본인 출퇴근, 본인 공수·급여 조회, 서류 제출, 게시판, 구직 |
| **구직자** | 채용공고 열람, 지원서·서류 제출 (로그인 불필요) |

---

## 3. 바로 확인하기 (데모 모드)

`assets/config.js` 의 `FIREBASE.projectId` 가 비어 있으면 **데모 모드**로 동작함.
데이터는 브라우저(localStorage)에만 저장되며, 초기 시연 데이터가 자동 생성됨.

- `index.html` → **데모 계정으로 둘러보기** 에서 개발자 / 직영팀장 / 근로자 / 구직자 선택
- 관리자 → 기준정보 → **데모 데이터 초기화** 로 언제든 되돌릴 수 있음

로컬 확인 시에는 파일을 직접 열지 말고 간단한 서버로 띄울 것
(ES 모듈은 `file://` 에서 차단됨):

```bash
npx serve .
# 또는
python -m http.server 8080
```

---

## 4. GitHub Pages 배포

1. GitHub 에서 새 저장소 생성 (예: `Teamspider`)
2. 이 폴더의 파일을 저장소 최상위에 업로드
3. 저장소 → **Settings → Pages**
   - Source: `Deploy from a branch`
   - Branch: `main` / `/ (root)` → Save
4. 1~2분 후 `https://windycity411-ui.github.io/Teamspider/` 에서 접속

> HTTPS 로 서비스되므로 **GPS 출퇴근이 정상 동작함.**
> (위치 기능은 HTTPS 또는 localhost 에서만 허용됨)

---

## 5. 운영 전환 (Firebase 연결)

데모 모드에서 운영 모드로 넘어가는 전체 절차입니다. **순서대로** 진행하십시오.

### 5-1. 프로젝트 생성

1. [Firebase 콘솔](https://console.firebase.google.com) → **프로젝트 추가**
   - 이름: 아무거나 (예: `teamspider`)
   - Google 애널리틱스: 사용 안 함으로 둬도 무방
2. 프로젝트 화면에서 **웹 앱 추가** (`</>` 아이콘)
   - 앱 닉네임: `teamspider-web`
   - "Firebase 호스팅 설정" 체크 **안 함** (GitHub Pages 를 쓰므로)
3. 화면에 나오는 `firebaseConfig` 값을 `assets/config.js` 의 `FIREBASE` 에 그대로 붙여넣기

```js
export const FIREBASE = {
  apiKey: "AIza...",
  authDomain: "teamspider-xxxx.firebaseapp.com",
  projectId: "teamspider-xxxx",
  storageBucket: "teamspider-xxxx.firebasestorage.app",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxx"
};
```

> `projectId` 가 채워지는 순간 **데모 모드가 자동으로 꺼지고** 운영 모드로 전환됩니다.
> 이 값들은 브라우저에 노출되는 공개 설정값입니다. 보안은 아래 규칙이 담당합니다.

### 5-2. 인증 (Authentication)

1. **Authentication → 시작하기 → Sign-in method**
2. **이메일/비밀번호** 사용 설정 → 저장 (이메일 링크는 꺼둠)
3. **Settings → 승인된 도메인** 에 아래 두 개가 있는지 확인
   - `windycity411-ui.github.io`
   - `localhost` (기본으로 들어 있음)

> **아이디 + 비밀번호 방식입니다.** 화면에서는 아이디만 받고,
> 내부적으로 `<아이디>@teamspider.app` 형태로 변환해 저장합니다
> (Firebase 이메일/비밀번호 인증이 이메일 형식을 요구하기 때문).
> 이 도메인은 실제로 존재하지 않아도 되며, 화면에 노출되지 않습니다.
>
> **전화번호 SMS 인증은 2단계로 미뤘습니다.** `assets/auth.js` 에 코드는
> 이미 들어 있으므로, 나중에 콘솔에서 "전화"를 켜고 화면만 연결하면 됩니다.

### 5-3. Firestore

1. **Firestore Database → 데이터베이스 만들기**
   - 위치: `asia-northeast3 (서울)`
   - **프로덕션 모드**로 시작
2. **규칙** 탭 → `firestore.rules` 내용 전체를 붙여넣고 **게시**

### 5-4. Storage

1. **Storage → 시작하기** (위치는 Firestore 와 동일하게)
2. **Rules** 탭 → `storage.rules` 내용 전체를 붙여넣고 **게시**

> 제출 서류 원본이 여기에 저장됩니다. 이미지·PDF, 1건당 10MB 까지 허용합니다.

### 5-5. 최초 관리자 계정 만들기

가입 화면으로는 근로자만 만들어집니다. 개발자 계정은 콘솔에서 직접 만듭니다.

1. 배포된 사이트에서 **근로자 가입** 탭으로 계정을 하나 만듭니다 (아이디·비밀번호·이름·연락처)
2. Firebase 콘솔 **Authentication → Users** 에서 방금 생긴 **UID** 복사
3. **Firestore → users** 컬렉션에서 그 UID 문서를 열고 아래 두 필드를 수정

```
role      : "dev"       (문자열)
approved  : true        (부울)
```

4. 사이트를 새로고침하면 관리자 화면으로 들어갑니다

> 이후 다른 계정의 역할·승인은 **관리자 → 근로자** 화면에서 처리하면 됩니다.

### 5-6. 서류 자동발송 (Cloud Functions)

**종량제(Blaze) 요금제 전환이 필요합니다.** 1단계 규모에서는 무료 할당량 안에 들어오지만,
반드시 **예산 알림(Budget Alert)** 을 함께 걸어 과금 사고를 막으십시오.

1. [Resend](https://resend.com) 가입 → API 키 발급 (무료 한도로 충분)
2. 발신 도메인 인증 (회사 도메인이 없으면 Resend 테스트 주소로 시작 가능)
3. 터미널에서:

```bash
npm install -g firebase-tools
firebase login
firebase use <projectId>

firebase functions:secrets:set MAIL_API_KEY     # Resend API 키 입력
firebase functions:secrets:set MAIL_FROM        # 예: 팀스파이더 <noreply@회사도메인>

cd functions && npm install && cd ..
firebase deploy --only functions
```

4. `functions/index.js` 의 `ALLOWED` 배열에 배포 주소가 들어 있는지 확인
5. 사이트 **관리자 → 기준정보 → 서류 자동발송** 에서 회사 수신 이메일 지정

> 수신처를 비워 두면 발송이 대기 상태로 쌓이며, 나중에 지정 후 **재발송** 버튼으로 한 번에 보낼 수 있습니다.

### 5-7. 전환 후 점검

| 확인 항목 | 정상 동작 |
|---|---|
| 로그인 | 아이디·비밀번호 입력 → 화면 진입 |
| 가입 | 아이디 중복이면 거절, 가입 직후에는 승인 대기 화면 |
| 출퇴근 | 현장 반경 밖이면 사유 입력 후 승인 대기로 기록 |
| 서류 제출 | Storage 에 파일이 쌓이고 메일이 발송됨 |
| 권한 | 직영팀장 계정으로 다른 팀 데이터가 안 보여야 정상 |

> **데모 데이터는 넘어오지 않습니다.** 운영 모드는 빈 상태에서 시작하며,
> 기준정보(요율·단가·현장 좌표)를 먼저 입력한 뒤 근로자를 등록하십시오.

---

## 6. 공수 계산

```
기본노무비 = 직종단가 × (정상공수 + 연장공수 + 야간가산 + 휴일가산)
지급총액   = 기본노무비 + 비과세수당(식대·교통비)
실지급액   = 지급총액 − 공제계
```

- 연장·야간·휴일 가산율, 식대, 공제 요율, 직종 단가는 **전부 기준정보에서 수정 가능**
- **국민연금·건강보험** 은 당월 출역일수(기본 8일) 또는 근로시간(60시간) 기준으로 자동 판정하며, 도달 임박 시 경고 표시
- **소득세** 는 일용근로소득 분리과세 구조로 계산하고, 소액부징수 기준 미만이면 0원 처리
- 요율은 적용 시점 기준으로 반드시 확인 후 입력할 것. 과거 확정 정산은 당시 요율이 함께 저장되어 소급 변경되지 않음

> 이 시스템은 **계산 보조 도구**임.
> 실제 임금 지급·4대보험 신고는 노무 담당자 또는 노무사의 최종 확인을 거칠 것.

---

## 7. 앱 전환 경로

- 계산 로직이 `gongsu.js` 한 곳에 모여 있어 Cloud Functions 로 그대로 이전 가능
- DB·인증·스토리지를 웹과 앱이 공유하므로 **데이터 이관 작업 없음**
- 1단계는 PWA(홈 화면 추가)로 운영 → 2단계에서 하이브리드 앱 또는 네이티브 재구현 선택

---

## 8. 개인정보 유의사항

- 위치정보는 **출퇴근 버튼을 누르는 순간에만** 수집하며, 가입 시 별도 동의를 받음
- 신분증은 주민등록번호 뒷자리를 가리고 제출하도록 화면에 안내함
- 출퇴근 기록은 임금 분쟁의 증거가 되므로 **삭제 불가 · 수정이력 보존**을 원칙으로 함
- 서류 보관기간 경과분은 주기적으로 삭제할 것
