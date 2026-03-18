(function () {
  function dataUrlFromBlob(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function createManager(options) {
    const videoEl = document.getElementById(options.videoElId);
    const canvasEl = document.getElementById(options.canvasElId);

    let stream = null;
    let recorder = null;
    let chunks = [];

    async function start() {
      if (stream) {
        return stream;
      }

      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });

      videoEl.srcObject = stream;
      return stream;
    }

    function stop() {
      if (!stream) return;
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
      videoEl.srcObject = null;
    }

    function capturePhoto() {
      if (!stream) {
        throw new Error("Camera is not active.");
      }

      const width = videoEl.videoWidth || 1280;
      const height = videoEl.videoHeight || 720;

      canvasEl.width = width;
      canvasEl.height = height;

      const ctx = canvasEl.getContext("2d");
      ctx.drawImage(videoEl, 0, 0, width, height);

      return {
        dataUrl: canvasEl.toDataURL("image/jpeg", 0.9),
        capturedAt: new Date().toISOString(),
      };
    }

    function startRecording() {
      if (!stream) {
        throw new Error("Camera is not active.");
      }

      if (typeof MediaRecorder === "undefined") {
        throw new Error("Video recording is not supported in this browser.");
      }

      if (recorder && recorder.state === "recording") {
        throw new Error("Recording already in progress.");
      }

      chunks = [];
      recorder = new MediaRecorder(stream, { mimeType: "video/webm" });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.start();
    }

    async function stopRecording() {
      if (!recorder || recorder.state !== "recording") {
        return null;
      }

      const stoppedBlob = await new Promise((resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: "video/webm" });
          resolve(blob);
        };
        recorder.stop();
      });

      const dataUrl = await dataUrlFromBlob(stoppedBlob);
      return {
        dataUrl,
        bytes: stoppedBlob.size,
      };
    }

    return {
      start,
      stop,
      capturePhoto,
      startRecording,
      stopRecording,
    };
  }

  window.GreenEarnCamera = {
    createManager,
  };
})();
