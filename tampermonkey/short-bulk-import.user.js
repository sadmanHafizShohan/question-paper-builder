// ==UserScript==
// @name         Question Ghor Short Question Bulk Importer
// @namespace    question-ghor
// @version      1.0.0
// @description  Import Bengali short questions and answers into Question Ghor
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

  function cleanField(value) {
    return value
      .trim()
      .replace(/^["“]\s*/, '')
      .replace(/["”]\s*,?\s*$/, '')
      .trim()
  }

  function parseQuestions(value) {
    const text = value.replace(/^```[^\r\n]*\r?\n?|^```\s*$/gm, '').replace(/\r\n?/g, '\n')
    const fieldPattern = /(?:^|(?<="))[ \t]*["“]?\s*(প্রশ্ন|উত্তর)\s*(?::|ঃ)\s*/gm
    const fields = []
    let match

    while ((match = fieldPattern.exec(text))) {
      fields.push({
        label: match[1],
        startMarker: match.index,
        start: fieldPattern.lastIndex,
        end: text.length,
      })
    }

    fields.forEach((field, index) => {
      field.end = fields[index + 1]?.startMarker ?? text.length
    })

    const questions = []
    const errors = []
    let currentQuestion = ''

    fields.forEach((field) => {
      const content = cleanField(text.slice(field.start, field.end))
      if (!content) {
        errors.push(`“${field.label}” ফাঁকা রাখা যাবে না।`)
        return
      }
      if (field.label === 'প্রশ্ন') {
        if (currentQuestion) errors.push('প্রতিটি প্রশ্নের পরে একটি উত্তর দিন।')
        currentQuestion = content
      } else if (!currentQuestion) {
        errors.push('উত্তরের আগে “প্রশ্ন:” লিখুন।')
      } else {
        const parsedQuestion = extractInlineMath(currentQuestion)
        const parsedAnswer = extractInlineMath(content)
        questions.push({
          prompt: parsedQuestion.text,
          equation: '',
          inlineEquations: parsedQuestion.equations,
          options: [],
          statements: [],
          statementQuestion: '',
          optionEquations: [],
          optionInlineEquations: [],
          answer: parsedAnswer.text,
          answerEquation: '',
          inlineAnswerEquations: parsedAnswer.equations,
        })
        currentQuestion = ''
      }
    })

    if (currentQuestion) errors.push('শেষ প্রশ্নের উত্তর “উত্তর:” দিয়ে লিখুন।')
    if (!fields.length) errors.push('“প্রশ্ন:” ও “উত্তর:” লেবেলযুক্ত কোনো তথ্য পাওয়া যায়নি।')
    if (fields.length && !questions.length && !errors.length) errors.push('প্রশ্ন ও উত্তর জোড়ায় লিখুন।')
    return { questions, errors }
  }

  function createImporter() {
    if (!document.querySelector('.app-shell') || document.getElementById('question-ghor-short-importer')) return

    const style = document.createElement('style')
    style.textContent = `
      #question-ghor-short-importer{position:fixed;right:22px;bottom:82px;z-index:2147483000;font:14px/1.5 system-ui,sans-serif;color:#202a25}
      #question-ghor-short-importer *{box-sizing:border-box}
      #qgs-import-toggle{border:0;border-radius:6px;background:#405e8b;color:#fff;padding:12px 16px;font:600 14px system-ui,sans-serif;box-shadow:0 5px 20px #14281f38;cursor:pointer}
      #qgs-import-panel{width:min(460px,calc(100vw - 32px));max-height:calc(100vh - 160px);overflow:auto;margin-bottom:10px;padding:18px;background:#fff;border:1px solid #d5dfd9;border-radius:8px;box-shadow:0 16px 50px #14281f38}
      #qgs-import-panel[hidden]{display:none}
      #qgs-import-panel h2{margin:0 0 5px;font-size:18px;color:#1d3027}
      #qgs-import-panel p{margin:0 0 14px;color:#65736b;font-size:12px}
      #qgs-import-panel label{display:block;margin:0 0 11px;font-weight:600;font-size:13px}
      #qgs-import-panel input,#qgs-import-panel textarea{display:block;width:100%;margin-top:5px;padding:9px 10px;border:1px solid #cbd6cf;border-radius:4px;background:#fff;color:#202a25;font:13px/1.6 system-ui,sans-serif}
      #qgs-import-panel textarea{min-height:180px;resize:vertical}
      #qgs-import-actions{display:flex;align-items:center;gap:8px}
      #qgs-import-start{border:0;border-radius:4px;background:#405e8b;color:white;padding:10px 13px;font:600 13px system-ui,sans-serif;cursor:pointer}
      #qgs-import-start:disabled{opacity:.55;cursor:wait}
      #qgs-import-close{border:1px solid #cbd6cf;border-radius:4px;background:#fff;color:#26352d;padding:9px 12px;font:13px system-ui,sans-serif;cursor:pointer}
      #qgs-import-status{margin:11px 0 0!important;white-space:pre-wrap;color:#344b3e!important}
      #qgs-import-status[data-error="true"]{color:#a12f2f!important}
      @media(max-width:520px){#question-ghor-short-importer{right:12px;bottom:76px}#qgs-import-panel{width:calc(100vw - 24px)}}
    `
    document.head.append(style)

    const root = document.createElement('div')
    root.id = 'question-ghor-short-importer'
    root.innerHTML = `
      <section id="qgs-import-panel" hidden aria-label="সংক্ষিপ্ত প্রশ্ন একসাথে যোগ করুন">
        <h2>সংক্ষিপ্ত প্রশ্ন একসাথে যোগ</h2>
        <p>বর্তমান শ্রেণি ও বিষয়ের প্রশ্ন ব্যাংকে যোগ হবে। $...$-এর ভেতরের সূত্র স্বয়ংক্রিয়ভাবে equation হিসেবে সংরক্ষিত হবে।</p>
        <label>অধ্যায় (ঐচ্ছিক)<input id="qgs-import-chapter" placeholder="না দিলে ফাঁকা রাখুন" /></label>
        <label>প্রতি প্রশ্নের নম্বর<input id="qgs-import-marks" type="number" min="1" max="100"  /></label>
        <label>প্রশ্ন ও উত্তর<textarea id="qgs-import-text" placeholder="প্রশ্ন: এখানে প্রশ্ন লিখুন $x^2 + y^2$&#10;উত্তর: এখানে উত্তর লিখুন $x = ১০$"></textarea></label>
        <div id="qgs-import-actions"><button id="qgs-import-start" type="button">প্রশ্ন যোগ করুন</button><button id="qgs-import-close" type="button">বন্ধ</button></div>
        <p id="qgs-import-status" role="status"></p>
      </section>
      <button id="qgs-import-toggle" type="button" aria-expanded="false">সংক্ষিপ্ত প্রশ্ন আমদানি</button>
    `
    document.body.append(root)

    const panel = root.querySelector('#qgs-import-panel')
    const toggle = root.querySelector('#qgs-import-toggle')
    const startButton = root.querySelector('#qgs-import-start')
    const status = root.querySelector('#qgs-import-status')

    function setStatus(message, isError = false) {
      status.textContent = message
      status.dataset.error = String(isError)
    }

    toggle.addEventListener('click', () => {
      panel.hidden = !panel.hidden
      toggle.setAttribute('aria-expanded', String(!panel.hidden))
    })
    root.querySelector('#qgs-import-close').addEventListener('click', () => {
      panel.hidden = true
      toggle.setAttribute('aria-expanded', 'false')
    })

    startButton.addEventListener('click', async () => {
      const gradeSelect = document.querySelector('.context-bar select')
      const subjectSelect = document.querySelectorAll('.context-bar select')[1]
      const chapter = root.querySelector('#qgs-import-chapter').value.trim()
      const marks = Number(root.querySelector('#qgs-import-marks').value)
      const parsed = parseQuestions(root.querySelector('#qgs-import-text').value)

      if (!gradeSelect || !subjectSelect) {
        setStatus('শ্রেণি ও বিষয় নির্বাচন পাওয়া যায়নি; প্রশ্ন ব্যাংক পেজটি রিফ্রেশ করুন।', true)
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
      if (!window.confirm(`${parsed.questions.length}টি সংক্ষিপ্ত প্রশ্ন যোগ করবেন?`)) return

      startButton.disabled = true
      const grade = Number(gradeSelect.value)
      const subject = subjectSelect.value
      const params = new URLSearchParams({ grade: String(grade), subject })
      const payloads = parsed.questions.map((question) => ({
        ...question,
        id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'short',
        chapter,
        grade,
        subject,
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
          for (const [index, payload] of payloads.slice().reverse().entries()) {
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
          storedQuestions.unshift(...payloads)
          localStorage.setItem(storageKey, JSON.stringify(storedQuestions))
        }

        setStatus(`${payloads.length}টি সংক্ষিপ্ত প্রশ্ন যোগ হয়েছে। তালিকা আপডেট হচ্ছে…`)
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
