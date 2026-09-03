/* =========================================================
   HEALTHGUARD AI - SECURITY CENTER
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

    const token = localStorage.getItem("healthguard_token");

    if (!token) {
        window.location.href = "../login.html";
        return;
    }

    try {

        // -----------------------------------------------------
        // GET CURRENT USER
        // -----------------------------------------------------

        const user = await getCurrentUser();

        const role = String(user.role || "").toLowerCase();

        // Security Center is restricted to hospital admins
        if (role !== "hospital_admin") {

            console.warn(
                "Security Center requires hospital administrator access."
            );

            redirectByRole(user.role);
            return;
        }

        // Store latest user information
        localStorage.setItem(
            "healthguard_user",
            JSON.stringify(user)
        );

        // -----------------------------------------------------
        // POPULATE USER INFORMATION
        // -----------------------------------------------------

        populateSecurityUser(user);

        // -----------------------------------------------------
        // LOGOUT
        // -----------------------------------------------------

        setupLogout();

        // -----------------------------------------------------
        // LOAD SECURITY DASHBOARD
        // -----------------------------------------------------

        await loadSecurityDashboard();

    } catch (error) {

        console.error(
            "Security dashboard initialization error:",
            error
        );

        /*
         * Do not immediately logout for API errors.
         * Only authentication failures should force logout.
         */

        if (
            error.status === 401 ||
            error.status === 403
        ) {

            localStorage.removeItem("healthguard_token");
            localStorage.removeItem("healthguard_user");

            window.location.href = "../login.html";

        } else {

            showSecurityLoadError(error);
        }
    }

});


/* =========================================================
   LOAD SECURITY DASHBOARD
   ========================================================= */

async function loadSecurityDashboard() {

    try {

        /*
         * IMPORTANT:
         * This endpoint is specifically designed for the
         * Hospital Administrator Security Center.
         */

        const data = await apiRequest(
            "/security/dashboard",
            {
                method: "GET"
            }
        );

        console.log(
            "Security dashboard data:",
            data
        );

        // -----------------------------------------------------
        // UPDATE STATISTICS
        // -----------------------------------------------------

        updateSecurityStatistics(data);

        // -----------------------------------------------------
        // UPDATE RISK INFORMATION
        // -----------------------------------------------------

        updateRiskInformation(data);

        // -----------------------------------------------------
        // RENDER RECENT SECURITY EVENTS
        // -----------------------------------------------------

        renderSecurityEvents(
            data.recent_events || []
        );

    } catch (error) {

        console.error(
            "Unable to load security dashboard:",
            error
        );

        showSecurityLoadError(error);
    }
}


/* =========================================================
   UPDATE SECURITY STATISTICS
   ========================================================= */

function updateSecurityStatistics(data) {

    const highRiskElement =
        document.getElementById("highRiskCount");

    const blockedElement =
        document.getElementById("blockedAccessCount");


    // High-risk events

    if (highRiskElement) {

        highRiskElement.textContent =
            data.high_risk_events ?? 0;
    }


    // Blocked access

    if (blockedElement) {

        blockedElement.textContent =
            data.blocked_events ?? 0;
    }
}


/* =========================================================
   UPDATE AI RISK INFORMATION
   ========================================================= */

function updateRiskInformation(data) {

    const riskLevelElement =
        document.getElementById("securityRiskLevel");

    const riskScoreElement =
        document.getElementById("securityRiskScore");

    const predictionElement =
        document.getElementById("securityPrediction");


    /*
     * The dashboard endpoint provides recent_events.
     * We use the latest event to show the current/latest
     * observed risk information.
     */

    const events =
        Array.isArray(data.recent_events)
            ? data.recent_events
            : [];


    if (events.length === 0) {

        if (riskLevelElement) {
            riskLevelElement.textContent = "NO DATA";
        }

        if (riskScoreElement) {
            riskScoreElement.textContent = "—";
        }

        if (predictionElement) {
            predictionElement.textContent = "—";
        }

        return;
    }


    // Most recent event

    const latestEvent = events[0];


    const riskLevel =
        String(
            latestEvent.risk_level || "UNKNOWN"
        ).toUpperCase();


    const prediction =
        String(
            latestEvent.prediction || "UNKNOWN"
        ).toUpperCase();


    const riskScore =
        latestEvent.risk_score;


    // -----------------------------------------------------
    // RISK LEVEL
    // -----------------------------------------------------

    if (riskLevelElement) {

        riskLevelElement.textContent =
            riskLevel;

        applyRiskClass(
            riskLevelElement,
            riskLevel
        );
    }


    // -----------------------------------------------------
    // RISK SCORE
    // -----------------------------------------------------

    if (riskScoreElement) {

        if (
            riskScore !== null &&
            riskScore !== undefined
        ) {

            riskScoreElement.textContent =
                Number(riskScore).toFixed(2);

        } else {

            riskScoreElement.textContent =
                "—";
        }
    }


    // -----------------------------------------------------
    // PREDICTION
    // -----------------------------------------------------

    if (predictionElement) {

        predictionElement.textContent =
            prediction;

        applyPredictionClass(
            predictionElement,
            prediction
        );
    }
}


/* =========================================================
   APPLY RISK LEVEL STYLE
   ========================================================= */

function applyRiskClass(element, riskLevel) {

    element.classList.remove(
        "risk-low",
        "risk-medium",
        "risk-high"
    );


    if (riskLevel === "LOW") {

        element.classList.add(
            "risk-low"
        );

    } else if (riskLevel === "MEDIUM") {

        element.classList.add(
            "risk-medium"
        );

    } else if (riskLevel === "HIGH") {

        element.classList.add(
            "risk-high"
        );
    }
}


/* =========================================================
   APPLY PREDICTION STYLE
   ========================================================= */

function applyPredictionClass(element, prediction) {

    element.classList.remove(
        "prediction-normal",
        "prediction-anomalous"
    );


    if (prediction === "NORMAL") {

        element.classList.add(
            "prediction-normal"
        );

    } else if (prediction === "ANOMALOUS") {

        element.classList.add(
            "prediction-anomalous"
        );
    }
}


/* =========================================================
   RENDER SECURITY EVENTS
   ========================================================= */

function renderSecurityEvents(events) {

    const container =
        document.getElementById("securityEvents");


    if (!container) {
        return;
    }


    // -----------------------------------------------------
    // NO EVENTS
    // -----------------------------------------------------

    if (!Array.isArray(events) || events.length === 0) {

        container.innerHTML = `
            <div class="security-empty-state">

                <div class="security-empty-icon">
                    ✓
                </div>

                <strong>
                    No security events recorded
                </strong>

                <span>
                    Protected access activity will appear here.
                </span>

            </div>
        `;

        return;
    }


    // -----------------------------------------------------
    // CREATE EVENT TABLE
    // -----------------------------------------------------

    const visibleEvents =
        events.slice(0, 8);


    let html = `
        <div class="security-events-table-wrapper">

            <table class="security-events-table">

                <thead>

                    <tr>

                        <th>
                            TIME
                        </th>

                        <th>
                            USER
                        </th>

                        <th>
                            DOCUMENT
                        </th>

                        <th>
                            DECISION
                        </th>

                        <th>
                            RISK SCORE
                        </th>

                        <th>
                            LEVEL
                        </th>

                        <th>
                            PREDICTION
                        </th>

                    </tr>

                </thead>

                <tbody>
    `;


    visibleEvents.forEach(event => {

        const decision =
            String(
                event.decision || "UNKNOWN"
            ).toUpperCase();


        const riskLevel =
            String(
                event.risk_level || "UNKNOWN"
            ).toUpperCase();


        const prediction =
            String(
                event.prediction || "UNKNOWN"
            ).toUpperCase();


        const riskScore =
            event.risk_score !== null &&
            event.risk_score !== undefined
                ? Number(event.risk_score).toFixed(2)
                : "—";


        const time =
            formatEventTime(
                event.accessed_at
            );


        const userName =
            escapeHtml(
                event.user_name ||
                "Unknown User"
            );


        const documentName =
            escapeHtml(
                event.document_name ||
                "Unknown Document"
            );


        html += `

            <tr>

                <td class="event-time">
                    ${time}
                </td>


                <td>

                    <div class="event-user">

                        <span class="event-avatar">
                            ${getInitials(
                                event.user_name ||
                                "User"
                            )}
                        </span>

                        <span>
                            ${userName}
                        </span>

                    </div>

                </td>


                <td>

                    <span class="event-document">
                        ${documentName}
                    </span>

                </td>


                <td>

                    <span class="
                        event-decision
                        ${getDecisionClass(decision)}
                    ">
                        ${decision}
                    </span>

                </td>


                <td>

                    <strong class="event-risk-score">
                        ${riskScore}
                    </strong>

                </td>


                <td>

                    <span class="
                        event-risk-level
                        ${getRiskLevelClass(riskLevel)}
                    ">
                        ${riskLevel}
                    </span>

                </td>


                <td>

                    <span class="
                        event-prediction
                        ${getPredictionClass(prediction)}
                    ">
                        ${prediction}
                    </span>

                </td>

            </tr>

        `;
    });


    html += `

                </tbody>

            </table>

        </div>
    `;


    container.innerHTML = html;
}


/* =========================================================
   DECISION CLASS
   ========================================================= */

function getDecisionClass(decision) {

    if (decision === "ALLOW") {

        return "decision-allow";

    }

    if (decision === "DENY") {

        return "decision-deny";

    }

    if (
        decision === "MFA_REQUIRED" ||
        decision === "MFA"
    ) {

        return "decision-mfa";
    }

    return "decision-unknown";
}


/* =========================================================
   RISK LEVEL CLASS
   ========================================================= */

function getRiskLevelClass(level) {

    if (level === "LOW") {

        return "level-low";

    }

    if (level === "MEDIUM") {

        return "level-medium";

    }

    if (level === "HIGH") {

        return "level-high";
    }

    return "level-unknown";
}


/* =========================================================
   PREDICTION CLASS
   ========================================================= */

function getPredictionClass(prediction) {

    if (prediction === "NORMAL") {

        return "prediction-normal";
    }

    if (prediction === "ANOMALOUS") {

        return "prediction-anomalous";
    }

    return "prediction-unknown";
}


/* =========================================================
   FORMAT EVENT TIME
   ========================================================= */

function formatEventTime(value) {

    if (!value) {
        return "—";
    }


    const date =
        new Date(value);


    if (Number.isNaN(date.getTime())) {

        return escapeHtml(
            String(value)
        );
    }


    return date.toLocaleString(
        "en-IN",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }
    );
}


/* =========================================================
   POPULATE SECURITY USER
   ========================================================= */

function populateSecurityUser(user) {

    const fullName =
        user.full_name ||
        user.name ||
        "Security Administrator";


    const role =
        String(user.role || "")
            .toLowerCase();


    const displayRole =
        role === "hospital_admin"
            ? "Hospital Admin"
            : "Security Operations";


    const initials =
        getInitials(fullName);


    // Sidebar name

    const sidebarName =
        document.getElementById(
            "sidebarName"
        );

    if (sidebarName) {

        sidebarName.textContent =
            fullName;
    }


    // Sidebar role

    const sidebarRole =
        document.getElementById(
            "sidebarRole"
        );

    if (sidebarRole) {

        sidebarRole.textContent =
            displayRole;
    }


    // Sidebar avatar

    const sidebarAvatar =
        document.getElementById(
            "sidebarAvatar"
        );

    if (sidebarAvatar) {

        sidebarAvatar.textContent =
            initials;
    }


    // Topbar name

    const topbarName =
        document.getElementById(
            "topbarName"
        );

    if (topbarName) {

        topbarName.textContent =
            fullName;
    }


    // Topbar avatar

    const topbarAvatar =
        document.getElementById(
            "topbarAvatar"
        );

    if (topbarAvatar) {

        topbarAvatar.textContent =
            initials;
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
   SECURITY LOAD ERROR
   ========================================================= */

function showSecurityLoadError(error) {

    const container =
        document.getElementById(
            "securityEvents"
        );


    if (!container) {
        return;
    }


    const message =
        error?.message ||
        "Unable to load security activity.";


    container.innerHTML = `

        <div class="security-error-state">

            <strong>
                Unable to load security activity.
            </strong>

            <span>
                ${escapeHtml(message)}
            </span>

        </div>

    `;
}


/* =========================================================
   GET INITIALS
   ========================================================= */

function getInitials(name) {

    if (!name) {
        return "SA";
    }


    const parts =
        String(name)
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
   ESCAPE HTML
   ========================================================= */

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}