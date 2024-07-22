const MAX_CONCURRENT_REQUESTS = 1; // 동시에 처리될 수 있는 최대 요청 수.,,,
let activeRequests = 0; // 현재 처리 중인 요청 수``
// let soundQueue = []; // 재생할 오디오 파일을 저장하는 큐,
// let isPlaying = false; // 현재 오디오가 재생 중인지 여부,

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}

function setWalkingModeToLocalStorage(walking_mode) {
  localStorage.setItem("walking_mode", JSON.stringify(walking_mode));
}

async function sendCameraImage(imageData) {
  var location = document.getElementById("location").textContent;
  var regex = /Latitude\s([-\d.]+),\sLongitude\s([-\d.]+)/;
  var matches = location.match(regex);

  if (matches) {
    var latitude = parseFloat(matches[1]);
    var longitude = parseFloat(matches[2]);

    console.log("Latitude:", latitude);
    console.log("Longitude:", longitude);
  } else {
    console.error("Could not parse location string.");
  }

  var csrf_token = getCookie("csrftoken");
  try {
    const response = await fetch("/walking_mode/test/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrf_token,
      },
      body: JSON.stringify({
        image_data: imageData,
        latitude: latitude,
        longitude: longitude,
      }),
    });

    const result = await response.json();
    console.log(result);
    if (result.complaints != null) {
      const save_break_response = await fetch("/record/break/save_break/", {
        method: "POST",
        headers: {
          Content_Type: "application/json",
          "X-CSRFToken": csrf_token,
        },
        body: JSON.stringify({
          broken_address: result.complaints.address,
          broken_img: result.complaints.img,
        }),
      });
      const save_break_result = await save_break_response.json();

      if (save_break_result.status === "success") {
        const brokenInformElement = document.getElementById("broken_inform");

        // if (brokenInformElement) {
        //   brokenInformElement.play().catch((error) => {
        //     console.log('Audio play failed:', error);
        //   });
        // }

        if (brokenInformElement) {
          const audioSrc = brokenInformElement.src;
          addToQueue(audioSrc);
        }
      }

      console.log(save_break_result);
    }

    // 탐지된 객체 정보를 HTML에 표시
    var objectDetectionElement = document.getElementById("object_detection");
    if (objectDetectionElement) {
      objectDetectionElement.textContent = `Detection: ${result.od_classes.join(", ")} (Segmentation: ${result.seg_classes.join(", ")})`;
    }

    // 이미지 표시
    const imgElement = document.getElementById("annotated-image");
    if (imgElement) {
      if (result.annotated_image) {
        imgElement.src = `data:image/jpeg;base64,${result.annotated_image}`;
        imgElement.style.display = "block";
      } else {
        imgElement.style.display = "none";
      }
    }

    // TTS 오디오를 큐에 추가하고 재생 관리
    if (Array.isArray(result.tts_audio_base64)) {
      result.tts_audio_base64.forEach((audioBase64) => {
        const audioData = `data:audio/mpeg;base64,${audioBase64}`;
        addToQueue(audioData);
        // soundQueue.push(audioData);
      });
      // playNextInQueue();
    } else {
      const audioData = `data:audio/mpeg;base64,${result.tts_audio_base64}`;
      // soundQueue.push(audioData);
      // playNextInQueue();
      addToQueue(audioData);
    }
  } catch (error) {
    console.error("Error sending camera image:", error);
  } finally {
    activeRequests--; // 요청이 완료되면 activeRequests를 감소
  }
}

function playNextInQueue() {
  if (isPlaying || soundQueue.length === 0) return;

  const audioData = soundQueue.shift();
  const sound = new Howl({
    src: [audioData],
    format: ["mp3"],
    autoplay: true,
    onend: function () {
      isPlaying = false;
      playNextInQueue();
    },
  });

  isPlaying = true;
  sound.play();
}

function captureImage(video, canvas) {
  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

document.addEventListener("DOMContentLoaded", function () {
  let recording = false;
  const frameRate = 1; // frames per second
  let video = document.getElementById("video");
  let canvas = document.getElementById("canvas");

  let mediaRecorder;
  let recordedChunks = [];
  const streamFrameRate = 30;
  const maxChunks = 2; // Assuming a frameRate of 1 chunk per second for 1 minute
  let lastSaveTime = 0;
  const saveInterval = 1000 * 60; // milliseconds
  var csrftoken = getCookie("csrftoken");

  const cameraSelect = document.getElementById("cameraSelect");
  let deviceId = localStorage.getItem("cameraId");
  if (!deviceId) {
    deviceId = cameraSelect.value;
  }
  // 카메라 장치를 나열하고 선택 목록을 업데이트
  navigator.mediaDevices.enumerateDevices().then((devices) => {
    devices.forEach((device) => {
      if (device.kind === "videoinput") {
        const option = document.createElement("option");
        option.value = device.deviceId;
        option.text = device.label || `Camera ${cameraSelect.length + 1}`;
        cameraSelect.appendChild(option);

        // 로컬 스토리지에서 불러온 deviceId와 일치하면 해당 옵션을 선택
        if (device.deviceId === deviceId) {
          option.selected = true;
        }
      }
    });
  });

  var walking_mode = localStorage.getItem("walking_mode");
  if (walking_mode === "true") {
    startRecording(deviceId);
    console.log("보행모드를 시작합니다.", walking_mode);
  } else {
    console.log("보행모드가 중지상태입니다.");
  }
  cameraSelect.addEventListener("change", () => {
    if (walking_mode === "true") {
      stopRecording();
      deviceId = cameraSelect.value;
      localStorage.setItem("cameraId", deviceId);
      startRecording(deviceId);
    } else {
      deviceId = cameraSelect.value;
      localStorage.setItem("cameraId", deviceId);
    }
  });

  async function maybeSendCameraImage() {
    if (recording && activeRequests < MAX_CONCURRENT_REQUESTS) {
      //console.log(activeRequests);
      activeRequests++; // 새로운 요청을 시작하기 전에 activeRequests를 증가
      const imageData = captureImage(video, canvas);
      sendCameraImage(imageData);
    }
  }

  function startRecording(deviceId) {
    recording = true;
    recordedChunks = [];
    var recordingStatusElement = document.getElementById("recording-status");
    if (recordingStatusElement) {
      recordingStatusElement.textContent = "Recording...";
    }

    if (walking_mode !== "true") {
      const onWalkingElement = document.getElementById("on_walking");

      // if (onWalkingElement) {
      //   onWalkingElement.play().catch((error) => {
      //     console.log('Audio play failed:', error);
      //   });
      // }
      if (onWalkingElement) {
        const audioSrc = onWalkingElement.src;
        addToQueue(audioSrc);
      }
    }

    setWalkingModeToLocalStorage(recording);
    navigator.mediaDevices
      .getUserMedia({
        width: { ideal: 640 },
        video: { facingMode: "environment", deviceId: deviceId },
        frameRate: { ideal: streamFrameRate, max: streamFrameRate },
      })
      .then(function (stream) {
        video.srcObject = stream;
        video.play();

        const imgElement = document.getElementById("annotated-image");
        video.addEventListener("loadedmetadata", () => {
          const videoWidth = video.videoWidth;
          const videoHeight = video.videoHeight;
          resizeCanvas(videoWidth, videoHeight);
        });
        // 창 크기가 변경될 때마다 캔버스 크기를 조정
        window.addEventListener("resize", () => {
          if (video.videoWidth && video.videoHeight) {
            resizeCanvas(video.videoWidth, video.videoHeight);
          }
        });
        function resizeCanvas(videoWidth, videoHeight) {
          const aspectRatio = videoWidth / videoHeight;

          imgElement.width = window.innerWidth * 0.75;
          imgElement.height = imgElement.width / aspectRatio;
        }

        // Set up MediaRecorder
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = function (event) {
          return new Promise((resolve, reject) => {
            if (event.data.size > 0) {
              recordedChunks.push(event.data);
              // Remove older chunks if exceeding the maxChunks limit
              if (recordedChunks.length > maxChunks) {
                recordedChunks.splice(0, recordedChunks.length - maxChunks);
              }
            }
            resolve();
          })
            .then(() => {
              // Start recording again
              if (recording) {
                mediaRecorder.start();
                console.log("Recording constraint and Recording restarted");
              }
            })
            .catch((error) => {
              console.error("Error during ondataavailable processing:", error);
            });
        };
        mediaRecorder.start();
      })
      .catch(function (error) {
        console.error("Error accessing camera:", error);
      });

    setInterval(maybeSendCameraImage, 1000 / frameRate);
    setInterval(constraintRecordedChunks, (1000 / frameRate) * 30);
    setInterval(observePredictionChange, 1000 / streamFrameRate);

    // setInterval(handlePrediction, 1000 * 6);
  }

  function stopRecording() {
    recording = false;
    document.getElementById("recording-status").textContent = "Recording stopped.";
    setWalkingModeToLocalStorage(recording);
    video.pause();
    video.srcObject.getTracks().forEach((track) => track.stop());
    mediaRecorder.stop();
    const offWalkingElement = document.getElementById("off_walking");

    // if (offWalkingElement) {
    //   offWalkingElement.play().catch((error) => {
    //     console.log('Audio play failed:', error);
    //   });
    // }
    if (offWalkingElement) {
      const audioSrc = offWalkingElement.src;
      addToQueue(audioSrc);
    }
  }

  function handlePrediction() {
    const fallRecognitionElement = document.getElementById("fall_recognition");
    if (fallRecognitionElement) {
      fallRecognitionElement.textContent = `Prediction: 1`;
    }
  }

  function observePredictionChange() {
    const targetNode = document.getElementById("fall_recognition");
    const config = {
      characterData: true,
      childList: true,
      subtree: true,
    };

    const callback = function (mutationsList) {
      for (let mutation of mutationsList) {
        if (mutation.type === "childList" || mutation.type === "characterData") {
          const currentText = targetNode.textContent.trim();

          if (currentText === "Prediction: 1") {
            const currentTime = Date.now();
            if (currentTime - lastSaveTime >= saveInterval) {
              lastSaveTime = currentTime;
              new Promise((resolve, reject) => {
                try {
                  constraintRecordedChunks();
                  setTimeout(() => {
                    resolve();
                  }, 50);
                } catch (error) {
                  reject(error);
                }
              })
                .then(() => {
                  return saveRecordedChunks();
                })
                .catch((error) => {
                  console.error("Error during constraint or save:", error);
                });
            }
          }
        }
      }
    };

    const observer = new MutationObserver(callback);
    observer.observe(targetNode, config);
  }

  function constraintRecordedChunks() {
    if (mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
  }

  async function saveRecordedChunks() {
    if (!recording) {
      return;
    }
    var location = document.getElementById("location").textContent;
    var regex = /Latitude\s([-\d.]+),\sLongitude\s([-\d.]+)/;
    var matches = location.match(regex);

    if (matches) {
      var latitude = parseFloat(matches[1]);
      var longitude = parseFloat(matches[2]);
    }
    if (recordedChunks.length > 0) {
      const recordedBlob = new Blob(recordedChunks, {
        type: "video/mp4",
      });
      const videoFile = new File([recordedBlob], "video.mp4", {
        type: "video/mp4",
      });

      // Prepare form data
      const formData = new FormData();
      formData.append("latitude", latitude); // Replace with actual location data
      formData.append("longitude", longitude); // Replace with actual location data
      formData.append("video_file", videoFile);

      for (let [key, value] of formData.entries()) {
        console.log(key, value);
      }

      try {
        const response = await fetch("../record/accident/save_accident/", {
          method: "POST",
          body: formData,
          headers: {
            "X-CSRFToken": csrftoken,
          },
        });

        const data = await response.json();

        if (data.status === "success") {
          console.log("Recorded chunk saved successfully");
          const fallingInformElement = document.getElementById("falling_inform");
          const fallenRedScreen = document.querySelector(".fallenRedScreen");

          function catchFallen() {
            // .fallenRedScreen 요소를 보이게 하고 fade 클래스를 추가하여 나타나게 함
            fallenRedScreen.style.display = "block";
            fallenRedScreen.classList.add("fade");
            // 2초 후에 fade 클래스를 제거하여 사라지게 함
            setTimeout(() => {
              fallenRedScreen.classList.remove("fade");
              fallenRedScreen.style.display = "none";
            }, 1500); // 애니메이션 시간과 동일하게 설정
          }
          catchFallen();

          // if (fallingInformElement) {
          //   fallingInformElement.play().catch((error) => {
          //     console.log('Audio play failed:', error);
          //   });
          // }
          if (fallingInformElement) {
            const audioSrc = fallingInformElement.src;
            addToQueue(audioSrc);
          }
        } else {
          console.error("Error saving recorded chunk");
        }
      } catch (error) {
        console.error("Error:", error);
      }
    }
  }

  var startCameraButton = document.getElementById("start-camera");
  if (startCameraButton) {
    startCameraButton.addEventListener("click", () => startRecording(deviceId));
  }

  var stopCameraButton = document.getElementById("stop-camera");
  if (stopCameraButton) {
    stopCameraButton.addEventListener("click", stopRecording);
  }
});
