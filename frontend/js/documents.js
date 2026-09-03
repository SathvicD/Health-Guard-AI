/* =========================================================
   HEALTHGUARD AI
   Patient Document Management
   ========================================================= */


/* =========================================================
   AUTH GUARD
   ========================================================= */

function checkDocumentAuthentication() {

    const token =
        localStorage.getItem(
            "healthguard_token"
        );

    if (!token) {

        window.location.href =
            "../login.html";

        return false;
    }

    return true;
}


/* =========================================================
   ELEMENTS
   ========================================================= */

const uploadForm =
    document.getElementById(
        "documentUploadForm"
    );

const fileInput =
    document.getElementById(
        "documentFile"
    );

const documentType =
    document.getElementById(
        "documentType"
    );

const descriptionInput =
    document.getElementById(
        "documentDescription"
    );

const uploadButton =
    document.getElementById(
        "uploadDocumentButton"
    );

const uploadButtonText =
    document.getElementById(
        "uploadButtonText"
    );

const uploadSpinner =
    document.getElementById(
        "uploadSpinner"
    );

const uploadMessage =
    document.getElementById(
        "uploadMessage"
    );

const documentsContainer =
    document.getElementById(
        "documentsContainer"
    );


/* =========================================================
   MESSAGE
   ========================================================= */

function showUploadMessage(
    message,
    type = "error"
) {

    if (!uploadMessage) return;

    uploadMessage.textContent =
        message;

    uploadMessage.className =
        `document-message ${type}`;

}


function hideUploadMessage() {

    if (!uploadMessage) return;

    uploadMessage.className =
        "document-message hidden";

}


/* =========================================================
   LOADING
   ========================================================= */

function setUploadLoading(
    loading
) {

    if (uploadButton) {

        uploadButton.disabled =
            loading;

    }


    if (uploadButtonText) {

        uploadButtonText.textContent =
            loading
                ? "Uploading..."
                : "Upload Document";

    }


    if (uploadSpinner) {

        uploadSpinner.classList.toggle(
            "hidden",
            !loading
        );

    }

}


/* =========================================================
   FORMAT FILE SIZE
   ========================================================= */

function formatFileSize(
    bytes
) {

    if (bytes < 1024) {

        return `${bytes} B`;

    }


    if (bytes < 1024 * 1024) {

        return `${(
            bytes / 1024
        ).toFixed(1)} KB`;

    }


    return `${(
        bytes /
        (1024 * 1024)
    ).toFixed(2)} MB`;

}


/* =========================================================
   LOAD DOCUMENTS
   ========================================================= */

async function loadDocuments() {

    if (!documentsContainer) return;


    documentsContainer.innerHTML = `
        <div class="documents-loading">
            Loading your medical documents...
        </div>
    `;


    try {

        const documents =
            await apiRequest(
                "/documents/my-documents",
                {
                    method: "GET"
                }
            );


        renderDocuments(
            documents
        );


    } catch (error) {

        console.error(
            "Document loading error:",
            error
        );


        documentsContainer.innerHTML = `
            <div class="documents-empty">
                <div class="empty-icon">⚠</div>
                <h3>Unable to load documents</h3>
                <p>${escapeHtml(
                    error.message
                )}</p>
            </div>
        `;

    }

}


/* =========================================================
   RENDER DOCUMENTS
   ========================================================= */

function renderDocuments(
    documents
) {

    if (!documentsContainer) return;


    if (
        !documents ||
        documents.length === 0
    ) {

        documentsContainer.innerHTML = `
            <div class="documents-empty">

                <div class="empty-icon">
                    📄
                </div>

                <h3>
                    No medical documents yet
                </h3>

                <p>
                    Upload your first medical
                    document using the form above.
                </p>

            </div>
        `;

        return;

    }


    documentsContainer.innerHTML =
        documents
            .map(
                document => `
                    <div class="document-card">

                        <div class="document-icon">
                            ${getDocumentIcon(
                                document.document_type
                            )}
                        </div>

                        <div class="document-info">

                            <h3>
                                ${escapeHtml(
                                    document.document_name
                                )}
                            </h3>

                            <div class="document-meta">

                                <span>
                                    ${escapeHtml(
                                        document.document_type
                                    )}
                                </span>

                                <span>
                                    •
                                </span>

                                <span>
                                    ${formatDate(
                                        document.created_at
                                    )}
                                </span>

                            </div>

                            ${
                                document.description
                                    ? `
                                        <p>
                                            ${escapeHtml(
                                                document.description
                                            )}
                                        </p>
                                    `
                                    : ""
                            }

                        </div>

                        <div class="document-status">

                            <span class="secure-badge">
                                ${
                                    document.is_encrypted
                                        ? "🔒 Encrypted"
                                        : "Stored Securely"
                                }
                            </span>

                        </div>

                    </div>
                `
            )
            .join("");

}


/* =========================================================
   DOCUMENT ICON
   ========================================================= */

function getDocumentIcon(
    type
) {

    const normalized =
        String(type)
            .toLowerCase();


    if (
        normalized.includes("ecg") ||
        normalized.includes("cardiac")
    ) {

        return "❤️";

    }


    if (
        normalized.includes("blood") ||
        normalized.includes("lab")
    ) {

        return "🧪";

    }


    if (
        normalized.includes("scan") ||
        normalized.includes("mri") ||
        normalized.includes("x-ray")
    ) {

        return "🩻";

    }


    return "📄";

}


/* =========================================================
   DATE FORMAT
   ========================================================= */

function formatDate(
    dateString
) {

    if (!dateString) {
        return "Unknown date";
    }


    const date =
        new Date(dateString);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "Unknown date";

    }


    return date.toLocaleString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHtml(
    value
) {

    if (value === null || value === undefined) {
        return "";
    }


    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


/* =========================================================
   FILE UPLOAD
   ========================================================= */

if (uploadForm) {

    uploadForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            hideUploadMessage();


            if (!fileInput.files.length) {

                showUploadMessage(
                    "Please select a medical document."
                );

                return;

            }


            const file =
                fileInput.files[0];


            const maxSize =
                10 * 1024 * 1024;


            if (file.size > maxSize) {

                showUploadMessage(
                    "File size must not exceed 10 MB."
                );

                return;

            }


            const allowedTypes = [
                "application/pdf",
                "image/png",
                "image/jpeg"
            ];


            if (
                file.type &&
                !allowedTypes.includes(
                    file.type
                )
            ) {

                showUploadMessage(
                    "Only PDF, PNG, and JPEG files are allowed."
                );

                return;

            }


            const type =
                documentType.value.trim();


            if (!type) {

                showUploadMessage(
                    "Please select a document type."
                );

                return;

            }


            setUploadLoading(true);


            try {

                const formData =
                    new FormData();


                formData.append(
                    "file",
                    file
                );


                formData.append(
                    "document_type",
                    type
                );


                formData.append(
                    "description",
                    descriptionInput.value.trim()
                );


                await apiUpload(
                    "/documents/upload",
                    formData
                );


                showUploadMessage(
                    "Document uploaded successfully.",
                    "success"
                );


                uploadForm.reset();


                await loadDocuments();


            } catch (error) {

                console.error(
                    "Upload error:",
                    error
                );


                showUploadMessage(
                    error.message ||
                    "Unable to upload document."
                );

            } finally {

                setUploadLoading(false);

            }

        }
    );

}


/* =========================================================
   INITIALIZE
   ========================================================= */

if (
    checkDocumentAuthentication()
) {

    loadDocuments();

}