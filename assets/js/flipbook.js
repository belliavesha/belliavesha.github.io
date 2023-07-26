
var flipbookIndex = 1; // Initialize flipbookIndex
var startY; // Initialize startY

// Listen for wheel event
window.addEventListener('wheel', function(e) {
    updateFlipbookIndex(e.deltaY > 0 ? 1 : -1);
});

// Listen for touchstart event
window.addEventListener('touchstart', function(e) {
    startY = e.touches[0].clientY;
});

// Listen for touchend event
window.addEventListener('touchend', function(e) {
    var endY = e.changedTouches[0].clientY;
    updateFlipbookIndex(startY > endY ? 1 : -1);
});


function updateFlipbookIndex(delta) {
    flipbookIndex += delta;

    var maxIndex = 16;
    // Wrap around to the start or end of the array if necessary
    if (flipbookIndex > maxIndex) {
        flipbookIndex = 1;
    } else if (flipbookIndex < 1) {
        flipbookIndex = maxIndex;
    }

    // Change the image
    var flipbook = document.getElementById('profile-pic');
    flipbook.src = 'assets/images/alive_2/frame' + String(flipbookIndex).padStart(2, '0') + '.jpg';
}


