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
        [ 0,  4,  8,  9, 13],
        [ 1,  5,  7, 10, 12],
        [ 2,  3,  6, 11, 14]
    ],
    [
        [ 0,  3,  9, 10, 13],
        [ 1,  4,  5, 11, 14],
        [ 2,  6,  7,  8, 12]
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
        [ 0, 11, 19],
        [ 1, 13, 16],
        [ 2, 10, 18],
        [ 3,  7, 20],
        [ 4, 12, 14],
        [ 5,  8, 17],
        [ 6,  9, 15],
    ]
];

generateGallery(diceSets);