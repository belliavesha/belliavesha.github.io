the problem is described in tree.md and the solution is in tree.html, styles.css, tree_ui.js, and tree_math.js. familiarize yourself with the architecture.

The current task is to modernize the control panel. 
Firts: the angle knobs - currently they are ugly sliders. lets make really nice neat knobs that rotate, with mouse drag up and down or with mose wheel. make very fine and sensitive (I mean the value changes slowly with the drag)  because these angles have to be precise. 
Second, rearrange the panel into two columns (rules + samples in one column and angles + root in another). 
on the very top there are two buttons - build trees and fit tree. 
next two blocks are sample parameters in the left column and at the same level the root selector parameters are in the right column. and next there are two expandable (downwards, with the increase of M) blocks of rules in the left and angles on the right.  the angle parameters must be paralel (on the same) to rule parameters. number of rules next to initial angle knob (at the same level), rule 0 next to 0 angle knob, rule 1 next to angle 1 knob, and so on. 
then  sample parameters must be at the same level as. 
So in the end we have a very nice and logical grid of controls
