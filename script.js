/* =========================================================
   VUCA Decision-Tree Game  •  Main Logic + Firebase Leaderboard
   ========================================================= */

/* ---------- 1. Firebase (v9 compat) ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyCm4L0NgE-yyBvATJ1jQw4gSzVIHfm34ps",
  authDomain: "dupont-tree.firebaseapp.com",
  projectId: "dupont-tree",
  storageBucket: "dupont-tree.firebasestorage.app",
  messagingSenderId: "1097928928875",
  appId: "1:1097928928875:web:38394b3d7b17939a0b4b2e"
};
firebase.initializeApp(firebaseConfig);
const db     = firebase.firestore();
const SCORES = db.collection("scores");   // auto-creates on first write

/* ---------- 2. Global State ---------- */
const MASTER_INDUSTRIES = [
  "Retail",
  "Tech",
  "Manufacturing",
  "Healthcare",
  "Finance",
  "Education",
  "Tourism",
  "Agriculture",
  "Transportation",
  "Energy"
];
let scenariosByIndustry = {};      // { industry : [scenario,…] }
let activeScenarios     = [];      // slice used in one play
let username            = "";
let industryChosen      = "";
let current             = 0;
let totalScore          = 0;
let totalROI            = 0;

/* ---------- 3. DOM Elements ---------- */
const usernameInput  = document.getElementById("usernameInput");
const industrySelect = document.getElementById("industrySelect");
const startBtn       = document.getElementById("startBtn");
const setupBox       = document.getElementById("setupBox");
const questionBox    = document.getElementById("questionBox");
const scenarioText   = document.getElementById("scenario");
const choicesDiv     = document.getElementById("choices");
const scoreBox       = document.getElementById("scoreBox");
const nextBtn        = document.getElementById("nextBtn");
const resultsBox     = document.getElementById("resultsBox");
const leaderboardBox = document.getElementById("leaderboardBox");
const progressBar    = document.getElementById("progressBar");

/* ---------- 4. Helpers ---------- */
const shuffle = arr => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
const updateProgress = () =>
  (progressBar.style.width = ((current) / activeScenarios.length) * 100 + "%");

/* ---------- 5. Populate Dropdown (static) ---------- */
MASTER_INDUSTRIES.forEach(ind =>
  industrySelect.insertAdjacentHTML(
    "beforeend",
    `<option value="${ind}">${ind}</option>`
  )
);

/* ---------- 6. Game Flow Functions ---------- */
function showScenario() {
  updateProgress();
  scoreBox.textContent = "";
  nextBtn.classList.add("hidden");

  const s = activeScenarios[current];
  scenarioText.textContent = s.text;
  choicesDiv.innerHTML = "";

  shuffle([...s.choices]).forEach(choice => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = choice.text;
    btn.onclick = () => handleChoice(choice);
    choicesDiv.appendChild(btn);
  });
}
function handleChoice(choice) {
  totalScore += choice.score;
  totalROI   += choice.roi;
  scoreBox.textContent =
    `🎯 +${choice.score}  |  💰 ${choice.roi >= 0 ? '+' : ''}${choice.roi}`;
  nextBtn.classList.remove("hidden");
  document.querySelectorAll(".choice-btn").forEach(b => b.disabled = true);
}
function nextScenario() {
  current++;
  current < activeScenarios.length ? showScenario() : gameOver();
}
async function gameOver() {
  questionBox.classList.add("hidden");
  resultsBox.classList.remove("hidden");
  const maxScore = activeScenarios.length * 100;

  const docRef = await SCORES.add({
    username,
    industry : industryChosen,
    score    : totalScore,
    roi      : totalROI,
    created  : firebase.firestore.FieldValue.serverTimestamp()
  });

  resultsBox.innerHTML = `
    <h2>Game Over ✅</h2>
    <p class="pill">Score ${totalScore}/${maxScore} &nbsp;•&nbsp;
       ROI ${totalROI.toLocaleString('en-US',{style:'currency',currency:'USD'})}</p>
    <button id="restartBtn" class="primary-btn">Restart</button>
    <button id="leaderBtn"  class="secondary-btn">View Leaderboard</button>
  `;
  document.getElementById("restartBtn").onclick = () => location.reload();
  document.getElementById("leaderBtn").onclick  = () =>
      showLeaderboard(totalScore, totalROI, docRef.id);
}

/* ---------- 7. Leaderboard ---------- */
async function showLeaderboard(myScore, myROI, myDocId) {
  resultsBox.classList.add("hidden");
  leaderboardBox.classList.remove("hidden");

  const topSnap = await SCORES
        .orderBy("score","desc").orderBy("roi","desc").limit(10).get();

  let html = `<h2>🏆 Leaderboard</h2><table><thead><tr>
                <th>#</th><th>Name</th><th>Score</th><th>ROI</th><th>Industry</th>
              </tr></thead><tbody>`;
  topSnap.docs.forEach((doc, idx) => {
    const d = doc.data();
    html += `<tr${doc.id === myDocId ? ' class="me"' : ''}>
               <td>${idx + 1}</td>
               <td>${d.username}</td>
               <td>${d.score}</td>
               <td>${d.roi}</td>
               <td>${d.industry}</td>
             </tr>`;
  });
  html += `</tbody></table>`;

  const higherSnap      = await SCORES.where("score", ">", myScore).get();
  const sameScoreBetter = await SCORES
        .where("score","==",myScore).where("roi",">",myROI).get();
  const myRank = higherSnap.size + sameScoreBetter.size + 1;

  leaderboardBox.innerHTML = `${html}
    <p><strong>Your global rank:</strong> #${myRank}</p>
    <button class="primary-btn" onclick="location.reload()">Play Again</button>`;
}

/* ---------- 8. Load Questions.json ---------- */
fetch("questions.json")
  .then(res => res.json())
  .then(data => {
    data.forEach(s => {
      const ind = (s.industry || "").trim();
      if (!ind) {
        console.warn("Skipping scenario with missing industry:", s);
        return;
      }
      (scenariosByIndustry[ind] ??= []).push(s);
    });
  })
  .catch(err => console.error("Error loading questions:", err));

/* ---------- 9. Start Game ---------- */
startBtn.addEventListener("click", () => {
  username       = usernameInput.value.trim();
  industryChosen = industrySelect.value;

  if (!username)        { alert("Please enter a nickname!"); return; }
  if (!industryChosen)  { alert("Please choose an industry!"); return; }

  const pool = scenariosByIndustry[industryChosen] ?? [];
  if (pool.length === 0) {
    alert(`No scenarios found for "${industryChosen}" yet. Please pick another industry or add more to questions.json.`);
    return;
  }

  activeScenarios = shuffle(pool).slice(0, 15);
  [current, totalScore, totalROI] = [0, 0, 0];

  setupBox.classList.add("hidden");
  questionBox.classList.remove("hidden");
  showScenario();
});

nextBtn.addEventListener("click", nextScenario);
