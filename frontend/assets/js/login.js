document.addEventListener("DOMContentLoaded", function () {
    function waitForElement(selector, callback, timeout = 3000) {
        const startTime = Date.now();
        
        function check() {
            const element = document.querySelector(selector);
            if (element) {
                callback(element);
            } else if (Date.now() - startTime < timeout) {
                setTimeout(check, 100); // إعادة المحاولة كل 100ms
            } else {
                console.error(`❌ Element '${selector}' not found after waiting.`);
            }
        }
        
        check();
    }

    waitForElement("#loginForm", function (loginForm) {
        console.log("✅ loginForm found!");

        loginForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const emailInput = document.getElementById("email");
            const passwordInput = document.getElementById("password");

            if (!emailInput || !passwordInput) {
                console.error("❌ email or password input not found");
                return;
            }

            const email = emailInput.value;
            const password = passwordInput.value;

            try {
                const response = await fetch('http://127.0.0.1:5000/login', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();
                if (response.ok) {
                    localStorage.setItem("token", data.token); // تخزين الـ Token
                    window.location.href = "/home"; // تحويل المستخدم لصفحة Home
                } else {
                    alert(data.message || "فشل تسجيل الدخول. تأكد من البريد وكلمة المرور.");
                }
            } catch (error) {
                console.error("❌ Error:", error);
                alert("فشل الاتصال بالسيرفر.");
            }
        });
    });
});