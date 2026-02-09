// FYX Dashboard JavaScript

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  await loadDashboardData();

  document.getElementById('refresh-insights').addEventListener('click', async () => {
    const btn = document.getElementById('refresh-insights');
    btn.textContent = 'Analyzing...';
    btn.disabled = true;
    try {
      await chrome.runtime.sendMessage({ type: 'ANALYZE_PATTERNS' });
      await loadDashboardData();
    } catch (e) {
      console.error('Analysis failed:', e);
    }
    btn.textContent = 'Refresh Insights';
    btn.disabled = false;
  });
});

async function loadDashboardData() {
  let data;
  try {
    data = await chrome.runtime.sendMessage({ type: 'GET_DASHBOARD_DATA' });
  } catch (e) {
    // Fallback to direct storage access
    data = await chrome.storage.local.get([
      'sessionHistory', 'dailyScores', 'dailyStats',
      'geminiInsights', 'userName', 'lastAnalysisTime'
    ]);
  }

  if (!data) return;

  // Greeting
  const name = data.userName || '';
  document.getElementById('greeting').textContent = name ? `Hey ${name}!` : 'Hello!';

  // Stats
  renderStats(data);

  // Chart
  renderScoreChart(data.dailyScores || []);

  // Insights
  renderInsights(data.geminiInsights);

  // Session history
  renderSessionHistory(data.sessionHistory || []);
}

function renderStats(data) {
  const stats = data.dailyStats || { sessions: 0, focusTime: 0, breaks: 0 };
  const sessions = data.sessionHistory || [];

  document.getElementById('stat-sessions').textContent = stats.sessions || sessions.length;

  const focusMinutes = Math.round((stats.focusTime || 0) / 60);
  document.getElementById('stat-focus-time').textContent =
    focusMinutes >= 60 ? `${Math.floor(focusMinutes / 60)}h ${focusMinutes % 60}m` : `${focusMinutes}m`;

  document.getElementById('stat-breaks').textContent = stats.breaks || 0;

  // Average score from daily scores
  const dailyScores = data.dailyScores || [];
  const allScores = dailyScores.flatMap(d => d.scores.map(s => s.score));
  const avg = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : '--';
  document.getElementById('stat-avg-score').textContent = avg;
}

function renderScoreChart(dailyScores) {
  const canvas = document.getElementById('score-chart');
  const ctx = canvas.getContext('2d');

  // Set canvas resolution
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * 2;
  canvas.height = rect.height * 2;
  ctx.scale(2, 2);

  const width = rect.width;
  const height = rect.height;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };

  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Collect all data points
  let allPoints = [];
  dailyScores.forEach(day => {
    day.scores.forEach(s => {
      allPoints.push({ score: s.score, label: s.time, date: day.date });
    });
  });

  // If no data, show empty state
  if (allPoints.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '14px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No score data yet. Start a focus session!', width / 2, height / 2);
    return;
  }

  // Limit to last 50 points for readability
  if (allPoints.length > 50) allPoints = allPoints.slice(-50);

  // Draw grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    // Y-axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(100 - i * 25, padding.left - 10, y + 4);
  }

  // Draw colored zones
  // Green zone (70-100)
  const greenTop = padding.top;
  const greenBottom = padding.top + chartH * 0.3;
  const grad1 = ctx.createLinearGradient(0, greenTop, 0, greenBottom);
  grad1.addColorStop(0, 'rgba(16, 185, 129, 0.08)');
  grad1.addColorStop(1, 'rgba(16, 185, 129, 0.02)');
  ctx.fillStyle = grad1;
  ctx.fillRect(padding.left, greenTop, chartW, greenBottom - greenTop);

  // Red zone (0-40)
  const redTop = padding.top + chartH * 0.6;
  const redBottom = padding.top + chartH;
  const grad2 = ctx.createLinearGradient(0, redTop, 0, redBottom);
  grad2.addColorStop(0, 'rgba(239, 68, 68, 0.02)');
  grad2.addColorStop(1, 'rgba(239, 68, 68, 0.08)');
  ctx.fillStyle = grad2;
  ctx.fillRect(padding.left, redTop, chartW, redBottom - redTop);

  // Draw line
  ctx.beginPath();
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  allPoints.forEach((point, i) => {
    const x = padding.left + (i / (allPoints.length - 1 || 1)) * chartW;
    const y = padding.top + (1 - point.score / 100) * chartH;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  // Gradient stroke
  const lineGrad = ctx.createLinearGradient(padding.left, 0, width - padding.right, 0);
  lineGrad.addColorStop(0, '#6366f1');
  lineGrad.addColorStop(0.5, '#8b5cf6');
  lineGrad.addColorStop(1, '#a78bfa');
  ctx.strokeStyle = lineGrad;
  ctx.stroke();

  // Fill area under line
  ctx.lineTo(padding.left + chartW, padding.top + chartH);
  ctx.lineTo(padding.left, padding.top + chartH);
  ctx.closePath();

  const fillGrad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
  fillGrad.addColorStop(0, 'rgba(99, 102, 241, 0.15)');
  fillGrad.addColorStop(1, 'rgba(99, 102, 241, 0)');
  ctx.fillStyle = fillGrad;
  ctx.fill();

  // Draw dots on recent points
  const dotsToShow = Math.min(allPoints.length, 20);
  const startDot = allPoints.length - dotsToShow;
  for (let i = startDot; i < allPoints.length; i++) {
    const x = padding.left + (i / (allPoints.length - 1 || 1)) * chartW;
    const y = padding.top + (1 - allPoints[i].score / 100) * chartH;

    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    const color = allPoints[i].score >= 70 ? '#10b981' : allPoints[i].score >= 40 ? '#f59e0b' : '#ef4444';
    ctx.fillStyle = color;
    ctx.fill();
  }

  // X-axis: show date labels
  const uniqueDates = [...new Set(allPoints.map(p => p.date))];
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  uniqueDates.forEach((date, i) => {
    const x = padding.left + (i / (uniqueDates.length - 1 || 1)) * chartW;
    const shortDate = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    ctx.fillText(shortDate, x, height - 10);
  });
}

function renderInsights(insights) {
  const list = document.getElementById('insights-list');
  const suggestion = document.getElementById('suggestion-box');

  if (!insights || !insights.insights || insights.insights.length === 0) {
    return; // Keep empty state
  }

  const icons = ['💡', '📊', '🎯', '⚡', '🧠'];
  list.innerHTML = insights.insights.map((text, i) =>
    `<li class="insight-item">
      <span class="insight-icon">${icons[i % icons.length]}</span>
      <span>${text}</span>
    </li>`
  ).join('');

  // Patterns
  if (insights.bestFocusTime) {
    document.getElementById('pat-time').textContent = capitalize(insights.bestFocusTime);
  }
  if (insights.optimalDuration) {
    document.getElementById('pat-duration').textContent = insights.optimalDuration;
  }
  if (insights.trend) {
    const trendEmoji = insights.trend === 'improving' ? '📈' : insights.trend === 'declining' ? '📉' : '➡️';
    document.getElementById('pat-trend').textContent = trendEmoji + ' ' + capitalize(insights.trend);
  }

  if (insights.suggestion) {
    suggestion.style.display = 'block';
    suggestion.innerHTML = `<strong>💡 Suggestion:</strong> ${insights.suggestion}`;
  }
}

function renderSessionHistory(sessions) {
  const list = document.getElementById('session-list');
  if (sessions.length === 0) return;

  // Show most recent first, limit to 10
  const recent = sessions.slice(-10).reverse();

  list.innerHTML = recent.map(s => {
    const date = new Date(s.date);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const rating = s.focusRating || 5;
    const ratingClass = rating >= 7 ? 'high' : rating >= 4 ? 'mid' : 'low';

    return `
      <li class="session-item">
        <div class="session-rating ${ratingClass}">${rating}</div>
        <div class="session-info">
          <div class="session-goal">${s.goal || 'Focus Session'}</div>
          <div class="session-meta">${dateStr} at ${timeStr} · ${s.duration || 0}min</div>
          ${s.summary ? `<div class="session-summary">${s.summary}</div>` : ''}
        </div>
      </li>
    `;
  }).join('');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
