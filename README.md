# PlacePick - 장소 추천 서비스

PlacePick은 URL이나 이미지를 통해 장소 정보를 추출하고, 지도에서 확인할 수 있는 장소 추천 서비스입니다.

## 🚀 주요 기능

### 1. 로그인 시스템
- **회원가입/로그인**: 이메일과 비밀번호를 통한 사용자 인증
- **프로필 관리**: 사용자명 변경, 비밀번호 변경
- **세션 관리**: 로그인 상태 유지 및 보안

### 2. 장소 추출 기능
- **URL에서 장소 추출**: 인스타그램, 웹페이지 URL을 통한 자동 장소 정보 추출
- **이미지 OCR**: 업로드된 이미지에서 텍스트 추출 및 장소 검색
- **네이버 API 연동**: 네이버 검색 API를 통한 정확한 장소 정보 제공

### 3. 즐겨찾기 시스템
- **장소 저장**: 찾은 장소를 즐겨찾기에 저장
- **즐겨찾기 관리**: 저장된 장소 조회, 삭제
- **사용자별 분리**: 각 사용자마다 개별적인 즐겨찾기 관리

### 4. 지도 연동
- **네이버 지도 API**: hk7y7c86pt
- **좌표 변환**: 네이버 API 좌표를 GPS 좌표로 자동 변환
- **마커 표시**: 추출된 장소를 지도에 자동으로 표시

## 🛠️ 기술 스택

- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **Authentication**: Passport.js, bcrypt
- **Session**: express-session, session-file-store
- **Template Engine**: EJS
- **Image Processing**: Tesseract.js (OCR)
- **APIs**: 네이버 검색 API, 네이버 지도 API
- **Styling**: CSS3, Responsive Design

## 📁 프로젝트 구조

```
project/
├── src/
│   ├── views/           # EJS 템플릿 파일들
│   ├── controllers/     # 라우팅 및 컨트롤러
│   ├── models/         # 데이터 모델 (User, Favorites)
│   └── public/         # 정적 파일 (CSS, JS)
├── config/             # 설정 파일들
├── database/           # SQLite 데이터베이스
├── uploads/            # 업로드된 이미지 임시 저장
├── app.js             # 메인 애플리케이션 파일
└── server.js          # 서버 실행 파일
```

## 🚀 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
`.env` 파일을 생성하고 필요한 API 키를 설정하세요:
```env
WEATHERAPI_KEY=your_weather_api_key
```

### 3. 서버 실행
```bash
npm start
```

서버는 `http://localhost:3000`에서 실행됩니다.

## 🔑 API 키 설정

### 네이버 API
- **지도 API**: hk7y7c86pt
- **검색 API**: dv09yJvf1T8W4_pyPYjs+k4ncKS6rkV

## 📱 사용법

### 1. 회원가입/로그인
- `/register` - 새 계정 생성
- `/login` - 기존 계정으로 로그인

### 2. 장소 추출
- **URL 추출**: URL 입력 → 장소 정보 자동 추출
- **이미지 추출**: 이미지 업로드 → OCR 처리 → 장소 검색

### 3. 즐겨찾기 관리
- `/profile` - 저장된 장소 확인 및 관리
- API를 통한 즐겨찾기 추가/삭제

## 🎨 UI/UX 특징

- **반응형 디자인**: 모바일과 데스크톱 모두 지원
- **모던한 인터페이스**: 깔끔하고 직관적인 사용자 경험
- **그라데이션 디자인**: 시각적으로 매력적인 색상 구성
- **애니메이션 효과**: 부드러운 전환과 상호작용

## 🔒 보안 기능

- **비밀번호 해싱**: bcrypt를 통한 안전한 비밀번호 저장
- **세션 관리**: 안전한 사용자 인증 상태 유지
- **입력 검증**: 사용자 입력 데이터 검증 및 보안

## 🧪 테스트된 기능

- ✅ 회원가입 및 로그인
- ✅ 프로필 정보 수정
- ✅ 장소 추출 (성신여대, 나누미떡볶이, 나폴레옹, 트리마제 등)
- ✅ 즐겨찾기 추가/삭제
- ✅ 네이버 API 연동
- ✅ 이미지 OCR 처리

## 📈 향후 개발 계획

- [ ] 네이버 지도 API 완전 연동
- [ ] 장소 리뷰 시스템
- [ ] 사용자 간 장소 공유
- [ ] 모바일 앱 개발
- [ ] AI 기반 장소 추천

## 🤝 기여하기

프로젝트에 기여하고 싶으시다면:
1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

---

**PlacePick** - 당신의 완벽한 장소를 찾아드립니다! 🗺️✨ 