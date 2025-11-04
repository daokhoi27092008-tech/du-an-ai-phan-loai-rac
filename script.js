// script.js
const MODEL_FOLDER = "./recycle-classifier/";
const MIN_CONFIDENCE = 0.35;

let model, webcam, loopId;
let historyData = [];

const btnStart = document.getElementById("btnStart");
const btnScan = document.getElementById("btnScan");
const btnStop = document.getElementById("btnStop");
const webcamContainer = document.getElementById("webcam-container");
const currentSpan = document.getElementById("current");
const toplistDiv = document.getElementById("toplist");
const historyBody = document.getElementById("history-body");
const statsBody = document.getElementById("stats-body");
const errorDiv = document.getElementById("error");
const progressBar = document.querySelector("#progress div");
const progress = document.getElementById("progress");

function emojiFor(label) {
  const s = label.toLowerCase();
  if (s.includes("plastic")) return "🥤";
  if (s.includes("paper") || s.includes("cardboard")) return "📦";
  if (s.includes("glass")) return "🍶";
  if (s.includes("metal")) return "🔩";
  if (s.includes("ewaste")) return "💻";
  if (s.includes("cloth") || s.includes("clothes")) return "👕";
  if (s.includes("food")) return "🍂";
  return "🗑️";
}

function bgColorFor(label) {
  const s = label.toLowerCase();
  if (s.includes("plastic")) return "linear-gradient(120deg,#e0f7fa,#b2ebf2)";
  if (s.includes("paper") || s.includes("cardboard")) return "linear-gradient(120deg,#fff8e1,#ffecb3)";
  if (s.includes("glass")) return "linear-gradient(120deg,#e8f5e9,#c8e6c9)";
  if (s.includes("metal")) return "linear-gradient(120deg,#eceff1,#cfd8dc)";
  if (s.includes("ewaste")) return "linear-gradient(120deg,#ede7f6,#d1c4e9)";
  if (s.includes("cloth")) return "linear-gradient(120deg,#fce4ec,#f8bbd0)";
  if (s.includes("food")) return "linear-gradient(120deg,#f1f8e9,#dcedc8)";
  return "linear-gradient(120deg,#eaf7f0,#f2f8ff)";
}

async function loadModel() {
  if (model) return;
  try {
    progress.style.display = "block";
    progressBar.style.width = "30%";
    model = await tmImage.load(MODEL_FOLDER + "model.json", MODEL_FOLDER + "metadata.json");
    progressBar.style.width = "100%";
    setTimeout(() => (progress.style.display = "none"), 400);
    console.log("✅ Model loaded");
  } catch (e) {
    console.error(e);
    errorDiv.textContent = "❌ Không tải được model. Kiểm tra thư mục recycle-classifier.";
    throw e;
  }
}

async function startCamera() {
  errorDiv.textContent = "";
  try {
    await loadModel();
    webcam = new tmImage.Webcam(320, 320, true);
    await webcam.setup({ facingMode: "environment" });
    await webcam.play();

    function updateFrame() {
      webcam.update();
      loopId = requestAnimationFrame(updateFrame);
    }
    updateFrame();

    webcamContainer.innerHTML = "";
    webcamContainer.appendChild(webcam.canvas);

    btnStart.disabled = true;
    btnScan.disabled = false;
    btnStop.disabled = false;
    currentSpan.textContent = "📷 Camera đã bật — sẵn sàng quét";
  } catch (e) {
    console.error("camera error", e);
    errorDiv.textContent = "❌ Không thể bật camera. Hãy kiểm tra quyền truy cập (biểu tượng camera trên thanh địa chỉ).";
  }
}

async function stopCamera() {
  cancelAnimationFrame(loopId);
  try { await webcam.stop(); } catch {}
  webcamContainer.innerHTML = "";
  btnStart.disabled = false;
  btnScan.disabled = true;
  btnStop.disabled = true;
  currentSpan.textContent = "Đã tắt camera.";
  document.body.style.background = "linear-gradient(120deg,#eaf7f0,#f2f8ff)";
}

async function scanOnce() {
  if (!webcam || !model) { errorDiv.textContent = "Chưa bật camera hoặc model."; return; }

  progress.style.display = "block";
  progressBar.style.width = "50%";
  const prediction = await model.predict(webcam.canvas);
  const top = prediction.sort((a,b)=>b.probability - a.probability);
  progressBar.style.width = "100%";
  setTimeout(()=> (progress.style.display = "none"), 500);

  toplistDiv.innerHTML = "<strong>Top kết quả:</strong><br>";
  top.slice(0,3).forEach(p => {
    toplistDiv.innerHTML += `${emojiFor(p.className)} ${p.className}: ${(p.probability*100).toFixed(1)}%<br>`;
  });

  const best = top[0];
  const resDiv = document.getElementById("result");
  resDiv.classList.remove("fade");
  void resDiv.offsetWidth;
  resDiv.classList.add("fade");

  if (best.probability < MIN_CONFIDENCE) {
    currentSpan.textContent = "⚠️ Không chắc chắn, hãy thử lại.";
    document.body.style.background = "linear-gradient(120deg,#eaf7f0,#f2f8ff)";
    return;
  }

  currentSpan.innerHTML = `${emojiFor(best.className)} <b>${best.className}</b> — ${(best.probability*100).toFixed(1)}%`;

  // đổi màu nền theo loại rác
  document.body.style.transition = "background 0.8s ease";
  document.body.style.background = bgColorFor(best.className);

  // nháy viền camera
  webcamContainer.classList.add("flash");
  setTimeout(()=> webcamContainer.classList.remove("flash"), 700);

  const rec = { time: new Date().toLocaleTimeString(), className: best.className, prob: best.probability, emoji: emojiFor(best.className) };
  historyData.unshift(rec);
  renderHistory();
  renderStats();
}

function renderHistory() {
  historyBody.innerHTML = "";
  historyData.forEach(r => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${r.time}</td><td>${r.className}</td><td>${(r.prob*100).toFixed(1)}%</td><td>${r.emoji}</td>`;
    historyBody.appendChild(row);
  });
}

function renderStats() {
  if (historyData.length === 0) { statsBody.textContent = "Chưa có dữ liệu."; return; }
  const counts = {};
  historyData.forEach(r => counts[r.className] = (counts[r.className]||0)+1);
  statsBody.innerHTML = "";
  for (const k in counts) statsBody.innerHTML += `${emojiFor(k)} ${k}: ${counts[k]} lần<br>`;
}

btnStart.onclick = startCamera;
btnStop.onclick = stopCamera;
btnScan.onclick = scanOnce;
