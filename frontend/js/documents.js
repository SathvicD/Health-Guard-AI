/* =========================================================
   HEALTHGUARD AI
   Patient Document Management
   Secure In-App Document Viewer
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
   SECURE VIEWER ELEMENTS
   ========================================================= */

const patientDocumentViewer =
    document.getElementById(
        "patientDocumentViewer"
    );

const patientDocumentFrame =
    document.getElementById(
        "patientDocumentFrame"
    );

const patientDocumentId =
    document.getElementById(
        "patientDocumentId"
    );

const patientViewerMessage =
    document.getElementById(
        "patientViewerMessage"
    );

const patientViewerMessageIcon =
    document.getElementById(
        "patientViewerMessageIcon"
    );

const patientViewerMessageTitle =
    document.getElementById(
        "patientViewerMessageTitle"
    );

const patientViewerMessageText =
    document.getElementById(
        "patientViewerMessageText"
    );


/* =========================================================
   VIEWER STATE
   ========================================================= */

let patientDocumentBlobUrl = null;

let currentlyViewedDocumentId = null;


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

    if (!bytes) {
        return "0 B";
    }


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

                <div class="empty-icon">
                    ⚠
                </div>

                <h3>
                    Unable to load documents
                </h3>

                <p>
                    ${escapeHtml(
                        error.message ||
                        "An unexpected error occurred."
                    )}
                </p>

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
                document => {

                    const encrypted =
                        Boolean(
                            document.is_encrypted
                        );


                    const securityBadge =
                        encrypted
                            ? `
                                <span
                                    class="secure-badge encrypted"
                                >
                                    🔐 Encrypted
                                </span>
                            `
                            : `
                                <span
                                    class="secure-badge secure"
                                >
                                    Stored Securely
                                </span>
                            `;


                    return `
                        <div
                            class="document-card"
                            data-document-id="${document.id}"
                        >

                            <!-- DOCUMENT ICON -->

                            <div class="document-icon">

                                ${getDocumentIcon(
                                    document.document_type
                                )}

                            </div>


                            <!-- DOCUMENT INFORMATION -->

                            <div class="document-info">


                                <!-- TITLE + BADGE -->

                                <div
                                    class="document-title-row"
                                >

                                    <h3>
                                        ${escapeHtml(
                                            document.document_name
                                        )}
                                    </h3>

                                    ${securityBadge}

                                </div>


                                <!-- TYPE -->

                                <p
                                    class="document-type"
                                >
                                    ${escapeHtml(
                                        document.document_type
                                    )}
                                </p>


                                <!-- DESCRIPTION -->

                                ${
                                    document.description
                                        ? `
                                            <p
                                                class="document-description"
                                            >
                                                ${escapeHtml(
                                                    document.description
                                                )}
                                            </p>
                                        `
                                        : ""
                                }


                                <!-- DOCUMENT METADATA -->

                                <div
                                    class="document-meta"
                                >

                                    <span
                                        class="document-meta-item document-id"
                                    >

                                        <strong>
                                            Document ID:
                                        </strong>

                                        #${document.id}

                                    </span>


                                    <span
                                        class="document-meta-item"
                                    >
                                        Uploaded:
                                        ${formatDate(
                                            document.created_at
                                        )}
                                    </span>

                                </div>

                            </div>


                            <!-- ACTION -->

                            <div
                                class="document-actions"
                            >

                                <button
                                    type="button"
                                    class="view-document-btn"
                                    data-document-id="${document.id}"
                                    onclick="viewPatientDocument(${document.id})"
                                >

                                    👁
                                    View Document

                                </button>

                            </div>

                        </div>
                    `;

                }
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


    if (
        normalized.includes("prescription")
    ) {

        return "💊";

    }


    if (
        normalized.includes("discharge")
    ) {

        return "🏥";

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

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

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


            /* ---------------------------------------------
               FILE CHECK
               --------------------------------------------- */

            if (
                !fileInput ||
                !fileInput.files ||
                !fileInput.files.length
            ) {

                showUploadMessage(
                    "Please select a medical document."
                );

                return;

            }


            const file =
                fileInput.files[0];


            /* ---------------------------------------------
               SIZE CHECK
               --------------------------------------------- */

            const maxSize =
                10 * 1024 * 1024;


            if (
                file.size > maxSize
            ) {

                showUploadMessage(
                    "File size must not exceed 10 MB."
                );

                return;

            }


            /* ---------------------------------------------
               TYPE CHECK
               --------------------------------------------- */

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


            /* ---------------------------------------------
               DOCUMENT TYPE CHECK
               --------------------------------------------- */

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
   VIEWER MESSAGE
   ========================================================= */

function showViewerMessage(
    icon,
    title,
    message
) {

    if (patientViewerMessageIcon) {

        patientViewerMessageIcon.textContent =
            icon;

    }


    if (patientViewerMessageTitle) {

        patientViewerMessageTitle.textContent =
            title;

    }


    if (patientViewerMessageText) {

        patientViewerMessageText.textContent =
            message;

    }


    if (patientViewerMessage) {

        patientViewerMessage.classList.add(
            "active"
        );

    }

}


/* =========================================================
   HIDE VIEWER MESSAGE
   ========================================================= */

function hideViewerMessage() {

    if (patientViewerMessage) {

        patientViewerMessage.classList.remove(
            "active"
        );

    }

}


/* =========================================================
   OPEN PATIENT DOCUMENT
   ========================================================= */

async function viewPatientDocument(
    documentId
) {

    /* ---------------------------------------------
       AUTHENTICATION
       --------------------------------------------- */

    const token =
        localStorage.getItem(
            "healthguard_token"
        );


    if (!token) {

        window.location.href =
            "../login.html";

        return;

    }


    /* ---------------------------------------------
       VALIDATE DOCUMENT ID
       --------------------------------------------- */

    const numericDocumentId =
        Number(documentId);


    if (
        !Number.isInteger(
            numericDocumentId
        ) ||
        numericDocumentId <= 0
    ) {

        alert(
            "Invalid document ID."
        );

        return;

    }


    /* ---------------------------------------------
       CLEAN PREVIOUS VIEWER
       --------------------------------------------- */

    closePatientDocumentViewer();


    currentlyViewedDocumentId =
        numericDocumentId;


    /* ---------------------------------------------
       UPDATE VIEWER HEADER
       --------------------------------------------- */

    if (patientDocumentId) {

        patientDocumentId.textContent =
            `Document ID: #${numericDocumentId}`;

    }


    /* ---------------------------------------------
       OPEN VIEWER
       --------------------------------------------- */

    if (patientDocumentViewer) {

        patientDocumentViewer.classList.add(
            "active"
        );

        patientDocumentViewer.setAttribute(
            "aria-hidden",
            "false"
        );

    }


    /* ---------------------------------------------
       SHOW LOADING
       --------------------------------------------- */

    showViewerMessage(
        "🔄",
        "Opening document",
        "HealthGuard AI is securely preparing your document."
    );


    /* ---------------------------------------------
       CLEAR FRAME
       --------------------------------------------- */

    if (patientDocumentFrame) {

        patientDocumentFrame.src =
            "about:blank";

    }


    /* ---------------------------------------------
       REQUEST DOCUMENT
       --------------------------------------------- */

    try {

        const response =
            await fetch(
                `${API_BASE_URL}/documents/${numericDocumentId}/view`,
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`,

                        "Accept":
                            "application/pdf,image/png,image/jpeg"
                    },

                    cache: "no-store"
                }
            );


        /* -----------------------------------------
           HANDLE AUTH FAILURE
           ----------------------------------------- */

        if (
            response.status === 401
        ) {

            localStorage.removeItem(
                "healthguard_token"
            );

            localStorage.removeItem(
                "healthguard_user"
            );

            window.location.href =
                "../login.html";

            return;

        }


        /* -----------------------------------------
           HANDLE OTHER ERRORS
           ----------------------------------------- */

        if (!response.ok) {

            let errorMessage =
                "Unable to open this document.";


            try {

                const error =
                    await response.json();

                if (
                    error &&
                    error.detail
                ) {

                    errorMessage =
                        error.detail;

                }

            } catch (_) {

                /* Response was not JSON */

            }


            throw new Error(
                errorMessage
            );

        }


        /* -----------------------------------------
           GET BLOB
           ----------------------------------------- */

        const blob =
            await response.blob();


        if (
            !blob ||
            blob.size === 0
        ) {

            throw new Error(
                "The document is empty or unavailable."
            );

        }


        /* -----------------------------------------
           CREATE TEMPORARY BLOB URL
           ----------------------------------------- */

        patientDocumentBlobUrl =
            URL.createObjectURL(
                blob
            );


        /* -----------------------------------------
           DISPLAY DOCUMENT
           ----------------------------------------- */

        if (patientDocumentFrame) {

            patientDocumentFrame.src =
                patientDocumentBlobUrl;


            patientDocumentFrame.onload =
                () => {

                    hideViewerMessage();

                };

        }


        /*
         * Some browsers do not fire iframe.onload
         * consistently for PDF blob URLs.
         *
         * Remove the loading message after a
         * short delay if the document has loaded.
         */

        setTimeout(
            () => {

                if (
                    currentlyViewedDocumentId ===
                    numericDocumentId
                ) {

                    hideViewerMessage();

                }

            },
            1200
        );


    } catch (error) {

        console.error(
            "Secure document viewer error:",
            error
        );


        showViewerMessage(
            "⚠️",
            "Unable to open document",
            error.message ||
            "HealthGuard AI could not securely load this document."
        );

    }

}


/* =========================================================
   CLOSE PATIENT DOCUMENT VIEWER
   ========================================================= */

function closePatientDocumentViewer() {

    currentlyViewedDocumentId =
        null;


    /* ---------------------------------------------
       STOP FRAME
       --------------------------------------------- */

    if (patientDocumentFrame) {

        patientDocumentFrame.src =
            "about:blank";

    }


    /* ---------------------------------------------
       RELEASE BLOB URL
       --------------------------------------------- */

    if (
        patientDocumentBlobUrl
    ) {

        URL.revokeObjectURL(
            patientDocumentBlobUrl
        );

        patientDocumentBlobUrl =
            null;

    }


    /* ---------------------------------------------
       HIDE VIEWER
       --------------------------------------------- */

    if (patientDocumentViewer) {

        patientDocumentViewer.classList.remove(
            "active"
        );

        patientDocumentViewer.setAttribute(
            "aria-hidden",
            "true"
        );

    }


    /* ---------------------------------------------
       RESET VIEWER MESSAGE
       --------------------------------------------- */

    hideViewerMessage();


    if (patientDocumentId) {

        patientDocumentId.textContent =
            "Document";

    }

}


/* =========================================================
   ESC KEY → CLOSE VIEWER
   ========================================================= */

document.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "Escape" &&
            patientDocumentViewer &&
            patientDocumentViewer.classList.contains(
                "active"
            )
        ) {

            closePatientDocumentViewer();

        }

    }
);


/* =========================================================
   PREVENT BACKGROUND SCROLL WHILE VIEWER IS OPEN
   ========================================================= */

if (patientDocumentViewer) {

    const observer =
        new MutationObserver(
            () => {

                const isOpen =
                    patientDocumentViewer.classList.contains(
                        "active"
                    );


                document.body.style.overflow =
                    isOpen
                        ? "hidden"
                        : "";

            }
        );


    observer.observe(
        patientDocumentViewer,
        {
            attributes: true,
            attributeFilter: [
                "class"
            ]
        }
    );

}


/* =========================================================
   CLEANUP ON PAGE EXIT
   ========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        if (
            patientDocumentBlobUrl
        ) {

            URL.revokeObjectURL(
                patientDocumentBlobUrl
            );

            patientDocumentBlobUrl =
                null;

        }

    }
);


/* =========================================================
   INITIALIZE
   ========================================================= */

if (
    checkDocumentAuthentication()
) {

    loadDocuments();

}