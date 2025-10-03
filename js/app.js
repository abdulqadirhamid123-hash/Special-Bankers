
let state = {
  idx: 0,
  order: [],
  questions: [],
  showAnswer: false,
  score: {}, // id -> {correct: true/false}
};

const els = {}

function $(q){ return document.querySelector(q); }
function $all(q){ return Array.from(document.querySelectorAll(q)); }

function loadQuestions(){
  return fetch('assets/questions.json?_=' + Date.now())
    .then(r=>r.json())
    .then(data => {
      state.questions = data.questions;
      state.order = state.questions.map((_,i)=>i);
      applySaved();
      render();
    });
}

function applySaved(){
  try {
    const saved = JSON.parse(localStorage.getItem('qb_state_v1') || '{}');
    if(saved && typeof saved === 'object'){
      state.idx = saved.idx ?? 0;
      state.order = Array.isArray(saved.order) && saved.order.length ? saved.order : state.order;
      state.score = saved.score || {};
    }
  } catch(e){}
}

function save(){
  const toSave = { idx: state.idx, order: state.order, score: state.score };
  localStorage.setItem('qb_state_v1', JSON.stringify(toSave));
}

function shuffle(){
  for (let i = state.order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.order[i], state.order[j]] = [state.order[j], state.order[i]];
  }
  state.idx = 0;
  state.showAnswer = false;
  save();
  render();
}

function go(delta){
  const n = state.order.length;
  state.idx = (state.idx + delta + n) % n;
  state.showAnswer = false;
  save();
  render();
}

function setIndex(i){
  state.idx = i;
  state.showAnswer = false;
  save();
  render();
}

function mark(correct){
  const q = current();
  state.score[q.id] = {correct, ts: Date.now()};
  save();
  renderBadges();
}

function exportAnswers(){
  const blob = new Blob([JSON.stringify(state.score, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'my-answers.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function importAnswers(file){
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result);
      if(typeof obj === 'object') {
        state.score = obj;
        save();
        renderBadges();
      }
    } catch(e){ alert('Invalid JSON'); }
  };
  reader.readAsText(file);
}

function current(){
  const i = state.order[state.idx];
  return state.questions[i];
}

function render(){
  const q = current();
  // header
  $('#pos').textContent = `${state.idx + 1} / ${state.order.length}`;
  $('#progressFill').style.width = `${((state.idx+1)/state.order.length)*100}%`;

  // body images
  const qImg = $('#qImg');
  qImg.src = q.question;
  qImg.alt = `Question ${q.id}`;

  const ansWrap = $('#answerWrap');
  if(q.answer){
    $('#aImg').src = q.answer;
    ansWrap.classList.toggle('hidden', !state.showAnswer);
    $('#toggleAnswer').classList.remove('hidden');
  } else {
    ansWrap.classList.add('hidden');
    $('#toggleAnswer').classList.add('hidden');
  }

  // badges
  renderBadges();

  // thumbnails list (lazy)
  renderThumbs();
}

function renderBadges(){
  const q = current();
  const info = state.score[q.id];
  const badge = $('#badge');
  if(!info){
    badge.textContent = 'Unseen';
    badge.style.borderColor = 'var(--border)';
    badge.style.color = 'var(--muted)';
  } else {
    if(info.correct){
      badge.textContent = 'Marked Correct';
      badge.style.borderColor = 'var(--ok)';
      badge.style.color = 'var(--ok)';
    } else {
      badge.textContent = 'Marked Incorrect';
      badge.style.borderColor = 'var(--error)';
      badge.style.color = 'var(--error)';
    }
  }

  // overall stats
  const total = state.questions.length;
  const seen = Object.keys(state.score).length;
  const correct = Object.values(state.score).filter(s=>s.correct).length;
  $('#stats').textContent = `Seen ${seen}/${total} • Correct ${correct}`;
}

function renderThumbs(){
  const wrap = $('#thumbs');
  if(wrap.dataset.populated === '1') return;
  wrap.innerHTML = '';
  state.questions.forEach((q,i)=>{
    const btn = document.createElement('button');
    btn.className = 'button ghost';
    btn.style.padding = '6px';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.gap = '6px';
    btn.title = `#${i+1}`;
    btn.innerHTML = `<span class="small">#${i+1}</span>`;
    btn.addEventListener('click', ()=>setIndex(i));
    wrap.appendChild(btn);
  });
  wrap.dataset.populated = '1';
}

document.addEventListener('DOMContentLoaded', () => {
  // cache els
  ['prev','next','shuffle','toggleAnswer','markCorrect','markIncorrect','exportBtn','importInput']
    .forEach(id=> els[id] = document.getElementById(id));

  loadQuestions().then(()=>{
    els.prev.addEventListener('click', ()=>go(-1));
    els.next.addEventListener('click', ()=>go(1));
    els.shuffle.addEventListener('click', shuffle);

    els.toggleAnswer.addEventListener('click', ()=>{
      state.showAnswer = !state.showAnswer;
      save();
      render();
    });

    els.markCorrect.addEventListener('click', ()=>mark(true));
    els.markIncorrect.addEventListener('click', ()=>mark(false));

    els.exportBtn.addEventListener('click', exportAnswers);
    els.importInput.addEventListener('change', (e)=>{
      const f = e.target.files?.[0];
      if(f) importAnswers(f);
      e.target.value = '';
    });

    // keyboard shortcuts
    document.addEventListener('keydown', (e)=>{
      if(e.key === 'ArrowLeft') go(-1);
      else if(e.key === 'ArrowRight') go(1);
      else if(e.key.toLowerCase() === 's') shuffle();
      else if(e.key.toLowerCase() === 'a') { state.showAnswer = !state.showAnswer; render(); }
      else if(e.key.toLowerCase() === 'k') mark(true);
      else if(e.key.toLowerCase() === 'j') mark(false);
    });
  });
});

// ---- MCQ Enhancements ----
state.answerKey = {}; // id -> "A"/"B"/"C"/"D"
state.setKeyMode = false; // when true, clicking A-D sets the correct answer for current question

function loadAnswerKey(){
  // Try localStorage first
  try {
    const local = JSON.parse(localStorage.getItem('qb_answer_key_v1')||'{}');
    if(local && typeof local==='object') state.answerKey = local;
  } catch(e){}
  // Also fetch from file if exists (won't override local key)
  fetch('assets/answer_key.json').then(r=>r.json()).then(data=>{
    if(data && data.answer_key && Object.keys(state.answerKey).length===0){
      state.answerKey = data.answer_key;
      saveAnswerKey();
    }
  }).catch(()=>{});
}

function saveAnswerKey(){
  localStorage.setItem('qb_answer_key_v1', JSON.stringify(state.answerKey));
}

function currentCorrectLetter(){
  const q = current();
  return state.answerKey[String(q.id)] || null;
}

function handleOptionClick(letter){
  if(state.setKeyMode){
    const q = current();
    state.answerKey[String(q.id)] = letter;
    saveAnswerKey();
    renderOptions(); // refresh tick on correct
    return;
  }
  const correct = currentCorrectLetter();
  // If we don't have a correct letter yet, just toggle selection but don't grade
  if(!correct){
    // soft feedback: mark chosen as pending
    markChoice(letter, null);
    return;
  }
  // grade
  const isCorrect = (letter === correct);
  mark(isCorrect); // existing progress tracker
  markChoice(letter, correct);
}

function markChoice(selectedLetter, correctLetter){
  // Save selection to score for this question
  const q = current();
  const isCorrect = correctLetter ? (selectedLetter===correctLetter) : null;
  state.score[q.id] = {selected: selectedLetter, correct: isCorrect===true, ts: Date.now()};
  save();
  renderOptions();
}

function renderOptions(){
  const q = current();
  const selected = state.score[q.id]?.selected || null;
  const correct = currentCorrectLetter();
  const opts = $all('#options .option');
  opts.forEach(opt=>{
    const letter = opt.getAttribute('data-letter');
    const status = opt.querySelector('.status');
    opt.classList.remove('correct','incorrect');
    status.className = 'status';
    // Reset styles
    if(correct){ // we know the answer
      if(letter === correct) {
        opt.classList.add('correct');
        status.classList.add('tick');
      }
      if(selected && letter === selected && letter !== correct){
        opt.classList.add('incorrect');
        status.classList.add('cross');
      }
    } else {
      // No key: highlight selected softly
      if(selected && letter === selected){
        opt.style.borderColor = 'var(--accent)';
      } else {
        opt.style.borderColor = 'var(--border)';
      }
    }
  });
  // badge hint when no key
  const badge = $('#badge');
  if(!correct){
    badge.textContent = 'No Answer Key';
    badge.style.borderColor = 'var(--warn)';
    badge.style.color = 'var(--warn)';
  }
}

function setupOptionHandlers(){
  $all('#options .option').forEach(opt=>{
    opt.addEventListener('click', ()=>{
      const letter = opt.getAttribute('data-letter');
      handleOptionClick(letter);
    });
  });
}

function setupKeyControls(){
  const toggleBtn = $('#toggleSetKey');
  const exportBtn = $('#exportKeyBtn');
  const importInput = $('#importKeyInput');

  toggleBtn.addEventListener('click', ()=>{
    state.setKeyMode = !state.setKeyMode;
    toggleBtn.classList.toggle('active', state.setKeyMode);
  });

  exportBtn.addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(state.answerKey, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'answer_key.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  importInput.addEventListener('change', (e)=>{
    const f = e.target.files?.[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try {
        const obj = JSON.parse(reader.result);
        if(obj && typeof obj==='object'){
          state.answerKey = obj.answer_key || obj; // accept both raw map or wrapped
          saveAnswerKey();
          renderOptions();
        }
      } catch(err){ alert('Invalid answer key JSON'); }
    };
    reader.readAsText(f);
    e.target.value = '';
  });
}

// patch existing render() to also render options after body image updates
const _render_orig = render;
render = function(){
  _render_orig();
  renderOptions();
}

// Init answer key and handlers after load
document.addEventListener('DOMContentLoaded', () => {
  loadAnswerKey();
  setupOptionHandlers();
  setupKeyControls();
});
// ---- End MCQ Enhancements ----
