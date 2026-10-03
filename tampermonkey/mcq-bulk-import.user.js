// ==UserScript==
// @name         Question Ghor MCQ Bulk Importer
// @namespace    question-ghor
// @version      1.1.0
// @description  Import numbered Bengali MCQs into Question Ghor
// @match        http://localhost/*
// @match        http://127.0.0.1/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict'

  const apiBase = 'http://localhost:4000/api'
  const legacyStorageKey = 'class-seven-math-questions'
  const equationMarker = '[[সূত্র]]'

  function extractInlineMath(value) {
    const equations = []
    const text = value.replace(/\$([^$]+)\$/g, (_match, equation) => {
      equations.push(equation.trim())
      return equationMarker
    })
    return { text, equations }
  }

  function parseQuestions(text) {
    const questions = []
    const errors = []
    const answerPattern = /সঠিক\s*উত্তর\s*[:ঃ]\s*([কখগঘ])/g
    let cursor = 0
    let answerMatch

    while ((answerMatch = answerPattern.exec(text))) {
      const questionNumber = questions.length + errors.length + 1
      const block = text.slice(cursor, answerMatch.index)
        .replace(/^[\s{}]+|[\s{}]+$/g, '')
        .replace(/^(?:[০-৯0-9]+[.)।]\s*)/, '')
      const optionPattern = /(?:^|\s)([কখগঘ])\s*[.)।]\s*/g
      const options = []
      let optionMatch

      while ((optionMatch = optionPattern.exec(block))) {
        const markerStart = optionMatch.index + (optionMatch[0].startsWith(' ') || optionMatch[0].startsWith('\n') ? 1 : 0)
        options.push({ label: optionMatch[1], markerStart, contentStart: optionPattern.lastIndex })
      }

      const errorPrefix = `প্রশ্ন ${questionNumber}: `
      if (options.length !== 4 || options.some((option, optionIndex) => option.label !== ['ক', 'খ', 'গ', 'ঘ'][optionIndex])) {
        errors.push(`${errorPrefix}ক., খ., গ., ঘ. এই ক্রমে চারটি অপশন দিন।`)
      } else {
        const promptText = block.slice(0, options[0].markerStart).trim()
        const parsedOptions = options.map((option, optionIndex) => {
          const optionEnd = options[optionIndex + 1]?.markerStart ?? block.length
          return block.slice(option.contentStart, optionEnd).trim()
        })
        const parsedPrompt = extractInlineMath(promptText)
        const parsedOptionMath = parsedOptions.map(extractInlineMath)

        if (!promptText || parsedOptions.some((option) => !option)) {
          errors.push(`${errorPrefix}প্রশ্ন এবং চারটি অপশন ফাঁকা রাখা যাবে না।`)
        } else if (parsedPrompt.equations.length > 1 || parsedOptionMath.some((option) => option.equations.length > 1)) {
          errors.push(`${errorPrefix}প্রশ্ন বা একটি অপশনে সর্বোচ্চ একটি $...$ সূত্র দিন।`)
        } else {
          const answerIndex = ['ক', 'খ', 'গ', 'ঘ'].indexOf(answerMatch[1])
          const correctOption = parsedOptionMath[answerIndex]
          questions.push({
            prompt: parsedPrompt.text,
            equation: parsedPrompt.equations[0] ?? '',
            options: parsedOptionMath.map((option) => option.text),
            optionEquations: parsedOptionMath.map((option) => option.equations[0] ?? ''),
            answer: correctOption.text.split(equationMarker).join('').replace(/\s+/g, ' ').trim()
              || correctOption.equations[0]
              || `option:${answerIndex}`,
          })
        }
      }

      cursor = answerPattern.lastIndex
    }

    if (questions.length + errors.length === 0) {
      errors.push('কোনো “সঠিক উত্তরঃ ক” পাওয়া যায়নি।')
    } else if (text.slice(cursor).replace(/[\s{}]/g, '')) {
      errors.push('শেষ প্রশ্নের পরে উত্তর ছাড়া অতিরিক্ত লেখা আছে।')
    }

    return { questions, errors }
  }

  function createImporter() {
    if (!document.querySelector('.app-shell') || document.getElementById('question-ghor-importer')) return

    const style = document.createElement('style')
    style.textContent = `
      #question-ghor-importer{position:fixed;right:22px;bottom:22px;z-index:2147483000;font:14px/1.5 system-ui,sans-serif;color:#202a25}
      #question-ghor-importer *{box-sizing:border-box}
      #qg-import-toggle{border:0;border-radius:6px;background:#246b54;color:#fff;padding:12px 16px;font:600 14px system-ui,sans-serif;box-shadow:0 5px 20px #14281f38;cursor:pointer}
      #qg-import-panel{width:min(460px,calc(100vw - 32px));max-height:calc(100vh - 100px);overflow:auto;margin-bottom:10px;padding:18px;background:#fff;border:1px solid #d5dfd9;border-radius:8px;box-shadow:0 16px 50px #14281f38}
      #qg-import-panel[hidden]{display:none}
      #qg-import-panel h2{margin:0 0 5px;font-size:18px;color:#1d3027}
      #qg-import-panel p{margin:0 0 14px;color:#65736b;font-size:12px}
      #qg-import-panel label{display:block;margin:0 0 11px;font-weight:600;font-size:13px}
      #qg-import-panel input,#qg-import-panel textarea{display:block;width:100%;margin-top:5px;padding:9px 10px;border:1px solid #cbd6cf;border-radius:4px;background:#fff;color:#202a25;font:13px/1.6 system-ui,sans-serif}
      #qg-import-panel textarea{min-height:160px;resize:vertical}
      #qg-import-actions{display:flex;align-items:center;gap:8px}
      #qg-import-start{border:0;border-radius:4px;background:#246b54;color:white;padding:10px 13px;font:600 13px system-ui,sans-serif;cursor:pointer}
      #qg-import-start:disabled{opacity:.55;cursor:wait}
      #qg-import-close{border:1px solid #cbd6cf;border-radius:4px;background:#fff;color:#26352d;padding:9px 12px;font:13px system-ui,sans-serif;cursor:pointer}
      #qg-import-status{margin:11px 0 0!important;white-space:pre-wrap;color:#344b3e!important}
      #qg-import-status[data-error="true"]{color:#a12f2f!important}
      @media(max-width:520px){#question-ghor-importer{right:12px;bottom:12px}#qg-import-panel{width:calc(100vw - 24px)}}
    `
    document.head.append(style)

    const root = document.createElement('div')
    root.id = 'question-ghor-importer'
    root.innerHTML = `
      <section id="qg-import-panel" hidden aria-label="MCQ একসাথে যোগ করুন">
        <h2>MCQ একসাথে যোগ</h2>
        <p>বর্তমান শ্রেণি ও বিষয়ের প্রশ্ন ব্যাংকে যোগ হবে।</p>
        <label>অধ্যায়<input id="qg-import-chapter" required placeholder="যেমন: ভগ্নাংশ" /></label>
        <label>প্রতি প্রশ্নের নম্বর<input id="qg-import-marks" type="number" min="1" max="100" value="1" /></label>
        <label>প্রশ্ন, অপশন ও সঠিক উত্তর<textarea id="qg-import-text" placeholder="১. প্রশ্ন লিখুন ক. প্রথম অপশন খ. দ্বিতীয় অপশন গ. তৃতীয় অপশন ঘ. চতুর্থ অপশন সঠিক উত্তরঃ ক"></textarea></label>
        <div id="qg-import-actions"><button id="qg-import-start" type="button">প্রশ্ন যোগ করুন</button><button id="qg-import-close" type="button">বন্ধ</button></div>
        <p id="qg-import-status" role="status"></p>
      </section>
      <button id="qg-import-toggle" type="button" aria-expanded="false">MCQ আমদানি</button>
    `
    document.body.append(root)

    const panel = root.querySelector('#qg-import-panel')
    const toggle = root.querySelector('#qg-import-toggle')
    const startButton = root.querySelector('#qg-import-start')
    const status = root.querySelector('#qg-import-status')

    function setStatus(message, isError = false) {
      status.textContent = message
      status.dataset.error = String(isError)
    }

    toggle.addEventListener('click', () => {
      panel.hidden = !panel.hidden
      toggle.setAttribute('aria-expanded', String(!panel.hidden))
    })
    root.querySelector('#qg-import-close').addEventListener('click', () => {
      panel.hidden = true
      toggle.setAttribute('aria-expanded', 'false')
    })

    startButton.addEventListener('click', async () => {
      const gradeSelect = document.querySelector('.context-bar select')
      const subjectSelect = document.querySelectorAll('.context-bar select')[1]
      const chapter = root.querySelector('#qg-import-chapter').value.trim()
      const marks = Number(root.querySelector('#qg-import-marks').value)
      const parsed = parseQuestions(root.querySelector('#qg-import-text').value)

      if (!gradeSelect || !subjectSelect) {
        setStatus('শ্রেণি ও বিষয় নির্বাচন পাওয়া যায়নি; প্রশ্ন ব্যাংক পেজটি রিফ্রেশ করুন।', true)
        return
      }
      if (!chapter) {
        setStatus('অধ্যায়ের নাম লিখুন।', true)
        return
      }
      if (!Number.isInteger(marks) || marks < 1 || marks > 100) {
        setStatus('নম্বর ১ থেকে ১০০-এর মধ্যে দিন।', true)
        return
      }
      if (parsed.errors.length) {
        setStatus(parsed.errors.join('\n'), true)
        return
      }
      if (!parsed.questions.length) {
        setStatus('কোনো প্রশ্ন পাওয়া যায়নি।', true)
        return
      }
      if (!window.confirm(`${parsed.questions.length}টি MCQ যোগ করবেন?`)) return

      startButton.disabled = true
      const grade = Number(gradeSelect.value)
      const subject = subjectSelect.value
      const params = new URLSearchParams({ grade: String(grade), subject })
      const payloads = parsed.questions.map((question) => ({
        ...question,
        id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'mcq',
        chapter,
        grade,
        subject,
        equation: question.equation,
        optionEquations: question.optionEquations,
        answerEquation: '',
        marks,
        figure: '',
      }))

      try {
        let useApi = false
        try {
          const response = await fetch(`${apiBase}/questions?${params}`)
          useApi = response.ok
        } catch {
          useApi = false
        }

        if (useApi) {
          for (const [index, payload] of payloads.entries()) {
            setStatus(`সংরক্ষণ হচ্ছে: ${index + 1} / ${payloads.length}`)
            const response = await fetch(`${apiBase}/questions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
            if (!response.ok) throw new Error(`প্রশ্ন ${index + 1} সংরক্ষণ হয়নি (HTTP ${response.status})`)
          }
        } else {
          const storageKey = `question-bank-${grade}-${subject}`
          const previous = localStorage.getItem(storageKey)
            ?? (grade === 7 && subject === 'math' ? localStorage.getItem(legacyStorageKey) : null)
          const storedQuestions = previous ? JSON.parse(previous) : []
          if (!Array.isArray(storedQuestions)) throw new Error('লোকাল প্রশ্নের তথ্য সঠিক ফরম্যাটে নেই।')
          for (const [index, payload] of payloads.entries()) {
            setStatus(`সংরক্ষণ হচ্ছে: ${index + 1} / ${payloads.length}`)
            storedQuestions.unshift(payload)
            localStorage.setItem(storageKey, JSON.stringify(storedQuestions))
          }
        }

        setStatus(`${payloads.length}টি প্রশ্ন যোগ হয়েছে। তালিকা আপডেট হচ্ছে…`)
        window.location.reload()
      } catch (error) {
        setStatus(error.message || 'প্রশ্ন যোগ করা যায়নি।', true)
        startButton.disabled = false
      }
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createImporter, { once: true })
  } else {
    createImporter()
  }
})()