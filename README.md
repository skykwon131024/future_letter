# future_letter
Future Letter는 AI가 '10년 후의 나'라는 역할을 맡아 사용자의 고민에 답장을 보내고, 현재의 고민을 타임캡슐처럼 저장해 미래에 다시 확인할 수 있도록 도와주는 감성 웹 서비스 프로젝트입니다.

## 실행 방법 (생성형 AI)
1. 의존성 설치
	- `npm install`
2. 환경 변수 설정
	- `.env.example`를 복사해서 `.env` 파일 생성
  - OpenAI 일반 API를 쓸 경우: `OPENAI_API_KEY` 입력
  - Azure Foundry 배포를 쓸 경우: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT` 입력
3. 서버 실행
	- `npm start`
4. 브라우저 접속
	- `http://localhost:3000`

## 배포 후 바로 할 일 (Azure Foundry)
1. 배포 생성 완료 후 다음 3가지를 복사
  - Endpoint
  - Key
  - Deployment name
2. `.env`에 Azure 변수 입력
3. `npm start`로 재실행 후 테스트

## 구현된 기능
- 4.1 고민 작성
  - 필수 입력 검증 및 버튼 비활성화 처리
  - 작성 날짜 자동 저장
  - 입력 중 임시저장(localStorage)
- 4.2 AI 편지 받기
  - 생성형 AI 응답 요청 (`POST /api/generate-letter`)
  - 결과 영역 표시 및 편지 렌더링
  - 저장하기/공유하기/다시 생성 동작

참고
- API 키가 없거나 AI 호출이 실패하면 기본 편지 텍스트로 자동 대체됩니다.
