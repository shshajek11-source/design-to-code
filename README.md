# design-to-code

Gemini로 디자인하고 Claude로 코드를 생성하는 CLI 도구

## 설치

```bash
npm install -g design-to-code
```

또는 로컬 설치:

```bash
git clone https://github.com/YOUR_USERNAME/design-to-code.git
cd design-to-code
npm install
npm run build
npm link
```

## API 키 설정

### 방법 1: 환경 변수

```bash
export GEMINI_API_KEY=your_gemini_key
export ANTHROPIC_API_KEY=your_anthropic_key
```

### 방법 2: .env 파일

프로젝트 루트에 `.env` 파일 생성:

```
GEMINI_API_KEY=your_gemini_key
ANTHROPIC_API_KEY=your_anthropic_key
```

### 방법 3: CLI 설정

```bash
design-to-code config init
```

## 사용법

### 인터랙티브 모드 (추천)

```bash
design-to-code generate
# 또는
d2c generate
```

### 전체 워크플로우

```bash
d2c workflow "현대적인 대시보드 페이지" -o ./my-project
```

### 개별 명령어

#### 디자인 생성 (Gemini)

```bash
# 텍스트 프롬프트로 디자인 생성
d2c design generate "이커머스 랜딩 페이지"

# 이미지 분석
d2c design analyze ./my-design.png

# 디자인 수정
d2c design refine "더 어두운 색상으로" -d ./design-spec.json
```

#### 코드 생성 (Claude)

```bash
# 디자인 스펙에서 코드 생성
d2c code generate -d ./design-spec.json --framework nextjs

# 코드 리팩토링
d2c code refactor -c ./component.tsx -i "타입 안전성 개선"

# 기능 추가
d2c code add-feature -c ./page.tsx -f "다크 모드 토글"
```

## 지원 프레임워크

- **Next.js** (App Router) - 기본값
- **React**
- **Vue 3**

## 출력 예시

```
./output/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── Header.tsx
│   ├── Footer.tsx
│   └── Card.tsx
├── design-spec.json
└── SETUP.md
```

## 명령어 요약

| 명령어 | 설명 |
|--------|------|
| `d2c generate` | 인터랙티브 생성 모드 |
| `d2c workflow <prompt>` | 전체 워크플로우 실행 |
| `d2c design generate <prompt>` | Gemini로 디자인 생성 |
| `d2c design analyze <image>` | 이미지에서 디자인 추출 |
| `d2c code generate -d <file>` | Claude로 코드 생성 |
| `d2c config init` | API 키 설정 |
| `d2c config show` | 현재 설정 확인 |

## API 키 발급

- **Gemini**: https://aistudio.google.com/apikey
- **Anthropic**: https://console.anthropic.com/

## 라이선스

MIT
