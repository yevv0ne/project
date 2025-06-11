const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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
        
        // User-Agent 설정
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        };

        const response = await axios.get(url, { headers });
        const $ = cheerio.load(response.data);
        
        // 메타 태그에서 설명 추출
        const description = $('meta[property="og:description"]').attr('content');
        
        if (description) {
            // 해시태그와 본문 분리
            const parts = description.split('#');
            const mainText = parts[0].trim();
            const hashtags = parts.slice(1).map(tag => '#' + tag.trim()).join(' ');
            
            res.json({
                success: true,
                data: {
                    text: mainText,
                    hashtags: hashtags
                }
            });
        } else {
            // 메타 태그가 없는 경우 다른 방법으로 시도
            const article = $('article');
            if (article.length > 0) {
                const text = article.text().trim();
                const hashtags = text.match(/#[\w가-힣]+/g) || [];
                const mainText = text.replace(/#[\w가-힣]+/g, '').trim();
                
                res.json({
                    success: true,
                    data: {
                        text: mainText,
                        hashtags: hashtags.join(' ')
                    }
                });
            } else {
                res.json({
                    success: false,
                    error: '포스트 내용을 찾을 수 없습니다.'
                });
            }
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 