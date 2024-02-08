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

    for (var i = 0; i < diceCount; i++) {
        var row = table.insertRow();
        for (var j = 0; j < diceCount; j++) {
            var cell = row.insertCell();
            var value = values[i][j];
            cell.className = value > 0 ? 'green' : value < 0 ? 'red' : 'black';
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
        var max = Math.max.apply(null, probabilityTable.map(function(row) {
            return Math.max.apply(Math, row);
        }));

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
    [
        [ 8, 10, 12, 13, 15, 16, 17, 19, 41, 43, 45, 49, 82, 83, 84, 85, 88, 90, 93],
        [21, 22, 23, 24, 25, 27, 28, 29, 30, 32, 35, 47, 65, 66, 67, 74, 91, 92, 94],
        [20, 26, 31, 33, 34, 36, 46, 48, 50, 51, 52, 53, 54, 55, 56, 58, 59, 63, 69],
        [ 0,  1,  2,  5, 37, 38, 39, 40, 42, 44, 57, 68, 70, 71, 73, 75, 76, 77, 78],
        [ 3,  4,  6,  7,  9, 11, 14, 18, 60, 61, 62, 64, 72, 79, 80, 81, 86, 87, 89],
    ],
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
        [ 0, 13, 17, 23, 32],
        [ 3, 12, 18, 24, 28],
        [ 2,  9, 19, 25, 30],
        [ 1,  7, 20, 26, 31],
        [ 4, 11, 14, 27, 29],
        [ 5, 10, 16, 21, 33],
        [ 6,  8, 15, 22, 34]
    ]
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