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

window.onload = window.onhashchange = function() {
    // Get the current hash value (without the # symbol)
    var currentHash = window.location.hash.substring(1);


    // <ul>
    //     <li><a href="index.html">Home</a></li>
    //     <li><a href="#recaman" onclick="loadContent('assets/html/Recaman.html', 'assets/js/recaman.js')">Recamán sequence</a></li>  
    //     <li><a href="#heart" onclick="loadContent('assets/html/Heart.html', 'assets/js/heart.js')">My heart</a></li>  
    //     <li><a href="#mandelbrot" onclick="loadContent('assets/html/Mandelbrot.html', 'assets/js/mandelbrot.js')">Mandelbrot</a></li>  
    //     <li><a href="#cygx3" onclick="loadContent('assets/html/CygX3.html', 'assets/js/cygx3.js')">CygX-3</a></li>  
    //     <li><a href="#dice" onclick="loadContent('assets/html/Dice.html', 'assets/js/dice.js')">Intransitive Dice</a></li>
    // </ul>
    
    
    // Determine what content to load based on the hash
    switch (currentHash) {
        case 'recaman':
            loadContent('assets/html/Recaman.html', 'assets/js/recaman.js');
            break;
        case 'heart':
            loadContent('assets/html/Heart.html', 'assets/js/heart.js');
            break;
        case 'mandelbrot':
            loadContent('assets/html/Mandelbrot.html', 'assets/js/mandelbrot.js');
            break;
        case 'cygx3':
            loadContent('assets/html/CygX3.html', 'assets/js/cygx3.js');
            break;
        case 'dice':    
            loadContent('assets/html/Dice.html', 'assets/js/dice.js');
            break;
        default:
            break;
    }
};