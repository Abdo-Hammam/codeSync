let username = null;
let fName = "";
let currentRoomId = null;

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
        roomsList.innerHTML = "";
        data.rooms.forEach((room) => {
          const roomItem = document.createElement("div");
          roomItem.className = "room-card";
          roomItem.innerHTML = `
                <img src="../assets/imgs/room-bg1.png" alt="Room Image" style="cursor: pointer;" onclick="showRoomHistory('${room.roomId}')"/>
                <h2 class="room-name">${room.roomId}</h2>
                <p class="room-users">
                  <i class="fa-regular fa-user" style="color: #599bd4; padding-right: 8px"></i>
                  ${room.participants.length} Participants
                </p>
                <button class="join-room" onclick="window.location.href='/dashboard?room=${room.roomId}'">
                  <i class="fa-solid fa-door-open" style="padding-right: 12px"></i>Join Room
                </button>
          `;
          roomsList.appendChild(roomItem);
        });
      } else {
        roomsList.innerHTML = "<p>No rooms found.</p>";
      }
    })
    .catch((error) => {
      console.error("Error loading rooms:", error);
      roomsList.innerHTML = "<p>Error loading rooms.</p>";
    });
}

function showRoomHistory(roomId) {
  currentRoomId = roomId;
  fetch(`/api/roomVersions?roomId=${roomId}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        document.getElementById("roomIdDisplay").textContent = roomId;
        document.getElementById("participantsDisplay").textContent = data.participants.join(", ");
        const versionList = document.getElementById("versionList");
        versionList.innerHTML = "";
        data.versions.forEach((version) => {
          const li = document.createElement("li");
          li.innerHTML = `Version ${version.versionNumber} - ${new Date(version.createdAt).toLocaleString()} <button class="load-version-btn" onclick="joinRoomWithVersion('${roomId}', ${version.versionNumber})">Join</button>`;
          versionList.appendChild(li);
        });
        document.getElementById("roomHistoryPopup").style.display = "block";
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: data.message || "Error in getting version date",
          confirmButtonColor: "#407bff",
        });
      }
    })
    .catch((error) => {
      console.error("Error fetching room history:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error in getting version date",
        confirmButtonColor: "#407bff",
      });
    });
}

function joinRoomWithVersion(roomId, versionNumber) {
  fetch(`/api/roomVersionCode?roomId=${roomId}&versionNumber=${versionNumber}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        sessionStorage.setItem('pendingVersionLoad', JSON.stringify({
          roomId,
          versionNumber,
          code: data.code,
          timestamp: Date.now()
        }));
        
        closeRoomHistory();
        window.location.href = `/dashboard?room=${roomId}&version=${versionNumber}`;
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: data.message || "Error in getting version",
          confirmButtonColor: "#407bff",
        });
      }
    })
    .catch((error) => {
      console.error("Error loading version:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error in getting version",
        confirmButtonColor: "#407bff",
      });
    });
}

function closeRoomHistory() {
  document.getElementById("roomHistoryPopup").style.display = "none";
  currentRoomId = null;
}

function logout() {
  localStorage.removeItem("token");
  window.location.replace("");
}

function showUserActions() {
  let userList = document.querySelector(".user .user-action");

  if (userList.style.display === "none") {
    userList.style.display = "block";
  } else {
    userList.style.display = "none";
  }
}
showUserActions();

function loadUserInfo() {
  try {
    const token = localStorage.getItem("token");
    if (token) {
      const payload = JSON.parse(atob(token.split(".")[1]));
      username = payload.username || "Unknown";
      fName = payload.fullName || "Unknown";
      let firstName = `${fName.split(" ")[0].charAt(0).toUpperCase()}${fName
        .split(" ")[0]
        .slice(1)}`;
      document.getElementById("userName").textContent = `username: ${username}`;
      document.querySelector(
        ".left-side .welcome-msg span"
      ).textContent = `${firstName}`;
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

function createRoom() {
  Swal.fire({
    title: "Create New Room",
    html: `
      <input id="roomId" class="swal2-input" style="width: 80%;" placeholder="Room ID">
      <input id="roomPassword" type="password" class="swal2-input" style="width: 80%;" placeholder="Set Password (Optional)">
    `,
    confirmButtonText: "Create",
    cancelButtonText: "Cancel",
    showCancelButton: true,
    showLoaderOnConfirm: true,
    confirmButtonColor: "#407bff",
    cancelButtonColor: "#d33",
    focusConfirm: false,
    backdrop: "rgba(0, 0, 0, 0.62)",
    didOpen: () => {
      document.getElementById("roomId").value = `room_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const inputs = Swal.getPopup().querySelectorAll("input");
      inputs.forEach((input) => {
        input.addEventListener("keypress", (e) => {
          if (e.key === "Enter") {
            Swal.clickConfirm();
          }
        });
      });
    },
    preConfirm: () => {
      const roomId = document.getElementById("roomId").value.trim();
      const password = document.getElementById("roomPassword").value.trim();

      if (!roomId) {
        Swal.showValidationMessage("Room ID required");
        return false;
      }

      return {
        roomId,
        password,
      };
    },
  }).then((result) => {
    if (result.isConfirmed) {
      console.log("Room ID:", result.value.roomId);
      console.log("Password:", result.value.password);

      Swal.fire({
        title: "Created!",
        html: `
    <div style="text-align: center">
      <p>
        Room ID: <strong id="roomIdVal">${result.value.roomId}</strong>
        <button onclick="copyToClipboard('roomIdVal')" style="
          background: transparent;
          border: none;
          cursor: pointer;
          color: white;
          font-size: 16px;
          margin-left: 5px;
        ">
          <i class="fa-regular fa-copy"></i>
        </button>
      </p>
      <p>
        Room Password: <strong id="roomPassVal">${
          result.value.password || "No password set"
        }</strong>
        <button onclick="copyToClipboard('roomPassVal')" style="
          background: transparent;
          border: none;
          cursor: pointer;
          color: white;
          font-size: 16px;
          margin-left: 5px;
        ">
          <i class="fa-regular fa-copy"></i>
        </button>
      </p>
    </div>
  
`,
        icon: "success",
        confirmButtonText: "Join Now",
        confirmButtonColor: "#407bff",
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
        preConfirm: () => {
          const roomId = result.value.roomId;
          const password = result.value.password;

          return {
            roomId,
            password,
          };
        },
      }).then((result) => {
        if (result.isConfirmed) {
          const roomId = result.value.roomId;
          const password = result.value.password;

          fetch("/api/createRoom", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({ roomId, owner: username, password }),
          })
            .then((response) => response.json())
            .then((data) => {
              if (data.success) {
                window.location.href = `/dashboard?room=${data.roomId}`;
              }
            })
            .catch((error) => {
              console.error("Error creating room:", error);
            });
        }
      });
    }
  });
}

function joinRoom() {
  Swal.fire({
    title: "Join Room",
    html: `
      <input id="roomId" class="swal2-input" style="width: 80%;" placeholder="Room ID">
      <input id="roomPassword" type="password" class="swal2-input" style="width: 80%;" placeholder="Enter Password (Optional)">
    `,
    confirmButtonText: "Join",
    cancelButtonText: "Cancel",
    showCancelButton: true,
    showLoaderOnConfirm: true,
    confirmButtonColor: "#407bff",
    cancelButtonColor: "#d33",
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
    preConfirm: () => {
      const roomId = document.getElementById("roomId").value.trim();
      const password = document.getElementById("roomPassword").value.trim();

      if (!roomId) {
        Swal.showValidationMessage("Room ID required");
        return false;
      }

      return { roomId, password };
    },
  }).then((result) => {
    if (result.isConfirmed) {
      const { roomId, password } = result.value;

      fetch(`/api/checkRoom?roomId=${roomId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          if (data.exists) {
            if (data.hasPassword && !password) {
              Swal.fire({
                icon: "error",
                title: "Password Required",
                text: "This room requires a password",
              });
              return;
            }
            fetch("/api/verifyRoomPassword", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
              body: JSON.stringify({ roomId, password }),
            })
              .then((response) => {
                if (!response.ok) {
                  throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
              })
              .then((data) => {
                if (data.success) {
                  Swal.close();
                  window.location.href = `/dashboard?room=${roomId}`;
                } else {
                  Swal.fire({
                    icon: "error",
                    title: "Error",
                    text:
                      data.message || "Invalid password or room access denied",
                  });
                }
              })
              .catch((error) => {
                console.error("Error verifying password:", error);
                Swal.fire({
                  icon: "error",
                  title: "Error",
                  text: "Failed to verify password. Please try again.",
                });
              });
          } else {
            Swal.fire({
              icon: "error",
              title: "Room Not Found",
              text: "The room ID does not exist.",
            });
          }
        })
        .catch((error) => {
          console.error("Error checking room:", error);
          Swal.fire({
            icon: "error",
            title: "Error",
            text: "Failed to check room. Please try again.",
          });
        });
    }
  });
}

function copyToClipboard(elementId) {
  const text = document.getElementById(elementId)?.innerText;
  if (!text) {
    console.error("No text found to copy");
    return;
  }

  navigator.clipboard
    .writeText(text)
    .then(() => {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Copied to clipboard!",
        showConfirmButton: false,
        timer: 1500,
        background: "#1a1a1a",
        color: "#fff",
      });
    })
    .catch((err) => {
      console.error("Copy failed:", err);
      alert("Copy failed. Your browser may be blocking clipboard access.");
    });
}

function searchRooms(query) {
  if (!query) {
    document.getElementById("searchResults").style.display = "none";
    return;
  }

  fetch(`/api/searchRooms?query=${encodeURIComponent(query)}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  })
    .then((response) => response.json())
    .then((data) => {
      const searchResults = document.getElementById("searchResults");
      searchResults.innerHTML = "";
      searchResults.style.display = data.rooms.length > 0 ? "block" : "none";

      if (data.rooms.length > 0) {
        data.rooms.forEach((room) => {
          const resultItem = document.createElement("div");
          resultItem.innerHTML = `
            <strong>${room.roomId}</strong>
            <p>${room.participants.length} participants</p>
          `;
          resultItem.onclick = () => {
            document.getElementById("searchInput").value = room.roomId;
            searchResults.style.display = "none";
            joinRoomWithId(room.roomId, room.hasPassword);
          };
          searchResults.appendChild(resultItem);
        });
      } else {
        searchResults.innerHTML = "<div>No Rooms Found</div>";
      }``
    })
    .catch((error) => {
      console.error("Error searching for rooms:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to search for rooms. Please try again.",
      });
    });
}

function joinRoomWithId(roomId, hasPassword) {
  if (hasPassword) {
    Swal.fire({
      title: "Enter Password",
      html: `
        <input id="roomPassword" type="password" class="swal2-input" style="width: 80%;" placeholder="Password">
      `,
      confirmButtonText: "Join",
      cancelButtonText: "Cancel",
      showCancelButton: true,
      showLoaderOnConfirm: true,
      confirmButtonColor: "#407bff",
      cancelButtonColor: "#d33",
      focusConfirm: false,
      preConfirm: () => {
        const password = document.getElementById("roomPassword").value.trim();
        return { roomId, password };
      },
    }).then((result) => {
      if (result.isConfirmed) {
        const { roomId, password } = result.value;
        fetch("/api/verifyRoomPassword", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ roomId, password }),
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
          })
          .then((data) => {
            if (data.success) {
              Swal.close();
              window.location.href = `/dashboard?room=${roomId}`;
            } else {
              Swal.fire({
                icon: "error",
                title: "Error",
                text: data.message || "Incorrect password",
              });
            }
          })
          .catch((error) => {
            console.error("Error verifying password:", error);
            Swal.fire({
              icon: "error",
              title: "Error",
              text: "Failed to verify password. Please try again.",
            });
          });
      }
    });
  } else {
    window.location.href = `/dashboard?room=${roomId}`;
  }
}

function joinRoomByCode() {
  Swal.fire({
    title: "Join Room by Share Link",
    html: `
      <input id="shareLink" class="swal2-input" placeholder="Paste the share link here">
    `,
    confirmButtonText: "Join Room",
    showCancelButton: true,
    confirmButtonColor: "#407bff",
    cancelButtonColor: "#d33",
    focusConfirm: false,
    preConfirm: () => {
      const shareLink = document.getElementById("shareLink").value.trim();
      if (!shareLink) {
        Swal.showValidationMessage("Please paste the share link");
        return false;
      }
      
      try {
        // Extract token from URL
        const url = new URL(shareLink);
        const token = url.searchParams.get("token");
        if (!token) {
          Swal.showValidationMessage("Invalid share link - no token found");
          return false;
        }
        return { token };
      } catch (e) {
        Swal.showValidationMessage("Invalid URL format");
        return false;
      }
    }
  }).then((result) => {
    if (result.isConfirmed) {
      const { token } = result.value;
      
      // Verify the token and get room ID
      fetch(`/api/decodeRoomToken?token=${encodeURIComponent(token)}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          window.location.href = `/dashboard?room=${data.roomId}`;
        } else {
          Swal.fire({
            icon: "error",
            title: "Error",
            text: data.message || "Invalid share link",
          });
        }
      })
      .catch(error => {
        console.error("Error decoding token:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Failed to process share link",
        });
      });
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", (e) => {
    searchRooms(e.target.value);
  });
});

window.onload = loadUserInfo;