console.log("### BOOT server.js ###");


console.log("### RUNNING SERVER (WeatherAPI build) ###");
console.log("### BOOT: server.js entered ###");
process.on("exit", (code) => console.log("### EXIT:", code));
setTimeout(() => console.log("### still alive after 2s ###"), 2000);


const cheerio = require('cheerio');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");


const app = express();


// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // 현재 디렉토리의 모든 파일을 정적 파일로 제공

// 기본 라우트 추가
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index-map.html'));
});

app.get('/index-map.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index-map.html'));
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
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

app.post('/extract', async (req, res) => {
    try {
        const { url } = req.body;
        
        // Instagram URL 감지
        const isInstagram = url.includes('instagram.com');
        
        // URL별 맞춤 헤더 설정
        const headers = isInstagram ? {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3',
            'Accept-Encoding': 'gzip, deflate',
            'Referer': 'https://www.instagram.com/',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        } : {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        };

        console.log(`${isInstagram ? 'Instagram' : '일반'} URL 처리:`, url);
        
        const response = await axios.get(url, { 
            headers,
            timeout: 10000,
            maxRedirects: 5
        });
        const $ = cheerio.load(response.data);
        
        let extractedText = '';
        let hashtags = '';
        
        if (isInstagram) {
            // Instagram 전용 추출 로직
            console.log('Instagram 전용 파싱 시작...');
            
            // 1. 메타 태그들 확인
            const ogDescription = $('meta[property="og:description"]').attr('content');
            const metaDescription = $('meta[name="description"]').attr('content');
            const ogTitle = $('meta[property="og:title"]').attr('content');
            
            console.log('OG Description:', ogDescription);
            console.log('Meta Description:', metaDescription);
            console.log('OG Title:', ogTitle);
            
            // 2. JSON-LD 스크립트 태그에서 추출 시도
            let jsonLdData = null;
            $('script[type="application/ld+json"]').each((i, elem) => {
                try {
                    const jsonText = $(elem).html();
                    const data = JSON.parse(jsonText);
                    if (data && (data.caption || data.description || data.name)) {
                        jsonLdData = data;
                        console.log('JSON-LD 데이터 발견:', data);
                    }
                } catch (e) {
                    // JSON 파싱 실패는 무시
                }
            });
            
            // 3. window._sharedData에서 추출 시도
            const scriptTags = $('script:not([src])').toArray();
            for (let script of scriptTags) {
                const scriptContent = $(script).html();
                if (scriptContent && scriptContent.includes('window._sharedData')) {
                    try {
                        // _sharedData에서 데이터 추출
                        const match = scriptContent.match(/window\._sharedData\s*=\s*({.*?});/);
                        if (match) {
                            const sharedData = JSON.parse(match[1]);
                            console.log('_sharedData 발견, 분석 중...');
                            // 여기서 포스트 데이터 추출 로직 추가 가능
                        }
                    } catch (e) {
                        console.log('_sharedData 파싱 실패');
                    }
                }
            }
            
            // 4. 우선순위에 따라 텍스트 선택
            if (jsonLdData && jsonLdData.caption) {
                extractedText = jsonLdData.caption;
            } else if (ogDescription && ogDescription.length > 10) {
                extractedText = ogDescription;
            } else if (metaDescription && metaDescription.length > 10) {
                extractedText = metaDescription;
            } else if (ogTitle && ogTitle.length > 5) {
                extractedText = ogTitle;
            }
            
            console.log('Instagram에서 추출된 텍스트:', extractedText);
            
        } else {
            // 일반 URL 처리 (기존 로직)
            const description = $('meta[property="og:description"]').attr('content');
            
            if (description) {
                extractedText = description;
            } else {
                const article = $('article');
                if (article.length > 0) {
                    extractedText = article.text().trim();
                }
            }
        }
        
        if (extractedText) {
            // 해시태그와 본문 분리
            const hashtagMatches = extractedText.match(/#[\w가-힣]+/g) || [];
            hashtags = hashtagMatches.join(' ');
            const mainText = extractedText.replace(/#[\w가-힣]+/g, '').trim();
            
            res.json({
                success: true,
                data: {
                    text: mainText,
                    hashtags: hashtags,
                    fullText: extractedText
                }
            });
        } else {
            res.json({
                success: false,
                error: '포스트 내용을 찾을 수 없습니다.'
            });
        }
    } catch (error) {
        console.error('Error:', error.message);
        res.json({
            success: false,
            error: '포스트 내용을 가져오는데 실패했습니다. 링크를 확인해주세요.'
        });
    }
});

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



// 프로세스 전역 에러 로깅
process.on("uncaughtException", (e) => {
  console.error("UNCAUGHT:", e);
});
process.on("unhandledRejection", (e) => {
  console.error("UNHANDLED:", e);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`### Server is running on http://localhost:${PORT}`));

console.log("### BOOT: server.js entered ###");
process.on("exit", (code) => console.log("### EXIT:", code));
setTimeout(() => console.log("### still alive after 2s ###"), 2000);
