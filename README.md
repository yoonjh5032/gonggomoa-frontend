# 공고모아 프론트엔드 (gonggomoa-frontend)

입찰공고 통합 검색 서비스 프론트엔드

## 기술 스택
- 순수 HTML/CSS/JavaScript (프레임워크 없음)
- Font Awesome 아이콘
- Google Fonts (Noto Sans KR)

## 배포 설정 (Cloudflare Pages)

### 방법 1: GitHub 연동
1. 이 레포지토리를 GitHub에 push
2. [Cloudflare Dashboard](https://dash.cloudflare.com/) → Pages
3. "Create a project" → "Connect to Git"
4. GitHub 연결 → 이 레포지토리 선택
5. Build settings:
   - **Build command**: (비워두기 — 빌드 불필요)
   - **Build output directory**: `/` (루트)
6. Deploy!

### 방법 2: 직접 업로드
```bash
npx wrangler pages deploy . --project-name=gonggomoa
```

## 커스텀 도메인 연결
1. Cloudflare Pages 프로젝트 → Custom domains
2. 보유 도메인 추가 (예: `gonggomoa.co.kr`)
3. DNS 설정 자동 구성됨

## ★ 중요: API 주소 변경

`js/public-api.js` 파일의 `API_BASE` 를 실제 백엔드 URL로 변경:

```javascript
const API_BASE = 'https://your-backend.cloudtype.app/api';
```

## 파일 구조
```
/
├── index.html           ← 메인 페이지 (홈 + 캘린더)
├── css/
│   └── public.css       ← 공통 스타일시트
├── js/
│   ├── public-api.js    ← API 통신 모듈 ★ API_BASE 변경 필요
│   ├── public-auth.js   ← 인증 모듈
│   └── feedback.js      ← 토스트 알림
├── public/
│   ├── login.html       ← 로그인 / 회원가입
│   ├── notices.html     ← 전체 공고 목록
│   └── mypage.html      ← 마이페이지
├── _redirects           ← Cloudflare SPA 라우팅
└── favicon.png          ← (직접 추가)
```
