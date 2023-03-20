const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const searchButton = document.getElementById("search-button");
const loading = document.getElementById("loading");
const searchResults = document.getElementById("search-results");
const uploadButton = document.getElementById("upload-button");
const uploadModal = document.getElementById("upload-modal");
const closeModal = document.querySelector(".close");
const uploadForm = document.getElementById("upload-form");
const photoFile = document.getElementById("photo-file");
const customLabels = document.getElementById("custom-labels");
const uploadLoading = document.getElementById("upload-loading");
const uploadSuccess = document.getElementById("upload-success");

const apigClient = apigClientFactory.newClient();
const API_GATEWAY_PUT_URL =
  "https://hpgx35r3xb.execute-api.us-east-1.amazonaws.com/dev/upload/photo-album-webapp-b2/{filename}";

const toggleLoading = (isLoading) => {
  if (isLoading) {
    loading.style.display = "block";
  } else {
    loading.style.display = "none";
  }
};

const displaySearchResults = (photos) => {
  if (photos.length === 0) {
    searchResults.innerHTML = "<p>No images found.</p>";
  } else {
    searchResults.innerHTML = photos
      .map((photo) => `<img src="${photo.url}" alt="${photo.labels.join(", ")}">`)
      .join("");
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

closeModal.addEventListener("click", () => {
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
