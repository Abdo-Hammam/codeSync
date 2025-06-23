import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js";
import { FacebookAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js";


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
                window.location.href = "/login"; // تحويل المستخدم لصفحة Home
            } else {
                alert(data.message || "حدث خطأ أثناء التسجيل.");
            }
        } catch (error) {
            console.error("Error:", error);
            alert("فشل الاتصال بالسيرفر.");
        }
    });

    
  // ==========================================================================

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();

  function loginWithGoogle() {
    signInWithPopup(auth, provider)
      .then((result) => {
        return result.user.getIdToken();
      })
      .then((idToken) => {
        return fetch("http://localhost:5000/api/auth/google-auth", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ idToken }),
        });
      })
      .then((res) => res.json())
      .then((data) => {
        if (!data.token) {
          console.error("No token received from backend:", data);
          return;
        }
        localStorage.setItem("token", data.token);
        window.location.replace("/home");
      })
      .catch(console.error);
  }

  const facebookAuth = getAuth();
  const facebookProvider = new FacebookAuthProvider();

  function loginWithFacebook() {
    signInWithPopup(facebookAuth, facebookProvider)
      .then((result) => {
        return result.user.getIdToken();
      })
      .then((idToken) => {
        return fetch("http://localhost:5000/api/auth/google-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
      })
      .then((res) => res.json())
      .then((data) => {
        localStorage.setItem("token", data.token);
        window.location.href = "/home";
      })
      .catch(console.error);
  }

  document
    .querySelector(".google-login-btn")
    .addEventListener("click", loginWithGoogle);

  document
    .querySelector(".facebook-login-btn")
    .addEventListener("click", loginWithFacebook);

  window.loginWithGoogle = loginWithGoogle;
  window.loginWithFacebook = loginWithFacebook;
});
