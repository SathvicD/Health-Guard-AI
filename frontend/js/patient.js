/* =========================================================
   HEALTHGUARD AI
   Patient Dashboard
   ========================================================= */


/* =========================================================
   GLOBAL DATA
   ========================================================= */

let patientDocuments = [];
let hospitals = [];


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


        /*
         * Protect patient pages.
         */
        if (!token) {

            window.location.href =
                "../login.html";

            return;
        }


        try {

            /*
             * Get authenticated user
             * from FastAPI.
             */
            const user =
                await getCurrentUser();


            /*
             * Only patients can access
             * patient portal pages.
             */
            if (
                String(user.role).toLowerCase()
                !== "patient"
            ) {

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
             * Populate patient profile.
             */
            populatePatientInformation(
                user
            );


            /*
             * Setup logout.
             */
            setupLogout();


            /*
             * Load patient's actual
             * medical documents.
             */
            await loadPatientDocuments();


            /*
             * Load hospital information.
             */
            await loadHospitals();


            /*
             * Load actual consent requests.
             */
            await loadPatientConsents();


            /*
             * Setup approve / deny
             * event handling.
             */
            setupConsentActions();


        } catch (error) {

            console.error(
                "Patient dashboard authentication error:",
                error
            );


            /*
             * Authentication failed.
             */
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
   PATIENT INFORMATION
   ========================================================= */

function populatePatientInformation(
    user
) {

    const name =
        user.full_name ||
        "Patient";


    /*
     * Keep the complete name for the
     * sidebar and top-right profile.
     *
     * Example:
     * Rahul Kumar
     */
    const fullName =
        name.trim();


    /*
     * Get the patient's given/first name
     * for the dashboard greeting.
     *
     * Example:
     * Rahul Kumar → Rahul
     * Sathvic Devabathula → Sathvic
     */
    const firstName =
        fullName
            .split(/\s+/)[0] ||
            "Patient";


    /*
     * The current demo account is:
     *
     * Test Patient
     *
     * Since "Test" is only a placeholder
     * name for the demo account, display
     * "Patient" in the welcome greeting.
     *
     * This does NOT affect the actual
     * stored/database name.
     */
    const greetingName =
        (
            fullName.toLowerCase() ===
            "test patient"
        )
            ? "Patient"
            : firstName;


    const initials =
        getInitials(fullName);


    const patientName =
        document.getElementById(
            "patientName"
        );


    const sidebarName =
        document.getElementById(
            "sidebarName"
        );


    const sidebarRole =
        document.getElementById(
            "sidebarRole"
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


    /*
     * Main dashboard greeting.
     *
     * Current demo:
     * Welcome back, Patient
     *
     * Real patient:
     * Welcome back, Rahul
     */
    if (patientName) {

        patientName.textContent =
            greetingName;

    }


    /*
     * Sidebar continues showing
     * the complete registered name.
     *
     * Example:
     * Test Patient
     * Rahul Kumar
     */
    if (sidebarName) {

        sidebarName.textContent =
            fullName;

    }


    /*
     * Patient role.
     */
    if (sidebarRole) {

        sidebarRole.textContent =
            "Patient";

    }


    /*
     * Top-right profile continues
     * showing the complete name.
     */
    if (topbarName) {

        topbarName.textContent =
            fullName;

    }


    /*
     * Avatar initials.
     *
     * Example:
     * Test Patient → TP
     * Rahul Kumar → RK
     */
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
   LOAD PATIENT DOCUMENTS
   ========================================================= */

async function loadPatientDocuments() {

    try {

        /*
         * This endpoint returns documents
         * belonging to the authenticated patient.
         */
        const documents =
            await apiRequest(
                "/documents/my-documents",
                {
                    method: "GET"
                }
            );


        console.log(
            "Patient documents:",
            documents
        );


        patientDocuments =
            Array.isArray(documents)
                ? documents
                : [];


        /*
         * Update document counter.
         */
        const documentCount =
            document.getElementById(
                "documentCount"
            );


        if (documentCount) {

            documentCount.textContent =
                patientDocuments.length;

        }


        /*
         * Update the Recent Document
         * section if it exists on the page.
         */
        updateRecentDocument();


    } catch (error) {

        console.error(
            "Unable to load patient documents:",
            error
        );


        /*
         * Keep the page usable even if
         * document loading fails.
         */
        const documentCount =
            document.getElementById(
                "documentCount"
            );


        if (documentCount) {

            documentCount.textContent =
                "—";

        }

    }

}


/* =========================================================
   UPDATE RECENT DOCUMENT
   ========================================================= */

function updateRecentDocument() {

    /*
     * Find the most recently created document.
     */
    if (!patientDocuments.length) {
        return;
    }


    const sortedDocuments =
        [...patientDocuments].sort(
            (a, b) =>
                new Date(
                    b.created_at || 0
                ) -
                new Date(
                    a.created_at || 0
                )
        );


    const latestDocument =
        sortedDocuments[0];


    /*
     * IMPORTANT:
     * Don't use the variable name "document"
     * here because it conflicts with the
     * browser's global document object.
     */


    const nameElement =
        document.querySelector(
            ".document-details strong"
        );


    const typeElement =
        document.querySelector(
            ".document-details span"
        );


    const descriptionElement =
        document.querySelector(
            ".document-details small"
        );


    const encryptedBadge =
        document.querySelector(
            ".encrypted-badge"
        );


    if (nameElement) {

        nameElement.textContent =
            latestDocument.document_name ||
            "Medical Document";

    }


    if (typeElement) {

        typeElement.textContent =
            latestDocument.document_type ||
            "Medical Record";

    }


    if (descriptionElement) {

        descriptionElement.textContent =
            latestDocument.description ||
            "Stored securely";

    }


    if (encryptedBadge) {

        encryptedBadge.textContent =
            latestDocument.is_encrypted
                ? "🔒 Encrypted"
                : "Protected";

    }

}


/* =========================================================
   LOAD HOSPITALS
   ========================================================= */

async function loadHospitals() {

    try {

        /*
         * Get hospital information from
         * the authenticated hospitals endpoint.
         */
        const result =
            await apiRequest(
                "/hospitals",
                {
                    method: "GET"
                }
            );


        console.log(
            "Hospitals:",
            result
        );


        hospitals =
            Array.isArray(result)
                ? result
                : [];


    } catch (error) {

        console.error(
            "Unable to load hospitals:",
            error
        );


        hospitals = [];

    }

}


/* =========================================================
   FIND DOCUMENT BY ID
   ========================================================= */

function getDocumentById(
    documentId
) {

    return patientDocuments.find(
        doc =>
            Number(doc.id) ===
            Number(documentId)
    );

}


/* =========================================================
   FIND HOSPITAL BY ID
   ========================================================= */

function getHospitalById(
    hospitalId
) {

    return hospitals.find(
        hospital =>
            Number(hospital.id) ===
            Number(hospitalId)
    );

}


/* =========================================================
   LOAD PATIENT CONSENTS
   ========================================================= */

async function loadPatientConsents() {

    try {

        /*
         * Get all consent requests for
         * the authenticated patient.
         */
        const consents =
            await apiRequest(
                "/consents/my-requests",
                {
                    method: "GET"
                }
            );


        console.log(
            "Patient consent requests:",
            consents
        );


        if (!Array.isArray(consents)) {

            console.error(
                "Unexpected consent response:",
                consents
            );

            return;
        }


        /*
         * Update dashboard counters.
         */
        updateConsentCounters(
            consents
        );


        /*
         * Render recent requests.
         */
        renderConsentRequests(
            consents
        );


    } catch (error) {

        console.error(
            "Unable to load patient consents:",
            error
        );


        /*
         * Do not log the user out.
         *
         * Authentication is still valid.
         */
        const requestContainer =
            document.getElementById(
                "patientRequests"
            );


        if (requestContainer) {

            requestContainer.innerHTML = `
                <div class="patient-request-card">

                    <div class="request-main">

                        <strong>
                            Unable to load access requests
                        </strong>

                        <small>
                            Please refresh the page
                            and try again.
                        </small>

                    </div>

                </div>
            `;

        }

    }

}


/* =========================================================
   CONSENT COUNTERS
   ========================================================= */

function updateConsentCounters(
    consents
) {

    const activeConsentCount =
        document.getElementById(
            "activeConsentCount"
        );


    const pendingRequestCount =
        document.getElementById(
            "pendingRequestCount"
        );


    /*
     * Current browser time.
     */
    const now =
        new Date();


    /*
     * Find approved consents that
     * are currently inside their
     * valid time window.
     */
    const activeConsents =
        consents.filter(
            consent => {

                const status =
                    String(
                        consent.status || ""
                    ).toLowerCase();


                if (
                    status !== "approved"
                ) {

                    return false;

                }


                /*
                 * If the API doesn't provide
                 * dates, approved status is
                 * treated as active.
                 */
                if (
                    !consent.start_time &&
                    !consent.expiry_time
                ) {

                    return true;

                }


                const start =
                    consent.start_time
                        ? new Date(
                            consent.start_time
                        )
                        : null;


                const expiry =
                    consent.expiry_time
                        ? new Date(
                            consent.expiry_time
                        )
                        : null;


                /*
                 * Consent hasn't started.
                 */
                if (
                    start &&
                    now < start
                ) {

                    return false;

                }


                /*
                 * Consent has expired.
                 */
                if (
                    expiry &&
                    now >= expiry
                ) {

                    return false;

                }


                return true;

            }
        );


    /*
     * Find pending requests.
     */
    const pendingConsents =
        consents.filter(
            consent =>
                String(
                    consent.status || ""
                ).toLowerCase()
                === "pending"
        );


    if (activeConsentCount) {

        activeConsentCount.textContent =
            activeConsents.length;

    }


    if (pendingRequestCount) {

        pendingRequestCount.textContent =
            pendingConsents.length;

    }

}


/* =========================================================
   RENDER CONSENT REQUESTS
   ========================================================= */

function renderConsentRequests(
    consents
) {

    const container =
        document.getElementById(
            "patientRequests"
        );


    if (!container) {
        return;
    }


    /*
     * No requests.
     */
    if (!consents.length) {

        container.innerHTML = `
            <div class="patient-request-card">

                <div class="request-main">

                    <strong>
                        No access requests
                    </strong>

                    <small>
                        You currently have no healthcare
                        access requests requiring attention.
                    </small>

                </div>

            </div>
        `;

        return;
    }


    /*
     * Newest requests first.
     */
    const sortedConsents =
        [...consents].sort(
            (a, b) =>
                new Date(
                    b.created_at || 0
                ) -
                new Date(
                    a.created_at || 0
                )
        );


    /*
     * Display up to five recent
     * consent requests.
     */
    const recentConsents =
        sortedConsents.slice(
            0,
            5
        );


    container.innerHTML =
        recentConsents
            .map(
                consent =>
                    createConsentCard(
                        consent
                    )
            )
            .join("");

}


/* =========================================================
   CREATE CONSENT CARD
   ========================================================= */

function createConsentCard(
    consent
) {

    const status =
        String(
            consent.status ||
            "pending"
        ).toLowerCase();


    const statusText =
        status.toUpperCase();


    /*
     * Resolve actual document.
     */
    const medicalDocument =
        getDocumentById(
            consent.document_id
        );


    /*
     * Resolve actual hospital.
     */
    const hospital =
        getHospitalById(
            consent.requesting_hospital_id
        );


    /*
     * Human-readable document name.
     */
    const documentName =
        medicalDocument
            ? medicalDocument.document_name
            : `Medical Document #${consent.document_id}`;


    /*
     * Document type.
     */
    const documentType =
        medicalDocument
            ? medicalDocument.document_type
            : "Medical Record";


    /*
     * Human-readable hospital name.
     */
    const hospitalName =
        hospital
            ? hospital.name
            : `Hospital #${consent.requesting_hospital_id}`;


    /*
     * Purpose.
     */
    const purpose =
        consent.purpose ||
        "Medical record access";


    /*
     * Action buttons only appear
     * for pending requests.
     */
    const actions =
        status === "pending"
            ? `
                <div class="request-actions">

                    <button
                        type="button"
                        class="approve-button"
                        data-consent-id="${consent.id}">
                        Approve
                    </button>

                    <button
                        type="button"
                        class="deny-button"
                        data-consent-id="${consent.id}">
                        Deny
                    </button>

                </div>
            `
            : "";


    /*
     * Document icon.
     */
    const iconText =
        documentType
            ? documentType
                .substring(
                    0,
                    3
                )
                .toUpperCase()
            : "DOC";


    return `
        <div
            class="patient-request-card"
            data-consent-id="${consent.id}">


            <div class="request-document-icon">

                ${escapeHtml(
                    iconText
                )}

            </div>


            <div class="request-main">

                <strong>

                    ${escapeHtml(
                        formatPurpose(
                            purpose
                        )
                    )}

                </strong>


                <span>

                    ${escapeHtml(
                        hospitalName
                    )}

                </span>


                <small>

                    ${escapeHtml(
                        documentName
                    )}

                </small>

            </div>


            <div class="request-status">

                <span
                    class="status-badge ${status}">

                    ${escapeHtml(
                        statusText
                    )}

                </span>

            </div>


            ${actions}

        </div>
    `;

}


/* =========================================================
   FORMAT PURPOSE
   ========================================================= */

function formatPurpose(
    purpose
) {

    if (!purpose) {

        return "Medical Record Access";

    }


    return purpose
        .toLowerCase()
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
        );

}


/* =========================================================
   CONSENT ACTIONS
   ========================================================= */

function setupConsentActions() {

    const container =
        document.getElementById(
            "patientRequests"
        );


    if (!container) {
        return;
    }


    /*
     * Prevent multiple event listeners
     * if this function is called again.
     */
    if (
        container.dataset
            .consentActionsReady === "true"
    ) {

        return;

    }


    container.dataset
        .consentActionsReady =
        "true";


    /*
     * Event delegation.
     *
     * This works even after the
     * consent cards are re-rendered.
     */
    container.addEventListener(
        "click",
        event => {

            const approveButton =
                event.target.closest(
                    ".approve-button"
                );


            const denyButton =
                event.target.closest(
                    ".deny-button"
                );


            if (approveButton) {

                const consentId =
                    approveButton.dataset
                        .consentId;


                updateConsent(
                    consentId,
                    "approve",
                    approveButton
                );


                return;

            }


            if (denyButton) {

                const consentId =
                    denyButton.dataset
                        .consentId;


                updateConsent(
                    consentId,
                    "deny",
                    denyButton
                );

            }

        }
    );

}


/* =========================================================
   APPROVE / DENY CONSENT
   ========================================================= */

async function updateConsent(
    consentId,
    action,
    clickedButton
) {

    if (!consentId) {

        alert(
            "Invalid consent request."
        );

        return;
    }


    const isApprove =
        action === "approve";


    const endpoint =
        `/consents/${consentId}/${action}`;


    /*
     * Find request card.
     */
    const card =
        clickedButton.closest(
            ".patient-request-card"
        );


    /*
     * Disable all buttons inside
     * this request.
     */
    const buttons =
        card
            ? card.querySelectorAll(
                "button"
            )
            : [clickedButton];


    buttons.forEach(
        button => {

            button.disabled =
                true;

        }
    );


    const originalText =
        clickedButton.textContent;


    clickedButton.textContent =
        isApprove
            ? "Approving..."
            : "Denying...";


    try {

        /*
         * Send the real PATCH request
         * to FastAPI.
         */
        const response =
            await apiRequest(
                endpoint,
                {
                    method: "PATCH"
                }
            );


        console.log(
            "Consent updated:",
            response
        );


        /*
         * Reload actual data from
         * PostgreSQL.
         *
         * This ensures counters and
         * cards always represent the
         * database state.
         */
        await loadPatientConsents();


    } catch (error) {

        console.error(
            "Consent update failed:",
            error
        );


        alert(
            error.message ||
            "Unable to update consent."
        );


        /*
         * Restore buttons.
         */
        buttons.forEach(
            button => {

                button.disabled =
                    false;

            }
        );


        clickedButton.textContent =
            originalText;

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
     * Prevent duplicate logout
     * event listeners.
     */
    if (
        logoutButton.dataset
            .logoutReady === "true"
    ) {

        return;

    }


    logoutButton.dataset
        .logoutReady =
        "true";


    logoutButton.addEventListener(
        "click",
        () => {

            logoutUser();

        }
    );

}


/* =========================================================
   CONSENT MANAGEMENT PAGE
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const revokeButton =
            document.getElementById(
                "revokeConsent2"
            );


        if (!revokeButton) {
            return;
        }


        /*
         * Revoke endpoint has not yet
         * been implemented in backend.
         */
        revokeButton.addEventListener(
            "click",
            async () => {

                alert(
                    "Revoke functionality will be connected after the backend revoke endpoint is added."
                );

            }
        );

    }
);


/* =========================================================
   HELPERS
   ========================================================= */

function getInitials(
    name
) {

    const parts =
        name
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    if (parts.length === 1) {

        return parts[0]
            .substring(
                0,
                2
            )
            .toUpperCase();

    }


    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();

}


/* =========================================================
   HTML ESCAPING
   ========================================================= */

function escapeHtml(
    value
) {

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