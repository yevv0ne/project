// 환경변수 로드
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');

const app = express();

// 환경변수 불러오기
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
const WEATHERAPI_KEY = process.env.WEATHERAPI_KEY;
const PORT = process.env.PORT || 3000;

// ====== 미들웨어 ======
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ====== 기본 페이지 ======
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index-map.html'));
});
app.get('/index-map.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index-map.html'));
});

// ====== 헬스 체크 ======
app.get("/health", (_req, res) => {
    res.json({ ok: true, ts: Date.now() });
});

// ====== 네이버 장소 검색 API ======
app.get('/api/searchPlace', async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        if (!q) return res.status(400).json({ error: 'query required' });

        const resp = await axios.get('https://openapi.naver.com/v1/search/local.json', {
            params: { query: q, display: 1, start: 1, sort: 'random' },
            headers: {
                'X-Naver-Client-Id': NAVER_CLIENT_ID,
                'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
            },
            timeout: 5000
        });

        const item = (resp.data.items && resp.data.items[0]) || null;
        if (!item) return res.json({ found: false });

        res.json({
            found: true,
            name: item.title.replace(/<[^>]+>/g, ''),
            address: item.address || item.roadAddress || '',
            roadAddress: item.roadAddress || '',
            mapx: item.mapx,
            mapy: item.mapy,
            link: item.link
        });
    } catch (e) {
        console.error('searchPlace error', e?.response?.data || e.message);
        res.status(500).json({ error: 'search failed' });
    }
});

// ====== Instagram / 일반 URL 텍스트 추출 ======
app.post('/extract', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.json({ success: false, error: 'URL이 없습니다.' });

        const isInstagram = url.includes('instagram.com');
        const headers = isInstagram ? {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)',
            'Accept-Language': 'ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3'
        } : {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)'
        };

        const response = await axios.get(url, { headers, timeout: 10000 });
        const $ = cheerio.load(response.data);

        let extractedText = '';
        if (isInstagram) {
            const ogDescription = $('meta[property="og:description"]').attr('content');
            const metaDescription = $('meta[name="description"]').attr('content');
            const ogTitle = $('meta[property="og:title"]').attr('content');
            extractedText = ogDescription || metaDescription || ogTitle || '';
        } else {
            const description = $('meta[property="og:description"]').attr('content');
            extractedText = description || $('article').text().trim();
        }

        if (extractedText) {
            const hashtags = (extractedText.match(/#[\w가-힣]+/g) || []).join(' ');
            const mainText = extractedText.replace(/#[\w가-힣]+/g, '').trim();
            res.json({ success: true, data: { text: mainText, hashtags, fullText: extractedText } });
        } else {
            res.json({ success: false, error: '포스트 내용을 찾을 수 없습니다.' });
        }
    } catch (error) {
        console.error('Error:', error.message);
        res.json({ success: false, error: '포스트 내용을 가져오는데 실패했습니다.' });
    }
});

// ====== 이미지 업로드 + OCR 처리 ======
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadDir = 'uploads';
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            cb(null, Date.now() + path.extname(file.originalname));
        }
    })
});
app.post('/extract-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.json({ success: false, error: '이미지 파일이 없습니다.' });
        }

        const result = await Tesseract.recognize(req.file.path, 'kor+eng');
        fs.unlinkSync(req.file.path);

        const text = result.data.text;
        const hashtags = (text.match(/#[\w가-힣]+/g) || []).join(' ');
        const mainText = text.replace(/#[\w가-힣]+/g, '').trim();

        res.json({ success: true, data: { text: mainText, hashtags } });
    } catch (error) {
        console.error('Error processing image:', error);
        res.json({ success: false, error: '이미지 처리 중 오류가 발생했습니다.' });
    }
});

// ====== 날씨 API ======
app.get("/weather", async (req, res) => {
    try {
        const { city, lat, lon } = req.query;
        const q = lat && lon ? `${lat},${lon}` : (city || "Seoul");

        const { data } = await axios.get("https://api.weatherapi.com/v1/current.json", {
            params: { key: WEATHERAPI_KEY, q, lang: "ko" }
        });

        return res.json(data);
    } catch (err) {
        console.error("WEATHERAPI ERROR:", err?.response?.status, err?.response?.data);
        return res.json({
            location: { name: "서울" },
            current: { temp_c: 23, humidity: 45, wind_kph: 7.2, condition: { text: "맑음" } }
        });
    }
});

// ====== 서버 시작 ======
app.listen(PORT, () => console.log(`서버 실행 중 → http://localhost:${PORT}`));
