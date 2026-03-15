/** 
 * Document Portal Logic with Permanent IndexedDB Storage
 */

// Credentials
const CREDENTIALS = {
    USER: "SLNWOP",
    PASS: "79992",
    UPLOAD_PIN: "#s23#S/S"
};

// Database setup utilizing IndexedDB for permanent storage
const DB_NAME = "WOPDocumentDB";
const STORE_NAME = "FilesStore";
let db;

// App State
let uploadedFiles = [];
let isAuthenticated = false;

// Initialize Database connection on load
function initDB() {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = (event) => {
        console.error("Database error: " + event.target.errorCode);
    };

    request.onupgradeneeded = (event) => {
        const _db = event.target.result;
        // Create an object store to hold files; key is auto-incremented
        _db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        // Once DB is open, load existing saved files
        loadAllFilesFromDB();
    };
}
// Start Init
initDB();

// DOM Elements - Panels
const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");
const uploadAuthModal = document.getElementById("upload-auth-modal");
const uploadFileModal = document.getElementById("upload-file-modal");
const downloadModal = document.getElementById("download-modal");

// DOM Elements - Inputs & Text
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginError = document.getElementById("login-error");
const userDisplay = document.getElementById("user-display");

const uploadPasswordInput = document.getElementById("upload-password");
const uploadAuthError = document.getElementById("upload-auth-error");

const fileInput = document.getElementById("file-input");
const fileNameDisplay = document.getElementById("selected-file-name");
const uploadStatus = document.getElementById("upload-status");
const uploadBtn = document.getElementById("upload-btn");

// List Containers
const lists = {
    PDF: document.getElementById("pdf-list"),
    Word: document.getElementById("word-list"),
    Excel: document.getElementById("excel-list")
};

const counts = {
    PDF: document.getElementById("pdf-count"),
    Word: document.getElementById("word-count"),
    Excel: document.getElementById("excel-count")
};

// --- AUTHENTICATION --- //

function attemptLogin() {
    const user = usernameInput.value.trim();
    const pass = passwordInput.value;

    if (user === CREDENTIALS.USER && pass === CREDENTIALS.PASS) {
        // Success
        isAuthenticated = true;
        loginError.style.display = "none";
        userDisplay.innerText = user;
        
        // Transition
        loginView.classList.remove("active-panel");
        loginView.classList.add("hidden-panel");
        
        setTimeout(() => {
            dashboardView.classList.remove("hidden-panel");
            dashboardView.classList.add("active-panel");
        }, 300);

        // Security clear
        usernameInput.value = "";
        passwordInput.value = "";
    } else {
        // Fail
        loginError.innerText = "Error: Invalid Username or Password";
        loginError.style.display = "block";
        
        // Slight shake effect applied via CSS animation
        const form = document.querySelector("#login-view .form-container");
        form.style.animation = 'none';
        form.offsetHeight; /* trigger reflow */
        form.style.animation = 'shake 0.4s ease-in-out';
    }
}

function logout() {
    isAuthenticated = false;
    closeAllModals();
    
    // Transition back
    dashboardView.classList.remove("active-panel");
    dashboardView.classList.add("hidden-panel");
    
    setTimeout(() => {
        loginView.classList.remove("hidden-panel");
        loginView.classList.add("active-panel");
    }, 300);
}

// --- MODAL MANAGEMENT --- //

function closeModal(id) {
    const modal = document.getElementById(id);
    if(modal) {
        modal.classList.add("hidden-panel");
    }
}

function closeAllModals() {
    ["upload-auth-modal", "upload-file-modal", "download-modal"].forEach(closeModal);
}

// --- PERMANENT UPLOAD FLOW (IndexedDB) --- //

function showUploadAuthModal() {
    uploadAuthModal.classList.remove("hidden-panel");
    uploadPasswordInput.value = "";
    uploadAuthError.style.display = "none";
    setTimeout(() => uploadPasswordInput.focus(), 100);
}

function verifyUploadAuth() {
    if (uploadPasswordInput.value === CREDENTIALS.UPLOAD_PIN) {
        uploadAuthError.style.display = "none";
        closeModal("upload-auth-modal");
        
        setTimeout(() => {
            uploadFileModal.classList.remove("hidden-panel");
            resetUploadForm();
        }, 300);
    } else {
        uploadAuthError.innerText = "Error: Incorrect security PIN";
        uploadAuthError.style.display = "block";
    }
}

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        fileNameDisplay.innerHTML = `<i class="fa-solid fa-check-circle"></i> Selected: ${e.target.files[0].name}`;
        uploadStatus.style.display = "none";
    } else {
        fileNameDisplay.innerHTML = "";
    }
});

function resetUploadForm() {
    fileInput.value = "";
    fileNameDisplay.innerHTML = "";
    uploadStatus.style.display = "none";
    uploadStatus.className = "status-msg";
    uploadBtn.disabled = false;
    uploadBtn.innerHTML = "Confirm Upload";
}

function handleFileUpload() {
    if (!db) {
        showUploadStatus("Storage is currently starting up, please wait a second and try again.", false);
        return;
    }
    
    if (fileInput.files.length === 0) {
        showUploadStatus("Please select a file to permanently store.", false);
        return;
    }

    const file = fileInput.files[0];
    const fileName = file.name;
    const fileExt = fileName.split('.').pop().toLowerCase();
    
    // Determine category and validate
    let type = null;
    let iconClass = "";
    
    if (fileExt === "pdf") {
        type = "PDF";
        iconClass = "fa-file-pdf pdf-icon";
    } else if (["doc", "docx"].includes(fileExt)) {
        type = "Word";
        iconClass = "fa-file-word word-icon";
    } else if (["xls", "xlsx"].includes(fileExt)) {
        type = "Excel";
        iconClass = "fa-file-excel excel-icon";
    }

    if (!type) {
        showUploadStatus("Unsupported format. Only PDF, Word, Excel allowed.", false);
        return;
    }

    // Prepare to save permanently using FileReader as base64 or directly storing Blob in some browsers. 
    // It's safest across all browsers to store File/Blob directly since most modern browsers support it in IndexedDB.
    
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving Permanently...';

    const transaction = db.transaction([STORE_NAME], "readwrite");
    const objectStore = transaction.objectStore(STORE_NAME);
    
    const record = {
        name: fileName,
        type: type,
        icon: iconClass,
        fileBlob: file, // Store the actual file blob
        timestamp: new Date().getTime()
    };

    const request = objectStore.add(record);

    request.onsuccess = () => {
        // Also add to local array so memory is updated mapped immediately
        // Note: we'll create a link specifically for download
        record.id = request.result; 
        uploadedFiles.push(record);

        showUploadStatus(`"${fileName}" permanently saved!`, true);
        
        setTimeout(() => {
            resetUploadForm();
            closeModal('upload-file-modal');
        }, 2000);
    };

    request.onerror = (e) => {
        showUploadStatus("Error saving file. File too large or storage full.", false);
        resetUploadForm();
    };
}

function showUploadStatus(msg, isSuccess) {
    uploadStatus.innerText = msg;
    uploadStatus.className = `status-msg ${isSuccess ? 'status-success' : 'status-error'}`;
    uploadStatus.style.display = "block";
}

// Loads files into RAM memory securely on boot
function loadAllFilesFromDB() {
    if(!db) return;
    uploadedFiles = [];
    
    const transaction = db.transaction([STORE_NAME], "readonly");
    const objectStore = transaction.objectStore(STORE_NAME);
    
    const request = objectStore.openCursor();
    
    request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            uploadedFiles.push(cursor.value);
            cursor.continue();
        }
    };
}

// --- PERMANENT DOWNLOAD FLOW --- //

function showDownloadModal() {
    downloadModal.classList.remove("hidden-panel");
    renderLibrary();
}

function renderLibrary() {
    // 1. Sort files A to Z permanently
    const sortedFiles = [...uploadedFiles].sort((a,b) => a.name.localeCompare(b.name));
    
    // 2. Filter by type
    const categorized = {
        PDF: sortedFiles.filter(f => f.type === "PDF"),
        Word: sortedFiles.filter(f => f.type === "Word"),
        Excel: sortedFiles.filter(f => f.type === "Excel")
    };

    // 3. Render each list
    Object.keys(categorized).forEach(category => {
        const files = categorized[category];
        const ul = lists[category];
        
        counts[category].innerText = files.length;
        ul.innerHTML = "";

        if (files.length === 0) {
            ul.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-folder-open"></i>
                    No ${category} documents uploaded yet.
                </div>
            `;
            return;
        }

        files.forEach(file => {
            const li = document.createElement("li");
            
            // To download reliably multiple times, we need to generate ObjectURLs on the fly for the blobs loaded from IndexedDB
            const fileLink = URL.createObjectURL(file.fileBlob);

            li.innerHTML = `
                <div class="file-info">
                    <i class="fa-solid ${file.icon} file-icon"></i>
                    <span class="file-name" title="${file.name}">${file.name}</span>
                </div>
                <!-- We open in an anchor passing the object URL -->
                <a href="${fileLink}" download="${file.name}" class="download-link">
                    <i class="fa-solid fa-download"></i> Download
                </a>
            `;
            ul.appendChild(li);
        });
    });
}

// --- EVENT LISTENERS --- //

// Handle Enter Keys
passwordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") attemptLogin();
});

uploadPasswordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") verifyUploadAuth();
});
