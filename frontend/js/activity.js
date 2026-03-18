(function () {
  if (!window.GreenEarnUtils.requireAuth("./login.html")) {
    return;
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (event) => {
      event.preventDefault();
      window.GreenEarnUtils.logout();
    });
  }

  const activitySelect = document.getElementById("activityType");
  const startCameraBtn = document.getElementById("startCameraBtn");
  const captureBeforeBtn = document.getElementById("captureBeforeBtn");
  const captureAfterBtn = document.getElementById("captureAfterBtn");
  const submitBtn = document.getElementById("submitBtn");
  const submitMessage = document.getElementById("submitMessage");
  const beforePreview = document.getElementById("beforePreview");
  const afterPreview = document.getElementById("afterPreview");
  const beforeLocationText = document.getElementById("beforeLocationText");
  const afterLocationText = document.getElementById("afterLocationText");

  const camera = window.GreenEarnCamera.createManager({
    videoElId: "liveVideo",
    canvasElId: "captureCanvas",
  });

  const state = {
    captureSessionId: null,
    captureSessionExpiresAt: 0,
    beforeImageData: null,
    afterImageData: null,
    beforeCaptureTimestamp: null,
    afterCaptureTimestamp: null,
    beforeLocation: null,
    afterLocation: null,
  };

  async function loadActivities() {
    try {
      const data = await window.GreenEarnAPI.apiRequest("/activities/types");
      activitySelect.innerHTML = data.activities
        .map((item) => `<option value="${item.id}">${item.name}</option>`)
        .join("");
    } catch (_error) {
      activitySelect.innerHTML = [
        '<option value="garbage_cleaning">Garbage Cleaning</option>',
        '<option value="tree_plantation">Tree Plantation</option>',
        '<option value="river_cleaning">River Cleaning</option>',
        '<option value="pothole_fixing">Pothole Fixing</option>',
      ].join("");
    }
  }

  async function ensureCaptureSession(forceNew) {
    const now = Date.now();
    const valid = state.captureSessionId && now < state.captureSessionExpiresAt - 5000;
    if (!forceNew && valid) {
      return state.captureSessionId;
    }

    const session = await window.GreenEarnAPI.apiRequest("/activities/capture-session", {
      method: "POST",
      data: {},
    });

    state.captureSessionId = session.captureSessionId;
    state.captureSessionExpiresAt = Date.now() + session.expiresInMs;
    return state.captureSessionId;
  }

  function resetCaptureState() {
    state.beforeImageData = null;
    state.afterImageData = null;
    state.beforeCaptureTimestamp = null;
    state.afterCaptureTimestamp = null;
    state.beforeLocation = null;
    state.afterLocation = null;
    beforePreview.classList.add("hidden");
    afterPreview.classList.add("hidden");
    beforePreview.removeAttribute("src");
    afterPreview.removeAttribute("src");
    beforeLocationText.textContent = "Before location: not captured.";
    afterLocationText.textContent = "After location: not captured.";
  }

  startCameraBtn.addEventListener("click", async () => {
    try {
      await ensureCaptureSession(true);
      await camera.start();
      resetCaptureState();
      window.GreenEarnUtils.showMessage(
        submitMessage,
        "Camera started. First capture BEFORE image, then AFTER image.",
        "success"
      );
    } catch (error) {
      window.GreenEarnUtils.showMessage(submitMessage, error.message, "error");
    }
  });

  captureBeforeBtn.addEventListener("click", async () => {
    try {
      window.GreenEarnUtils.showMessage(submitMessage, "Capturing BEFORE image and auto-detecting GPS...", "");
      const photo = camera.capturePhoto();
      const location = await window.GreenEarnGPS.getCurrentLocation();

      state.beforeImageData = photo.dataUrl;
      state.beforeCaptureTimestamp = photo.capturedAt;
      state.beforeLocation = location;

      beforePreview.src = photo.dataUrl;
      beforePreview.classList.remove("hidden");

      beforeLocationText.textContent = `Before location: Lat ${location.lat}, Lng ${location.lng}, Acc ${location.accuracy}m`;
      window.GreenEarnUtils.showMessage(submitMessage, "Before image + location captured.", "success");
    } catch (error) {
      window.GreenEarnUtils.showMessage(submitMessage, error.message, "error");
    }
  });

  captureAfterBtn.addEventListener("click", async () => {
    try {
      window.GreenEarnUtils.showMessage(submitMessage, "Capturing AFTER image and auto-detecting GPS...", "");
      const photo = camera.capturePhoto();
      const location = await window.GreenEarnGPS.getCurrentLocation();

      state.afterImageData = photo.dataUrl;
      state.afterCaptureTimestamp = photo.capturedAt;
      state.afterLocation = location;

      afterPreview.src = photo.dataUrl;
      afterPreview.classList.remove("hidden");

      afterLocationText.textContent = `After location: Lat ${location.lat}, Lng ${location.lng}, Acc ${location.accuracy}m`;
      window.GreenEarnUtils.showMessage(submitMessage, "After image + location captured.", "success");
    } catch (error) {
      window.GreenEarnUtils.showMessage(submitMessage, error.message, "error");
    }
  });

  submitBtn.addEventListener("click", async () => {
    try {
      if (!state.beforeImageData) {
        throw new Error("Please capture BEFORE image first.");
      }
      if (!state.afterImageData) {
        throw new Error("Please capture AFTER image after activity.");
      }
      if (!state.beforeLocation) {
        throw new Error("Before location missing. Capture BEFORE image again.");
      }
      if (!state.afterLocation) {
        throw new Error("After location missing. Capture AFTER image again.");
      }

      await ensureCaptureSession(false);

      submitBtn.disabled = true;
      window.GreenEarnUtils.showMessage(submitMessage, "Submitting before/after images for AI verification...", "");

      const payload = {
        activityType: activitySelect.value,
        source: "live_camera",
        beforeImageData: state.beforeImageData,
        afterImageData: state.afterImageData,
        captureSessionId: state.captureSessionId,
        beforeCaptureTimestamp: state.beforeCaptureTimestamp,
        afterCaptureTimestamp: state.afterCaptureTimestamp,
        beforeLocation: state.beforeLocation,
        afterLocation: state.afterLocation,
      };

      const data = await window.GreenEarnAPI.apiRequest("/activities/submit", {
        method: "POST",
        data: payload,
      });

      if (data.user) {
        const current = window.GreenEarnAPI.getUser() || {};
        window.GreenEarnAPI.setUser({ ...current, ...data.user });
      }

      const verdict = data.activity?.status || "Submitted";
      const points = data.activity?.pointsAwarded || 0;
      const failureReason =
        data.failureReason || data.activity?.rejectionReason || data.activity?.aiResult?.reason || "";
      const displayMessage = verdict === "Verified"
        ? `${verdict}: ${data.message} Points: ${points}`
        : `${verdict}: ${failureReason || data.message} Points: ${points}`;

      window.GreenEarnUtils.showMessage(
        submitMessage,
        displayMessage,
        verdict === "Verified" ? "success" : "error"
      );

      state.captureSessionId = null;
      state.captureSessionExpiresAt = 0;
      resetCaptureState();
    } catch (error) {
      window.GreenEarnUtils.showMessage(submitMessage, error.message, "error");
    } finally {
      submitBtn.disabled = false;
    }
  });

  loadActivities();
})();
