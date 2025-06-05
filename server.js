const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const natural = require('natural');
const { NlpManager } = require('node-nlp');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fetch = require('node-fetch');
const FormData = require('form-data');
const Tesseract = require('tesseract.js');
// const Komoran = require('komoran-js');
const app = express();

// CORS 설정
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 보안 헤더 설정
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

// JSON 파싱 미들웨어
app.use(express.json());

// 정적 파일 제공 설정
app.use(express.static(__dirname, {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// 파일 업로드를 위한 multer 설정
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 1024 * 1024 // 1MB 제한
    }
});

// NLP 매니저 초기화
const manager = new NlpManager({ languages: ['ko'] });

// 장소 관련 품사 태그
const LOCATION_TAGS = ['NNP', 'NNB', 'NNG'];

// OCR API 키
const API_KEY = 'K89835168188957';

// 네이버 지도 API 클라이언트 ID
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || 'bcpkgzjrua';

// OCR 처리 함수
async function processOCR(imageBuffer, language = 'kor') {
    const formData = new FormData();
    formData.append('base64Image', `data:image/jpeg;base64,${imageBuffer.toString('base64')}`);
    formData.append('language', language);
    formData.append('isOverlayRequired', 'false');
    formData.append('OCREngine', '2');

    const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: {
            'apikey': API_KEY
        },
        body: formData
    });

    if (!response.ok) {
        throw new Error('OCR.space API 요청 실패');
    }

    const result = await response.json();
    if (result.IsErroredOnProcessing) {
        throw new Error(result.ErrorMessage || 'OCR 처리 중 오류 발생');
    }

    return result.ParsedResults && result.ParsedResults[0] ? result.ParsedResults[0].ParsedText : '';
}

// OCR 엔드포인트
app.post('/ocr', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '이미지가 없습니다.' });
        }

        const text = await processOCR(req.file.buffer);
        res.json({ text });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 장소 추출 API
app.post('/api/extract-locations', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: '텍스트가 필요합니다.' });

        // 텍스트 전체에서 장소명 추출
        const locationNames = extractLocationNames(text);
        const locations = [];
        for (const locationName of locationNames) {
            const coordinates = await getCoordinates(locationName);
            if (!locations.some(loc => loc.name === locationName)) {
                locations.push({
                    name: locationName,
                    type: getLocationType(locationName),
                    coordinates
                });
            }
        }
        res.json({ locations });
    } catch (error) {
        res.status(500).json({ error: '장소 추출 중 오류가 발생했습니다.' });
    }
});

// URL에서 텍스트 추출 API
app.post('/api/extract-url', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'URL이 필요합니다.' });
        }

        const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(response.data);

        // 네이버 플레이스, 인스타그램 등 주요 사이트별로 텍스트 추출 방식 분기
        let text = '';
        if (url.includes('instagram.com')) {
            // 인스타그램: 본문, 해시태그, 위치명 등 추출
            text = $('meta[property="og:description"]').attr('content') || '';
            text += ' ' + $('meta[property="og:title"]').attr('content') || '';
            text += ' ' + $('title').text();
        } else if (url.includes('naver.me') || url.includes('place.naver.com')) {
            // 네이버 플레이스: 상호명, 주소, 본문 등 추출
            text = $('meta[property="og:description"]').attr('content') || '';
            text += ' ' + $('title').text();
            text += ' ' + $('.place_section_content').text();
        } else {
            // 기타: 메타, 타이틀, 바디
            text = $('meta[name="description"]').attr('content') || '';
            text += ' ' + $('title').text();
            text += ' ' + $('body').text();
        }

        text = text.replace(/\s+/g, ' ').trim();
        res.json({ text });
    } catch (error) {
        console.error('URL 처리 오류:', error);
        res.status(500).json({ error: 'URL 처리 중 오류가 발생했습니다.' });
    }
});

// 장소명 추출 함수
function extractLocationNames(text) {
    const patterns = [
        // 도로명 주소 (구, 로/길, 번지, 상세주소)
        /([가-힣]+구\s*[가-힣0-9]+(로|길)\s*[0-9]+(?:[ -]*[0-9가-힣]+)*\s*[0-9가-힣\- ]*)/g,
        // 지번 주소 (동/읍/면/리, 번지)
        /([가-힣]+(동|읍|면|리)\s*[0-9]+(\-[0-9]+)?번?지?)/g,
        // 주요 장소명 (카페, 식당, 공원 등)
        /([가-힣0-9]+(?:카페|식당|레스토랑|호텔|펜션|게스트하우스|숙소|공원|박물관|미술관|전시관|관광지|명소|역|학교|대학교|병원|의원|약국|마트|백화점|쇼핑몰|시장|운동장|체육관|수영장|타워|센터|플라자|몰|스퀘어|점|집|관|홀|장|찻집|음식점|분식|한식|중식|일식|양식|패스트푸드))/g,
        // 해시태그 장소
        /#([가-힣0-9]+(?:카페|식당|공원|역|호텔|시장|관광지|명소))/g
    ];
    const results = new Set();
    for (const pattern of patterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
            if (match[1]) results.add(match[1]);
        }
    }
    return Array.from(results);
}

// 장소 유형 추출 함수
function getLocationType(text) {
    const types = {
        '카페': '카페',
        '식당|레스토랑': '식당',
        '호텔|펜션|게스트하우스|숙소': '숙박',
        '공원|박물관|미술관|전시관|관광지|명소': '관광지',
        '역': '교통',
        '병원|의원|약국': '의료',
        '학교|대학교': '교육',
        '마트|백화점|쇼핑몰|시장': '쇼핑',
        '운동장|체육관|수영장': '운동'
    };

    for (const [pattern, type] of Object.entries(types)) {
        if (new RegExp(pattern).test(text)) {
            return type;
        }
    }

    return '기타';
}

// 좌표 정보 가져오기 함수
async function getCoordinates(locationName) {
    try {
        const response = await axios.get('https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode', {
            params: {
                query: locationName
            },
            headers: {
                'X-NCP-APIGW-API-KEY-ID': NAVER_CLIENT_ID,
                'X-NCP-APIGW-API-KEY': process.env.NAVER_CLIENT_SECRET
            }
        });

        if (response.data.addresses && response.data.addresses.length > 0) {
            const address = response.data.addresses[0];
            return {
                lat: parseFloat(address.y),
                lng: parseFloat(address.x),
                address: address.roadAddress || address.jibunAddress
            };
        }
        return null;
    } catch (error) {
        console.error('좌표 정보 가져오기 실패:', error);
        return null;
    }
}

// 위치 정보 추출 함수
async function extractLocation(text) {
    try {
        // NLP 매니저에 위치 관련 엔티티 추가
        await manager.addNamedEntityText('location', 'LOC', ['ko'], [
            '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
            '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
            '구', '군', '읍', '면', '동', '리', '가', '로', '길', '번지'
        ]);

        // 텍스트 분석
        const result = await manager.process('ko', text);
        const locations = [];

        // NER 결과에서 위치 엔티티 추출
        if (result.entities && result.entities.length > 0) {
            for (const entity of result.entities) {
                if (entity.entity === 'location') {
                    locations.push(entity.utteranceText);
                }
            }
        }

        // 주소 패턴 매칭
        const addressPattern = /([가-힣]+(시|도|구|군|읍|면|동|리|가|로|길|번지)\s*[0-9-]+(?:\s*[0-9-]+)?(?:\s*[가-힣]+)?(?:\s*[0-9]+층)?(?:\s*[0-9]+호)?)/g;
        const addressMatches = text.match(addressPattern) || [];
        
        // 장소명 패턴 매칭
        const locationPattern = /([가-힣0-9]+(?:카페|식당|레스토랑|호텔|펜션|게스트하우스|숙소|공원|박물관|미술관|전시관|관광지|명소|역|학교|대학교|병원|의원|약국|마트|백화점|쇼핑몰|시장|운동장|체육관|수영장|타워|센터|플라자|몰|스퀘어|점|집|관|홀|장|찻집|음식점|분식|한식|중식|일식|양식|패스트푸드))/g;
        const locationMatches = text.match(locationPattern) || [];
        
        // 중복 제거
        const uniqueLocations = [...new Set([...locations, ...addressMatches, ...locationMatches])];
        
        return uniqueLocations;
    } catch (error) {
        console.error('위치 정보 추출 중 오류:', error);
        return [];
    }
}

// 서버 포트 설정
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`http://localhost:${PORT} 에서 접속 가능합니다.`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`포트 ${PORT}가 이미 사용 중입니다.`);
    } else {
        console.error('서버 시작 중 오류 발생:', err);
    }
});

// 에러 핸들링
process.on('uncaughtException', (err) => {
    console.error('예기치 않은 오류 발생:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('처리되지 않은 Promise 거부:', err);
}); 