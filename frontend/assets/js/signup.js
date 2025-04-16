document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("signupForm").addEventListener("submit", async function (e) {
        e.preventDefault(); // منع إعادة تحميل الصفحة

        const fullName = document.getElementById("full-name").value;
        const email = document.getElementById("email").value;
        const password = document.getElementById("pass").value;

        try {
            const response = await fetch('http://127.0.0.1:5000/signup', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: fullName, email, password }),
            });

            const data = await response.json();
            if (response.ok) {
                localStorage.setItem("token", data.token); // تخزين الـ Token
                alert("تم التسجيل بنجاح! يمكنك تسجيل الدخول الآن.");
                window.location.href = "/home"; // تحويل المستخدم لصفحة Home
            } else {
                alert(data.message || "حدث خطأ أثناء التسجيل.");
            }
        } catch (error) {
            console.error("Error:", error);
            alert("فشل الاتصال بالسيرفر.");
        }
    });
});