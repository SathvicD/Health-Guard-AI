/* =========================================================
   HEALTHGUARD AI
   Authentication Logic
   ========================================================= */


/* =========================================================
   HELPERS
   ========================================================= */

function showAuthMessage(message, type = "error") {

    const messageBox =
        document.getElementById("authMessage");

    if (!messageBox) return;

    messageBox.textContent = message;

    messageBox.className =
        `auth-message ${type}`;
}


function hideAuthMessage() {

    const messageBox =
        document.getElementById("authMessage");

    if (!messageBox) return;

    messageBox.className =
        "auth-message hidden";
}


function setLoading(
    button,
    textElement,
    spinner,
    loading,
    text
) {

    if (!button) return;

    button.disabled = loading;

    if (textElement) {
        textElement.textContent = text;
    }

    if (spinner) {
        spinner.classList.toggle(
            "hidden",
            !loading
        );
    }
}


/* =========================================================
   PASSWORD TOGGLE
   ========================================================= */

function setupPasswordToggle(
    buttonId,
    inputId
) {

    const button =
        document.getElementById(buttonId);

    const input =
        document.getElementById(inputId);

    if (!button || !input) return;

    button.addEventListener(
        "click",
        () => {

            const isPassword =
                input.type === "password";

            input.type =
                isPassword
                    ? "text"
                    : "password";

            button.textContent =
                isPassword
                    ? "Hide"
                    : "Show";
        }
    );
}


/* =========================================================
   LOGIN
   ========================================================= */

const loginForm =
    document.getElementById("loginForm");

if (loginForm) {

    setupPasswordToggle(
        "passwordToggle",
        "password"
    );


    loginForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            hideAuthMessage();


            const email =
                document
                    .getElementById("email")
                    .value
                    .trim();


            const password =
                document
                    .getElementById("password")
                    .value;


            const button =
                document.getElementById(
                    "loginButton"
                );


            const buttonText =
                document.getElementById(
                    "loginButtonText"
                );


            const spinner =
                document.getElementById(
                    "loginSpinner"
                );


            setLoading(
                button,
                buttonText,
                spinner,
                true,
                "Signing in..."
            );


            try {

                const data =
                    await loginUser(
                        email,
                        password
                    );


                localStorage.setItem(
                    "healthguard_token",
                    data.access_token
                );


                const user =
                    await getCurrentUser();


                localStorage.setItem(
                    "healthguard_user",
                    JSON.stringify(user)
                );


                showAuthMessage(
                    "Authentication successful. Redirecting...",
                    "success"
                );


                setTimeout(
                    () => {

                        redirectByRole(
                            user.role
                        );

                    },
                    700
                );


            } catch (error) {

                console.error(
                    "Login error:",
                    error
                );


                showAuthMessage(
                    error.message ||
                    "Unable to sign in. Please check your credentials."
                );


            } finally {

                setLoading(
                    button,
                    buttonText,
                    spinner,
                    false,
                    "Sign In"
                );

            }

        }
    );

}


/* =========================================================
   LOAD HOSPITALS
   ========================================================= */

async function loadHospitals() {

    const hospitalSelect =
        document.getElementById(
            "hospitalId"
        );

    if (!hospitalSelect) return;


    try {

        hospitalSelect.innerHTML = `
            <option value="" disabled selected>
                Loading hospitals...
            </option>
        `;


        const hospitals =
            await apiRequest(
                "/hospitals",
                {
                    method: "GET"
                }
            );


        const activeHospitals =
            hospitals.filter(
                hospital =>
                    hospital.is_active
            );


        hospitalSelect.innerHTML = `
            <option value="" disabled selected>
                Select your hospital
            </option>
        `;


        if (
            activeHospitals.length === 0
        ) {

            hospitalSelect.innerHTML = `
                <option value="" disabled>
                    No active hospitals available
                </option>
            `;

            return;
        }


        activeHospitals.forEach(
            hospital => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    hospital.id;


                option.textContent =
                    `${hospital.name} — ${hospital.city}`;


                hospitalSelect.appendChild(
                    option
                );

            }
        );


    } catch (error) {

        console.error(
            "Unable to load hospitals:",
            error
        );


        hospitalSelect.innerHTML = `
            <option value="" disabled selected>
                Unable to load hospitals
            </option>
        `;


        showAuthMessage(
            "Unable to load hospitals. Please make sure the HealthGuard AI backend is running."
        );

    }

}


/* =========================================================
   REGISTER
   ========================================================= */

const registerForm =
    document.getElementById(
        "registerForm"
    );


if (registerForm) {

    setupPasswordToggle(
        "passwordToggle",
        "password"
    );


    setupPasswordToggle(
        "confirmPasswordToggle",
        "confirmPassword"
    );


    const roleSelect =
        document.getElementById(
            "role"
        );


    const hospitalGroup =
        document.getElementById(
            "hospitalGroup"
        );


    const hospitalInput =
        document.getElementById(
            "hospitalId"
        );


    /*
     * Load hospitals when registration page opens.
     */

    loadHospitals();


    /*
     * Show hospital only for doctors.
     */

    if (roleSelect) {

        roleSelect.addEventListener(
            "change",
            () => {

                const role =
                    roleSelect.value;


                const isDoctor =
                    role === "doctor";


                hospitalGroup.classList.toggle(
                    "hidden",
                    !isDoctor
                );


                hospitalInput.required =
                    isDoctor;


                /*
                 * Clear hospital selection
                 * when switching back to patient.
                 */

                if (!isDoctor) {

                    hospitalInput.value =
                        "";

                }

            }
        );

    }


    /* =====================================================
       REGISTER SUBMIT
       ===================================================== */

    registerForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            hideAuthMessage();


            const fullName =
                document
                    .getElementById("fullName")
                    .value
                    .trim();


            const email =
                document
                    .getElementById("email")
                    .value
                    .trim();


            const role =
                document
                    .getElementById("role")
                    .value;


            const password =
                document
                    .getElementById("password")
                    .value;


            const confirmPassword =
                document
                    .getElementById("confirmPassword")
                    .value;


            const hospitalId =
                document
                    .getElementById("hospitalId")
                    .value;


            /* =================================================
               VALIDATION
               ================================================= */


            if (fullName.length < 2) {

                showAuthMessage(
                    "Please enter your full name."
                );

                return;
            }


            if (!email) {

                showAuthMessage(
                    "Please enter your email address."
                );

                return;
            }


            if (!role) {

                showAuthMessage(
                    "Please select your account type."
                );

                return;
            }


            /*
             * Only patient and doctor are allowed
             * through public registration.
             */

            if (
                role !== "patient" &&
                role !== "doctor"
            ) {

                showAuthMessage(
                    "This account type cannot be registered publicly."
                );

                return;
            }


            if (
                role === "doctor" &&
                !hospitalId
            ) {

                showAuthMessage(
                    "Please select your hospital."
                );

                return;
            }


            if (password.length < 8) {

                showAuthMessage(
                    "Password must contain at least 8 characters."
                );

                return;
            }


            if (password !== confirmPassword) {

                showAuthMessage(
                    "Passwords do not match."
                );

                return;
            }


            /* =================================================
               BUTTON
               ================================================= */

            const button =
                document.getElementById(
                    "registerButton"
                );


            const buttonText =
                document.getElementById(
                    "registerButtonText"
                );


            const spinner =
                document.getElementById(
                    "registerSpinner"
                );


            setLoading(
                button,
                buttonText,
                spinner,
                true,
                "Creating account..."
            );


            try {

                const payload = {

                    email: email,

                    password: password,

                    full_name: fullName,

                    role: role

                };


                /*
                 * Doctors require a hospital.
                 */

                if (
                    role === "doctor"
                ) {

                    payload.hospital_id =
                        Number(hospitalId);

                }


                const user =
                    await registerUser(
                        payload
                    );


                console.log(
                    "Registered user:",
                    user
                );


                showAuthMessage(
                    "Account created successfully. Redirecting to login...",
                    "success"
                );


                setTimeout(
                    () => {

                        window.location.href =
                            "login.html";

                    },
                    1000
                );


            } catch (error) {

                console.error(
                    "Registration error:",
                    error
                );


                showAuthMessage(
                    error.message ||
                    "Unable to create account."
                );


            } finally {

                setLoading(
                    button,
                    buttonText,
                    spinner,
                    false,
                    "Create Account"
                );

            }

        }
    );

}


/* =========================================================
   ROLE REDIRECTION
   ========================================================= */

function redirectByRole(role) {

    const normalizedRole =
        String(role).toLowerCase();


    if (
        normalizedRole === "patient"
    ) {

        window.location.href =
            "patient/dashboard.html";

        return;
    }


    if (
        normalizedRole === "doctor"
    ) {

        window.location.href =
            "doctor/dashboard.html";

        return;
    }


    if (
        normalizedRole === "hospital_admin"
    ) {

        window.location.href =
            "security/dashboard.html";

        return;
    }


    if (
        normalizedRole === "lab_technician"
    ) {

        window.location.href =
            "doctor/dashboard.html";

        return;
    }


    window.location.href =
        "index.html";
}