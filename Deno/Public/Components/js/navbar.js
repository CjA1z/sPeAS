document.addEventListener("DOMContentLoaded", () => {
    
    const authBtn = document.getElementById("auth-btn");
    const userRole = localStorage.getItem("userRole"); // Get stored user role

    if (authBtn) {
        if (userRole === "Isregistered") {
                        authBtn.outerHTML = `<button id="logout-btn" class="nav-link loginbtn w-nav-link">Logout</button>`;

            // Add logout event listener
            document.getElementById("logout-btn").addEventListener("click", () => {
                                localStorage.removeItem("userRole"); // Remove user role
                globalThis.location.href = "/log-in.html"; // Redirect to login page
            });
        } else {
                    }
    } else {
    }
});
