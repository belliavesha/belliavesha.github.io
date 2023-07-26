var rotation = 0.5; 

window.addEventListener('wheel', function(e) {
    rotation += e.deltaY / 13; 
    var photo = document.getElementById('profile-pic');
    var rot;
    if ((rotation) < -540) {
        rotation +=1080
    }
    if ((rotation) > 540) {
        rotation -=1080
    }
    if (Math.abs(rotation) < 400) {
        rot = rotation * rotation * rotation/ 400/400/10;
    } else {
        rot = rotation;
    }
    photo.style.transform = 'rotate(' + rot + 'deg)';

});


var styles = `   
    #profile-pic {
        top: 0;
        border-radius: 50%;
        width: 50%;
        padding-top: 0;
        margin-bottom: 20px;
        margin-top: 25%;
}
`
var styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);