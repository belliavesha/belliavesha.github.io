function loadContent(filename) {
    fetch(filename)
        .then(response => response.text())
        .then(data => {
            document.getElementById('content').innerHTML = data;
        });
}


var rotation = 0; // Initialize rotation

window.addEventListener('wheel', function(e) {
    rotation += e.deltaY / 100; // Adjust as needed
    var photo = document.getElementById('profile-pic');
    photo.style.transform = 'rotate(' + rotation + 'deg)';

});