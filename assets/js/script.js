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


// // Get all buttons that open modals
// var btns = document.getElementsByClassName("openModal");

// // Loop through the buttons and assign a click event handler to each
// for (var i = 0; i < btns.length; i++) {
//     btns[i].onclick = function() {
//         // Get the modal id from the data-modal attribute of the button
//         var modalId = this.getAttribute("data-modal");

//         // Get the modal and the close button
//         var modal = document.getElementById(modalId);
//         var span = modal.getElementsByClassName("close")[0];

//         // Show the modal
//         modal.style.display = "block";

//         // When the user clicks on <span> (x), close the modal
//         span.onclick = function() {
//             modal.style.display = "none";
//         }

//         // When the user clicks anywhere outside of the modal, close it
//         window.onclick = function(event) {
//             if (event.target == modal) {
//                 modal.style.display = "none";
//             }
//         }
//     }
// }


function loadVideo(filename) {
    // Get the button
    var button = document.getElementById('videoButton');

    // Create a new video element
    var video = document.createElement('video');

    // Set the source of the video
    video.src = filename;

    // Add controls to the video
    video.controls = true;

    // Add an event listener to the video that will change it back to a button when it ends
    video.addEventListener('ended', function() {
        button.innerHTML = 'Load Video 1';
        button.onclick = function() { loadVideo('movie1.mp4'); };
    });

    // Change the button to the video
    button.innerHTML = '';
    button.appendChild(video);
    button.onclick = null;
}
