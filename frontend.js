// ==============================
// 모드 전환 기능 (이미지 <-> URL)
// ==============================

// [1] 버튼과 입력 섹션 DOM 요소 가져오기
const imageModeBtn = document.getElementById('imageMode');         // 이미지 모드 버튼
const urlModeBtn = document.getElementById('urlMode');             // URL 모드 버튼
const imageSection = document.getElementById('imageInputSection'); // 이미지 입력 섹션
const urlSection = document.getElementById('urlInputSection');     // URL 입력 섹션

// [2] 이미지 모드 버튼 클릭 시 실행될 함수
imageModeBtn.addEventListener('click', () => {
  imageSection.style.display = 'block';         // 이미지 입력 섹션 보이기
  urlSection.style.display = 'none';            // URL 입력 섹션 숨기기
  imageModeBtn.classList.add('active');         // 이미지 버튼에 강조 스타일 적용
  urlModeBtn.classList.remove('active');        // URL 버튼 강조 제거
});

// [3] URL 모드 버튼 클릭 시 실행될 함수
urlModeBtn.addEventListener('click', () => {
  imageSection.style.display = 'none';          // 이미지 입력 섹션 숨기기
  urlSection.style.display = 'block';           // URL 입력 섹션 보이기
  urlModeBtn.classList.add('active');           // URL 버튼에 강조 스타일 적용
  imageModeBtn.classList.remove('active');      // 이미지 버튼 강조 제거
});

// [4] 처리하기 버튼 클릭 시 실행될 함수
document.getElementById('processButton').addEventListener('click', () => {
    const imageInput = document.getElementById('imageFile');   // 이미지 파일 입력
    const urlInput = document.getElementById('urlField');      // URL 입력
  
    // 이미지 파일이 선택되어 있으면 extractText() 실행
    if (imageInput && imageInput.files.length > 0) {
      extractText();
    }
    // URL 입력 값이 존재하면 extractContent() 실행
    else if (urlInput && urlInput.value.trim() !== '') {
      extractContent();
    }
    // 둘 다 없으면 에러 처리 (선택사항)
    else {
      alert("이미지 또는 URL을 입력해주세요!");
    }
  });
  