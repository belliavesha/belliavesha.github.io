function loadContent(filename) {
    fetch(filename)
        .then(response => response.text())
        .then(data => {
            document.getElementById('content').innerHTML = data;
        });
}


// var rotation = 0; // Initialize rotation

// window.addEventListener('wheel', function(e) {
//     rotation += e.deltaY / 20; // Adjust as needed
//     var photo = document.getElementById('profile-pic');
//     var rot;
//     if ((rotation) < -540) {
//         rotation +=1080
//     }
//     if ((rotation) > 540) {
//         rotation -=1080
//     }
//     if (Math.abs(rotation) < 400) {
//         rot = rotation * rotation * rotation / 400/400/10;
//     } else {
//         rot = rotation;
//     }
//     photo.style.transform = 'rotate(' + rot + 'deg)';

// });

var index = 1; // Initialize index
var startY; // Initialize startY

// Listen for wheel event
window.addEventListener('wheel', function(e) {
    updateIndex(e.deltaY > 0 ? 1 : -1);
});

// Listen for touchstart event
window.addEventListener('touchstart', function(e) {
    startY = e.touches[0].clientY;
});

// Listen for touchend event
window.addEventListener('touchend', function(e) {
    var endY = e.changedTouches[0].clientY;
    updateIndex(startY > endY ? 1 : -1);
});


function updateIndex(delta) {
    index += delta;

    var maxindex = 16;
    // Wrap around to the start or end of the array if necessary
    if (index > maxindex) {
        index = 1;
    } else if (index < 1) {
        index = maxindex;
    }

    // Change the image
    var flipbook = document.getElementById('profile-pic');
    flipbook.src = 'assets/images/alive_2/frame' + String(index).padStart(2, '0') + '.jpg';
}
