(function () {
  "use strict";

  // ── Progress bar color coding ──
  document.querySelectorAll(".dashboard-progress-bar").forEach(function (bar) {
    var pct = parseInt(bar.getAttribute("data-pct"), 10) || 0;
    if (pct >= 75) {
      bar.classList.add("dashboard-progress-green");
    } else if (pct >= 25) {
      bar.classList.add("dashboard-progress-yellow");
    } else {
      bar.classList.add("dashboard-progress-red");
    }
  });

  // ── Helpers ──
  var ghContainer = document.querySelector(".dashboard-github");
  if (!ghContainer) return;

  var USERNAME = ghContainer.getAttribute("data-username");
  if (!USERNAME) return;

  function getThemeColor(varName, fallback) {
    var val = getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
    return val || fallback;
  }

  function showError(id) {
    var el = document.getElementById(id);
    if (el) el.hidden = false;
  }

  function hideLoading(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = "none";
  }

  var CHART_COLORS = [
    "#3498db",
    "#e74c3c",
    "#2ecc71",
    "#f39c12",
    "#9b59b6",
    "#1abc9c",
    "#e67e22",
    "#34495e",
    "#d35400",
    "#8e44ad",
  ];

  // ── GitHub API fetch wrapper ──
  function ghFetch(path) {
    return fetch("https://api.github.com" + path, {
      headers: { Accept: "application/vnd.github.v3+json" },
    }).then(function (res) {
      if (!res.ok) throw new Error("GitHub API " + res.status);
      return res.json();
    });
  }

  // ── Language Donut Chart ──
  function loadLanguages() {
    ghFetch("/users/" + USERNAME + "/repos?per_page=100&sort=updated")
      .then(function (repos) {
        var langPromises = repos
          .filter(function (r) {
            return !r.fork;
          })
          .slice(0, 20)
          .map(function (r) {
            return ghFetch("/repos/" + r.full_name + "/languages").catch(
              function () {
                return {};
              }
            );
          });

        return Promise.all(langPromises);
      })
      .then(function (results) {
        var totals = {};
        results.forEach(function (langs) {
          Object.keys(langs).forEach(function (lang) {
            totals[lang] = (totals[lang] || 0) + langs[lang];
          });
        });

        var sorted = Object.entries(totals).sort(function (a, b) {
          return b[1] - a[1];
        });
        if (sorted.length === 0) {
          hideLoading("lang-loading");
          showError("lang-error");
          return;
        }

        // Take top 8, group rest as "Other"
        var top = sorted.slice(0, 8);
        var otherTotal = sorted.slice(8).reduce(function (sum, e) {
          return sum + e[1];
        }, 0);
        if (otherTotal > 0) top.push(["Other", otherTotal]);

        var labels = top.map(function (e) {
          return e[0];
        });
        var data = top.map(function (e) {
          return e[1];
        });

        hideLoading("lang-loading");
        var ctx = document.getElementById("dashboard-lang-chart");
        new Chart(ctx, {
          type: "doughnut",
          data: {
            labels: labels,
            datasets: [
              {
                data: data,
                backgroundColor: CHART_COLORS.slice(0, labels.length),
                borderWidth: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: "bottom",
                labels: {
                  color: getThemeColor("--primary", "#ccc"),
                  font: { size: 11 },
                  padding: 8,
                },
              },
            },
          },
        });
      })
      .catch(function () {
        hideLoading("lang-loading");
        showError("lang-error");
      });
  }

  // ── Weekly Activity Bar Chart ──
  function loadActivity() {
    ghFetch("/users/" + USERNAME + "/repos?per_page=10&sort=pushed")
      .then(function (repos) {
        var owned = repos
          .filter(function (r) {
            return !r.fork;
          })
          .slice(0, 5);
        var promises = owned.map(function (r) {
          return ghFetch(
            "/repos/" + r.full_name + "/stats/participation"
          ).catch(function () {
            return null;
          });
        });

        return Promise.all(promises).then(function (stats) {
          return { repos: owned, stats: stats };
        });
      })
      .then(function (result) {
        var repos = result.repos;
        var stats = result.stats;
        // Last 4 weeks of owner activity
        var weeks = ["4 weeks ago", "3 weeks ago", "2 weeks ago", "Last week"];
        var datasets = [];

        repos.forEach(function (repo, i) {
          var stat = stats[i];
          if (!stat || !stat.owner) return;
          var ownerWeeks = stat.owner.slice(-4);
          datasets.push({
            label: repo.name,
            data: ownerWeeks,
            backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
          });
        });

        if (datasets.length === 0) {
          hideLoading("activity-loading");
          showError("activity-error");
          return;
        }

        hideLoading("activity-loading");
        var ctx = document.getElementById("dashboard-activity-chart");
        new Chart(ctx, {
          type: "bar",
          data: {
            labels: weeks,
            datasets: datasets,
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                stacked: true,
                ticks: { color: getThemeColor("--primary", "#ccc") },
                grid: { color: getThemeColor("--border", "#333") },
              },
              y: {
                stacked: true,
                beginAtZero: true,
                ticks: {
                  color: getThemeColor("--primary", "#ccc"),
                  stepSize: 1,
                },
                grid: { color: getThemeColor("--border", "#333") },
                title: {
                  display: true,
                  text: "Commits",
                  color: getThemeColor("--secondary", "#999"),
                },
              },
            },
            plugins: {
              legend: {
                labels: {
                  color: getThemeColor("--primary", "#ccc"),
                  font: { size: 11 },
                },
              },
            },
          },
        });
      })
      .catch(function () {
        hideLoading("activity-loading");
        showError("activity-error");
      });
  }

  // ── Recent Commits Feed ──
  function loadCommits() {
    ghFetch("/users/" + USERNAME + "/events/public?per_page=30")
      .then(function (events) {
        var pushEvents = events.filter(function (e) {
          return e.type === "PushEvent";
        });
        var commits = [];

        pushEvents.forEach(function (event) {
          var repoName = event.repo.name;
          event.payload.commits.forEach(function (c) {
            if (commits.length < 10) {
              commits.push({
                sha: c.sha.substring(0, 7),
                message: c.message.split("\n")[0],
                repo: repoName,
                url:
                  "https://github.com/" + repoName + "/commit/" + c.sha,
                time: event.created_at,
              });
            }
          });
        });

        var list = document.getElementById("dashboard-commits");
        hideLoading("commits-loading");

        if (commits.length === 0) {
          list.innerHTML =
            '<li style="color: var(--secondary); font-style: italic;">No recent commits found.</li>';
          return;
        }

        list.innerHTML = commits
          .map(function (c) {
            var timeAgo = formatTimeAgo(c.time);
            return (
              "<li>" +
              '<a class="dashboard-commit-sha" href="' +
              c.url +
              '" target="_blank" rel="noopener">' +
              c.sha +
              "</a>" +
              '<span class="dashboard-commit-repo">' +
              c.repo.split("/")[1] +
              "</span>" +
              '<span class="dashboard-commit-msg">' +
              escapeHtml(c.message) +
              "</span>" +
              '<span class="dashboard-commit-time">' +
              timeAgo +
              "</span>" +
              "</li>"
            );
          })
          .join("");
      })
      .catch(function () {
        hideLoading("commits-loading");
        showError("commits-error");
      });
  }

  function formatTimeAgo(dateStr) {
    var now = Date.now();
    var then = new Date(dateStr).getTime();
    var diff = Math.floor((now - then) / 1000);

    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    return Math.floor(diff / 86400) + "d ago";
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ── Initialize ──
  loadLanguages();
  loadActivity();
  loadCommits();
})();
