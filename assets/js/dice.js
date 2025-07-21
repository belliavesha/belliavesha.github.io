   // # Function to compute the probability table
   function computeProbabilityTable(dice) {
    var numDice = dice.length;
    var probabilityTable = [];

    for (var i = 0; i < numDice; i++) {
        probabilityTable[i] = [];
        for (var j = 0; j < numDice; j++) {   
            var wins = 0;
            var losses = 0;
            for (var a = 0; a < dice[i].length; a++) {
                for (var b = 0; b < dice[j].length; b++) {
                    if (dice[i][a] > dice[j][b]) {
                        wins++;
                    } else if (dice[i][a] < dice[j][b]) {
                        losses++;
                    }
                }
            }
            probabilityTable[i][j] = wins - losses;
        }
    }

    return probabilityTable;
}


function generateTournamentTable(diceCount, values) {
    var table = document.createElement('table');
    table.className = 'tournament-table';
    var Maxcorn = Math.abs(values[0][1]);
    for (var i = 0; i < diceCount; i++) {
        var row = table.insertRow();
        for (var j = 0; j < diceCount; j++) {
            var cell = row.insertCell();
            var value = values[i][j];
            // cell.className = value > 0 ? 'green' : value < 0 ? 'red' : 'black';
            // below I want green if the value equals the max value of the table, red is equals the min value of the table, black if zero and gray otherwise
            if (value == Maxcorn){
                cell.className = 'green';
            } else if (value == -Maxcorn) {
                cell.className = 'red';
            } else if (value == 0) {
                cell.className = 'black';
            } else {
                cell.className = 'gray';
            }
        }
    }

    return table;
}

function displayDiceSet(diceSet) {
    var diceTable = document.createElement('table');
    diceTable.className = 'dice-table';

    diceSet.forEach(function(die, index) {
        var row = diceTable.insertRow();
        // Add a letter to the first column, name of the dice "A:", "B:", etc., in bold
        row.insertCell().textContent = String.fromCharCode(65 + index) + ':';
        row.cells[0].style.fontWeight = 'bold';
        
        die.forEach(function(face) {
            row.insertCell().textContent = face;
        });
    });

    return diceTable;
}

function generateGallery(diceSets) {
    var gallery = document.getElementById('diceSetsGallery');

    diceSets.forEach(function(diceSet) {
        var container = document.createElement('div');
        container.className = 'dice-set-title';
        // add the title # dice # faces on top of all the tables
        var faces = diceSet[0].length;
        var title = document.createElement('p');    
        title.textContent = diceSet.length + " dice with " + faces + " faces";
        title.style.fontWeight = 'bold';
        // it must be above the dice table
        container.appendChild(title);
        // the rest of the tables must be below the title
        
        
        var container = document.createElement('div');
        container.className = 'dice-set-container';

        var diceTable = displayDiceSet(diceSet);
        container.appendChild(diceTable);

        var probabilityTable = computeProbabilityTable(diceSet);
        var tournamentTable = generateTournamentTable(diceSet.length, probabilityTable);
        // faces = the number of faces on the dice



        //get the maximum value of the probability table
        // var max = Math.max.apply(null, probabilityTable.map(function(row) {
        //     return Math.max.apply(Math, row);
        // }));
        var max = Math.abs(probabilityTable[0][1]);

        container.appendChild(tournamentTable);

        // the tournament table shoulbe be to the right of the dice table in the container
        // on a constant distance from the left border of the container
        container.style.display = 'flex';
        container.style.flexDirection = 'row';
        container.style.alignItems = 'center';
        container.style.width = 'auto';
        container.style.margin = '10 auto';

        // also add the line "The win probablity value is: 
        var winProbability = document.createElement('p');
        winProbability.textContent = 'p =  ' 
                        + (max + faces*faces)/2 + "/" + (faces*faces) + 
                        '\u2248' + Math.round((max + faces*faces)/2/(faces*faces)*10000)/100 + " %";

        container.appendChild(winProbability);

        



        gallery.appendChild(container);
    });
}

// Example dice sets
var diceSets = [
    [
        [ 0, 5, 7],
        [ 1, 3, 8],
        [ 2, 4, 6 ],
    ],
    [
        [ 0,  5,  7, 10],
        [ 1,  2,  8, 11],
        [ 3,  4,  6,  9]
    ],
    [
        [ 0,  5,  7, 10, 13],
        [ 1,  3,  8, 11, 12],
        [ 2,  4,  6,  9, 14]
    ],
    [
        [ 0,  3,  9, 10, 13],
        [ 1,  4,  5, 11, 14],
        [ 2,  6,  7,  8, 12]
    ],
    [
        [ 0,  2, 10, 11, 12],
        [ 1,  3,  4, 13, 14],
        [ 5,  6,  7,  8,  9]
    ],   
    [
        [ 0,  1,  8, 13, 14, 15],
        [ 2,  3,  4,  9, 16, 17],
        [ 5,  6,  7, 10, 11, 12],
    ],  
    [
        [ 0,  3,  7, 10, 13, 17, 20],
        [ 1,  6,  8,  9, 12, 16, 18],
        [ 2,  4,  5, 11, 14, 15, 19]
    ],
    [
        [ 0,  3,  9, 10, 12, 17, 19],
        [ 1,  4,  5, 11, 14, 15, 20],
        [ 2,  6,  7,  8, 13, 16, 18]
    ],
    [
        [0, 3, 9, 10, 11, 18, 19],
        [1, 4, 5, 12, 13, 15, 20],
        [2, 6, 7, 8, 14, 16, 17]
    ],
    [
        [ 2,  3,  4,  6, 16, 19, 20],
        [ 5,  7,  8,  9, 10, 14, 17],
        [ 0,  1, 11, 12, 13, 15, 18]
    ],
    [
        [ 1,  2,  3, 13, 16, 17, 18],
        [ 4,  5,  6,  7,  9, 19, 20],
        [ 0,  8, 10, 11, 12, 14, 15]
    ],
    [
        [ 0,  4,  5, 10, 16, 17, 19, 21],
        [ 1,  6,  7,  8,  9, 18, 20, 23],
        [ 2,  3, 11, 12, 13, 14, 15, 22]
    ],
    [
        [ 0,  1,  9, 10, 12, 19, 20, 21],
        [ 2,  3,  4, 11, 13, 14, 22, 23],
        [ 5,  6,  7,  8, 15, 16, 17, 18],
    ],
    [
        [ 0,  9, 10, 11, 12, 13, 16, 21],
        [ 1,  2,  3, 14, 15, 17, 18, 22],
        [ 4,  5,  6,  7,  8, 19, 20, 23],
    ],
    [
        [ 0,  9, 10, 11, 12, 13, 14, 23],
        [ 1,  2,  4, 15, 16, 17, 18, 19],
        [ 3,  5,  6,  7,  8, 20, 21, 22]
    ],
    [
        [ 0,  1,  2, 15, 17, 18, 19, 20],
        [ 3,  4,  5,  6,  8, 21, 22, 23],
        [ 7,  9, 10, 11, 12, 13, 14, 16],
    ],
    [
        [ 0,  5,  6,  7,  8, 19, 23, 24, 25],
        [ 1,  9, 10, 11, 12, 13, 15, 20, 26],
        [ 2,  3,  4, 14, 16, 17, 18, 21, 22]
    ],

    [
        [ 0, 11, 12, 13, 14, 15, 16, 17, 19],
        [ 1,  2,  3,  4, 18, 20, 22, 23, 24],
        [ 5,  6,  7,  8,  9, 10, 21, 25, 26],
    ],
    [
        [ 0,  9, 12],
        [ 1,  7, 13],
        [ 2,  5, 14],
        [ 3,  8, 10],
        [ 4,  6, 11],
    ],
    [
        [0, 4, 16, 17, 23],
        [1, 6, 13, 19, 21],
        [2, 3, 11, 20, 24],
        [7, 9, 10, 12, 22],
        [5, 8, 14, 15, 18]
    ],
    [
        [ 1,  4, 10, 22, 23],
        [ 5,  7,  8, 16, 24],
        [ 6, 11, 12, 14, 17],
        [ 0,  9, 13, 18, 20],
        [ 2,  3, 15, 19, 21],
    ],
    [
         [ 6,  7,  8,  9, 13, 26, 27, 45, 51, 52, 53],
         [14, 15, 17, 18, 19, 21, 23, 29, 38, 49, 54],
         [10, 16, 20, 22, 28, 31, 32, 33, 34, 35, 36],
         [ 0,  1,  3, 24, 25, 30, 39, 40, 42, 43, 50],
         [ 2,  4,  5, 11, 12, 37, 41, 44, 46, 47, 48],
    ],    
    [
        [ 6,  7,  8,  9, 10, 27, 28, 49, 50, 51, 52],
        [15, 16, 17, 18, 19, 21, 22, 23, 39, 53, 54],
        [11, 13, 20, 25, 29, 30, 31, 33, 34, 35, 36],
        [ 0,  1,  2, 24, 26, 32, 40, 41, 42, 44, 45],
        [ 3,  4,  5, 12, 14, 37, 38, 43, 46, 47, 48],
    ],
    // [
    //     [ 8, 10, 12, 13, 15, 16, 17, 19, 41, 43, 45, 49, 82, 83, 84, 85, 88, 90, 93],
    //     [21, 22, 23, 24, 25, 27, 28, 29, 30, 32, 35, 47, 65, 66, 67, 74, 91, 92, 94],
    //     [20, 26, 31, 33, 34, 36, 46, 48, 50, 51, 52, 53, 54, 55, 56, 58, 59, 63, 69],
    //     [ 0,  1,  2,  5, 37, 38, 39, 40, 42, 44, 57, 68, 70, 71, 73, 75, 76, 77, 78],
    //     [ 3,  4,  6,  7,  9, 11, 14, 18, 60, 61, 62, 64, 72, 79, 80, 81, 86, 87, 89],
    // ],
    [
        [ 0, 11, 19],
        [ 1, 13, 16],
        [ 2, 10, 18],
        [ 3,  7, 20],
        [ 4, 12, 14],
        [ 5,  8, 17],
        [ 6,  9, 15],
    ],
    [
<<<<<<< HEAD
        [1,     22, 28],  
        [2,     20, 29],  
        [3,     18, 30],  
        [4,     16, 31],  
        [5,     14, 32],  
        [6,     12, 33],  
        [7,     21, 23],  
        [8,     19, 24],  
        [9,     17, 25],  
        [10,    15, 26],  
        [11,    13, 27],  
=======
        [ 0, 17, 22],
        [ 1, 15, 23],
        [ 2, 13, 24],
        [ 3, 11, 25],
        [ 4,  9, 26],
        [ 5, 16, 18],
        [ 6, 14, 19],
        [ 7, 12, 20],
        [ 8, 10, 21],
>>>>>>> aff94e2d0c439a7c9dc8c8a982c48656f4d9df2d
    ],
    [
        [ 0, 13, 17, 23, 32],
        [ 3, 12, 18, 24, 28],
        [ 2,  9, 19, 25, 30],
        [ 1,  7, 20, 26, 31],
        [ 4, 11, 14, 27, 29],
        [ 5, 10, 16, 21, 33],
        [ 6,  8, 15, 22, 34]
    ],
    [
        [ 3,  4,  6, 22, 23],
        [ 5,  8,  9, 12, 24],
        [ 7, 10, 13, 14, 16],
        [ 0, 11, 15, 17, 19],
        [ 1,  2, 18, 20, 21],
    ],
    [
        [ 9, 10, 11, 12, 13, 14],
        [ 0,  1, 15, 16, 17, 18],
        [ 2,  3,  4, 19, 20, 21],
        [ 5,  6,  7,  8, 22, 23]
    ],
    [
        [18, 19, 20, 21, 22, 23, 24, 25, 26],
        [ 0,  2,  3, 27, 28, 29, 30, 31, 33],
        [ 1,  4,  5,  6, 32, 34, 35, 36, 39],
        [ 7,  8,  9, 10, 11, 37, 38, 41, 43],
        [12, 13, 14, 15, 16, 17, 40, 42, 44]
    ],
    [
        [13, 14, 16, 17, 18, 20, 21],
        [ 0,  1, 19, 22, 23, 24, 26],
        [ 2,  3,  4, 25, 27, 28, 29],
        [ 5,  6,  7,  8, 30, 31, 33],
        [ 9, 10, 11, 12, 15, 32, 34]
    ],
    [
        [  0,   1,   2,   3,  58,  60,  61,  63,  64,  65,  66,  67,  68,  69,
        70,  71,  72,  73,  74,  75,  76,  77,  78,  79],
        [  4,   5,   6,   7,   8,   9,  10,  11,  12,  80,  81,  82,  83,  84,
        85,  86,  87,  88,  89,  90,  91,  92,  93,  94],
        [ 13,  14,  15,  16,  17,  18,  19,  20,  21,  22,  23,  24,  95,  96,
        97,  98,  99, 100, 101, 102, 103, 104, 105, 106],
        [ 25,  26,  27,  28,  29,  30,  31,  32,  33,  34,  35,  36,  37,  38,
        39, 107, 108, 109, 110, 111, 112, 113, 114, 115],
        [ 40,  41,  42,  43,  44,  45,  46,  47,  48,  49,  50,  51,  52,  53,
        54,  55,  56,  57,  59,  62, 116, 117, 118, 119]
    ], 
    [
        [ 58,  61,  62,  63,  64,  65,  66,  67,  68,  69,  70,  71,  72,  73,
        74,  75,  76,  77,  78,  79,  80,  81,  82,  85],
        [  0,   1,   2,   3,   4,   5,   6,  83,  84,  86,  87,  88,  89,  90,
        91,  92,  93,  94,  95,  96,  97,  98,  99, 100],
        [  7,   8,   9,  10,  11,  12,  13,  14,  15,  17, 101, 102, 103, 104,
        105, 106, 107, 108, 109, 110, 111, 112, 113, 115],
        [ 16,  18,  19,  20,  21,  22,  23,  24,  25,  26,  27,  30, 114, 116,
        117, 118, 119, 120, 121, 122, 123, 124, 125, 126],
        [ 28,  29,  31,  32,  33,  34,  35,  36,  37,  38,  39,  40,  41,  42,
        127, 128, 129, 130, 131, 132, 133, 134, 135, 136],
        [ 43,  44,  45,  46,  47,  48,  49,  50,  51,  52,  53,  54,  55,  56,
        57,  59,  60, 137, 138, 139, 140, 141, 142, 143]
    ],
    [
        [ 43,  44,  45,  48,  49,  50,  51,  52,  53,  54,  55,  56,  58,  59,
        63],
        [  0,   1,   2,   3,  57,  60,  61,  62,  64,  65,  66,  67,  68,  69,
        70],
        [  4,   5,   6,   7,   8,   9,  71,  72,  73,  74,  75,  76,  78,  79,
        80],
        [ 10,  11,  12,  13,  14,  16,  17,  77,  81,  82,  83,  84,  85,  86,
        87],
        [ 15,  18,  19,  20,  21,  22,  23,  25,  88,  89,  90,  91,  92,  93,
        96],
        [ 24,  26,  27,  28,  29,  30,  31,  32,  33,  94,  95,  97,  98,  99,
        100],
        [ 34,  35,  36,  37,  38,  39,  40,  41,  42,  46,  47, 101, 102, 103,
        104]
    ],
    [
        [35, 36, 37, 38, 39, 40, 41, 42, 43, 44],
        [ 0,  1,  2, 45, 46, 47, 48, 49, 51, 52],
        [ 3,  4,  5,  6, 50, 53, 54, 55, 56, 57],
        [ 8,  9, 10, 11, 12, 58, 59, 60, 61, 62],
        [ 7, 13, 14, 15, 18, 63, 64, 65, 67, 69],
        [16, 17, 19, 20, 21, 66, 68, 70, 71, 72],
        [22, 23, 24, 25, 26, 27, 73, 74, 76, 77],
        [28, 29, 30, 31, 32, 33, 34, 75, 78, 79],
    ],
    [
        [ 45,  47,  49,  51,  52,  53,  54,  55,  56,  58,  60,  62],
        [  0,   1,   4,  57,  59,  61,  63,  64,  66,  67,  68,  69],
        [  2,   3,   5,   7,  65,  70,  71,  72,  73,  74,  75,  77],
        [  6,   8,   9,  10,  11,  76,  78,  79,  80,  81,  82,  83],
        [ 12,  13,  14,  15,  16,  17,  84,  85,  86,  87,  88,  97],
        [ 18,  19,  20,  21,  22,  23,  89,  90,  91,  92,  93,  94],
        [ 24,  25,  26,  27,  28,  29,  31,  95,  96,  98,  99, 101],
        [ 30,  32,  33,  34,  36,  37,  38,  39, 100, 102, 104, 105],
        [ 35,  40,  41,  42,  43,  44,  46,  48,  50, 103, 106, 107]
    ],
    [
        [  0, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112,
        113, 114, 115, 116, 117, 118, 120],
        [  1,   2,   3,   4,   5,   7, 119, 121, 122, 123, 124, 125, 126, 127,
        128, 129, 130, 131, 132, 133, 134],
        [  6,   8,   9,  10,  11,  12,  13,  14, 135, 136, 137, 138, 139, 140,
        141, 142, 143, 144, 146, 147, 149],
        [ 15,  16,  17,  18,  19,  20,  21,  22,  23, 145, 148, 150, 151, 152,
        153, 154, 155, 156, 157, 158, 160],
        [ 24,  25,  26,  27,  28,  29,  30,  31,  32,  33, 159, 161, 162, 163,
        164, 165, 166, 167, 168, 169, 170],
        [ 34,  35,  36,  37,  38,  39,  40,  41,  42,  43,  44, 171, 172, 173,
        174, 175, 176, 177, 178, 179, 181],
        [ 45,  46,  47,  48,  49,  50,  51,  52,  53,  54,  55,  56, 180, 182,
        183, 184, 185, 186, 187, 190, 191],
        [ 57,  58,  59,  60,  61,  62,  63,  64,  65,  66,  68,  69,  72, 188,
        189, 192, 193, 194, 195, 198, 199],
        [ 67,  70,  71,  73,  74,  75,  76,  77,  78,  79,  80,  82,  83,  86,
        196, 197, 200, 202, 203, 204, 205],
        [ 81,  84,  85,  87,  88,  89,  90,  91,  92,  93,  94,  95,  96,  97,
            98,  99, 201, 206, 207, 208, 209]
    ],
    [
        [ 0,  9, 10, 19],
        [ 1, 11, 12, 13],
        [ 2,  7, 14, 15],
        [ 3,  4, 16, 17],
        [ 5,  6,  8, 18]
    ],
];

generateGallery(diceSets);


renderMathInElement(document.body, {
    delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false},
        {left: '\\(', right: '\\)', display: false},
        {left: '\\[', right: '\\]', display: true}
    ],
    throwOnError : false
});

document.addEventListener('DOMContentLoaded', function() {
    const tiles = ['tile1.jpg', 'tile2.jpg', 'tile3.jpg', 'tile4.jpg'];
    const tileSize = 100; // Assuming each tile is 100x100 pixels
    const background = document.getElementById('background');
    
    function createRandomTile() {
        return tiles[Math.floor(Math.random() * tiles.length)];
    }
    
    function createTiledBackground() {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const tilesX = Math.ceil(windowWidth / tileSize);
        const tilesY = Math.ceil(windowHeight / tileSize);
        
        let backgroundImage = '';
        for (let y = 0; y < tilesY; y++) {
            for (let x = 0; x < tilesX; x++) {
                backgroundImage += `url(${createRandomTile()}) ${x * tileSize}px ${y * tileSize}px`;
                if (x < tilesX - 1 || y < tilesY - 1) {
                    backgroundImage += ', ';
                }
            }
        }
        
        background.style.backgroundImage = backgroundImage;
    }
    
    createTiledBackground();
    window.addEventListener('resize', createTiledBackground);
});