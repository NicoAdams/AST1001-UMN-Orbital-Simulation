// TODO ITEMS
// Add a reference circle (easy)
// Add an arrow that shows the launch direction & speed
// Add interactivity to the launch arrow
// Add an interactive onscreen ruler which measures 3 AU

// BUGS
// Kepler's second law doesn't currently arise from this simulation!
//     (The area/time ratio of various sweeps come out differently
//     1. In a circular orbit, short sweeps have larger ratios than long ones 
//     2. In an elliptical orbit, sweeps closer to the sun have smaller ratios than those far away

// -- Global variables used in the orbit simulation --

// Interactive elements
let orbitButton;
let sweepButton;
let clearSweepsButton;
let referenceCircleButton;
let vInputMag;
let vInputAngle;

// State variables
let stateIsOrbiting = false;
let stateIsSweeping = false;

// Optional display elements
let displayReferenceCircle = false;
let displayRuler = false;

/* Locking the program allows interactive elements to completely finish
running before any new interactions take place. */
let programLocked = false; 

// Orbit properties
let orbit;

// Sweep properties
let sweeps;
let sweepColors;

// Global settings
let G = 1;
let dt = 1.1e-2;
let sweepMax = 6;

// Display properties
let zoom = 1.2;
let defaultAUDist = 150;
let sunSize = 40;
let planetSize = 20;
let velocityArrowLenPerPhys = 0.5;
let velocityArrowStrokeWidth = 9;
let velocityArrowTriangleSize = 35;

// Converts from input velocity units to physical velocity units
function inputVelocityToPhys() {
  updateVelocityInputValues();
  let vMagPhys = vInputMag / 30;
  let vAngleRad = vInputAngle * Math.PI/180;
  return createVector(
    vMagPhys * Math.cos(vAngleRad),
    -1 * vMagPhys * Math.sin(vAngleRad)
  );
}

// Creates a new orbit object
function createNewOrbit() {
  let orbitGen = {};
  
  // Physics simulation values
  orbitGen.xPlanet = createVector(0,-1);
  orbitGen.vPlanet = inputVelocityToPhys();
  
  // Values for snapping the planet to its first orbit's path
  orbitGen.isFirstOrbit = true;
  orbitGen.angularChangeThisOrbit = 0;
  orbitGen.firstOrbitPath = [orbitGen.xPlanet];
  orbitGen.currSnapIndex = 0;
  orbitGen.currSnapSubindex = 0;
  orbitGen.indexCarryOver = 0;

  return orbitGen;
}

// -- Planet update functions --

function updatePlanet_Iterative(iterCount, G, dt) {
  // Iteratively refines an initial guess at the next position and velocity

  let vCurr = orbit.vPlanet.copy();
  let xCurr = orbit.xPlanet.copy();  
  let xAvg = xCurr.copy()

  for(let i=0; i<iterCount; i++) {
    // Using the current mean position xAvg, computes the mean acceleration a
    let a = xAvg.copy().normalize().mult(-G / xAvg.magSq());

    // Using the current value of a, updates vNext and xNext
    vNext = vCurr.copy().add(a.copy().mult(dt));
    vAvg = vCurr.copy().add(vNext).div(2);
    xNext = xCurr.copy().add(vAvg.copy().mult(dt));
    xAvg = xCurr.copy().add(xNext).div(2);
  }

  // Updates the position and velocity
  orbit.vPlanet = vNext;
  orbit.xPlanet = xNext;
}

function updatePlanet_Iterative_Subdivided(iterCount, subdivCount, G, dt) {
  // Divides a planet's arc into segments for greater accuracy
  for (let i=0; i<subdivCount; i++) {
    updatePlanet_Iterative(iterCount, G, dt/subdivCount);
  }
}

function interpolatePosition(path, index, subindex) {
  p1 = path[index]
  p2 = path[(index+1)%path.length]
  return p1.copy().mult(subindex).add(p2.copy().mult(1-subindex))
}

// -- Functions for creating and managing the canvas --

function windowResized() {
  resizeCanvas(window.innerWidth, window.innerHeight);
}

// -- Utilities for converting between display and simulation coorindates --

function getDisplayCenter() {return createVector(width/2, height/2)}
function getDisplayPerPhys() {return defaultAUDist * zoom}

function physToDisplay(xyPhys) {
  let centerDisplay = getDisplayCenter()
  let displayPerPhys = getDisplayPerPhys()
  return xyPhys.copy().mult(displayPerPhys).add(centerDisplay)
}

function displayToPhys(xyDisplay) {
  let centerDisplay = getDisplayCenter()
  let displayPerPhys = getDisplayPerPhys()
  return xyPhys.copy().sub(centerDisplay).div(displayPerPhys)
}

// -- Utilities for computing sweep data --

function getTimeStepsPerDay() {
  let dtPer365Days = 2*Math.PI;
  let timeStepsPer365Days = dtPer365Days / dt;
  return timeStepsPer365Days / 365;
}

function getSweepTimeInDays(sweepPath) {
  return (sweepPath.length - 1) / getTimeStepsPerDay();
}

function getTriangleArea(points) {
  let sides = [
    points[0].dist(points[1]),
    points[1].dist(points[2]),
    points[2].dist(points[0]),
  ];
  let s = (sides[0] + sides[1] + sides[2]) / 2;
  return Math. sqrt(
    s * (s - sides[0]) * (s - sides[1]) * (s - sides[2])
  );
}

function getSweepAreaInAU2(sweepPath) {
  let total = 0;
  let center = createVector(0,0);
  for (let i=0; i<sweepPath.length-1; i++) {
    let p1 = sweepPath[i];
    let p2 = sweepPath[i+1];
    total += getTriangleArea([center, p1, p2]);
  }
  return total;
}

// -- Draw functions --

function drawSun() {
  let sunPosDisplay = getDisplayCenter();
  fill(255, 255, 0);
  noStroke();
  ellipse(sunPosDisplay.x, sunPosDisplay.y, sunSize*zoom, sunSize*zoom);
}

function drawPlanet() {
  planetPosDisplay = physToDisplay(orbit.xPlanet);
  fill(0, 0, 255);
  noStroke();
  ellipse(planetPosDisplay.x, planetPosDisplay.y, planetSize*zoom, planetSize*zoom);
}

function drawArrow(startDisplay, endDisplay, strokeWidth, triangleSize, color) {
  fill(color);
  stroke(color);
  strokeWeight(strokeWidth);

  // Draw the arrow body (line)
  line(startDisplay.x, startDisplay.y, endDisplay.x, endDisplay.y);

  let arrowVecDisplay = endDisplay.copy().sub(startDisplay);
  let arrowAngle = arrowVecDisplay.angleBetween(createVector(1,0));

  /* "push()" and "pop()" generate a new drawing state and restore the
  existing one, respectively. */
  push();
  fill(color);
  noStroke();
  translate(endDisplay.x, endDisplay.y);
  rotate(-Math.PI/2-arrowAngle);
  triangle(-triangleSize / 2, 0, triangleSize / 2, 0, 0, triangleSize);
  pop();
}

function drawLaunchArrow() {
  vPlanetInput = inputVelocityToPhys();
  startPhys = orbit.xPlanet;
  endPhys = orbit.xPlanet.copy().add(
    vPlanetInput.copy().mult(velocityArrowLenPerPhys)
  );
  drawArrow(
    physToDisplay(startPhys),
    physToDisplay(endPhys),
    velocityArrowStrokeWidth,
    velocityArrowTriangleSize,
    color(255, 255, 125, 125)
  );
}

function drawSweeps() {
  let sunPosDisplay = getDisplayCenter();
  for (sweepPathIdx in sweeps) {
    let sweepPath = sweeps[sweepPathIdx];
    let sweepColor = sweepColors[sweepPathIdx%sweepColors.length];
    
    fill(color(sweepColor[0], sweepColor[1], sweepColor[2], 150));
    
    beginShape();
    for (pPhys of sweepPath) {
      p = physToDisplay(pPhys);
      vertex(p.x, p.y);
    }
    vertex(sunPosDisplay.x, sunPosDisplay.y);
    endShape(CLOSE);

    fill(color(sweepColor[0], sweepColor[1], sweepColor[2], 255));

    // Sweep label
    let sweepMiddlePhys = sweepPath[int(sweepPath.length/2)];
    let sweepTextPhys = sweepMiddlePhys.copy().add(
      sweepMiddlePhys.copy().normalize().mult(0.17)
    );
    let sweepMiddleDisplay = physToDisplay(sweepTextPhys);
    let sweepLabelMessage = (int(sweepPathIdx)+1);
    textSize(30);
    textAlign(CENTER, CENTER);
    text(sweepLabelMessage, sweepMiddleDisplay.x, sweepMiddleDisplay.y);

    // Sweep data
    let sweepDataX = 15;
    let sweepDataY = 15 + 90*sweepPathIdx;
    let sweepDays = getSweepTimeInDays(sweepPath);
    let sweepArea = getSweepAreaInAU2(sweepPath);
    sweepAreaStr = Math.round(sweepArea*100)/100;

    let sweepDataMessage = ""
    sweepDataMessage += "SWEEP "+(int(sweepPathIdx)+1);
    sweepDataMessage += "\nTime (days): "+Math.round(sweepDays);
    sweepDataMessage += "\nArea (AU²): "+sweepAreaStr;
    textSize(21);
    textAlign(LEFT, TOP);
    text(sweepDataMessage, sweepDataX, sweepDataY);

  }
}

function drawPlanetPath() {
  
  stroke(255, 255, 0);
  strokeWeight(1);
  for (let i=0; i<orbit.firstOrbitPath.length-1; i++) {

    // Draws the line
    p1 = physToDisplay(orbit.firstOrbitPath[i]);
    p2 = physToDisplay(orbit.firstOrbitPath[i+1]);
    line(p1.x, p1.y, p2.x, p2.y);
  }

  const smallCircleDays = 7;
  const smallCircleSize = 6;
  const smallCircleColor = color(255, 255, 0, 255);
  let smallCircleDayTracker = 0;
  
  const bigCircleDays = smallCircleDays * 5;
  const bigCircleSize = 12;
  const bigCircleColor = color(255, 0, 0, 255);
  let bigCircleDayTracker = 0;

  noStroke();
  for (let i=0; i<orbit.firstOrbitPath.length; i++) {

    p = physToDisplay(orbit.firstOrbitPath[i]);

    // Checks whether a small circle should be drawn
    smallCircleDayTracker += 1 / getTimeStepsPerDay();
    if (smallCircleDayTracker >= smallCircleDays) {
      smallCircleDayTracker -= smallCircleDays;
      fill(smallCircleColor);
      circle(p.x, p.y, smallCircleSize);
    }

    // Checks whether a big circle should be drawn
    bigCircleDayTracker += 1 / getTimeStepsPerDay();
    if (bigCircleDayTracker >= bigCircleDays) {
      bigCircleDayTracker -= bigCircleDays;
      fill(bigCircleColor);
      circle(p.x, p.y, bigCircleSize);
    }
  }
}

function drawReferenceCircle() {
  let refCirclePointsPhys = [];
  let refCirclePointCount = 300;
  for (let i=0; i<refCirclePointCount; i++) {
    let angle = 2*Math.PI / refCirclePointCount * i;
    refCirclePointsPhys.push(createVector(Math.cos(angle), Math.sin(angle)));
  }
  refCirclePointsPhys.push(refCirclePointsPhys[0]);

  stroke(100, 255, 100);
  strokeWeight(1);
  for (let i=0; i<refCirclePointsPhys.length-1; i++) {
    p1 = physToDisplay(refCirclePointsPhys[i]);
    p2 = physToDisplay(refCirclePointsPhys[i+1]);

    line(p1.x, p1.y, p2.x, p2.y);
  }
}

// -- Initialization & update functions --

// TODO - where to put this one?
function updateVelocityInputValues() {
  vInputMag = document.getElementById("vInputMag").value;
  vInputAngle = document.getElementById("vInputAngle").value;
}

function setup() {
  createCanvas(window.innerWidth, window.innerHeight);

  orbitButton = document.getElementById("orbitButton");
  sweepButton = document.getElementById("sweepButton");
  clearSweepsButton = document.getElementById("clearSweepsButton");
  referenceCircleButton = document.getElementById("referenceCircleButton");

  vInputMag = 25;
  vInputAngle = 30;
  orbit = createNewOrbit();
  sweeps = [];

  sweepColors = [
    [50, 255, 255],
    [100, 100, 255],
    [255, 50, 255],
    [255, 50, 100],
    [255, 255, 50],
    [50, 255, 50]
  ]
}

function draw() {

  if (stateIsOrbiting) {

    // Updates the orbital path, and checks whether the first orbit is complete
    if (orbit.isFirstOrbit) {
      // Fully simulates the first orbit

      // Updates the position
      updatePlanet_Iterative_Subdivided(5, 25, G, dt);
      
      // Updates the history
      orbit.firstOrbitPath.push(orbit.xPlanet.copy());

      // Checks to see if the first orbit is complete
      let xPlanetPrev = orbit.firstOrbitPath[orbit.firstOrbitPath.length-2];
      orbit.angularChangeThisOrbit += Math.abs(xPlanetPrev.angleBetween(orbit.xPlanet));
      
      // If so, sets up the planet to snap to its first orbit
      if (orbit.angularChangeThisOrbit > Math.PI*2) {      
        orbit.isFirstOrbit = false;
        
        angleCarryOver = (orbit.angularChangeThisOrbit - Math.PI*2);
        firstStepAngle = Math.abs(
          orbit.firstOrbitPath[1].angleBetween(orbit.firstOrbitPath[0])
        );
        orbit.indexCarryOver = angleCarryOver / firstStepAngle;

        orbit.currSnapIndex = 0;
        orbit.currSnapSubindex = orbit.indexCarryOver;
      }

    } else {
      // Snaps to the grid of points from the first orbit
      orbit.currSnapIndex++;
      
      // Handles completed orbits
      if (orbit.currSnapIndex == orbit.firstOrbitPath.length) {
        orbit.currSnapIndex = 0;
        orbit.currSnapSubindex += orbit.indexCarryOver;
        if (orbit.currSnapSubindex >= 1) {
          orbit.currSnapIndex += 1;
          orbit.currSnapSubindex -= 1;
        }
      }

      orbit.xPlanet = interpolatePosition(
        orbit.firstOrbitPath, orbit.currSnapIndex, orbit.currSnapSubindex
      );

    }
    
    if (stateIsSweeping) {
      sweeps[sweeps.length-1].push(orbit.xPlanet);
    }
  }

  background(0);
  drawSun();
  drawPlanetPath();
  drawPlanet();
  drawSweeps();

  if (!stateIsOrbiting) {
    drawLaunchArrow();
  }
  if (displayReferenceCircle) {
    drawReferenceCircle();
  }
}

// -- Interactive elements --

function button_toggleOrbit() {
  if (programLocked) {return null;}
  programLocked = true;

  if (stateIsOrbiting) {
    if (stateIsSweeping) {
      action_endSweep();
    }
    action_clearAllSweeps();
    action_endOrbit();
  } else {
    action_startOrbit();
  }

  programLocked = false;
}

function button_toggleSweep() {
  if (programLocked) {return null;}
  programLocked = true;

  if (stateIsSweeping) {
    action_endSweep();
  } else {
    action_startSweep();
  }

  programLocked = false;
}

function button_clearAllSweeps() {
  if (programLocked) {return null;}
  programLocked = true;
  
  action_clearAllSweeps();
  
  programLocked = false;

}

function button_toggleReferenceCircle() {
  if (programLocked) {return null;}
  programLocked = true;
  
  if (displayReferenceCircle) {
    action_hideReferenceCircle();
  } else {
    action_showReferenceCircle();
  }
  
  programLocked = false;
}


function action_startOrbit() {
  stateIsOrbiting = true;
  orbit = createNewOrbit();
  orbitButton.innerHTML = 'Stop Orbit';
  sweepButton.style.display = 'block';
}

function action_endOrbit() {
  stateIsOrbiting = false;
  orbit = createNewOrbit();
  orbitButton.innerHTML = 'Start New Orbit';
  sweepButton.style.display = 'none';
  clearSweepsButton.style.display = 'none';
}

function action_startSweep() {
  stateIsSweeping = true;
  sweeps.push([])
  sweepButton.innerHTML = 'End Sweep';
  clearSweepsButton.style.display = 'none';
}

function action_endSweep() {
  stateIsSweeping = false;
  if (sweeps.length == sweepMax) {
    sweepButton.innerHTML = 'Max. sweeps reached';
    sweepButton.disabled = true;
  } else {
    sweepButton.innerHTML = 'Begin Sweep';
  }
  clearSweepsButton.style.display = 'block';  
}

function action_signalBelowSweepMax() {
  sweepButton.innerHTML = 'Begin Sweep';  
}


function action_clearAllSweeps() {
  sweeps = [];
  sweepButton.disabled = false;
  sweepButton.innerHTML = 'Begin Sweep';  
}

function action_showReferenceCircle() {
  displayReferenceCircle = true;
  referenceCircleButton.innerHTML = 'Hide reference circle';
}

function action_hideReferenceCircle() {
  displayReferenceCircle = false;
  referenceCircleButton.innerHTML = 'Show reference circle';
}