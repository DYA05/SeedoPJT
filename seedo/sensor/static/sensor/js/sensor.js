let previousPrediction = 0;
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}
async function sendSensorData(sensorData) {
  var csrftoken = getCookie("csrftoken");
  try {
    const response = await fetch("/sensor/fall_recognition/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrftoken,
      },
      body: JSON.stringify({ sensor_data: sensorData }),
    });

    const result = await response.json();
    //console.log('Prediction:', result.prediction);
    var alertSoundElement = document.getElementById("alert-sound");

    // Play sound if prediction changes from 0 to 1
    if (previousPrediction[0] === 0 && result.prediction[0] === 1) {
      if (alertSoundElement) {
        alertSoundElement.play();
      }
      console.log("play");
    }

    // Stop sound or play a different sound if prediction changes from 1 to 0
    if (previousPrediction[0] === 0 && result.prediction[0] === 0) {
      if (alertSoundElement) {
        alertSoundElement.pause();
        alertSoundElement.currentTime = 0;
      }
      // document.getElementById('stop-sound').play(); // Uncomment if you have a stop sound
    }

    previousPrediction = result.prediction;

    document.getElementById("fall_recognition").textContent = `Prediction: ${result.prediction}`;
  } catch (error) {
    console.error("Error sending sensor data:", error);
  }
}

class CircularBuffer {
  constructor(size) {
    this.size = size;
    this.buffer = [];
  }

  push(item) {
    if (this.buffer.length >= this.size) {
      this.buffer.shift();
    }
    this.buffer.push(item);
  }

  getBuffer() {
    return this.buffer;
  }

  getLastItem() {
    return this.buffer.length > 0 ? this.buffer[this.buffer.length - 1] : null;
  }
}

document.addEventListener("DOMContentLoaded", function () {
  let sensoring = false;
  let sensorDataBuffer = new CircularBuffer(29);
  const frameRate = 30; // frames per second
  let frameticks = 0;

  var walking_mode = localStorage.getItem("walking_mode");
  if (walking_mode === "true") {
    startSensoring();
    console.log("낙상감지를 시작합니다.", walking_mode);
  } else {
    console.log("낙상김지가 중지상태입니다.");
  }

  function maybeSendSensorData() {
    if (sensorDataBuffer.getBuffer().length >= 29) {
      const sensorData = sensorDataBuffer.getBuffer();
      if (frameticks % 10 === 0) {
        sendSensorData(sensorData);
      }
    }
  }

  function createNewFrame() {
    return {
      timestamp: Date.now(),
      gps: { latitude: null, longitude: null },
      acc: { x: null, y: null, z: null },
      gyro: { alpha: null, beta: null, gamma: null },
    };
  }

  async function updateSensorData(event) {
    if (sensoring) {
      frameticks++;
      const frame = createNewFrame();
      try {
        await Promise.all([
          updateGPS(frame),
          Promise.resolve(frame), // Ensure GPS promise is part of all promises
        ]);

        // Update Accelerometer
        try {
          if (event.acceleration && event.acceleration !== undefined) {
            let accel = event.acceleration;
            frame.acc = {
              x: accel.x || 0,
              y: accel.y || 0,
              z: accel.z || 0,
            };
            document.getElementById("accelerometer").textContent = `Accelerometer: x=${accel.x}, y=${accel.y}, z=${accel.z}`;
          } else {
            const lastItem = sensorDataBuffer.getLastItem();
            frame.acc = lastItem ? lastItem.acc : { x: 0, y: 0, z: 0 };
            document.getElementById("accelerometer").textContent = `Accelerometer: x=${frame.acc.x}, y=${frame.acc.y}, z=${frame.acc.z}`;
          }
        } catch (error) {
          //console.error('Error updating accelerometer data:', error);
          const lastItem = sensorDataBuffer.getLastItem();
          frame.acc = lastItem ? lastItem.acc : { x: 0, y: 0, z: 0 };
          document.getElementById("accelerometer").textContent = `Accelerometer: x=${frame.acc.x}, y=${frame.acc.y}, z=${frame.acc.z}`;
        }

        // Update Gyroscope
        try {
          if (event.alpha !== null && event.alpha !== undefined) {
            frame.gyro = {
              alpha: event.alpha || 0,
              beta: event.beta || 0,
              gamma: event.gamma || 0,
            };
            document.getElementById("gyroscope").textContent = `Gyroscope: alpha=${event.alpha}, beta=${event.beta}, gamma=${event.gamma}`;
          } else {
            const lastItem = sensorDataBuffer.getLastItem();
            frame.gyro = lastItem ? lastItem.gyro : { alpha: 0, beta: 0, gamma: 0 };
            document.getElementById("gyroscope").textContent = `Gyroscope: alpha=${frame.gyro.alpha}, beta=${frame.gyro.beta}, gamma=${frame.gyro.gamma}`;
          }
        } catch (error) {
          //console.error('Error updating gyroscope data:', error);
          const lastItem = sensorDataBuffer.getLastItem();
          frame.gyro = lastItem ? lastItem.gyro : { alpha: 0, beta: 0, gamma: 0 };
          document.getElementById("gyroscope").textContent = `Gyroscope: alpha=${frame.gyro.alpha}, beta=${frame.gyro.beta}, gamma=${frame.gyro.gamma}`;
        }

        sensorDataBuffer.push(frame);
        maybeSendSensorData();
      } catch (error) {
        console.error("Error updating sensor data:", error);
      }
    }
  }

  function updateGPS(frame) {
    return new Promise((resolve) => {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          function (position) {
            frame.gps = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            document.getElementById("location").textContent = `Location: Latitude ${position.coords.latitude}, Longitude ${position.coords.longitude}`;
            resolve();
          },
          function (error) {
            console.error("Error accessing GPS:", error);
            frame.gps = { latitude: 0, longitude: 0 };
            document.getElementById("location").textContent = `Location: Latitude 0, Longitude 0`;
            resolve();
          },
        );
      } else {
        console.error("Geolocation not supported");
        frame.gps = { latitude: 0, longitude: 0 };
        resolve();
      }
    });
  }

  function startSensoring() {
    sensoring = true;
    var sensoringStatusElement = document.getElementById("sensoring-status");

    if (sensoringStatusElement) {
      sensoringStatusElement.textContent = "Sensoring...";
    }

    if (window.DeviceMotionEvent) {
      window.addEventListener("devicemotion", updateSensorData);
    } else {
      console.error("Accelerometer not supported");
    }

    if (window.DeviceOrientationEvent) {
      window.addEventListener("deviceorientation", updateSensorData);
    } else {
      console.error("Gyroscope not supported");
    }

    setInterval(updateSensorData, 1000 / frameRate);
  }

  function stopSensoring() {
    frameticks = 0;
    sensoring = false;
    document.getElementById("sensoring-status").textContent = "Sensoring stopped.";
    window.removeEventListener("devicemotion", updateSensorData);
    window.removeEventListener("deviceorientation", updateSensorData);
  }

  var startSensorButton = document.getElementById("start-sensor");
  if (startSensorButton) {
    startSensorButton.addEventListener("click", startSensoring);
  }

  var stopSensor = document.getElementById("stop-sensor");
  if (stopSensor) {
    stopSensor.addEventListener("click", stopSensoring);
  }
});
