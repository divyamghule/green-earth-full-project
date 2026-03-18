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
  const walletRupeesEl = document.getElementById("walletRupees");
  const userLevelEl = document.getElementById("userLevel");
  const userStreakEl = document.getElementById("userStreak");
  const verifiedCountEl = document.getElementById("verifiedCount");
  const canWithdrawEl = document.getElementById("canWithdraw");
  const withdrawRuleEl = document.getElementById("withdrawRule");
  const withdrawPointsInput = document.getElementById("withdrawPoints");
  const withdrawUpiIdInput = document.getElementById("withdrawUpiId");
  const withdrawBtn = document.getElementById("withdrawBtn");
  const withdrawMessageEl = document.getElementById("withdrawMessage");
  const pointsListEl = document.getElementById("pointsList");
  const historyListEl = document.getElementById("historyList");
  const withdrawalListEl = document.getElementById("withdrawalList");

  function renderPoints(entries) {
    if (!entries || entries.length === 0) {
      pointsListEl.innerHTML = "<div class='list-item'>No point entries yet.</div>";
      return;
    }

    pointsListEl.innerHTML = entries
      .map(
        (entry) => {
          const sign = Number(entry.points) > 0 ? "+" : "";
          return `
            <article class="list-item">
              <strong>${sign}${entry.points} points</strong>
              <p>${window.GreenEarnUtils.titleCase(entry.reason)}</p>
              <small>${window.GreenEarnUtils.formatDate(entry.createdAt)} | Balance: ${entry.balanceAfter}</small>
            </article>
          `;
        }
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

  function renderWithdrawals(withdrawals) {
    if (!withdrawals || withdrawals.length === 0) {
      withdrawalListEl.innerHTML = "<div class='list-item'>No withdrawal requests yet.</div>";
      return;
    }

    withdrawalListEl.innerHTML = withdrawals
      .map((item) => {
        const status = String(item.status || "Pending");
        const statusClass = status.toLowerCase();
        return `
          <article class="list-item">
            <div>
              <strong>${item.points} points -> Rs ${item.rupees}</strong>
              <span class="badge ${statusClass}">${status}</span>
            </div>
            <p>UPI: ${item.upiId || "-"}</p>
            <small>${window.GreenEarnUtils.formatDate(item.createdAt)}</small>
            ${item.adminNote ? `<p>Note: ${item.adminNote}</p>` : ""}
          </article>
        `;
      })
      .join("");
  }

  async function loadDashboard() {
    try {
      const [summary, history, walletData] = await Promise.all([
        window.GreenEarnAPI.apiRequest("/dashboard/summary"),
        window.GreenEarnAPI.apiRequest("/activities/history?limit=20"),
        window.GreenEarnAPI.apiRequest("/withdrawals/wallet"),
      ]);

      totalPointsEl.textContent = summary.user.totalPoints;
      userLevelEl.textContent = summary.user.level;
      userStreakEl.textContent = summary.user.streak;
      verifiedCountEl.textContent = summary.stats.verifiedSubmissions;

      const wallet = walletData.wallet || {};
      walletRupeesEl.textContent = wallet.rupeesEquivalent || 0;
      canWithdrawEl.textContent = wallet.canWithdraw ? "Yes" : "No";
      withdrawRuleEl.textContent = `1 point = Rs ${wallet.pointToRupeeRate || 1}. Minimum ${wallet.minWithdrawPoints || 1000} points. Available: ${wallet.points || 0} points.`;
      withdrawPointsInput.min = String(wallet.minWithdrawPoints || 1000);

      renderPoints(summary.recentPoints || []);
      renderHistory(history.activities || []);
      renderWithdrawals(walletData.recentWithdrawals || []);

      window.GreenEarnAPI.setUser(summary.user);
    } catch (error) {
      pointsListEl.innerHTML = `<div class='list-item'>${error.message}</div>`;
      historyListEl.innerHTML = "<div class='list-item'>Could not load history.</div>";
      withdrawalListEl.innerHTML = "<div class='list-item'>Could not load withdrawals.</div>";
    }
  }

  if (withdrawBtn) {
    withdrawBtn.addEventListener("click", async () => {
      try {
        const points = Number(withdrawPointsInput.value);
        const upiId = String(withdrawUpiIdInput.value || "").trim();

        if (!Number.isFinite(points) || points <= 0) {
          throw new Error("Enter valid points for withdrawal.");
        }

        if (!upiId) {
          throw new Error("UPI ID is required.");
        }

        withdrawBtn.disabled = true;
        window.GreenEarnUtils.showMessage(withdrawMessageEl, "Creating withdrawal request...", "");

        const response = await window.GreenEarnAPI.apiRequest("/withdrawals/request", {
          method: "POST",
          data: {
            points,
            upiId,
          },
        });

        window.GreenEarnUtils.showMessage(withdrawMessageEl, response.message || "Withdrawal request submitted.", "success");
        withdrawPointsInput.value = "";
        await loadDashboard();
      } catch (error) {
        window.GreenEarnUtils.showMessage(withdrawMessageEl, error.message, "error");
      } finally {
        withdrawBtn.disabled = false;
      }
    });
  }

  loadDashboard();
})();
