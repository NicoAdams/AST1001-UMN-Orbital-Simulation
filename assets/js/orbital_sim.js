// -- Global variables used in the orbit simulation --

// State variables
let stateIsOrbiting = true
let stateIsSweeping = false

// Global settings
let G = 1;
let dt = 1e-2;

// Display properties
let zoom = 1;
let defaultAUDist = 150;
let sunSize = 40;
let planetSize = 20;

// Orbit properties
let orbit;
let vInputMag;
let vInputAngle;

// Converts from input velocity units to physical velocity units
function inputVelocityToPhys() {
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
  orbitGen.xPlanet = createVector(0,-1);
  orbitGen.vPlanet = inputVelocityToPhys(vInputMag, vInputAngle);
  orbitGen.isFirstOrbit = true;
  orbitGen.firstOrbitPath = [orbitGen.xPlanet];
  orbitGen.angularChangeThisOrbit = 0;
  orbitGen.currSnapIndex = 0;
  // orbitGen.angleRemainderPerOrbit = 0;
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

function updatePlanet_SnapToPath() {
  // TODO
}

// -- Functions for creating and managing the canvas --

function windowResized() {
  resizeCanvas(window.innerWidth, window.innerHeight);
}

// Utilities for converting between display and simulation coorindates
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

function drawPlanetPath() {
  // Draw a line around the orbital path
  // Mark each week with a small yellow circle
  // Mark every 5 weeks with a large red circle

  // Draws the line
  for (let i=0; i<orbit.firstOrbitPath.length-1; i++) {
    stroke(255, 255, 0);
    p1 = physToDisplay(orbit.firstOrbitPath[i]);
    p2 = physToDisplay(orbit.firstOrbitPath[i+1]);
    line(p1.x, p1.y, p2.x, p2.y);
  }
}

// -- Initialization & update functions --

function setup() {
  createCanvas(window.innerWidth, window.innerHeight);

  vInputMag = 25;
  vInputAngle = 30;
  orbit = createNewOrbit();
}

function draw() {
  background(0);

  drawSun();

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
      orbit.isFirstOrbit = (orbit.angularChangeThisOrbit <= Math.PI*2);

      drawPlanetPath();
      drawPlanet();
    
    } else {
      // Snaps to the grid of points from the first orbit
      
      orbit.xPlanet = orbit.firstOrbitPath[orbit.currSnapIndex];
      orbit.currSnapIndex++;
      if (orbit.currSnapIndex == orbit.firstOrbitPath.length) {
        orbit.currSnapIndex = 0;
      }

      drawPlanetPath();
      drawPlanet();
    }

    // updatePlanet_Iterative(6, G, dt);
    
    if (stateIsSweeping) {
      //TODO
    }
  }

  if (!stateIsOrbiting) {
    // TODO
  }
}

// -- Interactive elements --

function startNewOrbit() {
  // Retrieve values from input elements when the button is pressed
  vInputMag = document.getElementById("vInputMag").value;
  vInputAngle = document.getElementById("vInputAngle").value;

  // Call a function to start a new orbit with the updated values
  orbit = createNewOrbit();
}