

function loadContent(htmlFile, jsFile) {
            

    fetch(htmlFile)
        .then(response => response.text())
        .then(data => {
            document.getElementById('content').innerHTML = data;
            if (jsFile) loadScript(jsFile);
        });
    
}

function loadScript(jsFile) {
    let oldScript = document.querySelector(`script[src="${jsFile}"]`);
    if (oldScript) oldScript.remove();

    let script = document.createElement('script');
    script.src = jsFile;
    document.head.appendChild(script);
}

var perseverance = 0;
function redirectToSecondary(n) {
    perseverance = perseverance + n;
    if (perseverance > 5){
        perseverance = 0;
        window.location.href = "second.html";
    }   
}





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


window.onload = window.onhashchange = function() {
    // Get the current hash value (without the # symbol)
    var currentHash = window.location.hash.substring(1);

    
    // Determine what content to load based on the hash
    switch (currentHash) {
        case 'home':
            loadContent('assets/html/Home.html');
            break;  
        case 'projects':    
            loadContent('assets/html/Projects.html');
            break;
        case 'talks':
            loadContent('assets/html/Talks.html');
            break;
        case 'merits':
            loadContent('assets/html/Merits.html');
            break;
        default:
            loadContent('assets/html/Home.html');
            break;
    }
};

