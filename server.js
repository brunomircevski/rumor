const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');

const {
    verifyUsername,
    registerNewUser,
    verifyUser,
    createRoom,
    getRoomListByUser,
    getRoomSecret,
    leaveRoom,
    isUserInRoom,
    getMessages,
    getUserByUsername,
    inviteToRoom,
    getRequestsListByUser,
    respondToRequest,
    getUserListInRoom,
    newMessage,
    renameRoom
} = require('./functions.js');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

//Set public folder
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', socket => {

    //When client requests username verification
    socket.on('usernameVerify', username => {
        socket.emit('usernameVerifyResult', verifyUsername(username));
    });

    //When client requests registering new user
    socket.on('registerNewUser', ({username, passwordHash, userPublicKey, userPrivateKey}) => {

        if(verifyUsername(username)==0) {
            if(registerNewUser(username, passwordHash, userPublicKey, userPrivateKey)) {
                socket.emit('registerNewUserResult', 0); //OK
            } else {
                socket.emit('registerNewUserResult', 2); //Server or database error
            }
        } else {
            socket.emit('registerNewUserResult', 1); //Username not valid
        }
    });

    //When client requests login
    socket.on('loginRequest', ({username, passwordHash}) => {

        const user = verifyUser(username, passwordHash);

        if(user)
            socket.emit('loginRequestResponse', {
                encrypted_secret: user.encryptedSecret,
                userPublicKey: user.publicKey
            });
        else socket.emit('loginRequestResponse', {
            encrypted_secret: false,
            userPublicKey: false
        });
    });

    //When client requests creating new room
    socket.on('createRoom', ({username, passwordHash, roomPublicKey, creatorPrivateKey}) => {

        const user = verifyUser(username, passwordHash);

        if(user) {
            socket.emit('createRoomResponse', createRoom(user, roomPublicKey, creatorPrivateKey));
        }
    });

    //When client requests it's room list
    socket.on('getRooms', ({username, passwordHash}) => {

        const user = verifyUser(username, passwordHash);

        if(user) {
            socket.emit('getRoomsResponse', getRoomListByUser(user));
            socket.join(username); //To receive requests in real time
        }
    });

    //When client requests room secret
    socket.on('getRoomSecret', ({username, passwordHash, roomId}) => {

        const user = verifyUser(username, passwordHash);

        if(user) {
            const room = getRoomSecret(user.id, roomId);
            if(room) {
                socket.emit('getRoomSecretResponse', {
                    encryptedSecret: room.encryptedSecret,
                    public: room.publicKey
                });
            }
        }
    });

    //User leaves room
    socket.on('leaveRoom', ({username, passwordHash, roomId}) => {

        const user = verifyUser(username, passwordHash);

        if(user) {
            socket.leave(roomId);
            socket.emit('leaveRoomResponse', leaveRoom(user.id, roomId));
        }
    });
    
    //User changes room
    socket.on('changeRoom', ({username, passwordHash, newRoom, oldRoom}) => {

        const user = verifyUser(username, passwordHash);

        if(user && isUserInRoom(user.id, newRoom)) {
            socket.leave(oldRoom);
            socket.join(newRoom);

            socket.emit('changeRoomResponse', {
                roomId: newRoom,
                messages: getMessages(newRoom, 100, 0),
                userList: getUserListInRoom(newRoom)
            });
        }
    });

    //When user requests another user by username 
    socket.on('getUserByUsername', username => {

        const user = getUserByUsername(username);

        if(!user) socket.emit('getUserByUsernameResponse', false);
        else socket.emit('getUserByUsernameResponse', {
            id: user.id,
            username: user.username,
            public: user.publicKey
        });
    });

    //When user wants to invite anoter user to room.
    socket.on('inviteUser', ({username, passwordHash, roomId, userToInviteId, userToInviteUsername, secret}) => {

        const user = verifyUser(username, passwordHash);

        if(user && isUserInRoom(user.id, roomId) && !isUserInRoom(userToInviteId, roomId)) {
            socket.emit('inviteUserResponse', inviteToRoom(roomId, user.id, userToInviteId, secret));
            io.to(userToInviteUsername).emit('newRequest', true);
        } else {
            socket.emit('inviteUserResponse', false);
        }
    });

    //When user requests it's requests list
    socket.on('getRequests', ({username, passwordHash}) => {

        const user = verifyUser(username, passwordHash);

        if(user) {
            socket.emit('getRequestsResponse', getRequestsListByUser(user));
        } 
    });

    //When user responds to room request
    socket.on('respondToRequest', ({username, passwordHash, requestId, accept}) => {

        const user = verifyUser(username, passwordHash);

        if(user) {
            socket.emit('respondToRequestResponse', respondToRequest(user, requestId, accept));
        } 
    });

    //When user sends a message
    socket.on('message', ({username, passwordHash, roomId, encryptedMessage}) => {

        const user = verifyUser(username, passwordHash);
        
        if(user && isUserInRoom(user.id, roomId)) {
            io.to(roomId).emit('message', {
                encryptedMessage: encryptedMessage, 
                msgUsername: username
            });
            newMessage(roomId, user.id, encryptedMessage);

            getUserListInRoom(roomId).forEach(e => {
                io.to(e.username).emit('newMessageInRoom', roomId);
            });;
        } 
    });

    //Rename room
    socket.on('renameRoom', ({username, passwordHash, roomId, name}) => {

        const user = verifyUser(username, passwordHash);
        
        if(user && isUserInRoom(user.id, roomId)) {

            if(renameRoom(roomId, name)) {
                getUserListInRoom(roomId).forEach(e => {
                    io.to(e.username).emit('newMessageInRoom', 0);
                });
            }
        } 
    });

    //User requests messages for searching
    socket.on('getMessages', ({username, passwordHash, roomId}) => {

        const user = verifyUser(username, passwordHash);

        if(user && isUserInRoom(user.id, roomId)) {
            socket.emit('getMessagesResponse', getMessages(roomId, 500, 0));
        }
    });

});

//Run server
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
