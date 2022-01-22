if(localStorage.getItem('username')) window.location.replace('app.html');

const socket = io();

const usernameForm = document.querySelector('.register-username-form');
const passwordForm = document.querySelector('.register-password-form');
const newUsernameSpan = document.querySelector('.new-username');

const crypt = new Crypt();
const rsa = new RSA({keySize: 1024});

let username = '';
let passwordHash = '';

//When user submits username form
usernameForm.addEventListener('submit', e => {
    e.preventDefault();

    username = e.target.elements[0].value.normalize();

    socket.emit('usernameVerify', username);
});

//When user submits password form
passwordForm.addEventListener('submit', e => {
    e.preventDefault();

    const password = e.target.elements[0].value.normalize();
    const password2 = e.target.elements[1].value.normalize();

    if(password == password2) {
        //For safety password is checked only on client side, server never see it.
        if(password.length >= 8 && password.length <= 32) {
            passwordHash = CryptoJS.SHA256(password).toString(CryptoJS.enc.Base64);

            rsa.generateKeyPair(function(keyPair) {
                const encryptedSecret = CryptoJS.AES.encrypt(keyPair.privateKey, password).toString();

                socket.emit('registerNewUser', {
                    username: username,
                    passwordHash: passwordHash,
                    userPublicKey: keyPair.publicKey,
                    userPrivateKey: encryptedSecret
                });
            });

        } else {
            passwordForm.elements[0].value = '';
            passwordForm.elements[1].value = '';
            displayError('Password must contain 8-32 characters!');
        }
    } else {
        passwordForm.elements[0].value = '';
        passwordForm.elements[1].value = '';
        displayError('Passwords are not the same!');
    }
});

//When username verfication resoult is received
socket.on('usernameVerifyResult', r => {
    if(r==0) {
        usernameForm.classList.add('display-none');
        passwordForm.classList.remove('display-none');
        newUsernameSpan.innerHTML += 'Welcome, '+username+'!';
        errorBox.innerHTML = '';
    } else if(r==1) {
        displayError('Username must contain 6-20 characters!');
    } else if(r==2) {
        displayError('Username is already taken!');
    } else if(r==3) {
        displayError('Username can contain only small letters and numbers!');
    }
});

//When user registration resoult is received 
socket.on('registerNewUserResult', r => {
    if(r==0) {
        window.location.replace('index.html?register=1');
    } else if(r==1) {
        displayError('Username is not valid!');
    } else if(r==2) {
        displayError('Server or database error, try again later.');
    }
});

//Error box
const errorBox = document.querySelector('.error-box');

function displayError(msg) {
    errorBox.innerHTML = msg;
}
