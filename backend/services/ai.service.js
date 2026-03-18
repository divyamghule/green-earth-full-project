const tf = require("@tensorflow/tfjs");
const jpeg = require("jpeg-js");

const MIN_CONFIDENCE = Number(process.env.AI_MIN_CONFIDENCE || 0.72);
const MIN_CHANGE_SCORE = Number(process.env.AI_MIN_CHANGE_SCORE || 0.045);
const CLEANUP_FALLBACK_MIN_CHANGE = Number(process.env.AI_CLEANUP_FALLBACK_MIN_CHANGE || 0.08);
const CLEANUP_HIGH_CHANGE_OVERRIDE = Number(process.env.AI_CLEANUP_HIGH_CHANGE_OVERRIDE || 0.15);
const CLEANUP_MIN_BRIGHTNESS_GAIN = Number(process.env.AI_CLEANUP_MIN_BRIGHTNESS_GAIN || 0.02);
const CLEANUP_MIN_VARIANCE_DROP = Number(process.env.AI_CLEANUP_MIN_VARIANCE_DROP || 0.002);

function round4(value) {
  return Number(value.toFixed(4));
}

function imageTensor(buffer) {
  const decoded = jpeg.decode(buffer, { useTArray: true });

  if (!decoded || !decoded.width || !decoded.height || !decoded.data) {
    throw new Error("Could not decode JPEG image.");
  }

  const { width, height, data } = decoded;
  const rgb = new Uint8Array(width * height * 3);

  // Convert RGBA bytes into RGB bytes for tensor creation.
  for (let src = 0, dst = 0; src < data.length; src += 4) {
    rgb[dst++] = data[src];
    rgb[dst++] = data[src + 1];
    rgb[dst++] = data[src + 2];
  }

  return tf.tensor3d(rgb, [height, width, 3], "int32").toFloat().div(255);
}

function heuristicPredict(imgTensor) {
  const [rTensor, gTensor, bTensor] = tf.split(imgTensor, 3, 2);

  const brightness = tf.mean(imgTensor).dataSync()[0];
  const rMean = tf.mean(rTensor).dataSync()[0];
  const gMean = tf.mean(gTensor).dataSync()[0];
  const bMean = tf.mean(bTensor).dataSync()[0];

  const greenMask = gTensor.greater(rTensor.mul(1.08)).logicalAnd(gTensor.greater(bTensor.mul(1.05)));
  const greenRatio = tf.mean(greenMask.cast("float32")).dataSync()[0];

  const gray = tf.mean(imgTensor, 2);
  const variance = tf.moments(gray).variance.dataSync()[0];

  let className = "Clean";
  let confidence = 0.78;

  if (greenRatio > 0.26 && gMean > rMean) {
    className = "Plant";
    confidence = Math.min(0.96, 0.75 + greenRatio * 0.6);
  } else if (variance > 0.03 || brightness < 0.42 || (rMean + gMean + bMean) / 3 < 0.45) {
    className = "Garbage";
    confidence = Math.min(0.92, 0.7 + variance * 1.5);
  } else {
    className = "Clean";
    confidence = Math.min(0.95, 0.72 + brightness * 0.25);
  }

  tf.dispose([rTensor, gTensor, bTensor, gray, greenMask]);

  const allScores = {
    Garbage: className === "Garbage" ? confidence : Math.max(0.05, 1 - confidence - 0.1),
    Clean: className === "Clean" ? confidence : Math.max(0.05, 1 - confidence - 0.1),
    Plant: className === "Plant" ? confidence : Math.max(0.05, 1 - confidence - 0.1),
  };

  return {
    className,
    confidence,
    scores: allScores,
    metrics: {
      brightness: round4(brightness),
      variance: round4(variance),
      greenRatio: round4(greenRatio),
    },
    mode: "heuristic-tfjs",
  };
}

async function classifyImage(buffer) {
  if (!buffer || !buffer.length) {
    throw new Error("Empty image buffer");
  }

  const imgTensor = imageTensor(buffer);

  try {
    const prediction = heuristicPredict(imgTensor);
    tf.dispose(imgTensor);
    return prediction;
  } catch (error) {
    tf.dispose(imgTensor);
    throw error;
  }
}

function computeVisualChangeScore(beforeTensor, afterTensor) {
  const beforeResized = tf.image.resizeBilinear(beforeTensor, [128, 128]);
  const afterResized = tf.image.resizeBilinear(afterTensor, [128, 128]);
  const diff = tf.abs(beforeResized.sub(afterResized));
  const score = tf.mean(diff).dataSync()[0];

  tf.dispose([beforeResized, afterResized, diff]);
  return Number(score.toFixed(4));
}

function verifyBeforeAfter(activityType, beforePrediction, afterPrediction, changeScore) {
  const beforeClass = String(beforePrediction.className || "").toLowerCase();
  const afterClass = String(afterPrediction.className || "").toLowerCase();
  const beforeBrightness = Number(beforePrediction?.metrics?.brightness || 0);
  const afterBrightness = Number(afterPrediction?.metrics?.brightness || 0);
  const beforeVariance = Number(beforePrediction?.metrics?.variance || 0);
  const afterVariance = Number(afterPrediction?.metrics?.variance || 0);
  const brightnessGain = round4(afterBrightness - beforeBrightness);
  const varianceDrop = round4(beforeVariance - afterVariance);

  if (beforePrediction.confidence < MIN_CONFIDENCE || afterPrediction.confidence < MIN_CONFIDENCE) {
    return {
      valid: false,
      reason: `Low AI confidence. Need >= ${MIN_CONFIDENCE} on both before and after images.`,
      details: {
        rule: "min_confidence_failed",
      },
    };
  }

  if (changeScore < MIN_CHANGE_SCORE) {
    return {
      valid: false,
      reason: `Before and after look too similar (change score ${changeScore}).`,
      details: {
        rule: "min_change_failed",
        changeScore,
        minChangeScore: MIN_CHANGE_SCORE,
      },
    };
  }

  if (activityType === "tree_plantation") {
    if (beforeClass === "plant") {
      return {
        valid: false,
        reason: "Before image already looks like plantation. Capture true before state.",
        details: {
          rule: "tree_before_invalid",
          beforeClass,
          afterClass,
        },
      };
    }
    if (afterClass !== "plant") {
      return {
        valid: false,
        reason: "After image must look like plantation to verify tree activity.",
        details: {
          rule: "tree_after_not_plant",
          beforeClass,
          afterClass,
        },
      };
    }
    return {
      valid: true,
      reason: "Before/after plantation change detected.",
      details: {
        rule: "tree_transition_ok",
        beforeClass,
        afterClass,
      },
    };
  }

  if (["garbage_cleaning", "river_cleaning", "pothole_fixing"].includes(activityType)) {
    if (beforeClass !== "garbage") {
      return {
        valid: false,
        reason: "Before image should show garbage/unfixed condition.",
        details: {
          rule: "cleanup_before_not_garbage",
          beforeClass,
          afterClass,
        },
      };
    }
    if (afterClass !== "clean") {
      const fallbackClassDropOk = afterPrediction.confidence <= beforePrediction.confidence + 0.03;
      const fallbackVisualOk =
        brightnessGain >= CLEANUP_MIN_BRIGHTNESS_GAIN || varianceDrop >= CLEANUP_MIN_VARIANCE_DROP;
      const fallbackChangeOk = changeScore >= CLEANUP_FALLBACK_MIN_CHANGE;
      const highChangeOverride = changeScore >= CLEANUP_HIGH_CHANGE_OVERRIDE;

      if (highChangeOverride) {
        return {
          valid: true,
          reason: "Cleanup improvement detected from very high before/after change.",
          details: {
            rule: "cleanup_high_change_override",
            beforeClass,
            afterClass,
            changeScore,
            highChangeOverrideThreshold: CLEANUP_HIGH_CHANGE_OVERRIDE,
          },
        };
      }

      if (fallbackChangeOk && (fallbackClassDropOk || fallbackVisualOk)) {
        return {
          valid: true,
          reason: "Cleanup improvement detected from before/after visual change.",
          details: {
            rule: "cleanup_fallback_visual_improvement",
            beforeClass,
            afterClass,
            changeScore,
            brightnessGain,
            varianceDrop,
            fallbackChangeOk,
            fallbackVisualOk,
            fallbackClassDropOk,
          },
        };
      }

      return {
        valid: false,
        reason: "After image should show clean/fixed condition or strong visual improvement.",
        details: {
          rule: "cleanup_after_not_clean_and_no_fallback",
          beforeClass,
          afterClass,
          changeScore,
          brightnessGain,
          varianceDrop,
          fallbackChangeOk,
          fallbackVisualOk,
          fallbackClassDropOk,
        },
      };
    }
    return {
      valid: true,
      reason: "Before/after cleanup change detected.",
      details: {
        rule: "cleanup_transition_ok",
        beforeClass,
        afterClass,
        changeScore,
      },
    };
  }

  return {
    valid: false,
    reason: "Unsupported activity type for before/after verification.",
    details: {
      rule: "unsupported_activity",
      activityType,
    },
  };
}

async function analyzeBeforeAfterActivity(activityType, beforeBuffer, afterBuffer) {
  if (!beforeBuffer?.length || !afterBuffer?.length) {
    throw new Error("Both before and after image buffers are required.");
  }

  const beforeTensor = imageTensor(beforeBuffer);
  const afterTensor = imageTensor(afterBuffer);

  try {
    const beforePrediction = heuristicPredict(beforeTensor);
    const afterPrediction = heuristicPredict(afterTensor);
    const changeScore = computeVisualChangeScore(beforeTensor, afterTensor);
    const verification = verifyBeforeAfter(activityType, beforePrediction, afterPrediction, changeScore);

    return {
      valid: verification.valid,
      reason: verification.reason,
      verificationDetails: verification.details || null,
      beforePrediction,
      afterPrediction,
      changeScore,
      minChangeScore: MIN_CHANGE_SCORE,
      minConfidence: MIN_CONFIDENCE,
      confidenceScore: Number(((beforePrediction.confidence + afterPrediction.confidence) / 2).toFixed(4)),
      mode: "before-after-heuristic",
    };
  } finally {
    tf.dispose([beforeTensor, afterTensor]);
  }
}

module.exports = {
  classifyImage,
  analyzeBeforeAfterActivity,
  MIN_CONFIDENCE,
  MIN_CHANGE_SCORE,
  CLEANUP_FALLBACK_MIN_CHANGE,
  CLEANUP_HIGH_CHANGE_OVERRIDE,
};
