// ═══════════════════════════════════════════════
//  SafeVoice — app.js
//  All application logic, voice, AI, export
// ═══════════════════════════════════════════════

const App = (() => {

  // ── STATE ─────────────────────────────────────
  const state = {
    currentScreen: 1,
    apiKey: '',
    demoMode: false,
    token: '',

    // Form data
    emotions: [],
    storyText: '',
    certainty: 60,
    timeline: { before: {}, during: {}, after: {} },
    offender: null,       // 'known' | 'unknown' | 'unsure'
    offenderDesc: '',
    uploadedFiles: [],

    // Voice
    isRecording: false,
    isPaused: false,
    recognition: null,
    finalTranscript: '',

    // Report
    caseRef: '',
    aiSummary: '',
  };

  // ── INIT ──────────────────────────────────────
  function init() {
    setupApiKey();
    updateBreathLabel();
    setInterval(updateBreathLabel, 8000);
  }

  function setupApiKey() {
    const stored = sessionStorage.getItem('sv_key');
    if (stored) {
      state.apiKey = stored;
      return;
    }
    const key = prompt(
      'SafeVoice AI Setup\n\nEnter your Anthropic API key to enable live AI features.\n(Leave blank to use demo mode)'
    );
    if (key && key.trim().startsWith('sk-ant')) {
      state.apiKey = key.trim();
      sessionStorage.setItem('sv_key', state.apiKey);
    } else {
      state.demoMode = true;
      console.log('SafeVoice running in demo mode.');
    }
  }

  // ── NAVIGATION ────────────────────────────────
  function goTo(screenNum) {
    // Validation before leaving screen 2
    if (state.currentScreen === 2 && screenNum > 2) {
      const text = document.getElementById('story-text').value.trim();
      if (!text && !state.finalTranscript) {
        if (!confirm('You haven\'t shared anything yet. Continue without a story?')) return;
      }
    }

    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));

    // Show target
    const target = document.getElementById(`screen-${screenNum}`);
    if (target) {
      target.classList.remove('hidden');
    }

    // Nav bar
    const nav = document.getElementById('main-nav');
    if (screenNum === 1) {
      nav.classList.add('hidden');
    } else {
      nav.classList.remove('hidden');
      updateNavPips(screenNum);
    }

    state.currentScreen = screenNum;

    // Special actions on arrival
    if (screenNum === 5) renderReport();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateNavPips(active) {
    document.querySelectorAll('.step-pip').forEach((pip, i) => {
      const n = i + 1;
      pip.classList.remove('active', 'done');
      if (n === active) pip.classList.add('active');
      else if (n < active) pip.classList.add('done');
    });
  }

  // ── EMOTION HANDLING ──────────────────────────
  function toggleEmotion(el) {
    el.classList.toggle('selected');
    state.emotions = Array.from(
      document.querySelectorAll('#emotion-chips .chip.selected')
    ).map(e => e.textContent);

    const hasDistress = state.emotions.some(e =>
      ['Overwhelmed', 'Distressed'].includes(e)
    );
    document.getElementById('distress-banner').classList.toggle('hidden', !hasDistress);
  }

  // ── VOICE INPUT ───────────────────────────────
  function toggleVoice() {
    if (state.isRecording) stopVoice();
    else startVoice();
  }

  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('Voice input requires Chrome or Edge browser. Please type your account instead.');
      return;
    }

    state.recognition = new SR();
    state.recognition.continuous     = true;
    state.recognition.interimResults = true;
    state.recognition.lang           = 'en-IN';

    state.finalTranscript = document.getElementById('story-text').value;

    state.recognition.onstart = () => {
      state.isRecording = true;
      state.isPaused    = false;

      const btn = document.getElementById('mic-btn');
      btn.classList.add('recording');
      document.getElementById('mic-icon').textContent    = '⏹';
      document.getElementById('mic-status').textContent  = 'Listening… speak freely';
      document.getElementById('waveform').classList.add('show');
      document.getElementById('pause-btn').disabled = false;
    };

    state.recognition.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) state.finalTranscript += e.results[i][0].transcript + ' ';
        else interim = e.results[i][0].transcript;
      }
      const ta = document.getElementById('story-text');
      ta.value = state.finalTranscript + interim;
      analyzeVoiceEmotion(e);
    };

    state.recognition.onerror = (e) => {
      if (e.error !== 'aborted') {
        document.getElementById('mic-status').textContent = 'Mic error: ' + e.error;
      }
      stopVoice();
    };

    state.recognition.onend = () => {
      if (state.isRecording && !state.isPaused) stopVoice();
    };

    state.recognition.start();
  }

  function stopVoice() {
    state.isRecording = false;
    if (state.recognition) { state.recognition.stop(); state.recognition = null; }

    document.getElementById('mic-btn').classList.remove('recording');
    document.getElementById('mic-icon').textContent   = '🎙️';
    document.getElementById('mic-status').textContent = 'Recording saved ✓';
    document.getElementById('waveform').classList.remove('show');
    document.getElementById('pause-btn').disabled     = true;
  }

  function pauseVoice() {
    if (!state.isRecording) return;
    state.isPaused = true;
    if (state.recognition) state.recognition.stop();
    document.getElementById('mic-status').textContent = 'Paused — press mic to resume';
    document.getElementById('waveform').classList.remove('show');
  }

  function analyzeVoiceEmotion(e) {
    // Heuristic: short/fragmented results → more hesitant
    const lastResult = e.results[e.results.length - 1];
    if (!lastResult.isFinal) return;
    const text = lastResult[0].transcript.toLowerCase();
    const hesitantWords = ['i don\'t know', 'not sure', 'maybe', 'i think', 'forget'];
    const distressWords  = ['scared', 'terrified', 'hurt', 'couldn\'t', 'help'];

    if (distressWords.some(w => text.includes(w))) openCalmMode();
  }

  function onTextChange() {
    state.storyText = document.getElementById('story-text').value;
  }

  function insertFragment(text) {
    const ta = document.getElementById('story-text');
    ta.value += (ta.value ? '\n\n' : '') + text;
    ta.focus();
    state.storyText = ta.value;
  }

  // ── TIMELINE ──────────────────────────────────
  function toggleTimeline(phase) {
    const body    = document.getElementById(`${phase}-body`);
    const chevron = document.getElementById(`${phase}-chevron`);
    const isOpen  = !body.classList.contains('hidden');

    body.classList.toggle('hidden', isOpen);
    chevron.classList.toggle('open', !isOpen);
  }

  function updateTimelineSummary(phase) {
    const text    = document.getElementById(`${phase}-text`).value.trim();
    const summary = document.getElementById(`${phase}-summary`);
    summary.textContent = text
      ? (text.length > 60 ? text.slice(0, 60) + '…' : text)
      : 'Tap to add details';
  }

  function setOffender(type) {
    state.offender = type;
    document.querySelectorAll('.off-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById(`off-${type}`).classList.add('selected');

    const detail = document.getElementById('offender-detail');
    if (type === 'unknown') {
      detail.classList.remove('hidden');
    } else {
      detail.classList.add('hidden');
    }
  }

  function generateSketch() {
    const desc = document.getElementById('offender-desc').value;
    if (!desc.trim()) { alert('Please describe the offender\'s appearance first.'); return; }

    state.offenderDesc = desc;
    const canvas = document.getElementById('sketch-canvas');
    canvas.classList.remove('hidden');

    const ctx    = canvas.getContext('2d');
    const lower  = desc.toLowerCase();

    const features = {
      hairColor:   lower.includes('blonde') || lower.includes('light hair') ? 'light'
                 : lower.includes('grey') || lower.includes('gray')         ? 'grey'
                 : 'dark',
      beard:       lower.includes('beard') || lower.includes('stubble'),
      scar:        lower.includes('scar'),
      eyeColor:    lower.includes('light eye') || lower.includes('blue eye') || lower.includes('green eye') ? 'light' : 'dark',
      heavyBuild:  lower.includes('heavy') || lower.includes('large') || lower.includes('big'),
    };

    drawSketch(ctx, features, canvas.width, canvas.height);
  }

  function drawSketch(ctx, f, w, h) {
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#1a1430';
    ctx.fillRect(0, 0, w, h);

    // Skin
    ctx.fillStyle = '#d4a574';

    // Head
    ctx.beginPath();
    ctx.ellipse(w/2, 95, 58, 72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c49060'; ctx.lineWidth = 1;
    ctx.stroke();

    // Hair
    ctx.fillStyle = f.hairColor === 'light' ? '#c8a050'
                  : f.hairColor === 'grey'  ? '#909090'
                  : '#2a1a0a';
    ctx.beginPath();
    ctx.ellipse(w/2, 38, 60, 36, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    // Eyes
    const eyeColor = f.eyeColor === 'light' ? '#5a8fd4' : '#3a2010';
    [w/2-22, w/2+22].forEach(ex => {
      ctx.fillStyle = 'white';
      ctx.beginPath(); ctx.ellipse(ex, 86, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = eyeColor;
      ctx.beginPath(); ctx.ellipse(ex, 86, 6, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.ellipse(ex, 86, 3, 3, 0, 0, Math.PI * 2); ctx.fill();
    });

    // Eyebrows
    ctx.strokeStyle = f.hairColor === 'light' ? '#9a7030' : '#1a0a00';
    ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    [w/2-22, w/2+22].forEach(ex => {
      ctx.beginPath(); ctx.moveTo(ex-10, 76); ctx.lineTo(ex+10, 77); ctx.stroke();
    });

    // Nose
    ctx.strokeStyle = '#b08050'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(w/2, 96); ctx.lineTo(w/2-7, 110); ctx.lineTo(w/2+7, 110); ctx.stroke();

    // Mouth
    ctx.strokeStyle = '#a06040'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w/2-14, 122); ctx.quadraticCurveTo(w/2, 132, w/2+14, 122); ctx.stroke();

    // Beard
    if (f.beard) {
      ctx.fillStyle = f.hairColor === 'light' ? 'rgba(180,130,60,0.5)'
                    : f.hairColor === 'grey'  ? 'rgba(120,120,120,0.5)'
                    : 'rgba(40,20,5,0.6)';
      ctx.beginPath(); ctx.ellipse(w/2, 138, 30, 16, 0, 0, Math.PI); ctx.fill();
    }

    // Scar
    if (f.scar) {
      ctx.strokeStyle = '#e08080'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(w/2+28, 80); ctx.lineTo(w/2+38, 96); ctx.stroke();
    }

    // Ears
    ctx.fillStyle = '#d4a574'; ctx.strokeStyle = '#c49060'; ctx.lineWidth = 1;
    [-1, 1].forEach(side => {
      const ex = w/2 + side * 58;
      ctx.beginPath(); ctx.ellipse(ex, 97, 7, 13, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    });

    // Neck + shoulders
    ctx.fillStyle = '#d4a574';
    ctx.beginPath(); ctx.moveTo(w/2-14, 162); ctx.lineTo(w/2-14, 195); ctx.lineTo(w/2+14, 195); ctx.lineTo(w/2+14, 162); ctx.closePath(); ctx.fill();

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px Outfit, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('AI Composite Sketch', w/2, h - 6);
  }

  async function reconstructTimeline() {
    showLoader('AI is reconstructing timeline…');
    const events = [];
    ['before','during','after'].forEach(p => {
      const text = document.getElementById(`${p}-text`)?.value.trim();
      const time = document.getElementById(`${p}-time`)?.value.trim();
      const cert = document.getElementById(`${p}-certainty`)?.value;
      if (text) events.push({ phase: p, event_text: text, event_time: time || null, certainty: cert });
    });

    if (!events.length) { hideLoader(); alert('Please add at least one timeline event first.'); return; }

    try {
      if (state.demoMode || !state.apiKey) {
        await sleep(1200);
        // Demo: just sort them
        hideLoader();
        alert('Timeline sorted! (Demo mode — connect API key for real AI sorting)');
        return;
      }
      const res = await callBackend('/api/ai/reconstruct-timeline', {
        events, memory_text: state.storyText
      });
      hideLoader();
      alert('Timeline reconstructed successfully by AI!');
    } catch (err) {
      hideLoader();
      console.error(err);
    }
  }

  // ── EVIDENCE ──────────────────────────────────
  function triggerUpload(type) {
    document.getElementById(`upload-${type}`).click();
  }

  function handleUpload(input, type) {
    const files = Array.from(input.files);
    files.forEach(f => addFile(f, type));
    input.value = '';
  }

  function handleDrop(e) {
    e.preventDefault();
    document.getElementById('upload-drop').classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files);
    files.forEach(f => {
      const t = f.type.startsWith('image/') ? 'photo'
              : f.type.startsWith('audio/') ? 'audio'
              : f.type === 'application/pdf' ? 'doc' : 'other';
      addFile(f, t);
    });
  }

  function dragOver(e) {
    e.preventDefault();
    document.getElementById('upload-drop').classList.add('dragover');
  }
  function dragLeave(e) {
    document.getElementById('upload-drop').classList.remove('dragover');
  }

  function addFile(file, type) {
    const entry = { file, type, id: Date.now() + Math.random() };
    state.uploadedFiles.push(entry);
    renderUploadedFiles();
    updateEvidenceCounts();
  }

  function removeFile(id) {
    state.uploadedFiles = state.uploadedFiles.filter(f => f.id !== id);
    renderUploadedFiles();
    updateEvidenceCounts();
  }

  function renderUploadedFiles() {
    const list = document.getElementById('uploaded-list');
    list.innerHTML = '';
    state.uploadedFiles.forEach(entry => {
      const icons = { photo:'📷', doc:'📄', audio:'🎧', other:'📁' };
      const size  = entry.file.size > 1024*1024
        ? (entry.file.size / (1024*1024)).toFixed(1) + ' MB'
        : (entry.file.size / 1024).toFixed(0) + ' KB';

      const div = document.createElement('div');
      div.className = 'uploaded-item';
      div.innerHTML = `
        <span class="up-icon">${icons[entry.type]}</span>
        <span class="up-name">${entry.file.name}</span>
        <span class="up-size">${size}</span>
        <button class="up-del" onclick="App.removeFile(${entry.id})">✕</button>
      `;
      list.appendChild(div);
    });
  }

  function updateEvidenceCounts() {
    const counts = { photo: 0, doc: 0, audio: 0, other: 0 };
    state.uploadedFiles.forEach(f => counts[f.type]++);
    document.getElementById('ev-photos-count').textContent = counts.photo + ' file' + (counts.photo !== 1 ? 's' : '');
    document.getElementById('ev-docs-count').textContent   = counts.doc   + ' file' + (counts.doc   !== 1 ? 's' : '');
    document.getElementById('ev-audio-count').textContent  = counts.audio + ' file' + (counts.audio !== 1 ? 's' : '');
    document.getElementById('ev-other-count').textContent  = counts.other + ' file' + (counts.other !== 1 ? 's' : '');
  }

  // ── REPORT GENERATION ─────────────────────────
  async function generateReport() {
    // collect all data
    collectFormData();
    goTo(5);
  }

  function collectFormData() {
    state.storyText = document.getElementById('story-text').value;
    state.certainty = document.getElementById('certainty-slider').value;

    ['before','during','after'].forEach(p => {
      state.timeline[p] = {
        text:      document.getElementById(`${p}-text`)?.value || '',
        time:      document.getElementById(`${p}-time`)?.value || '',
        certainty: document.getElementById(`${p}-certainty`)?.value || 'medium',
      };
    });

    state.offenderDesc = document.getElementById('offender-desc')?.value || '';
    state.caseRef = 'SV-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);
  }

  async function renderReport() {
    // Meta
    document.getElementById('report-caseref').textContent  = state.caseRef || '—';
    document.getElementById('report-date').textContent     = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
    document.getElementById('report-certainty').textContent = (state.certainty || 60) + '%';

    // Show loading
    document.getElementById('report-loading').classList.remove('hidden');
    document.getElementById('report-content').classList.add('hidden');

    try {
      const summary = await generateAISummary();
      state.aiSummary = summary;
      document.getElementById('report-content').innerHTML = summary;
      document.getElementById('report-loading').classList.add('hidden');
      document.getElementById('report-content').classList.remove('hidden');
    } catch (err) {
      document.getElementById('report-loading').innerHTML =
        '<p style="color:#f87171">Could not generate AI summary. Check API key.</p>';
    }
  }

  async function generateAISummary() {
    const emotions = state.emotions.join(', ') || 'not specified';
    const timeline = Object.entries(state.timeline)
      .filter(([,v]) => v.text)
      .map(([k,v]) => `${k.toUpperCase()}: [${v.certainty}] ${v.time || 'unknown time'} — ${v.text}`)
      .join('\n') || 'No timeline provided';

    if (state.demoMode || !state.apiKey) {
      await sleep(1500);
      return `
        <strong>Case Reference:</strong> ${state.caseRef}<br><br>
        <strong>Nature of Incident:</strong> The survivor reports an incident involving coercion and distress.<br><br>
        <strong>Emotional State at Recording:</strong> ${emotions}<br><br>
        <strong>Account Summary:</strong> ${state.storyText || 'Voice testimony recorded.'}<br><br>
        <strong>Timeline:</strong><br>${timeline.replace(/\n/g,'<br>')}<br><br>
        ${state.offenderDesc ? `<strong>Offender Description:</strong> ${state.offenderDesc}<br><br>` : ''}
        <strong>Memory Reliability Note:</strong> Certainty self-assessed at ${state.certainty}%.
        Fragmented recall is consistent with trauma-induced memory encoding.
      `;
    }

    const system = `You are a trauma-informed legal documentation AI for SafeVoice.
Structure this testimony into a clear legal format. Use <strong> for section headings.
Sections: Nature of Incident | Emotional State | Account Summary | Timeline | ${state.offenderDesc ? 'Offender Description | ' : ''}Memory Reliability Note.
Never alter the survivor's meaning. Max 280 words. Plain HTML only.`;

    const userMsg = `
EMOTIONS: ${emotions}
CERTAINTY: ${state.certainty}%
STORY: ${state.storyText}
TIMELINE:\n${timeline}
${state.offenderDesc ? 'OFFENDER DESCRIPTION: ' + state.offenderDesc : ''}
Case ref: ${state.caseRef}`;

    const res = await callBackend('/api/ai/structure', {
      memory_text: state.storyText,
      emotions: state.emotions,
      certainty: parseInt(state.certainty),
      timeline_events: Object.entries(state.timeline).filter(([,v])=>v.text).map(([k,v]) => ({
        event_text: v.text, event_time: v.time, certainty: v.certainty
      }))
    });
    return res.summary || '<em>Summary generated.</em>';
  }

  // ── EXPORTS ───────────────────────────────────
  function downloadPDF() {
    // In production this calls GET /api/export/:id/pdf
    // For demo, use window.print with report content
    const content = document.getElementById('report-content').innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
      <!DOCTYPE html><html><head>
      <title>Testimony ${state.caseRef}</title>
      <style>
        body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; color: #222; line-height: 1.8; }
        h1 { color: #1e1442; font-size: 24px; border-bottom: 2px solid #6b4fbb; padding-bottom: 10px; }
        strong { color: #1e1442; }
        .note { background: #e8f0fe; border-left: 4px solid #4a90d9; padding: 12px; margin-top: 24px; font-size: 13px; color: #333; }
        .footer { margin-top: 40px; font-size: 11px; color: #888; border-top: 1px solid #ddd; padding-top: 12px; }
      </style></head><body>
      <h1>SafeVoice — Structured Testimony</h1>
      <p><strong>Case Reference:</strong> ${state.caseRef} &nbsp;|&nbsp; <strong>Date:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
      <hr/>
      ${content}
      <div class="note">💙 Memory fragmentation is clinically normal following trauma and does not affect the reliability of this testimony.</div>
      <div class="footer">Generated by SafeVoice — Confidential. For legal use only.</div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  function shareSecurely() {
    // In production: POST to server, get secure share link
    const link = `https://safevoice.app/case/${state.caseRef}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link)
        .then(() => alert('Secure link copied to clipboard!\n\n' + link))
        .catch(() => prompt('Copy this secure link:', link));
    } else {
      prompt('Copy this secure link:', link);
    }
  }

  function copyReport() {
    const text = document.getElementById('report-content').innerText;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
        .then(() => { showToast('Report copied to clipboard!'); })
        .catch(() => alert('Copy failed. Please select and copy manually.'));
    }
  }

  async function submitTestimony() {
    if (!confirm('Submit this testimony to the legal team? You can withdraw at any time.')) return;
    showLoader('Submitting testimony securely…');

    try {
      if (!state.demoMode && state.apiKey) {
        // In production: save to backend via /api/testimonies
        await sleep(1500);
      } else {
        await sleep(1800);
      }
      hideLoader();

      // Show success
      document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
      document.getElementById('screen-success').classList.remove('hidden');
      document.getElementById('success-caseref').textContent = 'CASE-REF: ' + state.caseRef;
      document.getElementById('main-nav').classList.add('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
      hideLoader();
      alert('Submission failed: ' + err.message);
    }
  }

  // ── CALM MODE ─────────────────────────────────
  function openCalmMode() {
    if (state.isRecording) pauseVoice();
    document.getElementById('calm-overlay').classList.remove('hidden');
  }

  function closeCalmMode() {
    document.getElementById('calm-overlay').classList.add('hidden');
  }

  let breathPhase = 0;
  const breathLabels = ['Breathe In…', 'Hold…', 'Breathe Out…', 'Rest…'];
  function updateBreathLabel() {
    const el = document.getElementById('breathe-label');
    if (el) {
      el.textContent = breathLabels[breathPhase % breathLabels.length];
      breathPhase++;
    }
  }

  // ── LOADER ────────────────────────────────────
  function showLoader(msg) {
    document.getElementById('loader-text').textContent = msg || 'Processing…';
    document.getElementById('loader').classList.remove('hidden');
  }
  function hideLoader() {
    document.getElementById('loader').classList.add('hidden');
  }

  // ── TOAST ─────────────────────────────────────
  function showToast(msg) {
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      background:#1e1442;color:white;padding:10px 22px;border-radius:999px;
      font-size:14px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.4);
      animation:toastIn 0.3s ease;border:1px solid rgba(255,255,255,0.15)`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }

  // ── BACKEND HELPERS ───────────────────────────
  async function callBackend(endpoint, body) {
    const res = await fetch(`http://localhost:5000${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(state.token ? { 'Authorization': `Bearer ${state.token}` } : {})
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('API error: ' + res.status);
    return res.json();
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── PUBLIC API ────────────────────────────────
  return {
    // Navigation
    goTo,
    // Emotions
    toggleEmotion,
    // Voice
    toggleVoice, pauseVoice, insertFragment, onTextChange,
    // Timeline
    toggleTimeline, updateTimelineSummary, setOffender, generateSketch, reconstructTimeline,
    // Evidence
    triggerUpload, handleUpload, handleDrop, dragOver, dragLeave, removeFile,
    // Report
    generateReport, downloadPDF, shareSecurely, copyReport, submitTestimony,
    // Calm Mode
    openCalmMode, closeCalmMode,
  };

})();

// ── BOOT ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  App.goTo(1);
  // Inject toast keyframe
  const style = document.createElement('style');
  style.textContent = `@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`;
  document.head.appendChild(style);
});
