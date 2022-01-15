if(localStorage.getItem('username')) window.location.replace('app.html');

const socket = io();

//Chceck if just registered
const registerLinkSpan = document.querySelector('.register-link');

if(window.location.search=='?register=1') {
    registerLinkSpan.innerHTML = '<p style="color:green;font-weight:700;">Registration successful, login in now</p>';
}

let username = '';
let passwordHash = '';
let password = '';

//When user submits login form
const loginForm = document.querySelector('.login-form');

loginForm.addEventListener('submit', e => {
    e.preventDefault();

    username = e.target.elements[0].value.normalize();
    password = e.target.elements[1].value.normalize();
    passwordHash = CryptoJS.SHA256(password).toString(CryptoJS.enc.Base64);

    socket.emit('loginRequest', {
        username: username,
        passwordHash: passwordHash
    });
});

//When user login resoult is received
socket.on('loginRequestResponse', ({encrypted_secret, userPublicKey}) => {
    if(userPublicKey) {
        const secret = CryptoJS.AES.decrypt(encrypted_secret, password);
        const userPrivateKey = CryptoJS.enc.Utf8.stringify(secret);

        localStorage.setItem('username', username);
        localStorage.setItem('passwordHash', passwordHash);
        localStorage.setItem('secret', userPrivateKey);
        localStorage.setItem('myPublicKey', userPublicKey);

        window.location.replace('app.html');
    } else {
        displayError('Username or password is incorrect!');
    } 
});

const errorBox = document.querySelector('.error-box');

function displayError(msg) {
    errorBox.innerHTML = msg;
}