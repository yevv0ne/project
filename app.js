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
                const reader = new FileReader();
                reader.onload = (e) => {
                    imagePreview.src = e.target.result;
                    imagePreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // 처리 버튼 클릭 이벤트
    if (processButton) {
        processButton.addEventListener('click', async () => {
            if (imageInput.checked) {
                await processImage();
            } else {
                await processUrl();
            }
        });
    }

    // 지도 초기화
    if (typeof naver !== 'undefined' && naver.maps) {
        initMap();
    }
});

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
                    markPlacesFromExtracted(places);
                } else {
                    console.log('추출된 장소명이 없습니다.');
                }
                showResults(places);
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
            markPlacesFromExtracted(places);
        } else {
            console.log('추출된 장소명이 없습니다.');
        }
        showResults(places);
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
        map = new naver.maps.Map('map', mapOptions);

        // 지도 로드 완료 이벤트
        naver.maps.Event.once(map, 'init', function() {
            console.log('지도 초기화 완료');
            map.refresh();
        });

        // 지도 크기 조정 이벤트
        window.addEventListener('resize', function() {
            if (map) {
                map.refresh();
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
        map: map,
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
        infoWindows.forEach(iw => iw.close());
        // 현재 정보창 열기
        infoWindow.open(map, marker);
    });

    infoWindows.push(infoWindow);
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
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.innerHTML = `<div><strong>${place}</strong></div>`;
            locationList.appendChild(li);
        });
        return;
    }

    // 객체 배열(기존 방식)일 경우
    locations.forEach(location => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.innerHTML = `
            <div>
                <strong>${location.name}</strong>
                ${location.type ? `<span class="badge bg-secondary ms-2">${location.type}</span>` : ''}
            </div>
            ${location.coordinates ? 
                `<a href="https://www.google.com/maps?q=${location.coordinates.lat},${location.coordinates.lng}" 
                   target="_blank" class="btn btn-sm btn-outline-primary">지도 보기</a>` 
                : ''}
        `;
        locationList.appendChild(li);
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