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

// 입력 방식 전환
imageInput.addEventListener('change', () => {
    imageUploadSection.style.display = 'block';
    urlInputSection.style.display = 'none';
});

urlInput.addEventListener('change', () => {
    imageUploadSection.style.display = 'none';
    urlInputSection.style.display = 'block';
});

// 이미지 미리보기
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

// 처리 버튼 클릭 이벤트
processButton.addEventListener('click', async () => {
    if (imageInput.checked) {
        await processImage();
    } else {
        await processUrl();
    }
});

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
                console.log('이미지 처리 시작');
                // OCR로 텍스트 추출
                const extractedText = await ocrSpaceImage(e.target.result);
                console.log('OCR 추출 결과:', extractedText);
                
                if (!extractedText) {
                    throw new Error('이미지에서 텍스트를 추출할 수 없습니다.');
                }

                // 장소 추출
                const locations = await extractLocations(extractedText);
                console.log('추출된 장소:', locations);
                showResults(locations);
            } catch (error) {
                console.error('처리 중 오류:', error);
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
        // URL에서 텍스트 추출 (서버에서 처리)
        const response = await fetch('http://localhost:3000/api/extract-url', {
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
        const locations = await extractLocations(data.text);
        showResults(locations);
    } catch (error) {
        showError(error.message);
    }
}

// 네이버 지도 초기화
let map;
let markers = [];
let infoWindows = [];

function initMap() {
    try {
        // 지도 옵션
        const mapOptions = {
            center: new naver.maps.LatLng(37.3595704, 127.105399),
            zoom: 10,
            zoomControl: true,
            zoomControlOptions: {
                position: naver.maps.Position.TOP_RIGHT
            },
            mapTypeControl: true,
            mapTypeControlOptions: {
                position: naver.maps.Position.TOP_LEFT
            },
            scaleControl: true,
            logoControl: true,
            mapDataControl: true
        };

        // 지도 생성
        const mapContainer = document.querySelector('.map-container');
        map = new naver.maps.Map(mapContainer, mapOptions);

        // 지도 로드 완료 이벤트
        naver.maps.Event.once(map, 'init', function() {
            console.log('지도 초기화 완료');
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
    const marker = new naver.maps.Marker({
        position: position,
        map: map,
        title: location.name
    });

    // 정보창 생성
    const infoWindow = new naver.maps.InfoWindow({
        content: `
            <div style="padding:10px;min-width:200px;text-align:center;">
                <h3 style="margin:0 0 5px 0;font-size:16px;">${location.name}</h3>
                <p style="margin:0;font-size:14px;color:#666;">${location.type || '기타'}</p>
                ${location.coordinates.address ? 
                    `<p style="margin:5px 0 0 0;font-size:12px;color:#999;">${location.coordinates.address}</p>` 
                    : ''}
            </div>
        `,
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
    hideLoading();
    resultContainer.style.display = 'block';
    locationList.innerHTML = '';

    if (!locations || locations.length === 0) {
        locationList.innerHTML = '<li class="list-group-item">추출된 장소가 없습니다.</li>';
        return;
    }

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
    loading.style.display = 'block';
    resultContainer.style.display = 'none';
}

// 로딩 숨기기
function hideLoading() {
    loading.style.display = 'none';
}

// 에러 표시
function showError(message) {
    hideLoading();
    resultContainer.style.display = 'block';
    locationList.innerHTML = `<li class="list-group-item text-danger">${message}</li>`;
} 