let pr = 0;
let yr = 0;
let rollRate = 0;
let rollArray = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
let pitchArray = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
let yawArray = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

let speedDivisor = geofs.animation.values.kias / 500;


geofs.animation.values.cRoll = 0;
geofs.animation.values.cPitch = 0;
geofs.animation.values.cYaw = 0;

class Controller {
    constructor(k_p, k_i, k_d, dt) {
        let i_max;
        if (typeof k_p === 'object') {
            let options = k_p;
            k_p = options.k_p;
            k_i = options.k_i;
            k_d = options.k_d;
            dt = options.dt;
            i_max = options.i_max;
        }

        // PID constants
        this.k_p = (typeof k_p === 'number') ? k_p : 1;
        this.k_i = k_i || 0;
        this.k_d = k_d || 0;

        // Interval of time between two updates
        // If not set, it will be automatically calculated
        this.dt = dt || 0;

        // Maximum absolute value of sumError
        this.i_max = i_max || 0;

        this.sumError = 0;
        this.lastError = 0;
        this.lastTime = 0;

        this.target = 0; // default value, can be modified with .setTarget
    }

    setTarget(target) {
        this.target = target;
    }

    update(currentValue) {
        if (!currentValue) throw new Error("Invalid argument");
        this.currentValue = currentValue;

        // Calculate dt
        let dt = this.dt;
        if (!dt) {
            let currentTime = Date.now();
            if (this.lastTime === 0) { // First time update() is called
                dt = 0;
            } else {
                dt = (currentTime - this.lastTime) / 1000; // in seconds
            }
            this.lastTime = currentTime;
        }
        if (typeof dt !== 'number' || dt === 0) {
            dt = 1;
        }

        let error = (this.target - this.currentValue);
        this.sumError = this.sumError + error * dt;
        if (this.i_max > 0 && Math.abs(this.sumError) > this.i_max) {
            let sumSign = (this.sumError > 0) ? 1 : -1;
            this.sumError = sumSign * this.i_max;
        }

        let dError = (error - this.lastError) / dt;
        this.lastError = error;

        return (this.k_p * error) + (this.k_i * this.sumError) + (this.k_d * dError);
    }

    reset() {
        this.sumError = 0;
        this.lastError = 0;
        this.lastTime = 0;
    }
}




function getRR() { //deg per second
    var lastRoll = geofs.animation.values.aroll
    setTimeout(function() {
        rollRate = 2 * (geofs.animation.values.aroll - lastRoll);
    }, 10)
}

function getPr() { //pitch rate in degrees per second
    var lastP = geofs.animation.values.atilt;
    setTimeout(function() {
        pr = (geofs.animation.values.atilt - lastP) * -1;
        //console.log(pr) for debug
    }, 10)
}

function getYr() { //pitch rate in degrees per second
    var lastY = geofs.animation.values.accX;
    setTimeout(function() {
        yr = (geofs.animation.values.accX - lastY) * -1;
        //console.log(pr) for debug
    }, 10)
}

function movingAvg(array, countBefore, countAfter) {
    if (countAfter == undefined) countAfter = 0;
    const result = [];
    for (let i = 0; i < array.length; i++) {
        const subArr = array.slice(Math.max(i - countBefore, 0), Math.min(i + countAfter + 1, array.length));
        const avg = subArr.reduce((a, b) => a + (isNaN(b) ? 0 : b), 0) / subArr.length;
        result.push(avg);
    }
    return result;
}


//DONT TOUCH THESE UNLESS YOU ABSOLUTELY KNOW WHAT YOU'RE DOING
let ctr = new Controller({
    k_p: 0.1,
    k_i: 0,
    k_d: 0
});

let ctrPitch = new Controller({
    k_p: 0.25,
    k_i: 0,
    k_d: 0.001
});

let ctrYaw = new Controller({
    k_p: 0.1,
    k_i: 0.001,
    k_d: 0
});


// ok you can touch the rest of the stuff
function computeRoll() {
    getRR();
    var target = -geofs.animation.values.roll * 50
    ctr.setTarget(target);
    var correction = ctr.update(rollRate) / clamp(speedDivisor, 1, 1000);
    rollArray.push(clamp(-correction, -1, 1))
    var computedArray = movingAvg(rollArray, 3, 3)
    geofs.animation.values.cRoll = computedArray[computedArray.length - 1]
}

function computePitch() {
    getPr();
    ctrPitch.setTarget((geofs.animation.values.pitch * 15) / clamp(geofs.animation.values.kias / 1000, 1, 1000));
    var correction = ctrPitch.update(0.25 * (geofs.animation.values.acceleration[2] + 9.8) / clamp(geofs.animation.values.kias / 10, 1, 1000));
    pitchArray.push(clamp((1 * correction), -1, 1))
    var computedArray = movingAvg(pitchArray, 2, 2)
    geofs.animation.values.cPitch = computedArray[computedArray.length - 1];
}

function computeYaw() {
    getYr();
    ctrYaw.setTarget(geofs.animation.values.yaw * 15);
    var correction = ctrYaw.update(1 * (yr));
    yawArray.push(clamp((1 * correction), -1, 1))
    var computedArray = movingAvg(yawArray, 10, 10)
    geofs.animation.values.cYaw = computedArray[computedArray.length - 1];
}


function assignControls() {
    if (controls.autopilot.on) {
        geofs.aircraft.instance.parts.elevatorleft.animations[1].value = "roll";
        geofs.aircraft.instance.parts.elevatorright.animations[1].value = "roll";
        geofs.aircraft.instance.parts.leftAileron.animations[0].value = "roll";
        geofs.aircraft.instance.parts.rightAileron.animations[0].value = "roll"
        geofs.aircraft.instance.engines[0].animations[1].value = "roll";
        geofs.aircraft.instance.engines[1].animations[1].value = "roll";
        geofs.aircraft.instance.parts.elevatorleft.animations[0].value = "pitch";
        geofs.aircraft.instance.parts.elevatorright.animations[0].value = "pitch";

        geofs.aircraft.instance.parts.rudderleft.animations[0].value = "yaw";
        geofs.aircraft.instance.parts.rudderright.animations[0].value = "yaw";
    } else {
        geofs.aircraft.instance.parts.elevatorleft.animations[1].value = "cRoll";
        geofs.aircraft.instance.parts.elevatorright.animations[1].value = "cRoll";
        geofs.aircraft.instance.parts.leftAileron.animations[0].value = "cRoll";
        geofs.aircraft.instance.parts.rightAileron.animations[0].value = "cRoll"
        geofs.aircraft.instance.engines[0].animations[1].value = "cRoll";
        geofs.aircraft.instance.engines[1].animations[1].value = "cRoll";
        geofs.aircraft.instance.parts.elevatorleft.animations[0].value = "cPitch";
        geofs.aircraft.instance.parts.elevatorright.animations[0].value = "cPitch";

        geofs.aircraft.instance.parts.rudderleft.animations[0].value = "cYaw";
        geofs.aircraft.instance.parts.rudderright.animations[0].value = "cYaw";
    }
}

function start() {
    setTimeout(function() {
        calcInt = setInterval(function() {
            speedDivisor = geofs.animation.values.kias / 500;
            computeRoll();
            computePitch();
            computeYaw();
            assignControls();
        }, 10)
    }, 1000)
}
start()




//PID Debug Graph
/*
var script1 = document.createElement('script');
script1.type = 'text/javascript';
script1.src = 'https://www.gstatic.com/charts/loader.js';
document.head.appendChild(script1);

setTimeout(function(){
let newDiv = document.createElement("div")
newDiv.id = "chart_div"
document.body.appendChild(newDiv)
// load current chart package
google.charts.load("current", {
  packages: ["corechart", "line"]
});
// set callback function when api loaded
google.charts.setOnLoadCallback(drawChart);

function drawChart() {
  // create data object with default value
  let data = google.visualization.arrayToDataTable([
      ["Year", "CPU Usage"],
  [0, 0]
  ]);
  // create options object with titles, colors, etc.
  let options = {
    curveType: 'function',
    title: "Pitch Rate",
    height: 300,
    hAxis: {
      scaleType: 'none',
      title: "Time"
    },
    vAxis: {
      title: "Rate"
    }
  };
  // draw chart on load
  setTimeout(function(){
  let chart = new google.visualization.LineChart(
    document.getElementById("chart_div")
  );
  chart.draw(data, options);
    let index = 0;
setInterval(function() {
  // instead of this random, you can make an ajax call for the current cpu usage or what ever data you want to display
  let random = geofs.animation.values.cPitch //set to any value to graph it
  data.addRow([index, random]);
  chart.draw(data, options);
  index++;
      if (data.cache.length>40){
    data.removeRow(0); 
      }
}, 20);
    }, 2000)
  }
},1000)
*/
