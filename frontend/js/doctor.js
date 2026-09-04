/* =========================================================
   HEALTHGUARD AI
   Doctor Portal
   ========================================================= */


/* =========================================================
   GLOBAL VIEWER STATE
   ========================================================= */

let secureViewerBlobUrl = null;
let secureViewerExpiryTimer = null;
let secureViewerDocumentId = null;


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        const token =
            localStorage.getItem(
                "healthguard_token"
            );


        /* Protect doctor pages */
        if (!token) {

            window.location.href =
                "../login.html";

            return;
        }


        try {

            const user =
                await getCurrentUser();


            /*
             * Only doctors should access
             * the doctor portal.
             */
            const userRole =
                String(
                    user.role && user.role.value
                        ? user.role.value
                        : user.role || ""
                ).toLowerCase();


            if (userRole !== "doctor") {

                redirectByRole(
                    user.role
                );

                return;
            }


            /*
             * Store latest user information.
             */
            localStorage.setItem(
                "healthguard_user",
                JSON.stringify(user)
            );


            /*
             * Populate doctor profile.
             */
            populateDoctorInformation(
                user
            );


            /*
             * Setup logout.
             */
            setupLogout();


            /*
             * Setup access-request form.
             */
            setupAccessRequestForm();


            /*
             * Setup document-access form.
             */
            setupDocumentAccessForm();


            /*
             * Set default access times.
             */
            setDefaultAccessTimes();


            /*
             * Load doctor's submitted
             * consent requests.
             */
            await loadDoctorConsentRequests();


        } catch (error) {

            console.error(
                "Doctor authentication error:",
                error
            );


            localStorage.removeItem(
                "healthguard_token"
            );

            localStorage.removeItem(
                "healthguard_user"
            );


            window.location.href =
                "../login.html";

        }

    }
);


/* =========================================================
   DOCTOR INFORMATION
   ========================================================= */

function populateDoctorInformation(
    user
) {

    const name =
        user.full_name ||
        "Doctor";


    /*
     * Remove an existing "Dr." before
     * adding the professional display title.
     */
    const cleanName =
        name
            .trim()
            .replace(
                /^Dr\.\s*/i,
                ""
            );


    /*
     * Doctor display format:
     *
     * Dr. Ravi Kumar 🩺
     */
    const displayName =
        String(
            user.role && user.role.value
                ? user.role.value
                : user.role || ""
        ).toLowerCase() === "doctor"
            ? `Dr. ${cleanName} 🩺`
            : cleanName;


    const initials =
        getInitials(
            cleanName
        );


    const doctorName =
        document.getElementById(
            "doctorName"
        );


    const sidebarName =
        document.getElementById(
            "sidebarName"
        );


    const topbarName =
        document.getElementById(
            "topbarName"
        );


    const sidebarAvatar =
        document.getElementById(
            "sidebarAvatar"
        );


    const topbarAvatar =
        document.getElementById(
            "topbarAvatar"
        );


    if (doctorName) {

        doctorName.textContent =
            displayName;

    }


    if (sidebarName) {

        sidebarName.textContent =
            displayName;

    }


    if (topbarName) {

        topbarName.textContent =
            displayName;

    }


    if (sidebarAvatar) {

        sidebarAvatar.textContent =
            initials;

    }


    if (topbarAvatar) {

        topbarAvatar.textContent =
            initials;

    }

}


/* =========================================================
   DOCTOR CONSENT / ACCESS REQUESTS
   ========================================================= */

async function loadDoctorConsentRequests() {

    const requestCount =
        document.getElementById(
            "doctorRequestCount"
        );


    const approvedCount =
        document.getElementById(
            "doctorApprovedCount"
        );


    const pendingCount =
        document.getElementById(
            "doctorPendingCount"
        );


    const recentRequests =
        document.getElementById(
            "doctorRecentRequests"
        );


    if (recentRequests) {

        recentRequests.innerHTML = `
            <div class="doctor-request-loading">
                Loading access requests...
            </div>
        `;

    }


    try {

        const response =
            await apiRequest(
                "/consents/doctor-requests",
                {
                    method: "GET"
                }
            );


        const requests =
            Array.isArray(response)
                ? response
                : [];


        console.log(
            "Doctor consent requests:",
            requests
        );


        const totalRequests =
            requests.length;


        const approvedRequests =
            requests.filter(
                consent =>
                    String(
                        consent.status || ""
                    ).toLowerCase()
                    === "approved"
            );


        const pendingRequests =
            requests.filter(
                consent =>
                    String(
                        consent.status || ""
                    ).toLowerCase()
                    === "pending"
            );


        if (requestCount) {

            requestCount.textContent =
                totalRequests;

        }


        if (approvedCount) {

            approvedCount.textContent =
                approvedRequests.length;

        }


        if (pendingCount) {

            pendingCount.textContent =
                pendingRequests.length;

        }


        renderDoctorRecentRequests(
            requests
        );


    } catch (error) {

        console.error(
            "Unable to load doctor consent requests:",
            error
        );


        if (requestCount) {

            requestCount.textContent =
                "0";

        }


        if (approvedCount) {

            approvedCount.textContent =
                "0";

        }


        if (pendingCount) {

            pendingCount.textContent =
                "0";

        }


        if (recentRequests) {

            recentRequests.innerHTML = `
                <div class="doctor-request-loading">
                    Unable to load access requests.
                </div>
            `;

        }

    }

}


/* =========================================================
   RENDER RECENT REQUESTS
   ========================================================= */

function renderDoctorRecentRequests(
    requests
) {

    const container =
        document.getElementById(
            "doctorRecentRequests"
        );


    if (!container) {
        return;
    }


    if (!requests.length) {

        container.innerHTML = `
            <div class="doctor-request-loading">
                No access requests submitted yet.
            </div>
        `;

        return;

    }


    const recentRequests =
        [...requests]
            .sort(
                (a, b) =>
                    new Date(
                        b.created_at || 0
                    ) -
                    new Date(
                        a.created_at || 0
                    )
            )
            .slice(
                0,
                5
            );


    container.innerHTML =
        recentRequests
            .map(
                consent =>
                    createDoctorRequestCard(
                        consent
                    )
            )
            .join("");

}


/* =========================================================
   DOCTOR REQUEST CARD
   ========================================================= */

function createDoctorRequestCard(
    consent
) {

    const status =
        String(
            consent.status ||
            "unknown"
        ).toLowerCase();


    let statusClass =
        "pending";


    if (
        status === "approved"
    ) {

        statusClass =
            "approved";

    }
    else if (
        status === "denied"
    ) {

        statusClass =
            "denied";

    }
    else if (
        status === "expired"
    ) {

        statusClass =
            "expired";

    }


    const statusText =
        status.charAt(0).toUpperCase() +
        status.slice(1);


    const purpose =
        escapeHtml(
            consent.purpose ||
            "Medical consultation"
        );


    const documentId =
        consent.document_id ??
        "—";


    const createdAt =
        consent.created_at
            ? formatDoctorDate(
                consent.created_at
            )
            : "—";


    return `
        <div class="doctor-request-card">

            <div class="doctor-request-main">

                <div class="doctor-request-icon">
                    📄
                </div>

                <div>

                    <strong>
                        Medical Document #${escapeHtml(
                            String(documentId)
                        )}
                    </strong>

                    <small>
                        ${purpose}
                    </small>

                    <small>
                        Requested ${escapeHtml(createdAt)}
                    </small>

                </div>

            </div>


            <div class="doctor-request-status ${statusClass}">
                ${escapeHtml(statusText)}
            </div>

        </div>
    `;

}


/* =========================================================
   FORMAT REQUEST DATE
   ========================================================= */

function formatDoctorDate(
    value
) {

    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "Unknown date";

    }


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


/* =========================================================
   ACCESS REQUEST FORM
   ========================================================= */

function setupAccessRequestForm() {

    const form =
        document.getElementById(
            "accessRequestForm"
        );


    if (!form) {
        return;
    }


    /*
     * Prevent duplicate listeners.
     */
    if (
        form.dataset.requestFormReady === "true"
    ) {

        return;

    }


    form.dataset.requestFormReady =
        "true";


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const documentIdInput =
                document.getElementById(
                    "documentId"
                );


            const purposeInput =
                document.getElementById(
                    "purpose"
                );


            const startTimeInput =
                document.getElementById(
                    "startTime"
                );


            const expiryTimeInput =
                document.getElementById(
                    "expiryTime"
                );


            if (
                !documentIdInput ||
                !purposeInput ||
                !startTimeInput ||
                !expiryTimeInput
            ) {

                showMessage(
                    "requestMessage",
                    "Access request form is not configured correctly.",
                    "error"
                );

                return;

            }


            const documentId =
                Number(
                    documentIdInput.value
                );


            const purpose =
                purposeInput.value.trim();


            const startTime =
                startTimeInput.value;


            const expiryTime =
                expiryTimeInput.value;


            /* -----------------------------------------
               DOCUMENT ID
               ----------------------------------------- */

            if (
                !Number.isInteger(
                    documentId
                ) ||
                documentId <= 0
            ) {

                showMessage(
                    "requestMessage",
                    "Please enter a valid medical document ID.",
                    "error"
                );

                return;

            }


            /* -----------------------------------------
               PURPOSE
               ----------------------------------------- */

            if (!purpose) {

                showMessage(
                    "requestMessage",
                    "Please provide the medical purpose.",
                    "error"
                );

                return;

            }


            /* -----------------------------------------
               ACCESS TIMES
               ----------------------------------------- */

            if (
                !startTime ||
                !expiryTime
            ) {

                showMessage(
                    "requestMessage",
                    "Please select the access period.",
                    "error"
                );

                return;

            }


            const start =
                new Date(
                    startTime
                );


            const expiry =
                new Date(
                    expiryTime
                );


            if (
                Number.isNaN(
                    start.getTime()
                ) ||
                Number.isNaN(
                    expiry.getTime()
                )
            ) {

                showMessage(
                    "requestMessage",
                    "Please provide valid access dates.",
                    "error"
                );

                return;

            }


            if (
                expiry <= start
            ) {

                showMessage(
                    "requestMessage",
                    "Expiry time must be later than start time.",
                    "error"
                );

                return;

            }


            /*
             * Don't allow completely expired
             * access periods.
             */
            if (
                expiry <= new Date()
            ) {

                showMessage(
                    "requestMessage",
                    "Expiry time must be in the future.",
                    "error"
                );

                return;

            }


            /* -----------------------------------------
               CURRENT DOCTOR
               ----------------------------------------- */

            const user =
                getStoredUser();


            if (!user) {

                showMessage(
                    "requestMessage",
                    "Unable to identify the authenticated doctor.",
                    "error"
                );

                return;

            }


            if (!user.hospital_id) {

                showMessage(
                    "requestMessage",
                    "Your doctor account is not linked to a hospital.",
                    "error"
                );

                return;

            }


            /* -----------------------------------------
               BUTTON
               ----------------------------------------- */

            const button =
                document.getElementById(
                    "requestAccessButton"
                );


            if (button) {

                button.disabled =
                    true;

                button.textContent =
                    "Submitting Request...";

            }


            try {

                const requestBody = {

                    document_id:
                        documentId,

                    requesting_hospital_id:
                        Number(
                            user.hospital_id
                        ),

                    requesting_user_id:
                        Number(
                            user.id
                        ),

                    purpose:
                        purpose,

                    start_time:
                        formatDateTimeForAPI(
                            start
                        ),

                    expiry_time:
                        formatDateTimeForAPI(
                            expiry
                        )

                };


                console.log(
                    "Consent request:",
                    requestBody
                );


                const response =
                    await apiRequest(
                        "/consents",
                        {
                            method: "POST",
                            body:
                                JSON.stringify(
                                    requestBody
                                )
                        }
                    );


                console.log(
                    "Consent created:",
                    response
                );


                showMessage(
                    "requestMessage",
                    `Access request #${response.id} submitted successfully. The patient must approve it before the document can be accessed.`,
                    "success"
                );


                form.reset();

                setDefaultAccessTimes();

                await loadDoctorConsentRequests();


            } catch (error) {

                console.error(
                    "Consent request failed:",
                    error
                );


                showMessage(
                    "requestMessage",
                    getErrorMessage(
                        error,
                        "Unable to create access request."
                    ),
                    "error"
                );

            } finally {

                if (button) {

                    button.disabled =
                        false;

                    button.textContent =
                        "Submit Access Request";

                }

            }

        }
    );

}


/* =========================================================
   DOCUMENT ACCESS FORM
   ========================================================= */

function setupDocumentAccessForm() {

    const form =
        document.getElementById(
            "documentAccessForm"
        );


    if (!form) {
        return;
    }


    if (
        form.dataset.documentAccessReady === "true"
    ) {

        return;

    }


    form.dataset.documentAccessReady =
        "true";


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const input =
                document.getElementById(
                    "accessDocumentId"
                );


            if (!input) {

                showMessage(
                    "accessMessage",
                    "Document access form is not configured correctly.",
                    "error"
                );

                return;

            }


            const documentId =
                Number(
                    input.value
                );


            if (
                !Number.isInteger(
                    documentId
                ) ||
                documentId <= 0
            ) {

                showMessage(
                    "accessMessage",
                    "Please enter a valid document ID.",
                    "error"
                );

                return;

            }


            /*
             * Close an existing viewer.
             */
            closeSecureViewer();


            const button =
                document.getElementById(
                    "accessDocumentButton"
                );


            if (button) {

                button.disabled =
                    true;

                button.textContent =
                    "Analyzing Access...";

            }


            hideElement(
                "accessResultPanel"
            );


            /*
             * Clear old access message.
             */
            const accessMessage =
                document.getElementById(
                    "accessMessage"
                );


            if (accessMessage) {

                accessMessage.textContent =
                    "";

                accessMessage.style.display =
                    "none";

            }


            try {

                /*
                 * First request:
                 *
                 * Consent
                 * Zero Trust
                 * ML decision
                 *
                 * No document bytes are returned here.
                 */
                const response =
                    await apiRequest(
                        `/access/documents/${documentId}`,
                        {
                            method: "GET"
                        }
                    );


                console.log(
                    "Document access result:",
                    response
                );


                /*
                 * Security check succeeded.
                 *
                 * Open the actual secure viewer.
                 */
                await showAllowedResult(
                    response,
                    documentId
                );


            } catch (error) {

                console.error(
                    "Document access failed:",
                    error
                );


                showSecurityResult(
                    error,
                    documentId
                );

            } finally {

                if (button) {

                    button.disabled =
                        false;

                    button.textContent =
                        "Attempt Secure Access";

                }

            }

        }
    );

}


/* =========================================================
   ALLOWED RESULT
   ========================================================= */

async function showAllowedResult(
    medicalDocument,
    documentId
) {

    const panel =
        document.getElementById(
            "accessResultPanel"
        );


    const result =
        document.getElementById(
            "accessResult"
        );


    if (!panel || !result) {

        return;

    }


    panel.style.display =
        "block";


    result.innerHTML = `

        <div class="security-result success">

            <div class="result-icon">
                ✓
            </div>


            <div>

                <span class="status-caption">
                    SECURITY DECISION
                </span>


                <h3>
                    ACCESS ALLOWED
                </h3>


                <p>
                    HealthGuard AI approved secure
                    viewing for medical document
                    #${escapeHtml(
                        String(documentId)
                    )}.
                </p>


                <div class="result-details">

                    <div>

                        <strong>
                            Document
                        </strong>

                        <span>
                            ${escapeHtml(
                                medicalDocument.document_name ||
                                `Document #${documentId}`
                            )}
                        </span>

                    </div>


                    <div>

                        <strong>
                            Type
                        </strong>

                        <span>
                            ${escapeHtml(
                                medicalDocument.document_type ||
                                "Medical Record"
                            )}
                        </span>

                    </div>


                    <div>

                        <strong>
                            Storage Protection
                        </strong>

                        <span>
                            ${
                                medicalDocument.is_encrypted
                                    ? "Encrypted"
                                    : "Legacy Storage"
                            }
                        </span>

                    </div>

                </div>

            </div>

        </div>

    `;


    /*
     * Open secure viewer.
     */
    await openSecureDocumentViewer(
        medicalDocument,
        documentId
    );

}


/* =========================================================
   SECURE DOCUMENT VIEWER
   ========================================================= */

async function openSecureDocumentViewer(
    medicalDocument,
    documentId
) {

    /*
     * IMPORTANT:
     *
     * The parameter is named "medicalDocument"
     * instead of "document".
     *
     * This prevents shadowing the browser's
     * global document object.
     */

    const viewerPanel =
        document.getElementById(
            "secureDocumentViewerPanel"
        );


    const viewerFrame =
        document.getElementById(
            "secureDocumentFrame"
        );


    const viewerMessage =
        document.getElementById(
            "secureViewerMessage"
        );


    const viewerName =
        document.getElementById(
            "secureViewerDocumentName"
        );


    const viewerType =
        document.getElementById(
            "secureViewerDocumentType"
        );


    const expiryElement =
        document.getElementById(
            "secureViewerExpiry"
        );


    if (
        !viewerPanel ||
        !viewerFrame
    ) {

        console.error(
            "Secure document viewer elements are missing."
        );

        return;

    }


    secureViewerDocumentId =
        Number(
            documentId
        );


    /* ---------------------------------------------
       DOCUMENT INFORMATION
       --------------------------------------------- */

    if (viewerName) {

        viewerName.textContent =
            medicalDocument.document_name ||
            `Medical Document #${documentId}`;

    }


    if (viewerType) {

        viewerType.textContent =
            medicalDocument.document_type ||
            "Medical Record";

    }


    /* ---------------------------------------------
       SHOW VIEWER
       --------------------------------------------- */

    viewerPanel.style.display =
        "block";


    viewerFrame.style.display =
        "none";


    if (viewerMessage) {

        viewerMessage.style.display =
            "flex";


        viewerMessage.innerHTML = `
            <div class="secure-viewer-loading">

                <div class="secure-viewer-loading-icon">
                    🔐
                </div>

                <strong>
                    Opening secure medical document...
                </strong>

                <p>
                    HealthGuard AI is verifying
                    the protected document session.
                </p>

            </div>
        `;

    }


    /* ---------------------------------------------
       GET CONSENT INFORMATION
       --------------------------------------------- */

    let consent = null;


    try {

        const requests =
            await apiRequest(
                "/consents/doctor-requests",
                {
                    method: "GET"
                }
            );


        if (
            Array.isArray(requests)
        ) {

            const matchingRequests =
                requests
                    .filter(
                        item =>
                            Number(
                                item.document_id
                            )
                            === Number(
                                documentId
                            )
                    )
                    .sort(
                        (a, b) =>
                            new Date(
                                b.created_at || 0
                            ) -
                            new Date(
                                a.created_at || 0
                            )
                    );


            /*
             * Use the latest approved
             * consent for the countdown.
             */
            consent =
                matchingRequests.find(
                    item =>
                        String(
                            item.status || ""
                        ).toLowerCase()
                        === "approved"
                );

        }

    } catch (error) {

        console.error(
            "Unable to retrieve consent details:",
            error
        );

    }


    /* ---------------------------------------------
       CONSENT EXPIRY
       --------------------------------------------- */

    if (
        consent &&
        consent.expiry_time
    ) {

        const expiryDate =
            parseBackendDate(
                consent.expiry_time
            );


        if (expiryDate) {

            /*
             * Do not open an already-expired
             * viewer session.
             */
            if (
                expiryDate.getTime()
                <= Date.now()
            ) {

                lockSecureViewer(
                    "Your approved patient-consent period has expired."
                );

                if (expiryElement) {

                    expiryElement.textContent =
                        "ACCESS EXPIRED";

                    expiryElement.classList.add(
                        "expired"
                    );

                }

                return;

            }


            startSecureViewerCountdown(
                expiryDate,
                expiryElement
            );

        }
        else if (expiryElement) {

            expiryElement.textContent =
                "Expiry unavailable";

        }

    }
    else if (expiryElement) {

        expiryElement.textContent =
            "Expiry unavailable";

    }


    /* ---------------------------------------------
       FETCH ACTUAL DOCUMENT
       --------------------------------------------- */

    try {

        const blob =
            await fetchSecureDocumentBlob(
                documentId
            );


        /*
         * Make sure viewer was not closed
         * while the request was running.
         */
        if (
            secureViewerDocumentId
            !== Number(documentId)
        ) {

            return;

        }


        /*
         * Make sure the consent hasn't expired
         * while the document was being fetched.
         */
        if (
            consent &&
            consent.expiry_time
        ) {

            const expiryDate =
                parseBackendDate(
                    consent.expiry_time
                );


            if (
                expiryDate &&
                expiryDate.getTime()
                <= Date.now()
            ) {

                lockSecureViewer(
                    "Your approved patient-consent period has expired."
                );

                return;

            }

        }


        secureViewerBlobUrl =
            URL.createObjectURL(
                blob
            );


        viewerFrame.src =
            secureViewerBlobUrl;


        viewerFrame.style.display =
            "block";


        if (viewerMessage) {

            viewerMessage.style.display =
                "none";

        }


    } catch (error) {

        console.error(
            "Secure document viewer failed:",
            error
        );


        viewerFrame.style.display =
            "none";


        if (viewerMessage) {

            viewerMessage.style.display =
                "flex";


            viewerMessage.innerHTML = `

                <div class="secure-viewer-error">

                    <div
                        style="
                            font-size:36px;
                            margin-bottom:12px;
                        "
                    >
                        ⚠️
                    </div>


                    <strong>
                        Unable to open secure document
                    </strong>


                    <p>
                        ${escapeHtml(
                            getErrorMessage(
                                error,
                                "The medical document could not be opened."
                            )
                        )}
                    </p>

                </div>

            `;

        }

    }

}


/* =========================================================
   FETCH SECURE DOCUMENT BLOB
   ========================================================= */

async function fetchSecureDocumentBlob(
    documentId
) {

    const token =
        localStorage.getItem(
            "healthguard_token"
        );


    if (!token) {

        throw new Error(
            "Your session has expired. Please log in again."
        );

    }


    const response =
        await fetch(
            `${API_BASE_URL}/access/documents/${documentId}/view`,
            {
                method: "GET",

                headers: {

                    "Authorization":
                        `Bearer ${token}`,

                    "Accept":
                        "application/pdf,image/png,image/jpeg"

                },

                cache:
                    "no-store"

            }
        );


    /* ---------------------------------------------
       AUTHENTICATION FAILURE
       --------------------------------------------- */

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


        throw new Error(
            "Your session has expired. Please log in again."
        );

    }


    /* ---------------------------------------------
       HANDLE SECURITY ERRORS
       --------------------------------------------- */

    if (!response.ok) {

        let message =
            "Unable to open the medical document.";


        try {

            const errorData =
                await response.json();


            if (
                typeof errorData.detail ===
                "string"
            ) {

                message =
                    errorData.detail;

            }
            else if (
                errorData.detail &&
                typeof errorData.detail ===
                    "object"
            ) {

                message =
                    errorData.detail.message ||
                    "HealthGuard AI blocked this document access request.";

            }

        } catch (_) {

            /*
             * Response wasn't JSON.
             */

        }


        throw new Error(
            message
        );

    }


    /* ---------------------------------------------
       READ BLOB
       --------------------------------------------- */

    const blob =
        await response.blob();


    if (
        !blob ||
        blob.size === 0
    ) {

        throw new Error(
            "The medical document is empty."
        );

    }


    return blob;

}


/* =========================================================
   SECURE VIEWER COUNTDOWN
   ========================================================= */

function startSecureViewerCountdown(
    expiryDate,
    expiryElement
) {

    if (secureViewerExpiryTimer) {

        clearInterval(
            secureViewerExpiryTimer
        );

        secureViewerExpiryTimer =
            null;

    }


    function updateCountdown() {

        /*
         * Do nothing if viewer has been closed.
         */
        if (
            !secureViewerDocumentId
        ) {

            clearInterval(
                secureViewerExpiryTimer
            );


            secureViewerExpiryTimer =
                null;


            return;

        }


        const now =
            new Date();


        const remaining =
            expiryDate.getTime() -
            now.getTime();


        /* -----------------------------------------
           EXPIRED
           ----------------------------------------- */

        if (
            remaining <= 0
        ) {

            if (expiryElement) {

                expiryElement.textContent =
                    "ACCESS EXPIRED";


                expiryElement.classList.add(
                    "expired"
                );

            }


            clearInterval(
                secureViewerExpiryTimer
            );


            secureViewerExpiryTimer =
                null;


            lockSecureViewer(
                "Your approved patient-consent period has expired."
            );


            return;

        }


        /* -----------------------------------------
           REMAINING TIME
           ----------------------------------------- */

        const totalSeconds =
            Math.floor(
                remaining / 1000
            );


        const days =
            Math.floor(
                totalSeconds / 86400
            );


        const hours =
            Math.floor(
                (totalSeconds % 86400) / 3600
            );


        const minutes =
            Math.floor(
                (totalSeconds % 3600) / 60
            );


        const seconds =
            totalSeconds % 60;


        let countdownText =
            "";


        if (days > 0) {

            countdownText +=
                `${days}d `;

        }


        countdownText +=
            `${String(hours).padStart(2, "0")}:` +
            `${String(minutes).padStart(2, "0")}:` +
            `${String(seconds).padStart(2, "0")}`;


        if (expiryElement) {

            expiryElement.textContent =
                countdownText;


            expiryElement.classList.remove(
                "expired"
            );

        }

    }


    updateCountdown();


    secureViewerExpiryTimer =
        setInterval(
            updateCountdown,
            1000
        );

}


/* =========================================================
   LOCK SECURE VIEWER
   ========================================================= */

function lockSecureViewer(
    message
) {

    const viewerFrame =
        document.getElementById(
            "secureDocumentFrame"
        );


    const viewerMessage =
        document.getElementById(
            "secureViewerMessage"
        );


    if (viewerFrame) {

        viewerFrame.src =
            "about:blank";


        viewerFrame.style.display =
            "none";

    }


    /* ---------------------------------------------
       RELEASE BLOB
       --------------------------------------------- */

    if (
        secureViewerBlobUrl
    ) {

        URL.revokeObjectURL(
            secureViewerBlobUrl
        );


        secureViewerBlobUrl =
            null;

    }


    if (viewerMessage) {

        viewerMessage.style.display =
            "flex";


        viewerMessage.innerHTML = `

            <div class="secure-viewer-expired">

                <div class="secure-expired-icon">
                    🔒
                </div>


                <h3>
                    Access Expired
                </h3>


                <p>
                    ${escapeHtml(
                        message ||
                        "This medical document is no longer available."
                    )}
                </p>


                <small>
                    Patient consent is required for continued access.
                </small>

            </div>

        `;

    }

}


/* =========================================================
   CLOSE SECURE VIEWER
   ========================================================= */

function closeSecureViewer() {

    if (
        secureViewerExpiryTimer
    ) {

        clearInterval(
            secureViewerExpiryTimer
        );


        secureViewerExpiryTimer =
            null;

    }


    const viewerFrame =
        document.getElementById(
            "secureDocumentFrame"
        );


    const viewerPanel =
        document.getElementById(
            "secureDocumentViewerPanel"
        );


    if (viewerFrame) {

        viewerFrame.src =
            "about:blank";


        viewerFrame.style.display =
            "none";

    }


    if (
        secureViewerBlobUrl
    ) {

        URL.revokeObjectURL(
            secureViewerBlobUrl
        );


        secureViewerBlobUrl =
            null;

    }


    if (viewerPanel) {

        viewerPanel.style.display =
            "none";

    }


    secureViewerDocumentId =
        null;

}


/* =========================================================
   PARSE BACKEND DATETIME
   ========================================================= */

function parseBackendDate(
    value
) {

    if (!value) {
        return null;
    }


    const normalized =
        String(value)
            .trim()
            .replace(
                " ",
                "T"
            );


    const date =
        new Date(
            normalized
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return null;

    }


    return date;

}


/* =========================================================
   SECURITY RESULT
   ========================================================= */

function showSecurityResult(
    error,
    documentId
) {

    const panel =
        document.getElementById(
            "accessResultPanel"
        );


    const result =
        document.getElementById(
            "accessResult"
        );


    if (!panel || !result) {
        return;
    }


    panel.style.display =
        "block";


    /*
     * Try to extract structured
     * backend security information.
     */
    const data =
        extractErrorDetail(
            error
        );


    if (
        data &&
        typeof data === "object"
    ) {

        const riskLevel =
            data.risk_level ||
            "UNKNOWN";


        const riskScore =
            data.risk_score !== undefined &&
            data.risk_score !== null
                ? data.risk_score
                : "—";


        const prediction =
            data.prediction ||
            "UNKNOWN";


        const action =
            data.security_action ||
            "DENY";


        const resultClass =
            action === "MFA_REQUIRED"
                ? "warning"
                : "danger";


        const heading =
            action === "MFA_REQUIRED"
                ? "MFA REQUIRED"
                : "ACCESS DENIED";


        const icon =
            action === "MFA_REQUIRED"
                ? "!"
                : "✕";


        const note =
            action === "MFA_REQUIRED"
                ? "Additional authentication is required."
                : "HealthGuard AI blocked this access attempt.";


        result.innerHTML = `

            <div class="security-result ${resultClass}">

                <div class="result-icon">
                    ${icon}
                </div>


                <div>

                    <span class="status-caption">
                        AI SECURITY DECISION
                    </span>


                    <h3>
                        ${escapeHtml(
                            heading
                        )}
                    </h3>


                    <p>
                        ${escapeHtml(
                            data.message ||
                            getErrorMessage(
                                error,
                                "Access was rejected."
                            )
                        )}
                    </p>


                    <div class="risk-metrics">

                        <div>

                            <span>
                                Risk Level
                            </span>

                            <strong>
                                ${escapeHtml(
                                    String(
                                        riskLevel
                                    )
                                )}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Risk Score
                            </span>

                            <strong>
                                ${escapeHtml(
                                    String(
                                        riskScore
                                    )
                                )}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Prediction
                            </span>

                            <strong>
                                ${escapeHtml(
                                    String(
                                        prediction
                                    )
                                )}
                            </strong>

                        </div>

                    </div>


                    <div class="security-decision-note">

                        <strong>
                            Document #${escapeHtml(
                                String(documentId)
                            )}
                        </strong>

                        <span>
                            ${escapeHtml(note)}
                        </span>

                    </div>

                </div>

            </div>

        `;


        return;

    }


    /* ---------------------------------------------
       GENERIC ACCESS DENIAL
       --------------------------------------------- */

    result.innerHTML = `

        <div class="security-result danger">

            <div class="result-icon">
                ✕
            </div>


            <div>

                <span class="status-caption">
                    ACCESS BLOCKED
                </span>


                <h3>
                    ACCESS DENIED
                </h3>


                <p>
                    ${escapeHtml(
                        getErrorMessage(
                            error,
                            "The document could not be accessed."
                        )
                    )}
                </p>


                <div class="security-decision-note">

                    <strong>
                        Document #${escapeHtml(
                            String(documentId)
                        )}
                    </strong>

                    <span>
                        Verify that valid patient consent
                        exists and has not expired.
                    </span>

                </div>

            </div>

        </div>

    `;

}


/* =========================================================
   ERROR DETAIL EXTRACTION
   ========================================================= */

function extractErrorDetail(
    error
) {

    if (!error) {
        return null;
    }


    /*
     * Common apiRequest structure.
     */
    if (
        error.data &&
        error.data.detail
    ) {

        return error.data.detail;

    }


    /*
     * Another possible structure.
     */
    if (
        error.detail
    ) {

        return error.detail;

    }


    /*
     * Some implementations store
     * response JSON here.
     */
    if (
        error.response &&
        error.response.detail
    ) {

        return error.response.detail;

    }


    return null;

}


/* =========================================================
   ERROR MESSAGE
   ========================================================= */

function getErrorMessage(
    error,
    fallback
) {

    const detail =
        extractErrorDetail(
            error
        );


    if (
        typeof detail === "string"
    ) {

        return detail;

    }


    if (
        detail &&
        typeof detail === "object" &&
        detail.message
    ) {

        return detail.message;

    }


    if (
        error &&
        error.message
    ) {

        return error.message;

    }


    return fallback;

}


/* =========================================================
   DEFAULT ACCESS TIMES
   ========================================================= */

function setDefaultAccessTimes() {

    const startInput =
        document.getElementById(
            "startTime"
        );


    const expiryInput =
        document.getElementById(
            "expiryTime"
        );


    if (
        !startInput ||
        !expiryInput
    ) {

        return;

    }


    /*
     * Don't overwrite existing values.
     */
    if (
        startInput.value ||
        expiryInput.value
    ) {

        return;

    }


    const now =
        new Date();


    /*
     * Default access period:
     * 3 days.
     */
    const expiry =
        new Date(
            now.getTime()
            +
            (
                3 *
                24 *
                60 *
                60 *
                1000
            )
        );


    startInput.value =
        formatDateTimeLocal(
            now
        );


    expiryInput.value =
        formatDateTimeLocal(
            expiry
        );

}


/* =========================================================
   DATE FORMAT — LOCAL INPUT
   ========================================================= */

function formatDateTimeLocal(
    date
) {

    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        );


    const hours =
        String(
            date.getHours()
        ).padStart(
            2,
            "0"
        );


    const minutes =
        String(
            date.getMinutes()
        ).padStart(
            2,
            "0"
        );


    return (
        `${year}-${month}-${day}` +
        `T${hours}:${minutes}`
    );

}


/* =========================================================
   DATE FORMAT — API
   ========================================================= */

function formatDateTimeForAPI(
    date
) {

    /*
     * Backend currently expects the
     * local datetime format.
     *
     * Example:
     * 2026-09-04T18:30
     */
    return formatDateTimeLocal(
        date
    );

}


/* =========================================================
   MESSAGE
   ========================================================= */

function showMessage(
    elementId,
    message,
    type
) {

    const element =
        document.getElementById(
            elementId
        );


    if (!element) {
        return;
    }


    element.textContent =
        message;


    element.className =
        `auth-message ${type}`;


    element.style.display =
        "block";

}


/* =========================================================
   HIDE ELEMENT
   ========================================================= */

function hideElement(
    elementId
) {

    const element =
        document.getElementById(
            elementId
        );


    if (element) {

        element.style.display =
            "none";

    }

}


/* =========================================================
   LOGOUT
   ========================================================= */

function setupLogout() {

    const logoutButton =
        document.getElementById(
            "logoutButton"
        );


    if (!logoutButton) {
        return;
    }


    /*
     * Prevent duplicate listener.
     */
    if (
        logoutButton.dataset.logoutReady === "true"
    ) {

        return;

    }


    logoutButton.dataset.logoutReady =
        "true";


    logoutButton.addEventListener(
        "click",
        () => {

            closeSecureViewer();

            logoutUser();

        }
    );

}


/* =========================================================
   INITIALS
   ========================================================= */

function getInitials(
    name
) {

    const parts =
        name
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    if (!parts.length) {

        return "DR";

    }


    if (
        parts.length === 1
    ) {

        return parts[0]
            .substring(
                0,
                2
            )
            .toUpperCase();

    }


    return (
        parts[0][0] +
        parts[
            parts.length - 1
        ][0]
    ).toUpperCase();

}


/* =========================================================
   HTML ESCAPING
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
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================================
   CLOSE VIEWER WITH ESCAPE KEY
   ========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape" &&
            secureViewerDocumentId
        ) {

            closeSecureViewer();

        }

    }
);


/* =========================================================
   CLEANUP ON PAGE EXIT
   ========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        if (
            secureViewerExpiryTimer
        ) {

            clearInterval(
                secureViewerExpiryTimer
            );


            secureViewerExpiryTimer =
                null;

        }


        if (
            secureViewerBlobUrl
        ) {

            URL.revokeObjectURL(
                secureViewerBlobUrl
            );


            secureViewerBlobUrl =
                null;

        }

    }
);