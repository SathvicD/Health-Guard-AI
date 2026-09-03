/* =========================================================
   HEALTHGUARD AI
   Doctor Portal
   ========================================================= */


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

    const token =
        localStorage.getItem("healthguard_token");


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
        if (
            String(user.role).toLowerCase()
            !== "doctor"
        ) {

            redirectByRole(user.role);

            return;
        }


        localStorage.setItem(
            "healthguard_user",
            JSON.stringify(user)
        );


        populateDoctorInformation(user);

        setupLogout();

        setupAccessRequestForm();

        setupDocumentAccessForm();

        setDefaultAccessTimes();


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

});


/* =========================================================
   DOCTOR INFORMATION
   ========================================================= */

function populateDoctorInformation(user) {

    const name =
        user.full_name ||
        "Doctor";


    /*
     * Doctors are automatically displayed with
     * the professional title "Dr."
     *
     * The database continues to store only the
     * person's actual name, for example:
     *
     * full_name = "Harika Uppati"
     *
     * Frontend display:
     *
     * Dr. Harika Uppati
     */
    const cleanName =
        name
            .trim()
            .replace(/^Dr\.\s*/i, "");


    const displayName =
    String(user.role).toLowerCase() === "doctor"
        ? `Dr. ${cleanName} 🩺`
        : cleanName;


    const initials =
        getInitials(cleanName);


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


    /*
     * Main dashboard greeting
     *
     * Example:
     * Welcome back, Dr. Harika Uppati
     */
    if (doctorName) {

        doctorName.textContent =
            displayName;

    }


    /*
     * Sidebar doctor name
     *
     * Example:
     * Dr. Harika Uppati
     */
    if (sidebarName) {

        sidebarName.textContent =
            displayName;

    }


    /*
     * Top-right profile name
     *
     * Example:
     * Dr. Harika Uppati
     */
    if (topbarName) {

        topbarName.textContent =
            displayName;

    }


    /*
     * Avatar initials should remain based on
     * the person's actual name.
     *
     * Example:
     * Harika Uppati → HU
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


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const documentId =
                Number(
                    document.getElementById(
                        "documentId"
                    ).value
                );


            const purpose =
                document.getElementById(
                    "purpose"
                ).value.trim();


            const startTime =
                document.getElementById(
                    "startTime"
                ).value;


            const expiryTime =
                document.getElementById(
                    "expiryTime"
                ).value;


            if (!documentId) {

                showMessage(
                    "requestMessage",
                    "Please enter a valid document ID.",
                    "error"
                );

                return;
            }


            if (!purpose) {

                showMessage(
                    "requestMessage",
                    "Please provide the medical purpose.",
                    "error"
                );

                return;
            }


            if (!startTime || !expiryTime) {

                showMessage(
                    "requestMessage",
                    "Please select the access period.",
                    "error"
                );

                return;
            }


            const start =
                new Date(startTime);


            const expiry =
                new Date(expiryTime);


            if (expiry <= start) {

                showMessage(
                    "requestMessage",
                    "Expiry time must be later than start time.",
                    "error"
                );

                return;
            }


            /*
             * Retrieve authenticated doctor.
             */
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


            const button =
                document.getElementById(
                    "requestAccessButton"
                );


            if (button) {

                button.disabled = true;

                button.textContent =
                    "Submitting Request...";

            }


            try {

                /*
                 * These values come directly from
                 * the authenticated doctor account.
                 */
                const requestBody = {

                    document_id:
                        documentId,

                    requesting_hospital_id:
                        Number(user.hospital_id),

                    requesting_user_id:
                        Number(user.id),

                    purpose:
                        purpose,

                    /*
                     * Convert datetime-local into
                     * backend-compatible ISO string.
                     *
                     * No timezone suffix is intentionally
                     * added because the current backend
                     * stores these values as naive datetimes.
                     */
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


            } catch (error) {

                console.error(
                    "Consent request failed:",
                    error
                );


                showMessage(
                    "requestMessage",
                    error.message ||
                    "Unable to create access request.",
                    "error"
                );

            } finally {

                if (button) {

                    button.disabled = false;

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


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const documentId =
                Number(
                    document.getElementById(
                        "accessDocumentId"
                    ).value
                );


            if (!documentId) {

                showMessage(
                    "accessMessage",
                    "Please enter a valid document ID.",
                    "error"
                );

                return;
            }


            const button =
                document.getElementById(
                    "accessDocumentButton"
                );


            if (button) {

                button.disabled = true;

                button.textContent =
                    "Analyzing Access...";

            }


            hideElement(
                "accessResultPanel"
            );


            try {

                /*
                 * This is the actual HealthGuard
                 * AI document-access endpoint.
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


                showAllowedResult(
                    response,
                    documentId
                );


            } catch (error) {

                console.error(
                    "Document access failed:",
                    error
                );


                /*
                 * apiRequest preserves the backend
                 * status and response body.
                 */
                showSecurityResult(
                    error,
                    documentId
                );

            } finally {

                if (button) {

                    button.disabled = false;

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

function showAllowedResult(
    document,
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
                    HealthGuard AI approved access to
                    medical document #${documentId}.
                </p>

                <div class="result-details">

                    <div>
                        <strong>Document</strong>
                        <span>
                            ${escapeHtml(
                                document.document_name ||
                                `Document #${documentId}`
                            )}
                        </span>
                    </div>

                    <div>
                        <strong>Type</strong>
                        <span>
                            ${escapeHtml(
                                document.document_type ||
                                "Medical Record"
                            )}
                        </span>
                    </div>

                    <div>
                        <strong>Encryption</strong>
                        <span>
                            ${
                                document.is_encrypted
                                    ? "Enabled"
                                    : "Not marked"
                            }
                        </span>
                    </div>

                </div>

            </div>

        </div>
    `;

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


    const data =
        error.data?.detail;


    /*
     * Backend sends an object for ML
     * security decisions.
     */
    if (
        data &&
        typeof data === "object"
    ) {

        const riskLevel =
            data.risk_level ||
            "UNKNOWN";


        const riskScore =
            data.risk_score !== undefined
                ? data.risk_score
                : "—";


        const prediction =
            data.prediction ||
            "UNKNOWN";


        const action =
            data.security_action ||
            "DENY";


        let resultClass =
            "danger";


        if (
            action === "MFA_REQUIRED"
        ) {

            resultClass =
                "warning";

        }


        result.innerHTML = `

            <div class="security-result ${resultClass}">

                <div class="result-icon">
                    ${
                        action === "MFA_REQUIRED"
                            ? "!"
                            : "✕"
                    }
                </div>

                <div>

                    <span class="status-caption">
                        AI SECURITY DECISION
                    </span>

                    <h3>
                        ${escapeHtml(action)}
                    </h3>

                    <p>
                        ${escapeHtml(
                            data.message ||
                            error.message ||
                            "Access was rejected."
                        )}
                    </p>


                    <div class="risk-metrics">

                        <div>

                            <span>
                                Risk Level
                            </span>

                            <strong>
                                ${escapeHtml(
                                    riskLevel
                                )}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Risk Score
                            </span>

                            <strong>
                                ${escapeHtml(
                                    String(riskScore)
                                )}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Prediction
                            </span>

                            <strong>
                                ${escapeHtml(
                                    prediction
                                )}
                            </strong>

                        </div>

                    </div>


                    <div class="security-decision-note">

                        <strong>
                            Document #${documentId}
                        </strong>

                        <span>
                            ${
                                action === "MFA_REQUIRED"
                                    ? "Additional authentication is required."
                                    : "HealthGuard AI blocked this access attempt."
                            }
                        </span>

                    </div>

                </div>

            </div>
        `;

        return;
    }


    /*
     * Consent failure or other backend error.
     */
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
                        error.message ||
                        "The document could not be accessed."
                    )}
                </p>

                <div class="security-decision-note">

                    <strong>
                        Document #${documentId}
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


    if (!startInput || !expiryInput) {
        return;
    }


    /*
     * Only set defaults when empty.
     */
    if (
        startInput.value ||
        expiryInput.value
    ) {
        return;
    }


    const now =
        new Date();


    const expiry =
        new Date(
            now.getTime() +
            (3 * 24 * 60 * 60 * 1000)
        );


    startInput.value =
        formatDateTimeLocal(now);


    expiryInput.value =
        formatDateTimeLocal(expiry);

}


/* =========================================================
   DATE HELPERS
   ========================================================= */

function formatDateTimeLocal(date) {

    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");


    const day =
        String(
            date.getDate()
        ).padStart(2, "0");


    const hours =
        String(
            date.getHours()
        ).padStart(2, "0");


    const minutes =
        String(
            date.getMinutes()
        ).padStart(2, "0");


    return `${year}-${month}-${day}T${hours}:${minutes}`;

}


function formatDateTimeForAPI(date) {

    /*
     * Return local time without Z.
     *
     * This matches the current backend's
     * naive datetime handling.
     */
    return formatDateTimeLocal(date);

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

function hideElement(elementId) {

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


    logoutButton.addEventListener(
        "click",
        () => {

            logoutUser();

        }
    );

}


/* =========================================================
   INITIALS
   ========================================================= */

function getInitials(name) {

    const parts =
        name
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    if (parts.length === 1) {

        return parts[0]
            .substring(0, 2)
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

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}