/* app.js — PlacePick (clean rebuild)
 * 흐름: 초기화 → 이미지/URL 입력 → 텍스트 추출(OCR/서버) → 장소 후보 추출 → 네이버 API 검색(markPlacesFromExtracted in api.js) → 리스트/지도 표시
 * 의존: api.js (ocrSpaceImage, markPlacesFromExtracted), Naver Maps (index-map.html에서 로드)
 */

(() => {
  // === 전역 요소 참조 ===
  let imageInput, urlInput;
  let imageUploadSection, urlInputSection;
  let imageFile, urlInputField, processButton;
  let imagePreview, loading, resultContainer, locationList;

  // 지도 전역 (api.js에서 window.map 사용)
  let map;

  // ===== 초기화 =====
  document.addEventListener('DOMContentLoaded', () => {
    // 요소 바인딩
    imageInput = document.getElementById('imageInput');
    urlInput = document.getElementById('urlInput');
    imageUploadSection = document.getElementById('imageUploadSection');
    urlInputSection = document.getElementById('urlInputSection');
    imageFile = document.getElementById('imageFile');
    urlInputField = document.getElementById('urlInputField');
    processButton = document.getElementById('processButton');
    imagePreview = document.getElementById('imagePreview');
    loading = document.querySelector('.loading');
    resultContainer = document.querySelector('.result-container');
    locationList = document.getElementById('locationList');

    // 입력 탭 전환
    if (imageInput && urlInput) {
      imageInput.addEventListener('change', () => {
        imageUploadSection.style.display = 'block';
        urlInputSection.style.display = 'none';
        updateReextractButtonState();
      });
      urlInput.addEventListener('change', () => {
        imageUploadSection.style.display = 'none';
        urlInputSection.style.display = 'block';
        updateReextractButtonState();
      });
    }

    // 파일 선택 → 미리보기 + 자동 처리
    if (imageFile) {
      imageFile.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) handleImageFile(file);
      });
    }

    // 재추출 버튼
    if (processButton) {
      processButton.addEventListener('click', async () => {
        if (imagePreview?.src && imagePreview.src !== 'data:') {
          await processImage();
        } else if (urlInputField && urlInputField.value.trim()) {
          await processUrl();
        } else {
          alert('먼저 이미지를 업로드하거나 URL을 입력해주세요.');
        }
      });
    }

    // 보조 UX
    initDragAndDrop();
    initClipboardPaste();
    updateReextractButtonState();

    // 지도 초기화
    if (typeof naver !== 'undefined' && naver.maps) {
      initMap();
    }
  });

  // ====== 공통 UI 유틸 ======
  function showLoading() {
    if (loading) loading.style.display = 'block';
    if (resultContainer) resultContainer.style.display = 'none';
    if (locationList) locationList.innerHTML = '';
  }

  function hideLoading() {
    if (loading) loading.style.display = 'none';
  }

  function showResults(placeNames) {
    hideLoading();
    if (!resultContainer || !locationList) return;

    resultContainer.style.display = 'block';
    locationList.innerHTML = '';

    if (!placeNames || placeNames.length === 0) {
      const li = document.createElement('li');
      li.className = 'list-group-item';
      li.textContent = '추출된 장소가 없습니다.';
      locationList.appendChild(li);
      return;
    }

    placeNames.forEach((name) => {
      const li = document.createElement('li');
      li.className =
        'list-group-item d-flex justify-content-between align-items-center';
      li.textContent = name;
      locationList.appendChild(li);
    });
  }

  function showError(msg) {
    hideLoading();
    if (!resultContainer || !locationList) {
      alert(msg || '오류가 발생했습니다.');
      return;
    }
    resultContainer.style.display = 'block';
    locationList.innerHTML = '';
    const li = document.createElement('li');
    li.className = 'list-group-item text-danger';
    li.textContent = msg || '처리 중 오류가 발생했습니다.';
    locationList.appendChild(li);
  }

  function updateFileSelectionStatus(fileName) {
    const statusEl = document.querySelector('#imageUploadSection .text-muted.small');
    if (statusEl) statusEl.textContent = fileName || '선택된 파일 없음';
    updateReextractButtonState();
  }

  function updateReextractButtonState() {
    if (!processButton) return;
    const hasImage = !!(imagePreview?.src && imagePreview.src !== 'data:');
    const hasUrl = !!(urlInputField && urlInputField.value.trim());
    processButton.disabled = !(hasImage || hasUrl);
    processButton.classList.toggle('btn-warning', hasImage || hasUrl);
    processButton.classList.toggle('btn-secondary', !(hasImage || hasUrl));
  }

  // ====== 입력(이미지/URL) 처리 ======
  function handleImageFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      imagePreview.src = e.target.result;
      imagePreview.style.display = 'block';
      updateFileSelectionStatus(file.name);
      await processImage();
    };
    reader.readAsDataURL(file);
  }

  async function processImage() {
    const file = imageFile?.files?.[0];
    if (!file) {
      alert('이미지 파일을 선택해주세요.');
      return;
    }
    try {
      showLoading();
      // 미리보기의 base64 사용 (api.js의 ocrSpaceImage는 base64를 받음)
      const base64 = imagePreview.src;
      const extractedText = await ocrSpaceImage(base64); // from api.js
      if (!extractedText) throw new Error('이미지에서 텍스트를 추출할 수 없습니다.');

      const places = extractPlaceCandidates(extractedText);
      if (places.length > 0 && typeof markPlacesFromExtracted === 'function') {
        await markPlacesFromExtracted(places); // from api.js
      }
      showResults(places);
    } catch (err) {
      console.error('processImage error:', err);
      showError(err.message || '이미지 처리 중 오류가 발생했습니다.');
    }
  }

  async function processUrl() {
    const url = urlInputField?.value?.trim();
    if (!url) {
      alert('URL을 입력해주세요.');
      return;
    }
    try {
      showLoading();
      const resp = await fetch('http://localhost:3000/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!resp.ok) throw new Error('URL 처리 중 오류가 발생했습니다.');
      const data = await resp.json();

      const text = data?.data?.text || data?.data?.fullText || '';
      if (!text) throw new Error('포스트 내용을 추출할 수 없습니다.');

      const places = extractPlaceCandidates(text);
      if (places.length > 0 && typeof markPlacesFromExtracted === 'function') {
        await markPlacesFromExtracted(places); // from api.js
      }
      showResults(places);
    } catch (err) {
      console.error('processUrl error:', err);
      showError(err.message || 'URL 처리 중 오류가 발생했습니다.');
    } finally {
      updateReextractButtonState();
    }
  }

  // ====== 보조 입력 UX (DnD / Paste) ======
  function initDragAndDrop() {
    const area = document.getElementById('dragDropArea');
    if (!area) return;

    area.addEventListener('dragover', (e) => {
      e.preventDefault();
      area.classList.add('dragover');
    });
    area.addEventListener('dragleave', (e) => {
      e.preventDefault();
      area.classList.remove('dragover');
    });
    area.addEventListener('drop', (e) => {
      e.preventDefault();
      area.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files?.length) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
          // 파일 input에 주입
          const dt = new DataTransfer();
          dt.items.add(file);
          imageFile.files = dt.files;
          handleImageFile(file);
        } else {
          alert('이미지 파일만 드롭 가능합니다.');
        }
      }
    });
    area.addEventListener('click', () => imageFile?.click());
  }

  function initClipboardPaste() {
    document.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items || [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const dt = new DataTransfer();
            dt.items.add(file);
            imageFile.files = dt.files;
            handleImageFile(file);
            break;
          }
        }
      }
    });
  }

  // ====== 장소 후보 추출 (문자열 배열 반환) ======
  function extractPlaceCandidates(text) {
    if (!text || typeof text !== 'string') return [];

    const candidates = [];

    // 매장/상호 라벨 뒤 텍스트
    const storePattern = /(?:매장|상호|업체|가게)\s*[:：]\s*([가-힣A-Za-z0-9\s]+)/g;
    let m;
    while ((m = storePattern.exec(text)) !== null) {
      const name = (m[1] || '').trim();
      if (name.length > 1) candidates.push(name);
    }

    // 도로명 주소 (상대적으로 긴 형태)
    const fullAddr =
      /([가-힣]+(시|도|특별시|광역시)\s+)?[가-힣]+(구|군|시)\s+[가-힣A-Za-z0-9\s\-]+(로|길|대로)\s+\d+[\-\d\s]*(?:[가-힣]|\d)*\s*(?:\d*층)?\s*(?:\d*호)?/g;
    (text.match(fullAddr) || []).forEach((addr) => {
      const clean = addr.trim();
      if (clean.length > 5) candidates.push(clean);
    });

    // 위치/주소 라벨 뒤 텍스트
    const locationPattern =
      /(?:위치|주소|address)\s*[:：]\s*([가-힣A-Za-z0-9\s\-]+(?:로|길|대로)\s*\d+[\s\-\d]*(?:[가-힣]|\d)*(?:\s*\d*층)?\s*(?:\d*호)?)/g;
    while ((m = locationPattern.exec(text)) !== null) {
      const loc = (m[1] || '').trim();
      if (loc.length > 5) candidates.push(loc);
    }

    // 간단 주소 (구 + 동/로/길)
    const simpleAddr = /[가-힣]+(구|군)\s+[가-힣A-Za-z0-9\-]+(동|로|길)\s*\d*/g;
    (text.match(simpleAddr) || []).forEach((addr) => {
      const clean = addr.trim();
      if (clean.length > 3) candidates.push(clean);
    });

    // 해시태그에서 지명/상호 후보
    const hashtag = /#([가-힣A-Za-z0-9]+)/g;
    while ((m = hashtag.exec(text)) !== null) {
      const tag = (m[1] || '').trim();
      if (tag.length > 2) candidates.push(tag);
    }

    // 업종 키워드 포함 상호
    const bizPattern =
      /[가-힣A-Za-z0-9]+(카페|커피|식당|맛집|베이커리|빵집|타르트|케이크|디저트|브런치|레스토랑)/g;
    (text.match(bizPattern) || []).forEach((b) => {
      if (b.length > 2) candidates.push(b.trim());
    });

    // 일반 지형지물 키워드
    const placeKeywords = [
      '역',
      '대학교',
      '대',
      '시청',
      '공원',
      '타워',
      '센터',
      '관',
      '병원',
      '교',
      '마을',
      '시장',
      '공항',
      '터미널',
      '호텔',
      '빌딩',
      '플라자',
      '몰',
      '스퀘어',
      '하우스',
      '맨션',
    ];
    const placePattern = new RegExp(
      `[가-힣A-Za-z0-9]+(${placeKeywords.join('|')})`,
      'g'
    );
    (text.match(placePattern) || []).forEach((p) => {
      if (p.length > 2) candidates.push(p.trim());
    });

    // 후처리: 공백 정리 + 중복 제거
    const unique = [...new Set(candidates.map((c) => c.replace(/\s+/g, ' ').trim()))]
      .filter(Boolean)
      .filter((c) => c.length > 1);

    return unique;
  }

  // ====== 지도 초기화 (api.js에서 window.map을 사용하므로 여기서 세팅) ======
  function initMap() {
    try {
      const defaultLocation = new naver.maps.LatLng(37.5666805, 126.9784147); // 서울시청
      const options = {
        center: defaultLocation,
        zoom: 15,
        zoomControl: true,
        zoomControlOptions: { position: naver.maps.Position.TOP_RIGHT },
      };
      map = new naver.maps.Map('map', options);
      window.map = map;

      naver.maps.Event.once(map, 'init', () => {
        console.log('지도 초기화 완료');
        map.refresh();
      });

      window.addEventListener('resize', () => map?.refresh());
    } catch (e) {
      console.error('지도 초기화 오류:', e);
    }
  }
})();
