(function () {
  function getCurrentLocation(options) {
    const finalOptions = {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
      ...(options || {}),
    };
    const maxWaitMs = Number(finalOptions.maxWaitMs || 12000);
    const targetAccuracy = Number(finalOptions.targetAccuracy || 60);

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by this browser."));
        return;
      }

      let best = null;
      let settled = false;
      let watchId = null;

      const normalize = (position) => ({
        lat: Number(position.coords.latitude.toFixed(7)),
        lng: Number(position.coords.longitude.toFixed(7)),
        accuracy: Number(position.coords.accuracy.toFixed(2)),
        capturedAt: new Date().toISOString(),
      });

      const finish = (value, error) => {
        if (settled) return;
        settled = true;
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
        }
        if (error) {
          reject(error);
        } else {
          resolve(value);
        }
      };

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const normalized = normalize(position);
          if (!best || normalized.accuracy < best.accuracy) {
            best = normalized;
          }
          if (normalized.accuracy <= targetAccuracy) {
            finish(normalized);
          }
        },
        (_error) => {
          // Ignore intermittent watch errors and fallback at timeout.
        },
        finalOptions
      );

      setTimeout(() => {
        if (best) {
          finish(best);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => finish(normalize(position)),
          (error) => finish(null, new Error(error.message || "Unable to get location.")),
          finalOptions
        );
      }, maxWaitMs);
    });
  }

  window.GreenEarnGPS = {
    getCurrentLocation,
  };
})();
