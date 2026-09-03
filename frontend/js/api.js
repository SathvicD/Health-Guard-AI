/* =========================================================
   HEALTHGUARD AI
   API Configuration & Communication
   ========================================================= */

const API_BASE_URL = "http://127.0.0.1:8000";


/* =========================================================
   GENERIC API REQUEST
   ========================================================= */

async function apiRequest(endpoint, options = {}) {

    const token = localStorage.getItem("healthguard_token");

    const headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    try {

        const response = await fetch(
            `${API_BASE_URL}${endpoint}`,
            {
                ...options,
                headers
            }
        );

        let data = null;

        try {
            data = await response.json();
        } catch {
            data = null;
        }

        if (!response.ok) {

            let message = "Something went wrong.";

            if (data?.detail) {

                if (typeof data.detail === "string") {

                    message = data.detail;

                } else if (typeof data.detail === "object") {

                    message =
                        data.detail.message ||
                        "Request was rejected by the security system.";
                }

            }

            const error = new Error(message);

            error.status = response.status;
            error.data = data;

            throw error;
        }

        return data;

    } catch (error) {

        /*
         * Preserve API errors.
         */

        if (error.status) {
            throw error;
        }

        /*
         * Network / CORS / backend unavailable.
         */

        console.error("API request failed:", error);

        throw new Error(
            "Unable to connect to HealthGuard AI backend. Please make sure the FastAPI server is running."
        );
    }
}


/* =========================================================
   LOGIN
   ========================================================= */

async function loginUser(email, password) {

    try {

        /*
         * HealthGuard AI /auth/login expects JSON:
         *
         * {
         *     "email": "...",
         *     "password": "..."
         * }
         */

        const response = await fetch(
            `${API_BASE_URL}/auth/login`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },

                body: JSON.stringify({
                    email: email,
                    password: password
                })
            }
        );


        let data = null;

        try {
            data = await response.json();
        } catch {
            data = null;
        }


        if (!response.ok) {

            let message = "Login failed.";

            if (data?.detail) {

                if (typeof data.detail === "string") {

                    message = data.detail;

                } else if (Array.isArray(data.detail)) {

                    message = data.detail
                        .map(item => item.msg || "Invalid input")
                        .join(", ");

                } else if (typeof data.detail === "object") {

                    message =
                        data.detail.message ||
                        "Unable to authenticate.";
                }
            }


            const error = new Error(message);

            error.status = response.status;
            error.data = data;

            throw error;
        }


        /*
         * Make sure backend returned an access token.
         */

        if (!data || !data.access_token) {

            throw new Error(
                "Login succeeded, but the server did not return an access token."
            );
        }


        return data;

    } catch (error) {

        console.error("Login error:", error);

        /*
         * Preserve useful backend errors.
         */

        if (error.status) {
            throw error;
        }


        throw new Error(
            error.message ||
            "Unable to authenticate."
        );
    }
}


/* =========================================================
   REGISTER
   ========================================================= */

async function registerUser(userData) {

    return await apiRequest(
        "/auth/register",
        {
            method: "POST",
            body: JSON.stringify(userData)
        }
    );
}


/* =========================================================
   GET CURRENT USER
   ========================================================= */

async function getCurrentUser() {

    return await apiRequest(
        "/users/me",
        {
            method: "GET"
        }
    );
}


/* =========================================================
   LOGOUT
   ========================================================= */

function logoutUser() {

    localStorage.removeItem(
        "healthguard_token"
    );

    localStorage.removeItem(
        "healthguard_user"
    );

    window.location.href =
        "../login.html";
}


/* =========================================================
   TOKEN CHECK
   ========================================================= */

function isAuthenticated() {

    const token =
        localStorage.getItem(
            "healthguard_token"
        );

    return Boolean(token);
}


/* =========================================================
   GET STORED USER
   ========================================================= */

function getStoredUser() {

    const user =
        localStorage.getItem(
            "healthguard_user"
        );

    if (!user) {
        return null;
    }

    try {

        return JSON.parse(user);

    } catch {

        return null;
    }
}


/* =========================================================
   AUTHORIZATION HEADER
   ========================================================= */

function getAuthHeaders() {

    const token =
        localStorage.getItem(
            "healthguard_token"
        );

    if (!token) {

        return {
            "Content-Type": "application/json",
            "Accept": "application/json"
        };
    }

    return {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

/* =========================================================
   FILE UPLOAD REQUEST
   ========================================================= */

async function apiUpload(
    endpoint,
    formData
) {

    const token =
        localStorage.getItem(
            "healthguard_token"
        );


    const headers = {
        "Accept": "application/json"
    };


    if (token) {

        headers["Authorization"] =
            `Bearer ${token}`;

    }


    try {

        const response =
            await fetch(
                `${API_BASE_URL}${endpoint}`,
                {
                    method: "POST",
                    headers: headers,
                    body: formData
                }
            );


        let data = null;


        try {

            data =
                await response.json();

        } catch {

            data = null;

        }


        if (!response.ok) {

            let message =
                "File upload failed.";


            if (data?.detail) {

                if (
                    typeof data.detail === "string"
                ) {

                    message =
                        data.detail;

                }

                else if (
                    typeof data.detail === "object"
                ) {

                    message =
                        data.detail.message ||
                        "File upload was rejected.";

                }

            }


            const error =
                new Error(message);


            error.status =
                response.status;


            error.data =
                data;


            throw error;

        }


        return data;


    } catch (error) {

        if (error.status) {
            throw error;
        }


        console.error(
            "File upload failed:",
            error
        );


        throw new Error(
            "Unable to connect to HealthGuard AI backend."
        );

    }

}