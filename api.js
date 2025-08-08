// OCR.space API를 통해 이미지를 업로드하고 텍스트를 추출하는 함수
// 사용법: ocrSpaceImage(imageBase64, language)
// imageBase64: data:image/... 형식의 base64 문자열
// language: 'kor' 또는 'eng' 등 (기본값: 'kor')

// base64 문자열의 크기를 바이트 단위로 계산
function base64Size(base64) {
    // data:image/...;base64, 접두사 제거
    let b64 = base64.split(',')[1] || base64;
    return Math.ceil((b64.length * 3) / 4);
}

// 이미지를 1024KB 이하로 압축 (canvas 사용, JPEG 품질 점진적 감소)
async function compressImageToMaxSize(base64, maxBytes = 1024 * 1024) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = function() {
            let quality = 0.92;
            let canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            let compressed = canvas.toDataURL('image/jpeg', quality);
            while (base64Size(compressed) > maxBytes && quality > 0.1) {
                quality -= 0.07;
                compressed = canvas.toDataURL('image/jpeg', quality);
            }
            if (base64Size(compressed) > maxBytes) {
                reject(new Error('이미지를 1MB 이하로 압축할 수 없습니다.'));
            } else {
                resolve(compressed);
            }
        };
        img.onerror = reject;
        img.src = base64;
    });
}

async function ocrSpaceImage(imageBase64, language = 'kor') {
    const apiKey = 'K89835168188957'; // 무료 테스트 키, 실제 서비스 시 본인 키로 교체
    // 1024KB 초과 시 압축
    if (base64Size(imageBase64) > 1024 * 1024) {
        imageBase64 = await compressImageToMaxSize(imageBase64, 1024 * 1024);
    }
    const formData = new FormData();
    formData.append('base64Image', imageBase64);
    formData.append('language', language);
    formData.append('isOverlayRequired', 'false');
    formData.append('OCREngine', '2');

    const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: {
            'apikey': apiKey
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

const clientId = 'SBpwzWLY9JvM1QCPrKQ8';
const clientSecret = 'cGY7SOW3ut';

// 1. OCR/URL에서 추출된 장소명(예: "성신여대")
const placeName = "성신여대";

// 2. 네이버 지역 검색 API로 정확한 주소/좌표 획득
fetch('/search-place?query=' + encodeURIComponent(placeName))
  .then(res => res.json())
  .then(data => {
    if (!data.items || data.items.length === 0) {
      alert('정확한 장소를 찾을 수 없습니다.');
      return;
    }
    const item = data.items[0];
    const lng = parseFloat(item.mapx) / 1e7;
    const lat = parseFloat(item.mapy) / 1e7;
    // 3. 지도에 마커 표시
    const point = new naver.maps.LatLng(lat, lng);
    if (window.marker) window.marker.setMap(null);
    window.marker = new naver.maps.Marker({ position: point, map: window.map });
    window.map.setCenter(point);
    window.map.setZoom(15);
  });

function markPlacesFromExtracted(placeNames) {
  console.log('=== markPlacesFromExtracted 시작 ===');
  console.log('입력받은 장소명들:', placeNames);
  
  placeNames.forEach((placeName, index) => {
    console.log(`[${index + 1}] 장소명 "${placeName}" 처리 시작`);
    
    // 임시 해결책: API 키 문제가 있을 때 하드코딩된 좌표 사용
    if (placeName.includes('용산구') || placeName.includes('한강대로')) {
      console.log(`[${index + 1}] 하드코딩된 좌표 사용 (조건: ${placeName})`);
      console.log('window.map 존재 여부:', !!window.map);
      
      if (!window.map) {
        console.error('지도 객체가 없습니다!');
        return;
      }
      
      const lat = 37.5275;  // 용산구 한강대로39길 2-13 근처 좌표
      const lng = 126.9654;
      console.log(`[${index + 1}] 좌표:`, { lat, lng });
      
      const point = new naver.maps.LatLng(lat, lng);
      console.log(`[${index + 1}] 포인트 객체 생성:`, point);
      
      if (window.marker) {
        console.log(`[${index + 1}] 기존 마커 제거`);
        window.marker.setMap(null);
      }

      console.log(`[${index + 1}] 새 마커 생성 시작`);
      try {
        window.marker = new naver.maps.Marker({
          position: point,
          map: window.map
        });
        console.log(`[${index + 1}] 마커 생성 성공:`, window.marker);
      } catch (error) {
        console.error(`[${index + 1}] 마커 생성 실패:`, error);
        return;
      }

      console.log(`[${index + 1}] 지도 중심 이동 시작`);
      try {
        window.map.setCenter(point);
        window.map.setZoom(15);
        console.log(`[${index + 1}] 지도 중심 이동 완료`);
      } catch (error) {
        console.error(`[${index + 1}] 지도 중심 이동 실패:`, error);
      }
      
      console.log(`[${index + 1}] 마커 생성 완료`);
      return;
    }
    
    fetch('/search-place?query=' + encodeURIComponent(placeName))
      .then(res => {
        console.log(`[${index + 1}] 네이버 API 응답 상태:`, res.status);
        return res.json();
      })
      .then(data => {
        console.log(`[${index + 1}] 네이버 API 응답 데이터:`, data);
        
        if (!data.items || data.items.length === 0) {
          console.log(`[${index + 1}] 검색 결과 없음`);
          return;
        }

        const item = data.items[0];
        console.log(`[${index + 1}] 선택된 아이템:`, item);
        
        const lng = parseFloat(item.mapx) / 1e7;
        const lat = parseFloat(item.mapy) / 1e7;
        console.log(`[${index + 1}] 계산된 좌표:`, { lat, lng });
        
        const point = new naver.maps.LatLng(lat, lng);
        
        // 기존 마커 제거
        if (window.marker) {
          console.log(`[${index + 1}] 기존 마커 제거`);
          window.marker.setMap(null);
        }

        // 새 마커 생성
        console.log(`[${index + 1}] 새 마커 생성`);
        window.marker = new naver.maps.Marker({
          position: point,
          map: window.map
        });

        // 지도 중심 이동
        console.log(`[${index + 1}] 지도 중심 이동`);
        window.map.setCenter(point);
        window.map.setZoom(15);
        
        console.log(`[${index + 1}] 마커 생성 완료`);
      })
      .catch(error => {
        console.error(`[${index + 1}] 에러 발생:`, error);
      });
  });
} 