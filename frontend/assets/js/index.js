document.addEventListener("DOMContentLoaded", () => {
  const items = document.querySelectorAll(
    ".fade-in-up, .fade-in-right, .fade-in-left"
  );
  const onScroll = () => {
    items.forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight - 100)
        el.classList.add("active");
    });
  };
  window.addEventListener(
    "scroll",
    () =>
      clearTimeout(window._scrollTimer) ||
      (window._scrollTimer = setTimeout(onScroll, 20))
  );
  onScroll();
});

function goToSection(event, id) {
  event.preventDefault();
  const section = document.getElementById(id);
  section.scrollIntoView({ behavior: "smooth" });
  history.replaceState(null, null, " ");
}

const token = localStorage.getItem("token");

const signupBtns = document.querySelectorAll("#signupBtn");
signupBtns.forEach((el) => {
  el.onclick = function () {
    if (token) {
      location.replace("/home");
    } else {
      location.replace("/signup");
    }
  };
});

const homeBtn = document.querySelector('header .links ul li a[href="/home"]');
homeBtn.addEventListener("click", function (e) {
  e.preventDefault();
  
  if (token) {
    location.href = "/home";
  } else {
    location.href = "/login";
  }
});
