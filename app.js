"use strict";

// 모듈
const express = require("express");
const bodyParser = require("body-parser");
const multer = require('multer');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const axios = require("axios");
const cors = require("cors");
const path = require("path");

const app = express();

//에러 라우팅
const errorController = require("./src/controllers/errorController");
require('dotenv').config();

//세션 이용
var session = require('express-session')
//세션을 파일에 저장
var FileStore = require('session-file-store')(session)
//로그인 기능 
const User = require("./src/models/User");

const bcrypt = require('bcrypt');

// 앱 셋팅
// 기존 HTML 파일들을 직접 제공
app.use(express.static(path.join(__dirname))); // 현재 디렉토리의 모든 파일을 정적 파일로 제공
app.use(express.static(`${__dirname}/src/public`)); // 새로운 CSS/JS 파일들도 제공
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const { sessionConfig} = require("./config/session_config")
//세션 사용
app.use(session({
  secret: sessionConfig.secret,
  resave: sessionConfig.resave,
  saveUninitialized: sessionConfig.saveUninitialized,
  store: new FileStore()
}))

const pool= require("./config/db");

//passport는 세션을 내부적으로 사용하기 때문에 express-session을 활성화 시키는 코드 다음에 등록해야한다.!!

var passport = require('passport'),
  LocalStrategy = require('passport-local').Strategy;

//passport를 설치한 것이고 express가 호출이 될 때마다 passport.initalize가 호출되면서 우리의 app에 개입됨
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function (user, done) {
  done(null, user.user_email);
});

passport.deserializeUser(function (id, done) {
  done(null, id);
});

let userInfo;
passport.use(new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password'
  },
  async function (username, password, done) {
    console.log('Passport 인증 시도:', { username, password });

    try {
      let user = new User();
      userInfo = await user.getUserInfo(username);
      
      if (!userInfo) {
        console.log('사용자를 찾을 수 없음:', username);
        return done(null, false, {
          reason: '등록된 이메일이 없습니다.'
        });
      }

      console.log('사용자 정보 확인:', userInfo.user_email);
      
      if (username === userInfo.user_email) {
        const isPasswordValid = await bcrypt.compare(password, userInfo.psword);
        console.log('비밀번호 검증 결과:', isPasswordValid);
        
        if (isPasswordValid) {
          console.log('인증 성공:', userInfo.user_email);
          return done(null, userInfo);
        } else {
          console.log('비밀번호 불일치');
          return done(null, false, {
            reason: '비밀번호가 틀렸습니다.'
          });
        }
      } else {
        console.log('이메일 불일치');
        return done(null, false, {
          reason: '등록된 이메일이 없습니다.'
        });
      }
    } catch (error) {
      console.error('Passport 인증 오류:', error);
      return done(error);
    }
  }
));

// 기본 라우트 - index-map.html 제공
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index-map.html'));
});

app.get('/index-map.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index-map.html'));
});

// 로그인 API 엔드포인트
app.post('/api/login', (req, res, next) => {
  console.log('로그인 요청 받음:', req.body);
  
  passport.authenticate('local', (err, user, info) => {
    console.log('Passport 인증 결과:', { err, user: user ? '사용자 존재' : '사용자 없음', info });
    
    if (info) {
      console.log('인증 실패 정보:', info);
      return res.json({ success: false, error: info.reason });
    }

    return req.login(user, loginErr => {
      if (loginErr) {
        console.log('로그인 세션 생성 실패:', loginErr);
        return res.json({ success: false, error: 'Authentication failed' });
      }
      console.log('로그인 성공:', user.user_email);
      const filteredUser = { ...user.dataValues };
      delete filteredUser.psword;
      return res.json({ success: true, user: filteredUser });
    });
  })(req, res, next);
});

// 로그아웃 API
app.post('/api/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.json({ success: false, error: '로그아웃 실패' });
    }
    res.json({ success: true, message: '로그아웃되었습니다.' });
  });
});

// 회원가입 API
app.post('/api/register', async (req, res) => {
  try {
    console.log('회원가입 요청 받음:', req.body);
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
      console.log('필수 필드 누락:', { email, password, username });
      return res.json({ success: false, error: '모든 필드를 입력해주세요.' });
    }

    if (password.length < 6) {
      console.log('비밀번호 길이 부족:', password.length);
      return res.json({ success: false, error: '비밀번호는 6자 이상이어야 합니다.' });
    }

    console.log('User 모델 생성 시도...');
    const user = new User();
    
    console.log('이메일 중복 확인 시도...');
    // 이메일 중복 확인
    const emailExists = await user.isEmailExists(email);
    console.log('이메일 중복 확인 결과:', emailExists);
    
    if (emailExists) {
      return res.json({ success: false, error: '이미 등록된 이메일입니다.' });
    }

    console.log('사용자 생성 시도...');
    // 사용자 생성
    const result = await user.createUser(email, password, username);
    console.log('사용자 생성 결과:', result);
    
    res.json({ success: true, message: '회원가입이 완료되었습니다.' });
  } catch (error) {
    console.error('회원가입 오류:', error);
    res.json({ success: false, error: '회원가입 중 오류가 발생했습니다.' });
  }
});

// 사용자 정보 조회 API
app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    const user = { ...req.user.dataValues };
    delete user.psword;
    res.json({ success: true, user });
  } else {
    res.json({ success: false, user: null });
  }
});

// Multer 설정
const upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            const uploadDir = 'uploads';
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir);
            }
            cb(null, uploadDir);
        },
        filename: function (req, file, cb) {
            cb(null, Date.now() + path.extname(file.originalname));
        }
    })
});

// uploads 디렉토리 생성
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// 이미지 처리 엔드포인트
app.post('/extract-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.json({
                success: false,
                error: '이미지 파일이 없습니다.'
            });
        }

        console.log('Processing image:', req.file.path);

        const result = await Tesseract.recognize(
            req.file.path,
            'kor+eng',
            {
                logger: m => console.log(m),
                tessedit_char_whitelist: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ가-힣ㄱ-ㅎㅏ-ㅣ!@#$%^&*()_+-=[]{}|;:,.<>?/~` '
            }
        );

        // 임시 파일 삭제
        fs.unlinkSync(req.file.path);

        // 추출된 텍스트에서 해시태그 분리
        const text = result.data.text;
        const hashtags = text.match(/#[\w가-힣]+/g) || [];
        const mainText = text.replace(/#[\w가-힣]+/g, '').trim();

        res.json({
            success: true,
            data: {
                text: mainText,
                hashtags: hashtags.join(' ')
            }
        });
    } catch (error) {
        console.error('Error processing image:', error);
        res.json({
            success: false,
            error: '이미지 처리 중 오류가 발생했습니다.'
        });
    }
});

// 네이버 지역(장소) 검색 프록시 엔드포인트
app.get('/search-place', async (req, res) => {
    const query = req.query.query;
    const clientId = 'dv09yJvf1T8W4_pyPYjs';         // 여기에 본인 Client ID 입력
    const clientSecret = 'k4ncKS6rkV'; // 여기에 본인 Client Secret 입력

    if (!query) {
        return res.status(400).json({ error: '검색어가 필요합니다.' });
    }

    try {
        console.log('네이버 API 요청:', query);
        
        const response = await axios.get('https://openapi.naver.com/v1/search/local.json', {
            params: { query, display: 1 },
            headers: {
                'X-Naver-Client-Id': clientId,
                'X-Naver-Client-Secret': clientSecret
            }
        });
        
        console.log('네이버 API 응답:', response.status, response.data);
        res.json(response.data);
    } catch (error) {
        console.error('네이버 API 에러:', error.response?.status, error.response?.data);
        
        if (error.response?.status === 401) {
            res.status(401).json({ error: '네이버 API 인증 실패 - Client ID/Secret을 확인해주세요.' });
        } else if (error.response?.status === 403) {
            res.status(403).json({ error: '네이버 API 권한 없음 - API 사용 권한을 확인해주세요.' });
        } else if (error.response?.status === 429) {
            res.status(429).json({ error: '네이버 API 요청 제한 - 잠시 후 다시 시도해주세요.' });
        } else {
            res.status(500).json({ error: '장소 검색 실패', details: error.message });
        }
    }
});

// 날씨 정보 프록시 엔드포인트
app.get("/weather", async (req, res) => {
  try {
    // 🔑 WeatherAPI 키 (하드코딩 또는 환경변수에서 불러오기)
    const API_KEY = process.env.WEATHERAPI_KEY || "fb1f1bca635a446c9dc192911251008"; 
    if (!API_KEY) {
      return res.status(500).json({ message: "Missing WeatherAPI key" });
    }

    const { city, lat, lon } = req.query;
    const q = lat && lon ? `${lat},${lon}` : (city || "Seoul");

    const url = "https://api.weatherapi.com/v1/current.json";
    console.log("PROVIDER=WEATHERAPI CALL:", url, "q=", q);

    const { data } = await axios.get(url, {
      params: { key: API_KEY, q, lang: "ko" },
    });

    // WeatherAPI 스키마 그대로 반환
    return res.json(data);
  } catch (err) {
    const status = err?.response?.status || 500;
    const payload = err?.response?.data || { message: err.message || "Unknown error" };
    console.error("WEATHERAPI ERROR:", status, payload);

    // 폴백(WeatherAPI 스키마와 동일)
    return res.json({
      location: { name: "서울" },
      current: {
        temp_c: 23,
        humidity: 45,
        wind_kph: 7.2,
        condition: { text: "맑음" },
      },
    });
  }
});

// 즐겨찾기 장소 추가 API
app.post('/api/favorites', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.json({ success: false, error: '로그인이 필요합니다.' });
    }

    const { placeName, address, latitude, longitude } = req.body;
    const user = new User();
    const userInfo = await user.getUserInfo(req.user);
    
    await user.addFavoritePlace(userInfo.id, placeName, address, latitude, longitude);
    
    res.json({ success: true, message: '즐겨찾기에 추가되었습니다.' });
  } catch (error) {
    console.error('즐겨찾기 추가 오류:', error);
    res.json({ success: false, error: '즐겨찾기 추가에 실패했습니다.' });
  }
});

// 즐겨찾기 장소 조회 API
app.get('/api/favorites', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.json({ success: false, error: '로그인이 필요합니다.' });
    }

    const user = new User();
    const userInfo = await user.getUserInfo(req.user);
    const favoritePlaces = await user.getFavoritePlaces(userInfo.id);
    
    res.json({ success: true, data: favoritePlaces });
  } catch (error) {
    console.error('즐겨찾기 조회 오류:', error);
    res.json({ success: false, error: '즐겨찾기 조회에 실패했습니다.' });
  }
});

// 즐겨찾기 장소 삭제 API
app.delete('/api/favorites/:id', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.json({ success: false, error: '로그인이 필요합니다.' });
    }

    const favoriteId = req.params.id;
    const user = new User();
    const userInfo = await user.getUserInfo(req.user);
    
    await user.removeFavoritePlace(favoriteId, userInfo.id);
    
    res.json({ success: true, message: '즐겨찾기에서 제거되었습니다.' });
  } catch (error) {
    console.error('즐겨찾기 삭제 오류:', error);
    res.json({ success: false, error: '즐겨찾기 삭제에 실패했습니다.' });
  }
});

// 서버 실행
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`### PlacePick 서버가 http://localhost:${PORT}에서 실행 중입니다 ###`);
    console.log(`### 로그인 시스템과 기존 기능이 하나의 페이지에서 통합되었습니다 ###`);
});

module.exports = app;