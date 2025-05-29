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

function initMap() {
    // 지도 옵션
    const mapOptions = {
        center: new naver.maps.LatLng(37.3595704, 127.105399),
        zoom: 10,
        zoomControl: true,
        zoomControlOptions: {
            position: naver.maps.Position.TOP_RIGHT
        }
    };

    // 지도 생성
    map = new naver.maps.Map('map', mapOptions);
}

// 페이지 로드 시 지도 초기화
window.addEventListener('load', initMap);

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

        // 결과 표시
        resultContainer.style.display = 'block';
        locationList.innerHTML = '';

        if (data.locations && data.locations.length > 0) {
            data.locations.forEach(location => {
                const li = document.createElement('li');
                li.className = 'list-group-item';
                li.innerHTML = `
                    <div class="location-item">
                        <span class="location-name">${location.name}</span>
                        <span class="location-type">${location.type || '기타'}</span>
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