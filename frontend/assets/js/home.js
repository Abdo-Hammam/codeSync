
let username = null;


// دالة إنشاء Room جديدة
function createRoom() {
    const roomId = document.getElementById('newRoomId').value.trim();
    const password = document.getElementById('roomPassword').value.trim();
    const createRoomError = document.getElementById('createRoomError');
    createRoomError.style.display = 'none';

    if (!roomId) {
        createRoomError.textContent = 'Please enter a Room ID';
        createRoomError.style.display = 'block';
        return;
    }

    fetch('/api/createRoom', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ roomId, owner: username, password })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                closeModal('createRoomModal');
                window.location.href = `/dashboard?room=${data.roomId}`;
            } else {
                createRoomError.textContent = data.message || 'Error creating room';
                createRoomError.style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Error creating room:', error);
            createRoomError.textContent = 'Error creating room';
            createRoomError.style.display = 'block';
        });
}

// دالة الانضمام لـ Room
function joinRoom() {
    const roomId = document.getElementById('joinRoomId').value.trim();
    const password = document.getElementById('joinRoomPassword').value.trim();
    const joinRoomError = document.getElementById('joinRoomError');
    joinRoomError.style.display = 'none';

    if (!roomId) {
        joinRoomError.textContent = 'Please enter a Room ID';
        joinRoomError.style.display = 'block';
        return;
    }

    fetch(`/api/checkRoom?roomId=${roomId}`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.exists) {
                if (data.hasPassword && !password) {
                    joinRoomError.textContent = 'This room requires a password';
                    joinRoomError.style.display = 'block';
                    return;
                }
                fetch('/api/verifyRoomPassword', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ roomId, password })
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            closeModal('joinRoomModal');
                            window.location.href = `/dashboard?room=${roomId}`;
                        } else {
                            joinRoomError.textContent = data.message;
                            joinRoomError.style.display = 'block';
                        }
                    })
                    .catch(error => {
                        console.error('Error verifying password:', error);
                        joinRoomError.textContent = 'Error verifying password';
                        joinRoomError.style.display = 'block';
                    });
            } else {
                joinRoomError.textContent = 'Room not found';
                joinRoomError.style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Error checking room:', error);
            joinRoomError.textContent = 'Error checking room';
            joinRoomError.style.display = 'block';
        });
}

// دالة عرض Modal
function showCreateRoomModal() {
    document.getElementById('createRoomModal').style.display = 'flex';
    document.getElementById('newRoomId').value = `room_${Math.random().toString(36).substr(2, 9)}`;
    document.getElementById('roomPassword').value = '';
    document.getElementById('createRoomError').style.display = 'none';
}

function showJoinRoomModal() {
    document.getElementById('joinRoomModal').style.display = 'flex';
    document.getElementById('joinRoomId').value = '';
    document.getElementById('joinRoomPassword').value = '';
    document.getElementById('joinRoomError').style.display = 'none';
}

// دالة إغلاق Modal
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    if (modalId === 'createRoomModal') {
        document.getElementById('newRoomId').value = '';
        document.getElementById('roomPassword').value = '';
        document.getElementById('createRoomError').style.display = 'none';
    } else if (modalId === 'joinRoomModal') {
        document.getElementById('joinRoomId').value = '';
        document.getElementById('joinRoomPassword').value = '';
        document.getElementById('joinRoomError').style.display = 'none';
    }
}

// دالة جلب الـ Rooms
function loadRooms() {
    fetch(`/api/userRooms?username=${username}`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
        .then(response => response.json())
        .then(data => {
            const roomsList = document.getElementById('roomsList');
            const roomsContainer = roomsList.querySelector('h3').nextElementSibling || document.createElement('div');
            roomsContainer.innerHTML = '';
            if (data.rooms && data.rooms.length > 0) {
                data.rooms.forEach(room => {
                    const roomItem = document.createElement('div');
                    roomItem.className = 'room-item';
                    roomItem.innerHTML = `
                        <span>Room Id: ${room.roomId} (Last Opened: ${new Date(room.lastOpened).toLocaleString()})</span>
                        <div class="actions">
                            <button id="join-button" onclick="window.location.href='/dashboard?room=${room.roomId}'"><i class="fas fa-sign-in-alt"></i> Join</button>
                        </div>
                    `;
                    roomsContainer.appendChild(roomItem);
                });
                roomsList.appendChild(roomsContainer);
            } else {
                roomsContainer.innerHTML = '<p>No rooms found.</p>';
                roomsList.appendChild(roomsContainer);
            }
        })
        .catch(error => {
            console.error('Error loading rooms:', error);
            const roomsContainer = document.getElementById('roomsList');
            roomsContainer.innerHTML = '<p>Error loading rooms.</p>';
        });
}

// دالة الـ Logout
function logout() {
    localStorage.removeItem('token');
    window.location.href = '/'; // توجه لـ index.html
}

function showUserActions() {
    let userList = document.querySelector('.user .user-action')


    if (userList.style.display === "none") {
        userList.style.display = "block"
    } else {
        userList.style.display = "none"
    }

}
showUserActions()

// جلب اسم المستخدم من الـ Token
function loadUserInfo() {
    try {
        const token = localStorage.getItem('token');
        if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            username = payload.username || 'Unknown';
            document.getElementById('userName').textContent = `username: ${username}`;
            loadRooms();
        } else {
            document.getElementById('userName').textContent = 'User: Not logged in';
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Error loading user info:', error);
        document.getElementById('userName').textContent = 'User: Error loading info';
        window.location.href = '/login';
    }
}

window.onload = loadUserInfo;
