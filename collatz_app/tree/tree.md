A standalone js + html page that produces the image of Collatz tree. 

For a sample start value, say 7, compute the collatz sequence until the cycle is found (a number repeats): 7→22→11→34→17→52→26→13→40→20→10→5→16→8→4→2→1→4.  
in this example 4 repeated. now the root is the minimum value (1), if the tree with this root exist, we add all these edges to our tree (the ones that exist increase weight by 1). and if it does not (either it is the first sample or we miraculously found another cycle) create a new tree.
write an optimized code, so big samples size does not freeze the browser.   

Then render the first tree  (if there is more than one tree, user must be able to pick the tree to render via a drop-down).the length of each branch is scaled with the log distance from the root and the thickness and the color depend on the weight. 

test agains the classical sequence :
n % 2 == 0 =>  n -> n/2
n % 2 == 1 => n -> 3*n + 1
and the "alternative collatz" sequence:
n % 2 == 0 =>  n -> n/2 + 1
n % 2 == 1 => n -> 3*n + 1
The alternative sequence is a good edge case test. it has one tree with just one node (sequence 2 → 2 → 2.... ) and at least 4 other trees. so the program should not fail this test. 
and triple sequence 
n % 3 == 0 => n -> n/3 
n % 3 == 1 => n -> 2*n + 1
n % 3 == 2 => n -> 4*n + 2
just for the sake of complete generalization.

for example of the alternative collatz rules, let's say we start with 9:
9→28→15 (not 14 as in classic) →46→24→13→40→21→64→33→100→51→154→78→40.
40 repeated. the root is 21 (not 9, and not 40), the minimum number of the cycle, not of the whole sequence. all the → edges are updated exept the one coming from the root: the edge 21→64 is special, it does not have a weight and its angle and length are not defined, we later highlight the node 65 with a special color box.

the data about the longest path (the furthest leaf) and the maximum value (the maxium number across all nodes) is also kept. when the tree is rendered, the maximum node and the furthes node  are also captioned in special color boxes. 


the graph consists of several maps and fields.
for every number n (serves also as a key), exist several important maps for all the necessary values
parent[n] = m - the number such that that n->m (it is unique, obviously) (for a root this is, naturally, the cycling node, the one we caption with a purple box), 
root[n] = the root value of the node. the ultimate parent. 
weight[n] - the number of times this node is visited (the root has the highest weight, naturally),
children[n] = [m1, m2]  a list just a list of numbers m such as there's an edge m->n,
depth[n] = the distance from the root (for the root node it is zero)

for each tree we have a lookup map 'trees' -
trees[root] = 
{
    highestNode - the node with the maximum value (we caption with a red box)
    lowestNode - the node with the minimum value (we caption with a yellow box, if it does not coinside with the root)
    deepestNode - the node with the maximum depth (we caption with a blue box)
}

there's also a list nodeList, the list of nodes in which each parent goes earlier than all of its children. 

It makes sense to construct it from the sample and keep in memory. the general algorithm must be something like that:
first we identify all the tree roots for all nodes:
lets say we consider the sample number s = 9: 
generate the list of nodes for this sequence  until we hit a value with the known root or cycle. for the sake of an example let's say it is our first sample of this pparticular tree, so we find a cycle first. 
9→28→15→46→24→13→40→21→64→33→100→51→154→78→40.
40 repeated, the root is 21, the minimum number after the first 40. 
so we say r = 21.
let's imagine it is a new root (the root[r] does not exist yet). we create the new tree by creating trees[r] with { highestNode = r, lowestNode = r, deepestNode = r}
then we reverse the sequence (or run with the index decresing i=i-1). we run until seq[i] == r. 
starting from the root and going back along the sequence we can fill the values:
21 has depth = 0, root = 21, parent = 64 (not 40), children = [40], weight = 0, (will be recomputed later)
40 has depth = 1, root = 21, parent = 21, children = [13], weight = 0, 
13 has depth = 2, root = 21, parent = 40, children = [24], weight = 0,
seq[i] has depth[seq[i]] = depth[seq[i+1]], root[seq[i]]=r, weight = 0, children[seq[i]] = [ seq[i-1] ] (if i>0) else []
....
finally 
9 has depth = 7, root = 21, parent = 28, children = [], weight = 0, 
(by the way, after each iteration we put the node into the nodeList)

each iteration i we can also say that 
    tree[r].highestNode = max(tree[r].highestNode, seq[i])
    tree[r].lowestNode = min(tree[r].highestNode, seq[i])
in the end we also do 
    if tree[r].deepestNode > depth[seq[0]], tree[r].deepestNode = seq[0]

let's say we then consider the sample s = 5. we run the sequence until we 
5→16→9... aha! 9 was considered before (root[9] exists). 
so we then say r=root[9]
children[9] append (16), then we run our sequence backwards again (i= i-1):
16 has depth = depth[9]+1 = 8, root = 21, parent = 9, children = [5], weight = 0
seq[i] has depth[seq[i]] = depth[seq[i+1]], root[seq[i]]=r, weight = 0, children[seq[i]] = [ seq[i-1] ] (if i>0) else []
5 has depth = depth[16]+1 = 9, root = 21, parent = 16, children = [], weight = 0
in the end we also do 
    if tree[r].deepestNode > depth[s], tree[r].deepestNode = 5.

let's say we then consider the sample 40. but root[40] already exists, so we just do nothing! 

then we consider the number 59. it gives us the sequence 59→178→90→46, and 46 already was earlier. 
in the end our nodeList will be like that:
[21, 40, 13, 24, 46, 15, 9, 28, 90, 178, 59]

if the value gets bigger than, say 1e18, webreak and ditch this sample. probably just add the sample value to the special list  graph.divergentNodes.


# weight
after we done that, we then compute weights in linear time, by using the nodeList smartly. 
we just run over nodeList backwards (i=i-1) and apply the following algorithm of computing weights:
take a number N = nodeList[i]. 
    if it has children == [], then we put weight[N] = 1. 
    if children is not empty we run weight[N] = sweight[N] of weight[c] for c in children[N].
    
run until i==0. voi la, the weights are computed in linear time. 
# height
similarly we do about height (the maximum node on the way to the root)
this time we run through nodelist forward (i=i+1) and look at parents
take a number N = nodeList[i]. 
    if it is the root, then it equals its own height
    otherwis etake parent P and height[N] = max(N, height[P])


Ok now the trees are constructed, and the weightsa adn heights and depths are known and we can just use it in the rendering procedure without the need of computing them. 
for the weights - maxWeight = weight[root] and minWeight = 1. maxDepth = depth[deepestNode].
the purple box is at parent[root] and so on. cool? cool

then write a debug printout function. consider "alternative collatz" and a sample of numbers [9, 5, 40, 59] and run the tree construction. print out the nodeList and for each node print out the depth, weight, parent and children.

Now about drawing the tree:

by going along nodeList in a normal direction we can compute each node position a plane and other things.
for each node in the nodeList we compute its position and direction (except the node is the root, then the position is 0,0 and the direction is 0). 
length of the branch ~ 1/sqrt(depth)
width and transparency alpha of the branch ~1log(weight+1)  
color (hue) of the branch depends on the log(value+1).
the for the node n the angle[n] = angle[parent[n]] + angleList[n%M], where M is the number of rules (2 in classic collatz and 3 in triple collatz) and angleList is given by the user in the appropriate fields (by default it is 10 degrees and -19 degrees)

the min and max X and Y coords are kept to automatically adjust the canvas to fit the entire tree

several special nodes are to be captioned with a black monospace number under the node in a colored transparent box
1. **Root Node** (Green Box `#2ecc71`)
   - Always rendered with root value
   - Background: `rgba(46, 204, 113, 0.4)`

2. **Maximum Node** (Red Box `#d15858`) 
   - `highestNode` - highest value across all nodes
   - Background: `rgba(209, 88, 88, 0.4)`

3. **Lowest Node** (Yellow Box `#f1c40f`)
   - `lowestNode` - minimum value in tree (omit if coinsides with the root)
   - Background: `rgba(241, 196, 15, 0.4)`

4. **Furthest Node** (Blue Box `#4facfa`)
   - `deepestNode` - node with maximum depth from root
   - Background: `rgba(79, 172, 250, 0.4)`

5. **Root Target/Purple Box** (`#9b59b6`)
   - `parent[root]` - node that root points to in the cycle (e.g., "1->4" gives target = 4)
   - Background: `rgba(155, 89, 182, 0.4)`
6. **Start value, orange** (`#ff8c00`)
   - background: rgba(255, 165, 0, 0.6); 
   -  highlights the start value sample
7. **Highest Leaf** (Red Box): Highlights the leaf node with the absolute maximum HEIGHT (the maximum value on the way from that leaf to the root).
8. **Highest Node of the Deepest Leaf** (Blue Box): Highlights the node with the maximum value along the path from the deepest leaf to the root.
9. **Height of the Start Value** (Orange Box): Highlights the node with the maximum value along the path from the current start value to the root.




if two boxes conside in value, the more important box wins. for example if the deepest and the highest node are the same the deepest wins and the blue box is rendered. the hierarchy is the following from most important to theleast: root, cycle target, deepest node, highest node, lowest node,and the start value (orange box) is the least important       


# **The controls**
 control panel is in two logical parts: 
1. the geraph parameters : rulebook, the sample size and range (I think the render tree button must be called build trees, because this is what it does)
2. render parameters : angle sliders, start value, root picker. 


The first field is the number M (number of the rules, the module, it is going to be ne of the main parameters from now on), and then there are M fields where we input the rules for each remainder (eg `n/2` and `n*3 + 1`). when M is increased, the new rule line pops up (and the new angle slider pops up in the render control panel). 
When all the rules are put into, the Rule object is created. it will be passed to the build tree and so on, instead of a string parameter with pre-defined functions.


there must be three fields where user inputs the parameters (min value (say 20000), range value (say 10000), number of samples from [min, min+range] (say 5000). 
if sample size is less than the range, a random set of samples in the range is taken. if the sample size is larger than the range, our sample set is just the whole range of values from min to min+range. 

the field "start value". what the tree selector dropdown menu does now is it puts the chosen tree root as the start value. but the user can also enter any other start value. Then the value is added to the sample, its root value is found the the correspoinding tree gets rendered. The start value is highlighted with an orange box. when the select tree option changes, the start value field is filled with the root value. 


There must also be three knobs for angles angles (10 and 19 degrees) and the initial angle (10 degrees by default) ) and then the image of the tree is rendered. 

the angle selectors are not dull input fields, but nice and tidy knobs. when they change, the tree gets re-rendered automatically.
there is also a separate button to fit the tree entirely into the canvas 

the controls are layed out as follows: on the very top there are two buttons - build trees and fit tree. 
next two blocks are sample parameters in the left column and at the same level the root selector parameters are in the right column. 
next there are two expandable (downwards, with the increase of M) blocks of rules in the left and angles on the right.  

Also the canvas itself is interactive: 
- **Tooltip:** Hovering over a node displays its Value, Weight, Depth and Height.
- **Click:** Clicking a node sets it as the new "Start Value", adds it to the sample set and re-renders the tree.




# Project Structure & Interaction

The project is split into:
- `tree.html`: The skeleton
- `style.css`: Styles
- `tree_math.js`: Algorithms and data structures
- `tree_ui.js`: Rendering and interaction logic

# New Features: Height and Advanced Captions

The system now computes the **Height** for each node, defined as the maximum value encountered on the path from that node to the root. 

- **Tooltip Update**: Tooltips now display the node's height alongside value, weight, and depth.
- **New Captions**:
