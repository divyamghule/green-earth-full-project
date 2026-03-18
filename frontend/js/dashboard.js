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

  const totalPointsEl = document.getElementById("totalPoints");
  const userLevelEl = document.getElementById("userLevel");
  const userStreakEl = document.getElementById("userStreak");
  const verifiedCountEl = document.getElementById("verifiedCount");
  const pointsListEl = document.getElementById("pointsList");
  const historyListEl = document.getElementById("historyList");

  function renderPoints(entries) {
    if (!entries || entries.length === 0) {
      pointsListEl.innerHTML = "<div class='list-item'>No point entries yet.</div>";
      return;
    }

    pointsListEl.innerHTML = entries
      .map(
        (entry) => `
          <article class="list-item">
            <strong>+${entry.points} points</strong>
            <p>${window.GreenEarnUtils.titleCase(entry.reason)}</p>
            <small>${window.GreenEarnUtils.formatDate(entry.createdAt)} | Balance: ${entry.balanceAfter}</small>
          </article>
        `
      )
      .join("");
  }

  function renderHistory(activities) {
    if (!activities || activities.length === 0) {
      historyListEl.innerHTML = "<div class='list-item'>No activity submissions yet.</div>";
      return;
    }

    historyListEl.innerHTML = activities
      .map((activity) => {
        const statusClass = activity.status === "Verified" ? "verified" : "rejected";
        const beforeClass = activity.aiResult?.beforePrediction?.className;
        const afterClass = activity.aiResult?.afterPrediction?.className;
        const aiLabel = beforeClass && afterClass
          ? `${beforeClass} -> ${afterClass}`
          : activity.aiResult?.className || "Unknown";
        const changeScore = activity.aiResult?.changeScore;
        const reasonText = activity.rejectionReason || activity.aiResult?.reason;
        return `
          <article class="list-item">
            <div>
              <strong>${window.GreenEarnUtils.titleCase(activity.activityType)}</strong>
              <span class="badge ${statusClass}">${activity.status}</span>
            </div>
            <p>AI: ${aiLabel} (${Math.round((activity.aiResult?.confidence || 0) * 100)}%)${changeScore !== undefined ? ` | Change: ${changeScore}` : ""}</p>
            ${reasonText ? `<p>Reason: ${reasonText}</p>` : ""}
            <p>Points: ${activity.pointsAwarded || 0}</p>
            <small>${window.GreenEarnUtils.formatDate(activity.createdAt)}</small>
          </article>
        `;
      })
      .join("");
  }

  async function loadDashboard() {
    try {
      const [summary, history] = await Promise.all([
        window.GreenEarnAPI.apiRequest("/dashboard/summary"),
        window.GreenEarnAPI.apiRequest("/activities/history?limit=20"),
      ]);

      totalPointsEl.textContent = summary.user.totalPoints;
      userLevelEl.textContent = summary.user.level;
      userStreakEl.textContent = summary.user.streak;
      verifiedCountEl.textContent = summary.stats.verifiedSubmissions;

      renderPoints(summary.recentPoints || []);
      renderHistory(history.activities || []);

      window.GreenEarnAPI.setUser(summary.user);
    } catch (error) {
      pointsListEl.innerHTML = `<div class='list-item'>${error.message}</div>`;
      historyListEl.innerHTML = "<div class='list-item'>Could not load history.</div>";
    }
  }

  loadDashboard();
})();
