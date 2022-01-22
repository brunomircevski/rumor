const username = localStorage.getItem('username');
const passwordHash = localStorage.getItem('passwordHash');
const secret = localStorage.getItem('secret');
const myPublicKey = localStorage.getItem('myPublicKey');

if(!username || !passwordHash || !secret) window.location.replace("logout.html");

const usernameBox = document.querySelector(".your-username-box");
usernameBox.innerHTML += username;

const socket = io();

const crypt = new Crypt();
const rsa = new RSA({keySize: 1024});

const activeRoom = {
    id: null,
    name: null,
    public: null,
    secret: null,
    prevId: null
};

//Starting a chain of events on connection
socket.on('connect', r => {
    console.log('Connected');
    getRooms();
});

//Creating new room 
const newRoomBtn = document.querySelector('.new-room-btn');

newRoomBtn.addEventListener('click', e => {

    rsa.generateKeyPair(function(keyPair) {

        const userEncryptedRoomPrivateKey = crypt.encrypt(myPublicKey, keyPair.privateKey);

        socket.emit('createRoom', {
            username: username,
            passwordHash: passwordHash,
            roomPublicKey: keyPair.publicKey,
            creatorPrivateKey: userEncryptedRoomPrivateKey
        });
    });
});

socket.on('createRoomResponse', r => {
    if(r) {
        getRooms();
    } else {
        popup("You can't have more than 2 empty rooms.");
    }
});

//Getting Rooms for user
function getRooms() {
    socket.emit('getRooms', {
        username: username,
        passwordHash: passwordHash
    });
}

let openRoomAfterLoading = true;

const roomsBox = document.querySelector('.room-list');

socket.on('getRoomsResponse', rooms => {
    roomsBox.innerHTML = '';
    
    if(rooms.length) {
        rooms.forEach(e => {
            let name = removeMyUsername(e.name.normalize());
            roomsBox.innerHTML += `<li data-id="${e.id}" data-name="${name}" class="join-room-btn">${name}<span class="room-list-date">${e.date}</span></li>`
        });

        document.querySelectorAll('.join-room-btn').forEach(el => {
            el.addEventListener('click', e => {
                getRoomSecret(e.target.getAttribute('data-id'), e.target.getAttribute('data-name'));
            });
        });
    }

    getRequests();

    if(openRoomAfterLoading) {
        openFirstRoom();
        openRoomAfterLoading = false;
    }

    highlightActiveRoom();
});

const messageBox = document.querySelector('.chat-box');
const chatNameBox = document.querySelector('.chat-name');
const sendForm = document.querySelector('.send-message-form');
const userListBox = document.querySelector('.room-user-list');

//Send message
sendForm.addEventListener('submit', e => {
    e.preventDefault();

    const message = e.target.elements[0].value.normalize();
    if(message != null && message != '') {
        e.target.elements[0].value = '';
        e.target.elements[0].focus();

        socket.emit('message', {
            username: username,
            passwordHash: passwordHash,
            roomId: activeRoom.id,
            encryptedMessage: crypt.encrypt(activeRoom.public, message)
        });
    }
});

let stopAddingMessagesWhenSearching = false;

//Receive a message
socket.on('message', ({encryptedMessage, msgUsername}) => {
    const msg = crypt.decrypt(activeRoom.secret, encryptedMessage).message;

    if(stopAddingMessagesWhenSearching == false) insertMsg(msg, msgUsername);
});

let lastMessage = {
    username: null,
    date: null,
    room: null
};

//Insert new Message
function insertMsg(msg, usr, date, skipHtmlEntitiesChceck=false) {
    const messageContainer = document.createElement('div'); messageContainer.classList = 'message-container';
    const text = document.createElement('p');

    if(username == usr) text.classList = 'my-message';

    if(date == null) {
        date = new Date();
        date = Math.floor(date.getTime()/1000);
    }

    if((lastMessage.username != usr || lastMessage.room != activeRoom.id || date-lastMessage.date > 180) || skipHtmlEntitiesChceck) {
        const metadataSpan = document.createElement('span');
        metadataSpan.classList = 'metadata';

        if(username == usr) {
            metadataSpan.classList += ' my-message';
            metadataSpan.innerHTML = 'You - ' + formatDate(date);
        } else {
            metadataSpan.innerHTML = usr + ' - ' + formatDate(date);
        }
    
        messageBox.appendChild(metadataSpan);
    }

    if(skipHtmlEntitiesChceck) text.innerHTML = msg;
    else text.innerHTML = htmlEntities(msg);
    messageContainer.appendChild(text);
    messageBox.insertBefore(messageContainer, document.querySelector('.chat-box>span:last-child'));

    lastMessage.username = usr;
    lastMessage.date = date;
    lastMessage.room = activeRoom.id;
    
    messageBox.scrollTo(0, messageBox.scrollHeight);
}

function formatDate(unixtime) {
    const now = new Date();
    let date = new Date(unixtime * 1000);
    if(unixtime == null)
        date = now;
            
    const hours = date.getHours();
    const minutes = (date.getMinutes()<10?'0':'') + date.getMinutes();
    
    let formatedTime = hours + ':' + minutes;

    const diff = now - date;
    if(diff > 86400000) {
        formatedTime = (date.getDate()<10?'0':'') + date.getDate() + '/' + ((date.getMonth()+1)<10?'0':'') + (date.getMonth()+1) + ' ' +formatedTime;
    }

    return formatedTime;
}

//Get room secret
function getRoomSecret(id, name) {

    socket.emit('getRoomSecret', {
        username: username,
        passwordHash: passwordHash,
        roomId: id
    });

    activeRoom.prevId = activeRoom.id;
    activeRoom.id = id;
    activeRoom.name = name;

    mobileButtonCenter.click();
}

socket.on('getRoomSecretResponse', r => {
    activeRoom.secret = crypt.decrypt(secret, r.encryptedSecret).message;
    activeRoom.public = r.public;
    openRoom();
});

//Open room
function openRoom() {
    messageBox.innerHTML = '';
    userListBox.innerHTML = '';
    stopAddingMessagesWhenSearching = false;

    socket.emit('changeRoom', {
        username: username,
        passwordHash: passwordHash,
        newRoom: activeRoom.id,
        oldRoom: activeRoom.prevId
    });

    highlightActiveRoom();
}

socket.on('changeRoomResponse', r => {
    if(r.roomId == activeRoom.id) {

        chatNameBox.innerHTML = removeMyUsername(activeRoom.name);

        const userListP = document.createElement('p');
        r.userList.forEach(e => {
            userListP.innerHTML += e.username + ', ';
        });
        userListP.innerHTML = userListP.innerHTML.slice(0, -2);
        userListBox.appendChild(userListP);

        if(r.messages.length) {
            r.messages.reverse().forEach(e => {
                insertMsg(crypt.decrypt(activeRoom.secret, e.content).message, e.username, e.date);
            });
        } else {
            messageBox.innerHTML = '<span style="color: #bbb; padding: 15px;">Room created. You can invite friends and send them a message!</span>';
        }
    } else {
        popup("Error. Wrong room id.");
    }
    messageBox.scrollTo(0, messageBox.scrollHeight);

    updateRoomListOnNewMessage = true;
});

//Leave room
const leaveBtn = document.querySelector('.leave-room-btn');

leaveBtn.addEventListener('click', e => {
    if(confirm('Are you sure you want to leave ' + activeRoom.name) == true) {
        socket.emit('leaveRoom', {
            username: username,
            passwordHash: passwordHash,
            roomId: activeRoom.id
        });
    }
});

socket.on('leaveRoomResponse', r => {
    if(!r) popup("Error while leaving room");
    getRooms();
    openRoomAfterLoading = true;
});

function openFirstRoom() {
    const firstRoomElement = document.querySelectorAll('.room-list>li')[0];
    if(firstRoomElement)
        getRoomSecret(firstRoomElement.getAttribute('data-id'), firstRoomElement.getAttribute('data-name'));
}

//Invite a user to active room
const inviteForm = document.querySelector('.invite-form');

inviteForm.addEventListener('submit', e => {
    e.preventDefault();

    const invUsername = e.target.elements[0].value.normalize();
    if(invUsername != null && invUsername != '') {
        e.target.elements[0].value = '';
        e.target.elements[0].focus();

        socket.emit('getUserByUsername', invUsername);
    }
});

socket.on('getUserByUsernameResponse', r => {
    if(!r) {
        popup('User not found!');
    }
    else {
        socket.emit('inviteUser', {
            username: username,
            passwordHash: passwordHash,
            roomId: activeRoom.id,
            userToInviteId: r.id,
            userToInviteUsername: r.username,
            secret: crypt.encrypt(r.public, activeRoom.secret)
        });
    }
});

socket.on('inviteUserResponse', r => {
    if(r) popup('Request was send succesfull');
    else popup('User is already in the room or is invited to this room');
});

//Display requests 
function getRequests() { //Runs after getRooms()
    socket.emit('getRequests', {
        username: username,
        passwordHash: passwordHash
    });
}

socket.on('getRequestsResponse', r => {
    const requestsBox = document.querySelector('.request-box');
    requestsBox.innerHTML = '';

    if(r) {
        r.forEach(e => {
            if(e.username == e.roomName) 
                requestsBox.innerHTML += `<div class="request"><p>${e.username} wants to be your friend (${e.date})</p><span data-id="${e.id}" class="accept">Accept</span><span data-id="${e.id}" class="reject">Reject</span>`;
            else
                requestsBox.innerHTML += `<div class="request"><p>${e.username} wants you to join ${e.roomName} (${e.date})</p><span data-id="${e.id}" class="accept">Accept</span><span data-id="${e.id}" class="reject">Reject</span>`;
        });

        document.querySelectorAll('.request>.accept').forEach(el => {
            el.addEventListener('click', e => {
                respondToRequest(e.target.getAttribute('data-id'), true);
            });
        });

        document.querySelectorAll('.request>.reject').forEach(el => {
            el.addEventListener('click', e => {
                respondToRequest(e.target.getAttribute('data-id'), false);
            });
        });
    } else requestsBox.innerHTML = "You don't have any requests.";
});

//Respond to request
function respondToRequest(id, accept) {
    socket.emit('respondToRequest', {
        username: username,
        passwordHash: passwordHash,
        requestId: id,
        accept: accept
    });
}

socket.on('respondToRequestResponse', r => {
    if(r) getRooms();
    else popup("Error while responding to request");
});

//When there is new request
socket.on('newRequest', r => {
    getRequests();
});

//When connection is lost
socket.on('disconnect', s => {
    popup('Lost connection. It is recomended to refresh the page.', true);
});

//When there is new message in one of ours room
let lastNewMessageRoomId = null;

socket.on('newMessageInRoom', roomId => {
    if(lastNewMessageRoomId != roomId || roomId == 0) {
        getRooms();
        lastNewMessageRoomId = roomId;
    }
    if(roomId == 0) {
        
    }
});

//Rename room
const renameForm = document.querySelector('.change-chat-name-form');

renameForm.addEventListener('submit', e => {
    e.preventDefault();

    const newName = e.target.elements[0].value.normalize();

    socket.emit('renameRoom', {
        username: username,
        passwordHash: passwordHash,
        roomId: activeRoom.id,
        name: newName
    });

    e.target.elements[0].value = '';
    chatNameBox.innerHTML = newName;
});

function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function removeMyUsername(name) {
    name = name.replace(username+', ', '');
    name = name.replace(', '+username, '');

    if(name==username) name = "Empty room";

    return name;
}

function highlightActiveRoom() {
    const old = document.querySelector('.active');
    if(old) old.classList = '';

    document.querySelectorAll('.room-list>li').forEach(e => {
        if(e.getAttribute('data-id')==activeRoom.id) e.classList += ' active';
    });
}

function popup(msg, doNotFadeOut) {
    console.log(msg + doNotFadeOut);
}

// ######################################
//               Searching
// ######################################
const searchForm = document.querySelector('.search-form');
let searchPattern = null;
const messageList = {
    roomId: null,
    msg: [],
};

searchForm.addEventListener('submit', e => {
    e.preventDefault();

    searchPattern = e.target.elements[0].value.normalize().toLowerCase().split("");

    if(searchPattern.length == 0) openRoom();

    if(searchPattern.length > 1) {

        if(messageList.roomId == activeRoom.id) {
            searchAndDisplay();
        } else {
            socket.emit('getMessages', {
                username: username,
                passwordHash: passwordHash,
                roomId: activeRoom.id,
            });
            messageList.roomId = activeRoom.id;
        }

        mobileButtonCenter.click();
    }
});

socket.on('getMessagesResponse', r => {
    messageList.msg = [];
    r.forEach(e => {
        messageList.msg.push({
            username: e.username,
            date: e.date,
            content: crypt.decrypt(activeRoom.secret, e.content).message
        });
    });
    messageList.msg.reverse()
    searchAndDisplay();
});

function searchAndDisplay() {
    chatNameBox.innerHTML = 'Wyszukiwanie';
    messageBox.innerHTML = '';
    stopAddingMessagesWhenSearching = true;
    messageList.msg.forEach(e => {
        const message = searchh(e.content.toLowerCase().split(""), searchPattern);
        if(message) insertMsg(message, e.username, e.date, true);
    });
}

// ######################################
//              Mobile Menu
// ######################################
const mobileButtonLeft = document.querySelector('.mobile-left-panel-btn');
const mobileButtonCenter = document.querySelector('.mobile-center-panel-btn');
const mobileButtonRight = document.querySelector('.mobile-right-panel-btn');

const panelLeft = document.querySelector('.left-panel');
const panelCenter = document.querySelector('.center-panel');
const panelRight = document.querySelector('.right-panel');

const mainContainer = document.querySelector('.container');

mobileButtonLeft.addEventListener('click', e => {
    panelLeft.classList = 'left-panel';
    panelCenter.classList = 'center-panel mobile-display-none';
    panelRight.classList = 'right-panel mobile-display-none';
    mainContainer.classList = 'container left-panel-acive';
    mobileButtonRight.classList = 'mobile-right-panel-btn'
    mobileButtonCenter.classList = 'mobile-center-panel-btn'
    mobileButtonLeft.classList = 'mobile-left-panel-btn mobile-menu-active'
});

mobileButtonCenter.addEventListener('click', e => {
    panelLeft.classList = 'left-panel mobile-display-none';
    panelCenter.classList = 'center-panel';
    panelRight.classList = 'right-panel mobile-display-none';
    mainContainer.classList = 'container center-panel-acive';
    mobileButtonRight.classList = 'mobile-right-panel-btn'
    mobileButtonCenter.classList = 'mobile-center-panel-btn mobile-menu-active'
    mobileButtonLeft.classList = 'mobile-left-panel-btn'
});

mobileButtonRight.addEventListener('click', e => {
    panelLeft.classList = 'left-panel mobile-display-none';
    panelCenter.classList = 'center-panel mobile-display-none';
    panelRight.classList = 'right-panel';
    mainContainer.classList = 'container right-panel-acive';
    mobileButtonRight.classList = 'mobile-right-panel-btn mobile-menu-active'
    mobileButtonCenter.classList = 'mobile-center-panel-btn'
    mobileButtonLeft.classList = 'mobile-left-panel-btn'
});
