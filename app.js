// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', function() {
    // DOM 요소
    const imageInput = document.getElementById('imageInput');
    const urlInput = document.getElementById('urlInput');
    const imageUploadSection = document.getElementById('imageUploadSection');
    const urlInputSection = document.getElementById('urlInputSection');
    const imageFile = document.getElementById('imageFile');
    const urlInputField = document.getElementById('urlInputField');
    const processButton = document.getElementById('processButton');
    const imagePreview = document.getElementById('imagePreview');
    const loading = document.querySelector('.loading');
    const resultContainer = document.querySelector('.result-container');
    const locationList = document.getElementById('locationList');
    window.resultContainer = resultContainer;

    // 입력 방식 전환
    if (imageInput && urlInput) {
        imageInput.addEventListener('change', () => {
            imageUploadSection.style.display = 'block';
            urlInputSection.style.display = 'none';
        });

        urlInput.addEventListener('change', () => {
            imageUploadSection.style.display = 'none';
            urlInputSection.style.display = 'block';
        });
    }

    // 이미지 미리보기
    if (imageFile) {
        imageFile.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                handleImageFile(file);
            }
        });
    }
    
    // 재추출 버튼 초기 상태 설정
    updateReextractButtonState();
    
    // 드래그앤드롭 기능 초기화
    initDragAndDrop();
    
    // 클립보드 붙여넣기 기능 초기화
    initClipboardPaste();

    // 재추출 버튼 클릭 이벤트
    if (processButton) {
        processButton.addEventListener('click', async () => {
            // 현재 이미지가 있는지 확인
            if (imagePreview.src && imagePreview.src !== 'data:') {
                console.log('재추출 시작: 이미지 재처리...');
                await processImage();
            } else if (urlInputField && urlInputField.value.trim()) {
                console.log('재추출 시작: URL 재처리...');
                await processUrl();
            } else {
                alert('재추출할 이미지나 URL이 없습니다.\n먼저 이미지를 업로드하거나 URL을 입력해주세요.');
            }
        });
    }

    // 지도 초기화
    if (typeof naver !== 'undefined' && naver.maps) {
        initMap();
    }
});

// 이미지 파일 처리 함수
function handleImageFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드 가능합니다.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        imagePreview.src = e.target.result;
        imagePreview.style.display = 'block';
        
        // 파일 선택 상태 업데이트
        updateFileSelectionStatus(file.name);
        
        // 이미지 업로드 시 자동으로 OCR 처리 시작
        console.log('이미지 업로드 완료, 자동 OCR 처리 시작...');
        await processImage();
    };
    reader.readAsDataURL(file);
}

// 파일 선택 상태 업데이트
function updateFileSelectionStatus(fileName) {
    const statusElement = document.querySelector('#imageUploadSection .text-muted.small');
    if (statusElement) {
        statusElement.textContent = fileName || '선택된 파일 없음';
    }
    
    // 재추출 버튼 상태 업데이트
    updateReextractButtonState();
}

// 재추출 버튼 상태 업데이트
function updateReextractButtonState() {
    const processButton = document.getElementById('processButton');
    if (!processButton) return;
    
    const hasImage = imagePreview && imagePreview.src && imagePreview.src !== 'data:';
    const hasUrl = urlInputField && urlInputField.value.trim();
    
    if (hasImage || hasUrl) {
        processButton.disabled = false;
        processButton.classList.remove('btn-secondary');
        processButton.classList.add('btn-warning');
    } else {
        processButton.disabled = true;
        processButton.classList.remove('btn-warning');
        processButton.classList.add('btn-secondary');
    }
}

// 드래그앤드롭 기능 초기화
function initDragAndDrop() {
    const dragDropArea = document.getElementById('dragDropArea');
    if (!dragDropArea) return;
    
    // 드래그 이벤트
    dragDropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dragDropArea.classList.add('dragover');
    });
    
    dragDropArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragDropArea.classList.remove('dragover');
    });
    
    dragDropArea.addEventListener('drop', async (e) => {
        e.preventDefault();
        dragDropArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        const items = e.dataTransfer.items;
        
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                // 파일 입력 필드에 파일 설정
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                imageFile.files = dataTransfer.files;
                
                // 이미지 처리 및 자동 OCR 시작
                handleImageFile(file);
            } else {
                alert('이미지 파일만 드롭 가능합니다.');
            }
        } else if (items.length > 0) {
            // 링크 드롭 감지
            for (let item of items) {
                if (item.type === 'text/plain') {
                    item.getAsString(async (text) => {
                        if (isValidUrl(text)) {
                            console.log('드롭된 URL 감지:', text);
                            
                            // 자동 처리 설정 확인
                            const autoProcessToggle = document.getElementById('autoProcessToggle');
                            if (autoProcessToggle && autoProcessToggle.checked) {
                                // Instagram 링크는 즉시 자동 처리
                                if (text.includes('instagram.com')) {
                                    console.log('Instagram 링크 자동 처리 시작...');
                                    await autoProcessUrl(text);
                                } else {
                                    // 일반 링크는 사용자에게 확인
                                    if (confirm(`링크를 자동으로 처리하시겠습니까?\n\n${text}`)) {
                                        await autoProcessUrl(text);
                                    }
                                }
                            }
                            
                            // URL 입력 필드에 자동 입력
                            if (urlInputField) {
                                urlInputField.value = text;
                                // URL 입력 섹션으로 자동 전환
                                if (urlInput) {
                                    urlInput.checked = true;
                                    urlInputSection.style.display = 'block';
                                    imageUploadSection.style.display = 'none';
                                }
                            }
                        }
                    });
                    break;
                }
            }
        }
    });
    
    // 클릭으로도 파일 선택 가능
    dragDropArea.addEventListener('click', () => {
        imageFile.click();
    });
}

// 클립보드 붙여넣기 기능 초기화
function initClipboardPaste() {
    document.addEventListener('paste', async (e) => {
        const items = e.clipboardData.items;
        let processed = false;
        
        for (let item of items) {
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    // 파일 입력 필드에 파일 설정
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    imageFile.files = dataTransfer.files;
                    
                    // 이미지 처리 및 자동 OCR 시작
                    handleImageFile(file);
                    processed = true;
                    break;
                }
            } else if (item.type === 'text/plain') {
                // 텍스트 클립보드 감지
                item.getAsString(async (text) => {
                    if (isValidUrl(text)) {
                        console.log('클립보드에서 URL 감지:', text);
                        
                        // 자동 처리 설정 확인
                        const autoProcessToggle = document.getElementById('autoProcessToggle');
                        if (autoProcessToggle && autoProcessToggle.checked) {
                            // Instagram 링크는 즉시 자동 처리
                            if (text.includes('instagram.com')) {
                                console.log('Instagram 링크 자동 처리 시작...');
                                await autoProcessUrl(text);
                            } else {
                                // 일반 링크는 사용자에게 확인
                                if (confirm(`링크를 자동으로 처리하시겠습니까?\n\n${text}`)) {
                                    await autoProcessUrl(text);
                                }
                            }
                        }
                        
                        // URL 입력 필드에 자동 입력
                        if (urlInputField) {
                            urlInputField.value = text;
                            // URL 입력 섹션으로 자동 전환
                            if (urlInput) {
                                urlInput.checked = true;
                                urlInputSection.style.display = 'block';
                                imageUploadSection.style.display = 'none';
                            }
                        }
                    }
                });
                processed = true;
            }
        }
        
        if (processed) {
            e.preventDefault();
        }
    });
}

// URL 유효성 검사 함수
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// 자동 URL 처리 함수
async function autoProcessUrl(url) {
    try {
        console.log('자동 URL 처리 시작:', url);
        showLoading();
        
        // URL에서 텍스트 추출
        const response = await fetch('http://localhost:3000/extract', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });
        
        if (!response.ok) {
            throw new Error('URL 처리 중 오류가 발생했습니다.');
        }
        
        const data = await response.json();
        const text = data.data && data.data.text ? data.data.text : '';
        
        // 장소명 후보 추출 및 지도에 마커 표시
        const places = extractPlaceCandidates(text);
        if (places.length > 0) {
            // 마커 표시가 완료된 후에 로딩 숨기기
            await markPlacesFromExtracted(places);
        }
        
        showResults(places);
        hideLoading();
        
        // 성공 메시지
        showSuccessMessage(`링크가 자동으로 처리되었습니다! ${places.length}개의 장소를 발견했습니다.`);
        
    } catch (error) {
        console.error('자동 URL 처리 중 오류:', error);
        hideLoading();
        showError('자동 처리 중 오류가 발생했습니다: ' + error.message);
    }
}

// 장소명 후보 추출 함수 (Instagram 텍스트 최적화)
function extractPlaceCandidates(text) {
    console.log('장소 추출 대상 텍스트:', text);
    
    const candidates = [];
    
    // 1. 매장명 패턴 (▪️매장: 뒤에 오는 이름)
    const storePattern = /(?:매장|상호|업체|가게)\s*[:：]\s*([가-힣A-Za-z0-9\s]+)/g;
    let storeMatch;
    while ((storeMatch = storePattern.exec(text)) !== null) {
        const storeName = storeMatch[1].trim();
        if (storeName.length > 1) {
            candidates.push(storeName);
            console.log('매장명 발견:', storeName);
        }
    }
    
    // 2. 완전한 주소 패턴 (도로명 주소)
    const fullAddressPattern = /([가-힣]+(시|도|특별시|광역시)\s+)?[가-힣]+(구|군|시)\s+[가-힣A-Za-z0-9\s\-]+(로|길|대로)\s+\d+[\-\d\s]*(?:[가-힣]|\d)*\s*(?:\d*층)?\s*(?:\d*호)?/g;
    const fullAddresses = text.match(fullAddressPattern) || [];
    fullAddresses.forEach(addr => {
        const cleanAddr = addr.trim();
        if (cleanAddr.length > 5) {
            candidates.push(cleanAddr);
            console.log('완전한 주소 발견:', cleanAddr);
        }
    });
    
    // 3. 위치 정보 패턴 (▪️위치: 뒤에 오는 주소)
    const locationPattern = /(?:위치|주소|address)\s*[:：]\s*([가-힣A-Za-z0-9\s\-]+(?:로|길|대로)\s*\d+[\s\-\d]*(?:[가-힣]|\d)*(?:\s*\d*층)?\s*(?:\d*호)?)/g;
    let locationMatch;
    while ((locationMatch = locationPattern.exec(text)) !== null) {
        const location = locationMatch[1].trim();
        if (location.length > 5) {
            candidates.push(location);
            console.log('위치 정보 발견:', location);
        }
    }
    
    // 4. 단순 주소 패턴 (구+동/로/길 조합)
    const simpleAddressPattern = /[가-힣]+(구|군)\s+[가-힣A-Za-z0-9\-]+(동|로|길)\s*\d*/g;
    const simpleAddresses = text.match(simpleAddressPattern) || [];
    simpleAddresses.forEach(addr => {
        const cleanAddr = addr.trim();
        if (cleanAddr.length > 3) {
            candidates.push(cleanAddr);
            console.log('단순 주소 발견:', cleanAddr);
        }
    });
    
    // 5. 해시태그에서 장소명 추출
    const hashtagPattern = /#([가-힣A-Za-z0-9]+)/g;
    let hashMatch;
    while ((hashMatch = hashtagPattern.exec(text)) !== null) {
        const hashtag = hashMatch[1];
        if (hashtag.length > 2) {
            candidates.push(hashtag);
            console.log('해시태그 장소 발견:', hashtag);
        }
    }
    
    // 6. 일반적인 상호명 패턴 (카페, 식당 등)
    const businessPattern = /[가-힣A-Za-z0-9]+(카페|커피|식당|맛집|베이커리|빵집|타르트|케이크|디저트|브런치|레스토랑)/g;
    const businesses = text.match(businessPattern) || [];
    businesses.forEach(business => {
        if (business.length > 2) {
            candidates.push(business);
            console.log('상호명 발견:', business);
        }
    });
    
    // 7. 특정 키워드가 포함된 장소명
    const placeKeywords = ['역', '대학교', '대', '시청', '공원', '타워', '센터', '관', '병원', '교', '마을', '시장', '공항', '터미널', '호텔', '빌딩', '플라자', '몰', '스퀘어', '하우스', '맨션'];
    const placePattern = new RegExp(`[가-힣A-Za-z0-9]+(${placeKeywords.join('|')})`, 'g');
    const places = text.match(placePattern) || [];
    places.forEach(place => {
        if (place.length > 2) {
            candidates.push(place);
            console.log('키워드 장소 발견:', place);
        }
    });
    
    // 중복 제거 및 정리
    const uniqueCandidates = [...new Set(candidates)]
        .filter(candidate => candidate.length > 1)
        .map(candidate => candidate.replace(/\s+/g, ' ').trim());
    
    console.log('최종 장소 후보들:', uniqueCandidates);
    return uniqueCandidates;
}

// 이미지 처리
async function processImage() {
    const file = imageFile.files[0];
    if (!file) {
        alert('이미지 파일을 선택해주세요.');
        return;
    }

    try {
        showLoading();
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                console.log('=== 이미지 처리 시작 ===');
                // OCR로 텍스트 추출
                const extractedText = await ocrSpaceImage(e.target.result);
                console.log('OCR 추출 결과:', extractedText);
                
                if (!extractedText) {
                    throw new Error('이미지에서 텍스트를 추출할 수 없습니다.');
                }

                // 장소명 후보 추출 및 지도에 마커 표시
                const places = extractPlaceCandidates(extractedText);
                console.log('추출된 장소명 후보:', places);
                console.log('추출된 장소명 후보 (상세):', JSON.stringify(places, null, 2));
                
                if (places.length > 0) {
                    console.log('지도에 마커 표시 시작...');
                    await markPlacesFromExtracted(places);
                } else {
                    console.log('추출된 장소명이 없습니다.');
                }
                showResults(places);
                hideLoading();
            } catch (error) {
                console.error('이미지 처리 중 오류:', error);
                showError(error.message);
            }
        };
        reader.readAsDataURL(file);
    } catch (error) {
        console.error('이미지 처리 오류:', error);
        showError(error.message);
    }
}

// URL 처리
async function processUrl() {
    const url = urlInputField.value.trim();
    if (!url) {
        alert('URL을 입력해주세요.');
        return;
    }

    try {
        showLoading();
        console.log('=== URL 처리 시작 ===');
        console.log('요청 URL:', url);
        
        // URL에서 텍스트 추출 (서버에서 처리)
        const response = await fetch('http://localhost:3000/extract', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        console.log('서버 응답 상태:', response.status);
        
        if (!response.ok) {
            throw new Error('URL 처리 중 오류가 발생했습니다.');
        }

        const data = await response.json();
        console.log('서버 응답 데이터:', data);
        
        const text = data.data && data.data.text ? data.data.text : '';
        console.log('추출된 텍스트:', text);
        
        // 장소명 후보 추출 및 지도에 마커 표시
        const places = extractPlaceCandidates(text);
        console.log('추출된 장소명 후보:', places);
        
        if (places.length > 0) {
            console.log('지도에 마커 표시 시작...');
            await markPlacesFromExtracted(places);
        } else {
            console.log('추출된 장소명이 없습니다.');
        }
        showResults(places);
        hideLoading();
    } catch (error) {
        console.error('URL 처리 중 오류:', error);
        showError(error.message);
    }
}

// 네이버 지도 초기화
let map;
let markers = [];
let infoWindows = [];

function initMap() {
    try {
        // 기본 위치 (서울시청)
        const defaultLocation = new naver.maps.LatLng(37.5666805, 126.9784147);
        
        // 지도 옵션
        const mapOptions = {
            center: defaultLocation,
            zoom: 15,
            zoomControl: true,
            zoomControlOptions: {
                position: naver.maps.Position.TOP_RIGHT
            }
        };

        // 지도 생성
        window.map = new naver.maps.Map('map', mapOptions);
        
        // 마커 배열 초기화
        window.markers = [];
        window.infoWindows = [];

        // 지도 로드 완료 이벤트
        naver.maps.Event.once(window.map, 'init', function() {
            console.log('지도 초기화 완료');
            window.map.refresh();
        });

        // 지도 크기 조정 이벤트
        window.addEventListener('resize', function() {
            if (window.map) {
                window.map.refresh();
            }
        });

    } catch (error) {
        console.error('지도 초기화 중 오류 발생:', error);
    }
}

// 마커 생성 함수
function createMarker(location) {
    if (!location.coordinates) return null;

    const position = new naver.maps.LatLng(location.coordinates.lat, location.coordinates.lng);
    
    // 마커 생성
    const marker = new naver.maps.Marker({
        position: position,
        map: window.map,
        title: location.name
    });

    // 정보창 내용 생성
    const contentString = [
        '<div class="iw_inner">',
        `   <h3>${location.name}</h3>`,
        `   <p>${location.type || '기타'}<br />`,
        location.coordinates.address ? 
            `       ${location.coordinates.address}<br />` : '',
        '   </p>',
        '</div>'
    ].join('');

    // 정보창 생성
    const infoWindow = new naver.maps.InfoWindow({
        content: contentString,
        maxWidth: 300,
        backgroundColor: "#fff",
        borderColor: "#b39ddb",
        borderWidth: 2,
        anchorSize: new naver.maps.Size(10, 10),
        anchorSkew: true,
        anchorColor: "#fff",
        pixelOffset: new naver.maps.Point(10, -10)
        });

    // 마커 클릭 이벤트
    naver.maps.Event.addListener(marker, 'click', () => {
        // 다른 정보창 닫기
        window.infoWindows.forEach(iw => iw.close());
        // 현재 정보창 열기
        infoWindow.open(window.map, marker);
    });

    window.infoWindows.push(infoWindow);
    return marker;
}

// 주소 전처리 함수
function preprocessText(text) {
    return text
        .replace(/\s+/g, ' ') // 여러 공백을 하나로
        .replace(/[^\w\s가-힣\-]/g, ' ') // 특수문자 제거 (하이픈은 유지)
        .trim();
}

// 주소 후처리 함수
function postprocessAddress(address) {
    return address
        .replace(/\s+/g, ' ') // 여러 공백을 하나로
        .replace(/(\d+)([가-힣])/g, '$1 $2') // 숫자와 한글 사이에 공백 추가
        .replace(/([가-힣])(\d+)/g, '$1 $2') // 한글과 숫자 사이에 공백 추가
        .trim();
}

// 주소 유효성 검사 함수
function isValidAddress(address) {
    // 최소 길이 체크
    if (address.length < 5) return false;
    
    // 필수 요소 체크 (시/도, 구/군 중 하나는 있어야 함)
    const hasCity = /(시|도)/.test(address);
    const hasDistrict = /(구|군)/.test(address);
    if (!hasCity && !hasDistrict) return false;
    
    // 숫자가 포함되어야 함
    if (!/\d+/.test(address)) return false;
    
    return true;
}

// OCR로 추출한 텍스트에서 주소 후보 추출
function extractAddressCandidates(text) {
    // 텍스트 전처리
    const preprocessedText = preprocessText(text);
    
    const patterns = [
        // 도로명 주소 패턴
        /([가-힣A-Za-z0-9]+(시|도|특별시|광역시)\s*)?[가-힣A-Za-z0-9]+(구|군|시)\s*[가-힣A-Za-z0-9\-]+(로|길|대로|거리)\s*\d+(?:[가-힣]|\s*\d*)?/g,
        
        // 지번 주소 패턴
        /([가-힣A-Za-z0-9]+(시|도|특별시|광역시)\s*)?[가-힣A-Za-z0-9]+(구|군|시)\s*[가-힣A-Za-z0-9]+(동|읍|면|가)\s*\d+[\-\d]*(?:[가-힣]|\s*\d*)?/g,
        
        // 건물명이 포함된 주소 패턴
        /([가-힣A-Za-z0-9]+(시|도|특별시|광역시)\s*)?[가-힣A-Za-z0-9]+(구|군|시)\s*[가-힣A-Za-z0-9\-]+(로|길|대로|거리)\s*\d+(?:[가-힣]|\s*\d*)?\s*[가-힣A-Za-z0-9]+(빌딩|아파트|타워|센터|몰|플라자|스퀘어|하우스|빌라|맨션)/g,
        
        // 간단한 주소 패턴 (시/구/동만 있는 경우)
        /([가-힣A-Za-z0-9]+(시|도|특별시|광역시)\s*)?[가-힣A-Za-z0-9]+(구|군|시)\s*[가-힣A-Za-z0-9]+(동|읍|면|가)\s*\d+/g
    ];
    
    // 모든 패턴에서 주소 추출
    let candidates = patterns.flatMap(pattern => preprocessedText.match(pattern) || []);
    
    // 중복 제거 및 후처리
    candidates = [...new Set(candidates)]
        .map(postprocessAddress)
        .filter(isValidAddress);
    
    // 주소 정렬 (길이가 긴 주소를 우선)
    candidates.sort((a, b) => b.length - a.length);
    
    return candidates;
}

// 기존의 extractLocations 함수 수정
async function extractLocations(text) {
    try {
        const response = await fetch('/api/extract-locations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });

        if (!response.ok) {
            throw new Error('위치 정보 추출 실패');
        }

        const data = await response.json();
        
        // 기존 마커 제거
        markers.forEach(marker => marker.setMap(null));
        markers = [];
        infoWindows = [];

        // 결과 표시
        resultContainer.style.display = 'block';
        locationList.innerHTML = '';

        if (data.locations && data.locations.length > 0) {
            // 지도 중심점을 첫 번째 위치로 설정
            if (data.locations[0].coordinates) {
                map.setCenter(new naver.maps.LatLng(
                    data.locations[0].coordinates.lat,
                    data.locations[0].coordinates.lng
                ));
                map.setZoom(15);
            }

            data.locations.forEach(location => {
                // 마커 생성
                if (location.coordinates) {
                    const marker = createMarker(location);
                    if (marker) markers.push(marker);
                }

                // 리스트 아이템 생성
                const li = document.createElement('li');
                li.className = 'list-group-item';
                li.innerHTML = `
                    <div class="location-item">
                        <span class="location-name">${location.name}</span>
                        <span class="location-type">${location.type || '기타'}</span>
                        ${location.coordinates ? 
                            `<p class="location-address">${location.coordinates.address}</p>` 
                            : ''}
                    </div>
                `;
                locationList.appendChild(li);
            });
        } else {
            locationList.innerHTML = '<li class="list-group-item">추출된 장소가 없습니다.</li>';
        }

        return data.locations;
    } catch (error) {
        console.error('위치 정보 추출 중 오류:', error);
        resultContainer.style.display = 'block';
        locationList.innerHTML = `<li class="list-group-item text-danger">${error.message}</li>`;
        return [];
    }
}

// 결과 표시
function showResults(locations) {
    resultContainer.style.display = 'block';
    locationList.innerHTML = '';

    if (!locations || locations.length === 0) {
        locationList.innerHTML = '<li class="list-group-item">추출된 장소가 없습니다.</li>';
        return;
    }

    // 문자열 배열(장소명)일 경우
    if (typeof locations[0] === 'string') {
        locations.forEach(place => {
            const li = document.createElement('li');
            li.className = 'list-group-item location-card';
            li.innerHTML = `
                <div class="location-card-content">
                    <div class="location-header">
                        <div class="location-icon">
                            <i class="bi bi-geo-alt-fill"></i>
                        </div>
                        <div class="location-info">
                            <h5 class="location-name">${place}</h5>
                            <p class="location-address">도로명 주소 정보를 가져오는 중...</p>
                        </div>
                    </div>
                    <div class="location-actions">
                        <button class="btn btn-sm btn-success save-btn">
                            <i class="bi bi-bookmark-plus"></i> 저장
                        </button>
                        <button class="btn btn-sm btn-outline-primary map-btn" onclick="searchAndShowOnMap('${place}')">
                            <i class="bi bi-map"></i> 지도에서 보기
                        </button>
                    </div>
                </div>
            `;
            locationList.appendChild(li);
            
            // 저장 버튼 이벤트 추가
            const saveBtn = li.querySelector('.save-btn');
            saveBtn.addEventListener('click', () => {
                savePlace(place);
            });
        });
        return;
    }

    // 객체 배열(기존 방식)일 경우
    locations.forEach(location => {
        const li = document.createElement('li');
        li.className = 'list-group-item location-card';
        li.innerHTML = `
            <div class="location-card-content">
                <div class="location-header">
                    <div class="location-icon">
                        <i class="bi bi-geo-alt-fill"></i>
                    </div>
                    <div class="location-info">
                        <h5 class="location-name">${location.name}</h5>
                        <p class="location-address">
                            ${location.coordinates && location.coordinates.address ? 
                                location.coordinates.address : '도로명 주소 정보를 가져오는 중...'}
                        </p>
                        ${location.type ? `<span class="location-type">${location.type}</span>` : ''}
                    </div>
                </div>
                <div class="location-actions">
                    <button class="btn btn-sm btn-success save-btn">
                        <i class="bi bi-bookmark-plus"></i> 저장
                    </button>
                    ${location.coordinates ? 
                        `<button class="btn btn-sm btn-outline-primary map-btn" onclick="showOnMap('${location.name}', ${location.coordinates.lat}, ${location.coordinates.lng})">
                            <i class="bi bi-map"></i> 지도에서 보기
                        </button>` 
                        : `<button class="btn btn-sm btn-outline-primary map-btn" onclick="searchAndShowOnMap('${location.name}')">
                            <i class="bi bi-map"></i> 지도에서 보기
                        </button>`
                    }
                </div>
            </div>
        `;
        locationList.appendChild(li);
        
        // 저장 버튼 이벤트 추가
        const saveBtn = li.querySelector('.save-btn');
        saveBtn.addEventListener('click', () => {
            savePlace(location.name, location.type, location.coordinates);
        });
    });
}

// 장소 저장 함수
function savePlace(name, type = '', coordinates = null) {
    const place = {
        name: name,
        type: type,
        coordinates: coordinates,
        createdAt: new Date().toISOString(),
        region: coordinates ? inferRegion(coordinates.address) : '',
        category: inferCategory(name, type)
    };
    
    upsertPlace(place);
    renderMyPlaces();
    
    // 저장 성공 메시지
    const saveBtn = event.target.closest('.save-btn');
    if (saveBtn) {
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<i class="bi bi-check"></i> 저장됨';
        saveBtn.classList.remove('btn-success');
        saveBtn.classList.add('btn-secondary');
        saveBtn.disabled = true;
        
        setTimeout(() => {
            saveBtn.innerHTML = originalText;
            saveBtn.classList.remove('btn-secondary');
            saveBtn.classList.add('btn-success');
            saveBtn.disabled = false;
        }, 2000);
    }
}

// 지도에서 검색하여 표시하는 함수
async function searchAndShowOnMap(placeName) {
    try {
        const response = await fetch(`/search-place?query=${encodeURIComponent(placeName)}`);
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            const item = data.items[0];
            const lat = parseFloat(item.mapy) / 1e7;
            const lng = parseFloat(item.mapx) / 1e7;
            
            // 지도에 마커 표시
            showOnMap(placeName, lat, lng, item.address);
            
            // 해당 장소 카드의 주소 정보 업데이트
            updatePlaceAddress(placeName, item.address);
        } else {
            alert('해당 장소를 찾을 수 없습니다.');
        }
    } catch (error) {
        console.error('장소 검색 실패:', error);
        alert('장소 검색에 실패했습니다.');
    }
}

// 지도에 표시하는 함수
function showOnMap(placeName, lat, lng, address = '') {
    if (typeof naver !== 'undefined' && naver.maps && window.map) {
        // 기존 마커들 제거
        if (window.markers) {
            window.markers.forEach(marker => marker.setMap(null));
        }
        window.markers = [];
        
        // 새로운 마커 생성
        const marker = new naver.maps.Marker({
            position: new naver.maps.LatLng(lat, lng),
            map: window.map,
            icon: {
                content: '<div class="custom-marker"><i class="bi bi-geo-alt-fill"></i></div>',
                size: new naver.maps.Size(40, 40),
                anchor: new naver.maps.Point(20, 20)
            }
        });
        
        window.markers.push(marker);
        
        // 지도 중심 이동
        window.map.setCenter(new naver.maps.LatLng(lat, lng));
        window.map.setZoom(15);
        
        // 정보창 표시
        const infoWindow = new naver.maps.InfoWindow({
            content: `
                <div class="info-window">
                    <h3>${placeName}</h3>
                    ${address ? `<p class="address">${address}</p>` : ''}
                </div>
            `,
            maxWidth: 200,
            backgroundColor: "#fff",
            borderColor: "#b39ddb",
            borderWidth: 2,
            anchorSize: new naver.maps.Size(20, 20),
            anchorColor: "#fff",
            pixelOffset: new naver.maps.Point(0, -20)
        });
        
        infoWindow.open(window.map, marker);
        
        // 마커 클릭 시 정보창 토글
        naver.maps.Event.addListener(marker, 'click', function() {
            if (infoWindow.getMap()) {
                infoWindow.close();
            } else {
                infoWindow.open(window.map, marker);
            }
        });
    }
}

// 장소 카드의 주소 정보 업데이트
function updatePlaceAddress(placeName, address) {
    const locationCards = document.querySelectorAll('.location-card');
    locationCards.forEach(card => {
        const nameElement = card.querySelector('.location-name');
        if (nameElement && nameElement.textContent === placeName) {
            const addressElement = card.querySelector('.location-address');
            if (addressElement) {
                addressElement.textContent = address;
            }
        }
    });
}

// 로딩 표시
function showLoading() {
    const loading = document.querySelector('.loading');
    if (loading) loading.style.display = 'block';
}

// 로딩 숨기기
function hideLoading() {
    const loading = document.querySelector('.loading');
    if (loading) loading.style.display = 'none';
}

// 에러 표시
function showError(message) {
    hideLoading();
    alert(message);
}

// 성공 메시지 표시
function showSuccessMessage(message) {
    hideLoading();
    
    // 성공 메시지 토스트 생성
    const toast = document.createElement('div');
    toast.className = 'alert alert-success alert-dismissible fade show position-fixed';
    toast.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    toast.innerHTML = `
        <i class="bi bi-check-circle me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(toast);
    
    // 5초 후 자동 제거
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 5000);
} 

const MY_PLACES_KEY = 'myPlaces:v1';
let myPlaces = loadMyPlaces();
const myPlaceListEl = document.getElementById('myPlaceList');
const myListSortByEl = document.getElementById('myListSortBy');
const myListOrderEl  = document.getElementById('myListOrder');

function loadMyPlaces() {
  try {
    return JSON.parse(localStorage.getItem(MY_PLACES_KEY)) || [];
  } catch {
    return [];
  }
}

function persistMyPlaces() {
  localStorage.setItem(MY_PLACES_KEY, JSON.stringify(myPlaces));
}

function inferRegion(address) {
  if (!address) return '';
  // 우선 '구/군'을 잡고, 없으면 시/시·도
  const m1 = address.match(/[가-힣A-Za-z]+(구|군)/);
  if (m1) return m1[0];
  const m2 = address.match(/[가-힣A-Za-z]+(시|특별시|광역시|도)/);
  if (m2) return m2[0];
  return '';
}

function inferCategory(name = '', type = '') {
  const source = `${name} ${type}`.toLowerCase();
  if (/(카페|coffee|브런치|디저트|베이커리|빵|tart|케이크)/i.test(source)) return '카페/디저트';
  if (/(맛집|식당|레스토랑|밥집|한식|중식|일식|양식|고기|포차|분식|숯불|bar|pub)/i.test(source)) return '음식점';
  if (/(호텔|모텔|게스트하우스|리조트)/i.test(source)) return '숙박';
  if (/(공원|시장|플라자|몰|스퀘어|타워|갤러리|박물관)/i.test(source)) return '명소/여가';
  return type || '기타';
}

function upsertPlace(place) {
  // place: {id?, name, address, lat, lng, region, category, createdAt}
  const key = (place.name || '') + '|' + (place.address || '');
  const idx = myPlaces.findIndex(p => ((p.name||'')+'|'+(p.address||'')) === key);
  if (idx >= 0) {
    myPlaces[idx] = { ...myPlaces[idx], ...place }; // 업데이트
  } else {
    myPlaces.push(place);
  }
  persistMyPlaces();
  renderMyPlaces();
}

function removePlaceAt(i) {
  myPlaces.splice(i, 1);
  persistMyPlaces();
  renderMyPlaces();
}

function sortMyPlaces(list, sortBy, order) {
  const sign = order === 'asc' ? 1 : -1;
  return list.slice().sort((a, b) => {
    let va, vb;
    switch (sortBy) {
      case 'region':   va = a.region || ''; vb = b.region || ''; break;
      case 'category': va = a.category || ''; vb = b.category || ''; break;
      case 'name':     va = a.name || ''; vb = b.name || ''; break;
      default:         va = a.createdAt || 0; vb = b.createdAt || 0;
    }
    if (va < vb) return -1 * sign;
    if (va > vb) return  1 * sign;
    return 0;
  });
}

function renderMyPlaces() {
  if (!myPlaceListEl) return;
  const sortBy = myListSortByEl?.value || 'createdAt';
  const order  = myListOrderEl?.value  || 'desc';
  const sorted = sortMyPlaces(myPlaces, sortBy, order);

  myPlaceListEl.innerHTML = '';
  if (sorted.length === 0) {
    myPlaceListEl.innerHTML = '<li class="list-group-item">아직 저장된 장소가 없습니다.</li>';
    return;
  }

  sorted.forEach((p, i) => {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-start';
    li.innerHTML = `
      <div>
        <div class="fw-bold">${p.name || '(이름 없음)'}</div>
        ${p.address ? `<div class="text-muted small">${p.address}</div>` : ''}
        <div class="small mt-1">
          <span class="badge bg-light text-dark me-2">지역: ${p.region || '-'}</span>
          <span class="badge bg-secondary">카테고리: ${p.category || '-'}</span>
        </div>
      </div>
      <div class="d-flex gap-2">
        ${p.lat && p.lng ? `<a class="btn btn-sm btn-outline-primary" target="_blank"
            href="https://www.google.com/maps?q=${p.lat},${p.lng}">지도</a>` : ''}
        <button class="btn btn-sm btn-outline-danger" data-remove="${i}">삭제</button>
      </div>
    `;
    myPlaceListEl.appendChild(li);
  });

  // 삭제 핸들러
  myPlaceListEl.querySelectorAll('button[data-remove]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = Number(e.currentTarget.getAttribute('data-remove'));
      removePlaceAt(idx);
    });
  });
}

// 정렬 컨트롤 이벤트
if (myListSortByEl) myListSortByEl.addEventListener('change', renderMyPlaces);
if (myListOrderEl)  myListOrderEl.addEventListener('change', renderMyPlaces);

// 초기 렌더
renderMyPlaces();

/***** =========================
 *   결과 리스트에 "저장" 버튼
 * ========================= *****/

// 장소명만 있는 경우(문자열 배열) → 네이버 검색으로 좌표/주소 resolve 후 저장
async function resolvePlaceViaNaver(query) {
  try {
    const res = await fetch('/search-place?query=' + encodeURIComponent(query));
    const data = await res.json();
    if (!data.items || data.items.length === 0) return null;

    const item = data.items[0];
    const lng = parseFloat(item.mapx) / 1e7;
    const lat = parseFloat(item.mapy) / 1e7;

    const name = (item.title || '').replace(/<[^>]*>/g, '');
    const address = item.roadAddress || item.address || '';
    return {
      name,
      address,
      lat,
      lng,
      region: inferRegion(address),
      category: inferCategory(name),
    };
  } catch (e) {
    console.error('resolvePlaceViaNaver error:', e);
    return null;
  }
}

// 원래 showResults를 확장: 저장 버튼 이벤트 리스너 추가
const _origShowResults = showResults;
showResults = function(locations) {
  _origShowResults(locations);

  const listEl = document.getElementById('locationList');
  if (!listEl) return;

  // 문자열 배열(장소명만)
  if (Array.isArray(locations) && locations[0] && typeof locations[0] === 'string') {
    // 각 li에 저장 버튼 이벤트 리스너 추가
    Array.from(listEl.children).forEach((li, idx) => {
      const placeName = locations[idx];
      const btn = li.querySelector('button.btn-success');
      if (btn) {
        btn.addEventListener('click', async () => {
          const resolved = await resolvePlaceViaNaver(placeName);
          const now = Date.now();
          const payload = resolved ? {
            ...resolved,
            createdAt: now
          } : {
            name: placeName,
            address: '',
            lat: null, lng: null,
            region: '',
            category: inferCategory(placeName),
            createdAt: now
          };
          upsertPlace(payload);
          
          // 주소 정보 업데이트
          if (resolved && resolved.address) {
            const addressElement = li.querySelector('.location-address');
            if (addressElement) {
              addressElement.textContent = resolved.address;
            }
          }
          
          alert('리스트에 저장했습니다.');
        });
      }
    });
    return;
  }

  // 객체 배열({ name, type, coordinates:{lat,lng,address}... })
  Array.from(listEl.children).forEach((li, idx) => {
    const loc = locations[idx];
    const btn = li.querySelector('button.btn-success');
    
    if (btn) {
      btn.addEventListener('click', () => {
        const lat = loc?.coordinates?.lat ?? null;
        const lng = loc?.coordinates?.lng ?? null;
        const address = loc?.coordinates?.address ?? '';
        const payload = {
          name: loc.name || '(이름 없음)',
          address,
          lat, lng,
          region: inferRegion(address),
          category: inferCategory(loc.name, loc.type),
          createdAt: Date.now()
        };
        upsertPlace(payload);
        alert('리스트에 저장했습니다.');
      });
    }
  });
};

// 장소를 지도에 표시하는 함수 (기존 함수와 통합)
function markOnMap(placeName, lat, lng, address = '') {
    if (typeof naver !== 'undefined' && naver.maps && window.map) {
        // 기존 마커들 제거
        if (window.markers) {
            window.markers.forEach(marker => marker.setMap(null));
        }
        window.markers = [];
        
        // 새로운 마커 생성
        const marker = new naver.maps.Marker({
            position: new naver.maps.LatLng(lat, lng),
            map: window.map,
            icon: {
                content: '<div class="custom-marker"><i class="bi bi-geo-alt-fill"></i></div>',
                size: new naver.maps.Size(40, 40),
                anchor: new naver.maps.Point(20, 20)
            }
        });
        
        window.markers.push(marker);
        
        // 지도 중심 이동
        window.map.setCenter(new naver.maps.LatLng(lat, lng));
        window.map.setZoom(15);
        
        // 정보창 표시
        const infoWindow = new naver.maps.InfoWindow({
            content: `
                <div class="info-window">
                    <h3>${placeName}</h3>
                    ${address ? `<p class="address">${address}</p>` : ''}
                </div>
            `,
            maxWidth: 200,
            backgroundColor: "#fff",
            borderColor: "#b39ddb",
            borderWidth: 2,
            anchorSize: new naver.maps.Size(20, 20),
            anchorColor: "#fff",
            pixelOffset: new naver.maps.Point(0, -20)
        });
        
        infoWindow.open(window.map, marker);
        
        // 마커 클릭 시 정보창 토글
        naver.maps.Event.addListener(marker, 'click', function() {
            if (infoWindow.getMap()) {
                infoWindow.close();
            } else {
                infoWindow.open(window.map, marker);
            }
        });
    }
}