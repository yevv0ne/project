const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');
const natural = require('natural');
const puppeteer = require('puppeteer');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // 현재 디렉토리의 정적 파일 제공

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

// 장소 관련 키워드 목록 확장
const locationKeywords = [
    // 음식점 관련
    '카페', '레스토랑', '식당', '맛집', '분식', '일식', '중식', '양식', '패스트푸드', '디저트', '베이커리', '술집', '바', '펍',
    '떡볶이', '치킨', '피자', '햄버거', '국수', '냉면', '부대찌개', '삼겹살', '곱창', '막창', '족발', '보쌈',
    // 숙박 관련
    '호텔', '펜션', '게스트하우스', '모텔', '리조트', '콘도', '민박', '캠핑장',
    // 문화/여가 시설
    '공원', '박물관', '미술관', '전시관', '갤러리', '쇼핑몰', '마트', '시장', '상가', '아울렛',
    // 교통 관련
    '역', '공항', '버스터미널', '주차장', '정류장', '터미널',
    // 생활 시설
    '병원', '약국', '학교', '도서관', '영화관', '공연장', '스타디움', '수영장', '체육관', '헬스장',
    // 종교/역사 시설
    '사찰', '교회', '성당', '사원', '궁전', '성', '성지', '사당',
    // 자연/지형
    '해변', '산', '강', '호수', '섬', '골목', '거리', '공원', '숲', '정원',
    // 행정구역
    '동', '읍', '면', '시', '군', '구', '도', '리', '가', '로', '길'
];

// 주소 패턴 정규식 개선
const addressPatterns = {
    roadAddress: /([가-힣]+(시|군|구)\s*[가-힣]+(로|길|가)\s*[0-9-]+)/g,
    buildingName: /([가-힣a-zA-Z0-9]+(빌딩|타워|센터|플라자|몰|스퀘어|파크|하우스|아파트|빌라|맨션))/g,
    landmark: /([가-힣a-zA-Z0-9]+(역|공원|학교|병원|시장|백화점|마트|상가|떡볶이|치킨|카페))/g
};

// 장소 정보 추출 함수 개선
async function extractLocationInfo(text) {
    const tokenizer = new natural.WordTokenizer();
    const tokens = tokenizer.tokenize(text);
    
    const locations = new Set();
    let currentLocation = '';
    
    // 1. 키워드 기반 추출
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        
        if (locationKeywords.some(keyword => token.includes(keyword))) {
            currentLocation = token;
            // 이전 토큰들도 함께 확인 (가게 이름이 키워드 앞에 올 수 있음)
            for (let j = Math.max(0, i - 2); j < i; j++) {
                const prevToken = tokens[j];
                if (prevToken.match(/[가-힣a-zA-Z0-9]+/)) {
                    currentLocation = prevToken + ' ' + currentLocation;
                }
            }
            // 다음 토큰들도 함께 확인
            for (let j = i + 1; j < Math.min(tokens.length, i + 3); j++) {
                const nextToken = tokens[j];
                if (nextToken.match(/[가-힣a-zA-Z0-9]+/)) {
                    currentLocation += ' ' + nextToken;
                }
            }
            if (currentLocation) {
                locations.add(currentLocation.trim());
            }
        }
    }
    
    // 2. 주소 패턴 기반 추출
    for (const [type, pattern] of Object.entries(addressPatterns)) {
        const matches = text.match(pattern);
        if (matches) {
            matches.forEach(match => {
                // 주소 앞뒤 문맥도 포함
                const textIndex = text.indexOf(match);
                const start = Math.max(0, textIndex - 20);
                const end = Math.min(text.length, textIndex + match.length + 20);
                const context = text.slice(start, end);
                
                // 문맥에서 가게명 추출 시도
                const beforeMatch = context.slice(0, context.indexOf(match)).trim();
                const words = beforeMatch.split(/\s+/).filter(w => w.length > 1);
                if (words.length > 0) {
                    locations.add(words[words.length - 1] + ' ' + match);
                }
                
                locations.add(match);
            });
        }
    }
    
    // 3. 모호한 장소명 검증 및 좌표 정보 추가
    const validatedLocations = [];
    for (const location of locations) {
        try {
            validatedLocations.push({
                name: location,
                type: determineLocationType(location),
                coordinates: null
            });
        } catch (error) {
            console.error(`Error validating location: ${location}`, error);
        }
    }
    
    return validatedLocations;
}

// 장소 유형 판별 함수 개선
function determineLocationType(location) {
    if (location.match(/떡볶이|치킨|피자|햄버거|국수|냉면|부대찌개|삼겹살|곱창|막창|족발|보쌈/)) return 'restaurant';
    if (location.match(/카페|커피|디저트|베이커리/)) return 'cafe';
    if (location.match(/식당|맛집|레스토랑/)) return 'restaurant';
    if (location.match(/호텔|펜션|게스트하우스/)) return 'accommodation';
    if (location.match(/공원|박물관|미술관/)) return 'attraction';
    if (location.match(/역|공항|터미널/)) return 'transportation';
    if (location.match(/병원|약국/)) return 'medical';
    if (location.match(/학교|도서관/)) return 'education';
    if (location.match(/쇼핑몰|마트|시장/)) return 'shopping';
    return 'other';
}

// Puppeteer를 이용한 인스타그램 본문 추출 함수 개선
async function extractInstagramTextWithPuppeteer(url) {
    const browser = await puppeteer.launch({ 
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'
        ]
    });
    try {
        const page = await browser.newPage();
        
        // User-Agent 설정
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // 타임아웃 설정
        await page.setDefaultNavigationTimeout(60000);
        
        // 쿠키 및 로컬 스토리지 설정
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
        });

        console.log('Accessing URL:', url);
        await page.goto(url, { 
            waitUntil: 'networkidle0',
            timeout: 60000
        });
        
        // 페이지 로딩 대기
        await page.waitForTimeout(8000);
        
        let text = '';
        try {
            // 여러 셀렉터 시도
            const selectors = [
                'div[role="presentation"] ul > div > li > div > div > div > span',
                'div.C4VMK > span',
                'article div[role="button"] > span',
                'div._a9zs',
                'div._a9zr',
                'div[data-testid="post_caption"]',
                'div[data-testid="post_caption"] span'
            ];
            
            for (const selector of selectors) {
                try {
                    await page.waitForSelector(selector, { timeout: 5000 });
                    text = await page.$eval(selector, el => el.innerText);
                    if (text) {
                        console.log('Found text with selector:', selector);
                        break;
                    }
                } catch (e) {
                    console.log(`Selector ${selector} failed:`, e.message);
                }
            }
            
            if (!text) {
                console.log('Trying to get body text...');
                text = await page.evaluate(() => {
                    const article = document.querySelector('article');
                    return article ? article.innerText : document.body.innerText;
                });
            }
            
            console.log('Extracted text:', text);
            return text;
        } catch (e) {
            console.error('Text extraction error:', e);
            throw e;
        }
    } finally {
        await browser.close();
    }
}

app.post('/extract', async (req, res) => {
    try {
        const { url } = req.body;
        let mainText = '';
        let hashtags = '';
        let locations = [];
        let text = '';
        let usedPuppeteer = false;

        // Puppeteer로 먼저 시도
        try {
            text = await extractInstagramTextWithPuppeteer(url);
            if (text && text.length > 0) {
                // 해시태그와 본문 분리
                hashtags = text.match(/#[\w가-힣]+/g) || [];
                mainText = text.replace(/#[\w가-힣]+/g, '').trim();
                locations = await extractLocationInfo(text);
                usedPuppeteer = true;
            }
        } catch (e) {
            // puppeteer 실패 시 fallback
            usedPuppeteer = false;
        }

        // puppeteer 실패 시 기존 방식 사용
        if (!usedPuppeteer) {
            // User-Agent 설정
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            };
            const response = await axios.get(url, { headers });
            const $ = cheerio.load(response.data);
            // 메타 태그에서 설명 추출
            const description = $('meta[property="og:description"]').attr('content');
            if (description) {
                const parts = description.split('#');
                mainText = parts[0].trim();
                hashtags = parts.slice(1).map(tag => '#' + tag.trim()).join(' ');
                locations = await extractLocationInfo(description);
            } else {
                // 메타 태그가 없는 경우 다른 방법으로 시도
                const article = $('article');
                if (article.length > 0) {
                    text = article.text().trim();
                    hashtags = text.match(/#[\w가-힣]+/g) || [];
                    mainText = text.replace(/#[\w가-힣]+/g, '').trim();
                    locations = await extractLocationInfo(text);
                } else {
                    return res.json({
                        success: false,
                        error: '포스트 내용을 찾을 수 없습니다.'
                    });
                }
            }
        }

        res.json({
            success: true,
            data: {
                text: mainText,
                hashtags: Array.isArray(hashtags) ? hashtags.join(' ') : hashtags,
                locations: locations
            }
        });
    } catch (error) {
        console.error('Error:', error.message);
        res.json({
            success: false,
            error: '포스트 내용을 가져오는데 실패했습니다. 링크를 확인해주세요.'
        });
    }
});

// 이미지 처리 엔드포인트 수정
app.post('/extract-image', express.json(), async (req, res) => {
    try {
        console.log('Received request body:', req.body); // 디버깅용

        const { text } = req.body;
        if (!text) {
            console.log('No text provided in request'); // 디버깅용
            return res.json({
                success: false,
                error: '텍스트가 없습니다.'
            });
        }

        console.log('Processing text:', text); // 디버깅용
        
        // 장소 정보 추출
        const locations = await extractLocationInfo(text);
        console.log('Extracted locations:', locations); // 디버깅용

        const response = {
            success: true,
            data: {
                text: text,
                hashtags: text.match(/#[\w가-힣]+/g) || [],
                locations: locations
            }
        };
        console.log('Sending response:', response); // 디버깅용
        res.json(response);

    } catch (error) {
        console.error('Error processing text:', error);
        res.json({
            success: false,
            error: '텍스트 처리 중 오류가 발생했습니다.'
        });
    }
});

// 기본 라우트 추가
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 서버 시작
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
}); 