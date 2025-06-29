let username = null;

// دالة جلب الـ Rooms
function loadRooms() {
  fetch(`/api/userRooms?username=${username}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  })
    .then((response) => response.json())
    .then((data) => {
      const roomsList = document.getElementById("rooms-grid");

      if (data.rooms && data.rooms.length > 0) {
        data.rooms.forEach((room) => {
          const roomItem = document.createElement("div");
          roomItem.className = "room-card";
          roomItem.innerHTML = `
                <img src="../assets/imgs/room-bg1.png" alt="" />
                <h2 class="room-name">${room.roomId}</h2>
                <p class="room-users">
                  <i
                    class="fa-regular fa-user"
                    style="color: #599bd4; padding-right: 8px"
                  ></i
                  >${room.participants.length} Participants
                </p>
                <button class="join-room" onclick="window.location.href='/dashboard?room=${room.roomId}'">
                  <i
                    class="fa-solid fa-door-open"
                    style="padding-right: 12px"
                  ></i
                  >Join Room
                </button>
`;
          roomsList.appendChild(roomItem);
        });
      } else {
        roomsContainer.innerHTML = "<p>No rooms found.</p>";
        roomsList.appendChild(roomsContainer);
      }
    })
    .catch((error) => {
      console.error("Error loading rooms:", error);
      const roomsContainer = document.getElementById("roomsList");
      roomsContainer.innerHTML = "<p>Error loading rooms.</p>";
    });
}

// دالة الـ Logout
function logout() {
  localStorage.removeItem("token");
  window.location.replace("");
}

// جلب اسم المستخدم من الـ Token
function loadUserInfo() {
  try {
    const token = localStorage.getItem("token");
    if (token) {
      const payload = JSON.parse(atob(token.split(".")[1]));
      username = payload.username || "Unknown";
      email = payload.email || "Unknown";
      fName = payload.fullName || "Unknown";
      document.getElementById("userName").textContent = `Username: ${username}`;
      document.getElementById("email").textContent = `Email: ${email}`;
      document.querySelector(".profile-info h2").textContent = `${(capitalized =
        fName.charAt(0).toUpperCase() + fName.slice(1).toLowerCase())}`;
      loadRooms();
    } else {
      document.getElementById("userName").textContent = "User: Not logged in";
      window.location.replace("/login");
    }
  } catch (error) {
    console.error("Error loading user info:", error);
    document.getElementById("userName").textContent =
      "User: Error loading info";
    window.location.replace("/login");
  }
}

function deleteUser() {
  const token = localStorage.getItem("token");
  if (token) {
    const payload = JSON.parse(atob(token.split(".")[1]));
    userId = payload.id || "Unknown";
    Swal.fire({
      title: "Are you sure?",
      text: "This action will permanently delete the user.",
      icon: "warning",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
      showCancelButton: true,
      showLoaderOnConfirm: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#407bff",
      focusConfirm: false,
      backdrop: "rgba(0, 0, 0, 0.62)",
      didOpen: () => {
        const inputs = Swal.getPopup().querySelectorAll("input");
        inputs.forEach((input) => {
          input.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
              Swal.clickConfirm();
            }
          });
        });
      },
    }).then((result) => {
      if (result.isConfirmed) {
        fetch(`/api/users/${userId}`, {
          method: "DELETE",
        })
          .then((res) => res.json())
          .then((data) => {
            console.log("Deleted:", data);
            window.location.replace("login");
          })
          .catch((err) => console.error(err));
      }
    });
  } else {
    window.location.replace("/login");
  }
}
async function uploadAvatar(event) {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('avatar', file);

  try {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/upload-avatar', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();
    if (data.success) {
      document.getElementById('profile-avatar').src = data.avatar;
      Swal.fire({
        icon: 'success',
        title: 'تم تحديث الصورة بنجاح',
        showConfirmButton: false,
        timer: 1500
      });
    }
  } catch (error) {
    console.error('Error uploading avatar:', error);
    Swal.fire({
      icon: 'error',
      title: 'خطأ',
      text: 'فشل في تحميل الصورة',
    });
  }
}

async function loadProfile() {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/users/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const user = await response.json();
    
    if (user.avatar) {
      // أضف هذا السطر لمنع التخزين المؤقت
      document.getElementById('profile-avatar').src = `${user.avatar}?t=${Date.now()}`;
    } else {
      document.getElementById('profile-avatar').src = '../assets/imgs/user_logo.png';
    }
    // باقي الكود...
  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

// استدعاء الدالة عند تحميل الصفحة
window.addEventListener('DOMContentLoaded', loadProfile);
window.onload = loadUserInfo;
