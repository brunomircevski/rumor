const mysql = require('sync-mysql');

const con = new mysql({
    host: "localhost",
    user: "root",
    password: "",
    database: "node"
})

function getUserByUsername(username) {
    let r;
    try {
        r = con.query(`SELECT * FROM user WHERE username=?`, [username]);
    }
    catch(e) {
        console.log(e.code);
        return false;
    }
    if(r.length==0) return false;
    return r[0];
}

function verifyUsername(username) {
    if(username.length >= 6 && username.length <= 20) {

        if(/^[a-z0-9_.-]*$/.test(username)) {

            if(!getUserByUsername(username)) return 0;
            else return 2;

        } else return 3;

    } else return 1;

}

function registerNewUser(username, passwordHash, public, secret) {
    try {
        con.query(`INSERT INTO user VALUES (NULL, ?, ?, ?, ?)`, [username, passwordHash, public, secret]);
    }
    catch(e) {
        console.log(e.code);
        return false;
    }
    return true;
}

function verifyUser(username, passwordHash) {
    const user = getUserByUsername(username);
    if(passwordHash == user.passwordHash) return user;
    return false;
}

function createRoom(user, publicKey, creatorSecret) {
    if(!publicKey || publicKey == '') return false;

    try {
        const r = con.query(`SELECT COUNT(uir.roomId) c FROM userInRoom uir WHERE uir.userId = ? AND uir.roomId IN (SELECT roomId FROM userInRoom GROUP BY roomId HAVING COUNT(*) = 1)`, [user.id])
        if(r[0].c > 1) return false;

        const newId = con.query(`SELECT MAX(id) id FROM room`)[0].id + 1;
        con.query(`INSERT INTO room VALUES (?, '', ?, 0, NOW())`, [newId, publicKey]);
        if(!addUserToRoom(user, newId, creatorSecret)) return false;
    }
    catch(e) {
        console.log(e.code);
        return false;
    }

    return true;
}

function addUserToRoom(user, roomId, userSecret) {
    try {
        con.query(`INSERT INTO userInRoom VALUES (NULL, ?, ?, ?)`, [roomId, user.id, userSecret]);

        r = con.query(`SELECT isNameCustom FROM room WHERE id = ?`, [roomId]);

        if(r[0].isNameCustom == 0) updateRoomName(roomId);
    }
    catch(e) {
        console.log(e.code);
        return false;
    }
    return true;
}

function updateRoomName(roomId) {
    const users = getUserListInRoom(roomId, 5);
    if(users.length) {
        let name = '';
        users.forEach(e => {
            name += e.username + ', ';
        });

        con.query(`UPDATE room SET name = ? WHERE id = ?`, [name.slice(0, -2), roomId]);
    }
}

function getRoomListByUser(user) {
    try {
        const r = con.query(`SELECT r.id, r.name, isNameCustom, DATE_FORMAT(lastMessageDate, '%d/%m %H:%i') date FROM room r, userInRoom WHERE r.id = userInRoom.roomId AND userInRoom.userId = ? ORDER BY lastMessageDate DESC`, [user.id]);
        if(r.length==0) return false;
        return r;
    }
    catch(e) {
        console.log(e.code);
        return false;
    }
}

function getRoomSecret(userId, roomId) {
    try {
        const r = con.query(`SELECT encryptedSecret, publicKey FROM userInRoom, room WHERE userId = ? AND roomId = ? AND roomId = room.id`, [userId, roomId]);
        if(r.length==0) return false;
        return r[0];
    }
    catch(e) {
        console.log(e.code);
        return false;
    }
}

function leaveRoom(userId, roomId) {
    try {
        con.query(`DELETE FROM userInRoom WHERE userId = ? AND roomId = ?`, [userId, roomId]);
    }
    catch(e) {
        console.log(e.code);
        return false;
    }
    removeEmptyRooms();
    return true;
}

function removeEmptyRooms() {
    try {
        con.query(`DELETE FROM room WHERE id NOT IN (SELECT DISTINCT roomId FROM userInRoom)`);
        con.query(`DELETE FROM message WHERE roomId NOT IN (SELECT id FROM room)`);
    }
    catch(e) {
        console.log(e.code);
    }
}

function isUserInRoom(userId, roomId) {
    try {
        r = con.query(`SELECT id FROM userInRoom WHERE userId = ? AND roomId = ?`, [userId, roomId]);
        if(r.length) return true
    }
    catch(e) {
        console.log(e.code);
    }
    return false;
}

function getMessages(roomId, number, start) {
    try {
        r = con.query(`SELECT username, UNIX_TIMESTAMP(date) date, content FROM message, user WHERE user.id = userId AND roomId = ? ORDER BY date DESC LIMIT ?`, [roomId, number]);
        return r;
    }
    catch(e) {
        console.log(e.code);
    }
    return false;
}

function inviteToRoom(roomId, authorId, invitedId, secret) {
    try {
        r = con.query(`SELECT id FROM invite WHERE roomId = ? AND invitedId = ?`, [roomId, invitedId]);
        if(r.length) return false;
        else con.query(`INSERT INTO invite VALUES (NULL, ?, ?, ?, ?, NOW())`, [authorId, invitedId, roomId, secret]);
    }
    catch(e) {
        console.log(e.code);
        return false;
    }

    return true;
}

function getRequestsListByUser(user) {
    try {
        const r = con.query(`SELECT invite.id id, username, name roomName, DATE_FORMAT(date, '%m/%d/%Y %H:%i') date FROM invite, room, user WHERE authorId = user.id AND roomId = room.id AND invitedId = ?`, [user.id]);
        if(r.length==0) return false;
        return r;
    }
    catch(e) {
        console.log(e.code);
        return false;
    }
}

function respondToRequest(user, requestId, accept) {
    try {
        if(accept) {
            const r = con.query(`SELECT encryptedSecret secret, roomId FROM invite WHERE invitedId = ? AND id = ?`, [user.id, requestId]);
            if(r.length==0) return false;

            addUserToRoom(user, r[0].roomId, r[0].secret);
        }
        con.query(`DELETE FROM invite WHERE invitedId = ? AND id = ?`, [user.id, requestId]);
    }
    catch(e) {
        console.log(e.code);
        return false;
    }
    return true;
}

function getUserListInRoom(roomId, limit) {
    if(!limit) limit = 100;
    try {
        const r = con.query(`SELECT username FROM user, userInRoom WHERE userId = user.id AND roomId = ? LIMIT ?`, [roomId, limit]);
        if(r.length==0) return false;
        return r;
    }
    catch(e) {
        console.log(e.code);
        return false;
    }
}

function newMessage(roomId, userId, content) {
    try {
        con.query(`INSERT INTO message VALUES (NULL, ?, ?, NOW(), ?)`, [roomId, userId, content]);
        con.query(`UPDATE room SET lastMessageDate = NOW() WHERE id = ?`, [roomId]);
    }
    catch(e) {
        console.log(e.code);
        return false;
    }
    return true;
}

function renameRoom(roomId, name) {
    if(name.length>50) return false;
    
    try {
        con.query(`UPDATE room SET name = ? WHERE id = ?`, [name, roomId]);
        con.query(`UPDATE room SET isNameCustom = 1 WHERE id = ?`, [roomId]);
    }
    catch(e) {
        console.log(e.code);
        return false;
    }
    return true;
}

module.exports = {
    verifyUsername,
    registerNewUser,
    verifyUser,
    getUserByUsername,
    createRoom,
    getRoomListByUser,
    getRoomSecret,
    leaveRoom,
    isUserInRoom,
    getMessages,
    inviteToRoom,
    getRequestsListByUser,
    respondToRequest,
    getUserListInRoom,
    newMessage,
    renameRoom
};