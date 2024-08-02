function showErrorMessage(){
    // Create a div element for the error message
    var errorDiv = document.createElement('div');
    errorDiv.id = 'errorDiv';
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '50%';
    errorDiv.style.left = '50%';
    errorDiv.style.transform = 'translate(-50%, -50%)';
    errorDiv.style.backgroundColor = '#f9dee4';
    errorDiv.style.color = 'white';
    errorDiv.style.padding = '20px';
    errorDiv.style.borderRadius = '5px';
    errorDiv.style.zIndex = '9999';
    errorDiv.style.width = '60%';
    errorDiv.style.minHeight = 'calc(60vw * 9 / 16)';
    errorDiv.style.maxHeight = 'calc(60vw * 9 / 16)';
    errorDiv.style.overflow = 'auto';
    errorDiv.style.backgroundImage = 'url(assets/images/wha.png)';
    errorDiv.style.backgroundSize = 'cover';

    // Create a paragraph element for the error message text
    var errorMessage = document.createElement('p');
    errorMessage.textContent = "An\u00A0error occurred. Maybe\u00A0you\u00A0did something\u00A0wrong? Maybe\u00A0it\u00A0is\u00A0God. Who\u00A0knows? Not\u00A0you.";
    errorMessage.style.textAlign = 'center';
    errorMessage.style.marginTop = '10px';
    errorMessage.style.fontSize = '18px';
    errorMessage.style.textShadow = '3px 3px 6px #1e2439';
    errorMessage.style.color = '#d5e083'; // Add this line to set the text color to red

    // Append the error message to the error div
    errorDiv.appendChild(errorMessage);

    // Create a button element for "Try Again"
    var tryAgainButton = document.createElement('button');
    tryAgainButton.textContent = 'Try Again';
    tryAgainButton.style.marginTop = '10px';
    tryAgainButton.style.display = 'block';
    tryAgainButton.style.margin = '0 auto';
    tryAgainButton.style.position = 'absolute';
    tryAgainButton.style.bottom = '10px';
    tryAgainButton.style.left = '0';
    tryAgainButton.style.right = '0';
    tryAgainButton.style.width = '50%';
    tryAgainButton.style.padding = '10px';
    tryAgainButton.style.fontSize = '16px';
    tryAgainButton.style.borderRadius = '5px';
    tryAgainButton.style.backgroundColor = '#1e2439';
    tryAgainButton.style.color = '#95d5b7';
    tryAgainButton.style.border = 'none';
    tryAgainButton.style.cursor = 'pointer';
    tryAgainButton.style.fontWeight = 'bold';
    tryAgainButton.style.transition = 'all 0.3s';
    tryAgainButton.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';

    // Add hover effect to the button
    tryAgainButton.addEventListener('mouseover', function() {
        tryAgainButton.style.transform = 'scale(1.1)';
        tryAgainButton.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
    });

    // Remove hover effect from the button
    tryAgainButton.addEventListener('mouseout', function() {
        tryAgainButton.style.transform = 'scale(1)';
        tryAgainButton.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
    });

    // Add an event listener to the button that closes the popup
    tryAgainButton.addEventListener('click', function() {
        var errorDiv = document.getElementById('errorDiv');
        if (errorDiv) {
            errorDiv.remove();
        }
    });

    // Append the "Try Again" button to the error div
    errorDiv.appendChild(tryAgainButton);

    // Append the error div to the body of the webpage
    document.body.appendChild(errorDiv);
}



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

