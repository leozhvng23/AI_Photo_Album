const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const searchButton = document.getElementById("search-button");
const loading = document.getElementById("loading");
const searchResults = document.getElementById("search-results");
const uploadButton = document.getElementById("upload-button");
const uploadModal = document.getElementById("upload-modal");
const closeModalUpload = document.querySelector("#upload-modal .close");
const uploadForm = document.getElementById("upload-form");
const photoFile = document.getElementById("photo-file");
const customLabels = document.getElementById("custom-labels");
const uploadLoading = document.getElementById("upload-loading");
const noResults = document.getElementById("no-results");
const uploadSuccess = document.getElementById("upload-success");
const imageModal = document.getElementById("image-modal");
const closeModalImage = document.querySelector("#image-modal .close");
const modalImage = document.getElementById("modal-image");
const leftButton = document.getElementById("left-button");
const rightButton = document.getElementById("right-button");
const searchIcon = document.getElementById("search-icon");
const uploadLaptopIcon = document.getElementById("upload-laptop");
const fileNameElement = document.getElementById("file-name");

const apigClient = apigClientFactory.newClient();
const API_GATEWAY_PUT_URL =
  "https://hpgx35r3xb.execute-api.us-east-1.amazonaws.com/dev/upload/photo-album-webapp-b2/{filename}";

document.getElementById("header").addEventListener("click", function () {
  window.location.reload();
});

const placeholders = [
  "Show me wine and sake...",
  "Show me pictures of food...",
  "Show me photos of plants...",
  "Show me all the pictures...",
  "Photos with people in them...",
];

const getRandomPlaceholder = () => {
  const index = Math.floor(Math.random() * placeholders.length);
  return placeholders[index];
};

/* search form */

const toggleLoading = (isLoading) => {
  if (isLoading) {
    searchIcon.src = "./assets/icons/loading.svg";
    searchIcon.classList.add("loading-icon");
    searchIcon.classList.remove("search-icon");
  } else {
    searchIcon.src = "./assets/icons/search.svg";
    searchIcon.classList.remove("loading-icon");
    searchIcon.classList.add("search-icon");
  }
};

const displaySearchResults = (photos) => {
  if (photos.length === 0) {
    noResults.style.display = "block";
  } else {
    searchResults.innerHTML = photos
      .map(
        (photo, index) =>
          `<img src="${photo.url}" alt="${photo.labels.join(
            ", "
          )}" data-index="${index}" class="search-result-image">`
      )
      .join("");
    allImages = photos;
  }
};

const searchPhotos = async (query) => {
  toggleLoading(true);
  noResults.style.display = "none";
  const params = {
    q: query,
  };
  const body = {};
  const additionalParams = {};

  try {
    const result = await apigClient.searchGet(params, body, additionalParams);
    const photos = JSON.parse(result.data.body);
    console.log("photos: ", photos);
    displaySearchResults(photos);
  } catch (error) {
    console.error("Error:", error);
  }
  toggleLoading(false);
};

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  searchPhotos(searchInput.value);
});

/* upload form */

uploadLaptopIcon.addEventListener("click", () => {
  photoFile.click();
});

const uploadPhoto = async (file, fileName, customLabels) => {
  toggleUploadLoading(true);
  const encodedFileName = encodeURIComponent(fileName);
  const url = API_GATEWAY_PUT_URL.replace("{filename}", encodedFileName);
  console.log("url: ", url);
  try {
    const uploadResponse = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
        "x-amz-meta-customLabels": customLabels,
      },
      body: file,
    });
    showUploadSuccess();
    console.log("uploadResponse: ", uploadResponse);
    toggleUploadLoading(false);
  } catch (error) {
    console.log("Error:", error);
    if (error.message === "Failed to fetch") {
      alert("File too large. Please upload a file smaller than 10MB.");
    } else {
      alert("Upload failed!");
    }
    toggleUploadLoading(false);
  }

  // if (uploadResponse.ok) {
  //   showUploadSuccess();
  // } else {
  //   alert("Upload failed!");
  // }

  // toggleUploadLoading(false);
};

uploadButton.addEventListener("click", () => {
  uploadModal.style.display = "block";
});

closeModalUpload.addEventListener("click", () => {
  uploadModal.style.display = "none";
});

const toggleUploadLoading = (isLoading) => {
  if (isLoading) {
    uploadLoading.style.display = "block";
    uploadSuccess.style.display = "none";
  } else {
    uploadLoading.style.display = "none";
  }
};

const showUploadSuccess = () => {
  uploadSuccess.style.display = "block";
};

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = photoFile.files[0];
  if (!file) {
    alert("Please select an image file to upload.");
    return;
  }
  await uploadPhoto(file, file.name, customLabels.value);
});

photoFile.addEventListener("change", function () {
  const fileName = this.files[0] ? this.files[0].name : "No file selected";
  fileNameElement.textContent = fileName;
});

/* image modal */

let currentImageIndex = 0;
let allImages = [];

const openImageModal = (index, images) => {
  currentImageIndex = index;
  allImages = images;
  modalImage.src = allImages[currentImageIndex].url;
  imageModal.style.display = "block";
};

const closeImageModal = () => {
  imageModal.style.display = "none";
};

const showPreviousImage = () => {
  currentImageIndex = (currentImageIndex - 1 + allImages.length) % allImages.length;
  modalImage.src = allImages[currentImageIndex].url;
};

const showNextImage = () => {
  currentImageIndex = (currentImageIndex + 1) % allImages.length;
  modalImage.src = allImages[currentImageIndex].url;
};

searchResults.addEventListener("click", (event) => {
  if (event.target.tagName === "IMG") {
    const index = parseInt(event.target.dataset.index, 10);
    openImageModal(index, allImages);
  }
});

closeModalImage.addEventListener("click", closeImageModal);
leftButton.addEventListener("click", showPreviousImage);
rightButton.addEventListener("click", showNextImage);

/* voice search */

const voiceButton = document.getElementById("voice-button");
const microphoneIcon = document.getElementById("microphone");

const loadingDots = document.createElement("div");
loadingDots.classList.add("loading-dots");
loadingDots.style.display = "none";
voiceButton.appendChild(loadingDots);

for (let i = 0; i < 3; i++) {
  const dot = document.createElement("div");
  dot.classList.add("loading-dot");
  loadingDots.appendChild(dot);
}

let voiceSearching = false;

microphoneIcon.addEventListener("click", () => {
  startVoiceSearch();
});

const startVoiceSearch = async () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Your browser does not support SpeechRecognition. Please try another browser.");
    return;
  }

  if (localStorage.getItem("micPermissionRequested") !== "true") {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStorage.setItem("micPermissionRequested", "true");
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      console.error("Error requesting microphone permission:", err);
    }
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.start();

  loadingDots.addEventListener("click", () => {
    recognition.stop();
  });
  recognition.addEventListener("start", () => {
    microphoneIcon.style.display = "none";
    loadingDots.style.display = "flex";
    searchInput.value = "";
    searchInput.placeholder = "Listening . . .";
  });

  recognition.addEventListener("end", () => {
    microphoneIcon.style.display = "flex";
    loadingDots.style.display = "none";
    searchInput.placeholder = getRandomPlaceholder();
  });

  recognition.addEventListener("result", (event) => {
    const transcript = event.results[0][0].transcript;
    searchInput.value = transcript;
    searchPhotos(transcript);
  });

  recognition.addEventListener("error", (event) => {
    let errorMessage = "An error occurred during voice recognition.";
    if (event.error === "not-allowed") {
      errorMessage = "Permission to access the microphone was denied.";
    } else if (event.error === "no-speech") {
      errorMessage = "No speech was detected. Please try again.";
    } else if (event.error === "network") {
      errorMessage =
        "A network error occurred. Please check your internet connection and try again.";
    }

    alert(errorMessage);
    microphoneIcon.style.display = "flex";
    loadingDots.style.display = "none";
    searchInput.placeholder = getRandomPlaceholder();
  });
};

const requestMicrophonePermission = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // If permission granted, set the flag in localStorage
    localStorage.setItem("micPermissionRequested", "true");
    stream.getTracks().forEach((track) => track.stop());
  } catch (err) {
    console.error("Error requesting microphone permission:", err);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("micPermissionRequested") !== "true") {
    requestMicrophonePermission();
  }
  // random placeholder
  searchInput.placeholder = getRandomPlaceholder();
});
