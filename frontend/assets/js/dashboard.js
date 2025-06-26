var editor = CodeMirror(document.getElementById("editor"), {
  value: "",
  mode: "javascript",
  lineNumbers: true,
  readOnly: false,
  autofocus: false,
});

let isUpdating = false;
let currentRoomId = null;
let username = null;
let isOwner = false;
let usersInRoom = [];
let requestingUser = null;

var socket = io("http://127.0.0.1:5000");

const defaultCode = {
  javascript: 'console.log("Welcome to CodeSync!");',
  python: 'print("Try CodeSync")',
  java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Try CodeSync");\n    }\n}',
  cpp: '#include <iostream>\nint main() {\n    std::cout << "Try CodeSync" << std::endl;\n    return 0;\n}',
  csharp:
    'using System;\nclass Program {\n    static void Main() {\n        Console.WriteLine("Try CodeSync");\n    }\n}',
  ruby: 'puts "Try CodeSync"',
  php: '<?php echo "Try CodeSync"; ?>',
  go: 'package main\nimport "fmt"\nfunc main() {\n    fmt.Println("Try CodeSync")\n}',
  typescript: 'console.log("Try CodeSync");',
};

editor.setValue(defaultCode["javascript"]);

function changeLanguage(language) {
  document.getElementById("languageSelect").value = language;
  let mode = language;
  if (language === "cpp") mode = "text/x-c++src";
  else if (language === "csharp") mode = "text/x-csharp";
  else if (language === "go") mode = "text/x-go";
  else if (language === "typescript") mode = "text/typescript";
  editor.setOption("mode", mode);
  if (currentRoomId)
    socket.emit("languageChange", { language, roomId: currentRoomId });
  const code = defaultCode[language];
  editor.setValue(code);
  if (currentRoomId)
    socket.emit("codeChange", { code: code, roomId: currentRoomId, username });
}

socket.on("languageChange", function (data) {
  document.getElementById("languageSelect").value = data.language;
  let mode = data.language;
  if (data.language === "cpp") mode = "text/x-c++src";
  else if (data.language === "csharp") mode = "text/x-csharp";
  else if (data.language === "go") mode = "text/x-go";
  else if (data.language === "typescript") mode = "text/typescript";
  editor.setOption("mode", mode);
  editor.setValue(defaultCode[data.language]);
});

editor.on("change", function (instance, change) {
  if (!isUpdating && currentRoomId) {
    const code = editor.getValue();
    console.log(`📤 Sending codeChange: code=${code.substring(0, 50)}...`);
    socket.emit("codeChange", { code, roomId: currentRoomId, username });
  }
});

let lastVersionNumber = 0;

socket.on("codeChange", function (data) {
  console.log(
    `📥 Received codeChange: versionNumber=${
      data.versionNumber || "N/A"
    }, data.username=${data.username}, local username=${username}, roomId=${
      data.roomId
    }, code=${data.code.substring(0, 50)}...`
  );

  if (isUpdating) {
    console.log("📥 Skipped codeChange: already updating");
    return;
  }

  if (isOwner) {
    lastVersionNumber = data.versionNumber || lastVersionNumber;
    isUpdating = true;
    const cursor = editor.getCursor();
    editor.setValue(
      data.code || defaultCode[document.getElementById("languageSelect").value]
    );
    editor.setCursor(cursor);
    editor.refresh();
    isUpdating = false;
    return;
  }

  console.log(`📥 Applying codeChange: non-owner updating editor`);
  lastVersionNumber = data.versionNumber || lastVersionNumber;
  isUpdating = true;
  const cursor = editor.getCursor();
  editor.setValue(
    data.code || defaultCode[document.getElementById("languageSelect").value]
  );
  editor.setCursor(cursor);
  editor.refresh();
  isUpdating = false;
});

function runCode() {
  if (!currentRoomId) {
    showNotification("Please join a room first!");
    return;
  }
  const code = editor.getValue();
  const language = document.getElementById("languageSelect").value;
  socket.emit("runCode", { code, language, roomId: currentRoomId });
}

socket.on("codeOutput", function (data) {
  document.getElementById("output").textContent =
    data.output || "Error running code";
});

socket.on("updateCode", function (data) {
  console.log(`📥 Received updateCode: code=${data.substring(0, 50)}...`);
  isUpdating = true;
  editor.setValue(
    data || defaultCode[document.getElementById("languageSelect").value]
  );
  editor.refresh();
  isUpdating = false;
});

socket.on("setEditorMode", (data) => {
  console.log("Received setEditorMode:", data);
  editor.setOption("readOnly", data.readOnly); // استخدام CodeMirror instance مباشرة
  console.log(`CodeMirror editor set to readOnly: ${data.readOnly}`);
  const requestAccessBtn = document.getElementById("requestAccessBtn");
  if (data.readOnly && !isOwner) {
    requestAccessBtn.style.display = "inline-block";
  } else {
    requestAccessBtn.style.display = "none";
  }
});

socket.on("updateUsers", function (data) {
  usersInRoom = data.users;
  updateUsersList();
});

function updateUsersList() {
  const usersList = document.getElementById("usersList");
  usersList.innerHTML = "";
  usersInRoom.forEach((user) => {
    const userItem = document.createElement("div");
    userItem.className = "dropdown-item";
    const isAdmin = user.username === username && isOwner;
    userItem.innerHTML = `
            <i class="${
              isAdmin ? "fas fa-crown admin-icon" : "fas fa-circle user-icon"
            }"></i>
            <span>${user.username}</span>
            ${
              isOwner && user.username !== username
                ? `
                <button onclick="toggleEditAccess('${
                  user.username
                }', ${!user.canEdit})" style="margin-left: auto; background-color: #245AB1; color: #fff; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">
                    ${user.canEdit ? "Revoke Edit" : "Grant Edit"}
                </button>
            `
                : ""
            }
        `;
    usersList.appendChild(userItem);
  });
}

function toggleDropdown() {
  const dropdown = document.getElementById("usersDropdown");
  dropdown.classList.toggle("active");
}

document.addEventListener("click", function (event) {
  const userInfo = document.querySelector(".user-info");
  const dropdown = document.getElementById("usersDropdown");
  if (!userInfo.contains(event.target)) dropdown.classList.remove("active");
});

function toggleEditAccess(user, canEdit) {
  // console.log(`📤 Sending toggleEditAccess: user=${user}, canEdit=${canEdit}, roomId=${currentRoomId}`);
  socket.emit("toggleEditAccess", {
    roomId: currentRoomId,
    username: user,
    canEdit,
  });
}

function requestAccess() {
  if (!currentRoomId || !username) {
    showNotification("Error: Unable to request access.");
    // console.log('❌ requestAccess failed: currentRoomId or username missing');
    return;
  }
  console.log(
    `📤 Sending requestAccess: username=${username}, roomId=${currentRoomId}`
  );
  socket.emit("requestAccess", { roomId: currentRoomId, username });
  showNotification("Access request sent to the admin.");
  document.getElementById("requestAccessBtn").style.display = "none";
}

socket.on("accessRequest", function (data) {
  console.log(
    `📥 Received accessRequest: username=${data.username}, isOwner=${isOwner}`
  );
  if (isOwner) {
    requestingUser = data.username;
    const accessRequestNotification = document.getElementById(
      "accessRequestNotification"
    );
    const accessRequestMessage = document.getElementById(
      "accessRequestMessage"
    );
    accessRequestMessage.textContent = `${data.username} has requested edit access.`;
    accessRequestNotification.style.display = "flex";
  }
});

function grantAccess() {
  if (requestingUser) {
    console.log(`📤 Granting access to ${requestingUser}`);
    socket.emit("toggleEditAccess", {
      roomId: currentRoomId,
      username: requestingUser,
      canEdit: true,
    });
    showNotification(`Access granted to ${requestingUser}.`);
    hideAccessRequestNotification();
  } else {
    console.log("❌ grantAccess failed: requestingUser is null");
  }
}

function denyAccess() {
  if (requestingUser) {
    console.log(`📤 Denying access to ${requestingUser}`);
    showNotification(`Access request from ${requestingUser} denied.`);
    hideAccessRequestNotification();
  } else {
    // console.log('❌ denyAccess failed: requestingUser is null');
  }
}

function hideAccessRequestNotification() {
  const accessRequestNotification = document.getElementById(
    "accessRequestNotification"
  );
  accessRequestNotification.style.display = "none";
  requestingUser = null;
}

function shareRoom() {
  if (!currentRoomId) {
    showNotification("Please join a room first!");
    return;
  }
  fetch("/api/generateRoomToken", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify({ roomId: currentRoomId }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        const shareLink = `http://127.0.0.1:5000/join?token=${data.token}`;
        navigator.clipboard.writeText(shareLink).then(() => {
          showNotification("Room link copied to clipboard!");
        });
      } else {
        showNotification(data.message);
      }
    })
    .catch((error) => {
      showNotification("Error generating share link");
    });
}

function clearEditor() {
  editor.setValue("");
  document.getElementById("output").textContent = "Output will appear here...";
}

function logout() {
  // localStorage.removeItem('token');
  // window.location.href = '/';
  window.history.back();
}

function showNotification(message) {
  const notification = document.getElementById("notification");
  notification.textContent = message;
  notification.style.display = "block";
  setTimeout(() => {
    notification.style.display = "none";
  }, 3000);
}

socket.on("userJoined", (data) => {
  showNotification(`User ${data.userId} joined the room!`);
});

function loadUserInfo() {
  try {
    const token = localStorage.getItem("token");

    if (token) {
      const payload = JSON.parse(atob(token.split(".")[1]));
      username = payload.username || "Unknown";
      console.log(`📌 Username from token: ${username}`);

      document.getElementById("userName").textContent = `User: ${username}`;

      const urlParams = new URLSearchParams(window.location.search);
      currentRoomId = urlParams.get("room");
      if (currentRoomId) {
        fetch(`/api/checkRoom?roomId=${currentRoomId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.exists) {
              isOwner = data.owner === username;
              // console.log(`📌 User ${username} isOwner=${isOwner}`);
              const userRoleIcon = document.getElementById("userRoleIcon");
              userRoleIcon.className = isOwner
                ? "fas fa-crown admin-icon"
                : "fas fa-circle user-icon";
              socket.emit("joinRoom", { roomId: currentRoomId, username });
              showNotification(`Joined room: ${currentRoomId}`);
              hideAccessRequestNotification();
            } else {
              alert("Room not found");
              window.location.href = "/home";
            }
          })
          .catch((error) => {
            alert("Error checking room");
            window.location.href = "/home";
          });
      } else {
        alert("No Room ID provided");
        window.location.href = "/home";
      }
    } else {
      window.location.href = "/login";
    }
  } catch (error) {
    window.location.href = "/login";
  }
}

window.onload = loadUserInfo;
