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

const apigClient = apigClientFactory.newClient();
const API_GATEWAY_PUT_URL =
  "https://hpgx35r3xb.execute-api.us-east-1.amazonaws.com/dev/upload/photo-album-webapp-b2/{filename}";

document.getElementById("header").addEventListener("click", function () {
  window.location.reload();
});

const toggleLoading = (isLoading) => {
  if (isLoading) {
    loading.style.display = "block";
  } else {
    loading.style.display = "none";
  }
};

const displaySearchResults = (photos) => {
  if (photos.length === 0) {
    searchResults.innerHTML = "<div></div><div> No images found. </div>";
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

const uploadPhoto = async (file, fileName, customLabels) => {
  toggleUploadLoading(true);
  const encodedFileName = encodeURIComponent(fileName);
  const url = API_GATEWAY_PUT_URL.replace("{filename}", encodedFileName);
  console.log("url: ", url);
  const uploadResponse = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
      "x-amz-meta-customLabels": customLabels,
    },
    body: file,
  });
  console.log("uploadResponse: ", uploadResponse);

  if (uploadResponse.ok) {
    showUploadSuccess();
  } else {
    alert("Upload failed!");
  }

  toggleUploadLoading(false);
};

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  searchPhotos(searchInput.value);
});

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
  await uploadPhoto(file, file.name, customLabels.value);
});

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
