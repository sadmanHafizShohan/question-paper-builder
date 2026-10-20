import { Fragment, useEffect, useRef, useState } from 'react'
import {
  bengaliNumber,
  builtInFigures,
  equationMarker,
  isHttpImageUrl,
  isMathExpression,
  mathTokenPattern,
} from './questionFormatting.js'
import { optionLabelsFor, statementLabels, typeLabel } from './questionTypes.js'

function normalizeMathValue(value = '') {
  const text = String(value ?? '').trim()
  if (!text) return ''

  const withoutMarkers = text
    .replace(/^\$\$([\s\S]*?)\$\$$/, '$1')
    .replace(/^\$([^$]+)\$$/, '$1')
    .replace(/^\\\(([\s\S]*)\\\)$/, '$1')
    .replace(/^\\\[([\s\S]*)\\\]$/, '$1')
    .replace(/^\\\s*/, '')
    .trim()

  if (!withoutMarkers) return ''

  const leadingCommandPattern = /^(frac|sqrt|sin|cos|tan|log|ln|csc|sec|cot|sum|prod|int|lim|dfrac|tfrac|binom|left|right|cdot|times|div|pm|mp|theta|alpha|beta|gamma|delta|pi|omega|root)/i
  if (leadingCommandPattern.test(withoutMarkers)) {
    return withoutMarkers.startsWith('\\') ? withoutMarkers : `\\${withoutMarkers}`
  }

  return withoutMarkers
}

export function QuestionPrompt({ prompt, equation, inlineEquations = [] }) {
  const sourceText = prompt ?? ''
  const mathTokens = sourceText.split(mathTokenPattern)
  const hasEquationMarker = sourceText.includes(equationMarker)

  return (
    <Fragment>
      {mathTokens.map((token, index) => {
        if (!token) return null

        if (token === equationMarker) {
          const currentEquationIndex = mathTokens.slice(0, index).filter((previousToken) => previousToken === equationMarker).length
          const resolvedEquation = inlineEquations[currentEquationIndex] ?? equation ?? ''
          return resolvedEquation ? <MathFormula key={`${index}-${currentEquationIndex}`} display value={normalizeMathValue(resolvedEquation)} /> : null
        }

        if (token.startsWith('$$') && token.endsWith('$$')) {
          return <MathFormula key={`${index}-raw-double`} display displayMode value={normalizeMathValue(token.slice(2, -2))} />
        }

        if (token.startsWith('\\[') && token.endsWith('\\]')) {
          return <MathFormula key={`${index}-raw-bracket`} display displayMode value={normalizeMathValue(token)} />
        }

        if (token.startsWith('$') && token.endsWith('$')) {
          return <MathFormula key={`${index}-raw-single`} display value={normalizeMathValue(token)} />
        }

        if (token.startsWith('\\(') && token.endsWith('\\)')) {
          return <MathFormula key={`${index}-raw-paren`} display value={normalizeMathValue(token)} />
        }

        if (token.startsWith('\\')) {
          return <MathFormula key={`${index}-raw-latex`} display value={normalizeMathValue(token)} />
        }

        return <Fragment key={`${index}-text`}>{token}</Fragment>
      })}
      {equation && !hasEquationMarker && <MathFormula display displayMode value={normalizeMathValue(equation)} />}
    </Fragment>
  )
}

export function QuestionBankPreview({ id, question, subject, number }) {
  const answer = question.answer ?? ''
  const questionNumber = subject.startsWith('english-') ? String(number) : bengaliNumber(number)

  return (
    <div id={id} className="bank-question-preview">
      <article className="bank-question-preview-paper">
        <header className="bank-question-preview-meta">
          <span>{typeLabel(question.type, subject)}</span>
          <span>{bengaliNumber(question.marks)} নম্বর</span>
        </header>
        <div className="bank-question-preview-prompt">
          <span className="bank-question-preview-number">{questionNumber}.</span>
          <div><QuestionPrompt prompt={question.prompt} equation={question.equation} inlineEquations={question.inlineEquations} /></div>
        </div>
        {question.figure && <QuestionFigure figure={question.figure} />}
        {question.type === 'mcq' && question.statements?.length > 0 && (
          <div className="paper-statement-body">
            <div className="paper-statements">
              {question.statements.map((statement, index) => (
                <div key={`${question.id}-preview-statement-${index}`}>
                  <span>{statementLabels[index] ?? bengaliNumber(index + 1)}.</span>
                  <span className="paper-statement-copy"><QuestionPrompt prompt={statement} /></span>
                </div>
              ))}
            </div>
            {question.statementQuestion && <div className="paper-statement-question"><QuestionPrompt prompt={question.statementQuestion} /></div>}
          </div>
        )}
        {question.type === 'mcq' && (
          <div className={`paper-options ${question.statements?.length ? 'paper-options-statements' : ''}`}>
            {(question.options ?? []).map((option, index) => {
              const optionText = option ?? ''
              const label = optionLabelsFor(subject)[index] ?? bengaliNumber(index + 1)
              const isMathOption = subject === 'math' && isMathExpression(optionText) && !optionText.includes(equationMarker) && !optionText.includes('$') && !optionText.includes('\\')
              return (
                <div className="paper-option" key={`${question.id}-preview-option-${index}`}>
                  <span className="paper-option-label option-label-period">{`${label}.`}</span>
                  {optionText && (isMathOption
                    ? <MathFormula display value={optionText} />
                    : <QuestionPrompt prompt={optionText} equation={question.optionEquations?.[index]} inlineEquations={question.optionInlineEquations?.[index]} />)}
                </div>
              )
            })}
          </div>
        )}
      </article>
      <section className={`bank-question-preview-answer${answer || question.answerEquation ? '' : ' is-missing'}`} aria-label="প্রশ্নের উত্তর">
        <strong>উত্তর</strong>
        {answer || question.answerEquation
          ? <div>
              {answer && (question.type === 'cq'
                ? <CreativeQuestionAnswer answer={answer} inlineEquations={question.inlineAnswerEquations} />
                : <QuestionPrompt
                    prompt={answer}
                    equation={question.type === 'short' && answer.split(equationMarker).length === 2 ? question.answerEquation : ''}
                    inlineEquations={question.inlineAnswerEquations}
                  />)}
              {question.answerEquation && !(question.type === 'short' && answer.split(equationMarker).length === 2) && <MathFormula display value={question.answerEquation} />}
            </div>
          : <span>এই প্রশ্নের উত্তর সংরক্ষিত নেই</span>}
      </section>
    </div>
  )
}

export function CreativeQuestionPrompt({ question, number, isEnglish }) {
  const lines = question.prompt.split(/\r?\n/)
  const localNumber = (value) => isEnglish ? String(value) : bengaliNumber(value)
  const marksText = (marks) => isEnglish ? `(${marks} marks)` : `(${bengaliNumber(marks)} নম্বর)`

  return (
    <div className="paper-cq-prompt">
      <span>{localNumber(number)}.</span>
      <div>
        {lines.map((line, index) => {
          const equationCount = line.split(equationMarker).length - 1
          const equationIndex = lines.slice(0, index).reduce((count, previousLine) => count + previousLine.split(equationMarker).length - 1, 0)
          const inlineEquations = question.inlineEquations?.slice(equationIndex, equationIndex + equationCount) ?? []
          return (
            <div className="paper-cq-prompt-line" key={index}>
              <QuestionPrompt prompt={line} equation={index === 0 ? question.equation : ''} inlineEquations={inlineEquations} />
              {index === 0 && <small>{marksText(question.marks)}</small>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function CreativeQuestionAnswer({ answer, inlineEquations = [] }) {
  const parts = answer.split(/(?=\([কখগঘa-d]\)\s*)/).filter((part) => part.trim())
  return (
    <div className="paper-cq-answer">
      {parts.map((part, index) => {
        const equationIndex = parts.slice(0, index).reduce((count, previousPart) => count + previousPart.split(equationMarker).length - 1, 0)
        const equationCount = part.split(equationMarker).length - 1
        return (
          <div className="paper-cq-answer-part" key={index}>
            <QuestionPrompt prompt={part.trim()} inlineEquations={inlineEquations.slice(equationIndex, equationIndex + equationCount)} />
          </div>
        )
      })}
    </div>
  )
}

export function QuestionFigure({ figure }) {
  if (!figure) return null
  if (!builtInFigures.includes(figure)) {
    return isHttpImageUrl(figure) ? <ImageFigure key={figure} src={figure} /> : null
  }
  const shared = { fill: 'none', stroke: 'currentColor', strokeWidth: 2 }
  return (
    <figure className={`question-figure figure-${figure}`}>
      <svg viewBox="0 0 180 120" role="img" aria-label={`${figure === 'triangle' ? 'ত্রিভুজ' : figure === 'circle' ? 'বৃত্ত' : 'আয়তক্ষেত্র'} চিত্র`}>
        {figure === 'triangle' && <><path d="M90 14 20 104h140L90 14Z" {...shared} /><text x="84" y="12">A</text><text x="8" y="116">B</text><text x="161" y="116">C</text><text x="35" y="65">৫</text><text x="132" y="65">৪</text><text x="83" y="114">৩ সেমি</text></>}
        {figure === 'circle' && <><circle cx="82" cy="60" r="43" {...shared} /><circle cx="82" cy="60" r="2.5" fill="currentColor" /><path d="M82 60h43" {...shared} /><text x="72" y="55">O</text><text x="99" y="52">৭ সেমি</text></>}
        {figure === 'rectangle' && <><rect x="27" y="22" width="126" height="76" {...shared} /><text x="75" y="17">৮ সেমি</text><text x="156" y="64">৫ সেমি</text></>}
      </svg>
    </figure>
  )
}

function ImageFigure({ src }) {
  const [loadFailed, setLoadFailed] = useState(false)
  return (
    <figure className="question-figure question-figure-image">
      {loadFailed
        ? <figcaption role="alert">ছবিটি লোড হয়নি। ImageBB থেকে সরাসরি image link (i.ibb.co/...) কপি করে দিন। <a href={src} target="_blank" rel="noreferrer">লিংক খুলুন</a></figcaption>
        : <img src={src} alt="প্রশ্নের চিত্র" referrerPolicy="no-referrer" onError={() => setLoadFailed(true)} />}
    </figure>
  )
}

export function MathFormula({ value, onChange, placeholder, compact = false, display = false, displayMode = false }) {
  const safeValue = normalizeMathValue(value)
  const mathfieldRef = useRef(null)
  const valueRef = useRef(safeValue)
  const onChangeRef = useRef(onChange)
  const [mathLiveReady, setMathLiveReady] = useState(() => Boolean(customElements.get('math-field')))

  useEffect(() => {
    valueRef.current = safeValue
  }, [safeValue])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (display) return undefined
    let active = true
    let removeInputListener = () => {}
    import('mathlive').then(() => {
      if (!active) return
      setMathLiveReady(true)
      const mathfield = mathfieldRef.current
      if (!mathfield) return
      mathfield.value = valueRef.current ?? ''
      if (display) mathfield.readOnly = true
      if (onChangeRef.current) {
        const handleInput = () => onChangeRef.current?.(mathfield.value)
        mathfield.addEventListener('input', handleInput)
        removeInputListener = () => mathfield.removeEventListener('input', handleInput)
      }
    }).catch(() => setMathLiveReady(false))
    return () => {
      active = false
      removeInputListener()
    }
  }, [display, mathLiveReady])

  useEffect(() => {
    const mathfield = mathfieldRef.current
    if (mathfield && customElements.get('math-field') && mathfield.value !== safeValue) {
      mathfield.value = safeValue
    }
  }, [safeValue])

  if (display) return safeValue ? <StaticMathFormula value={safeValue} displayMode={displayMode} /> : null
  if (!mathLiveReady) return <input className={`math-field math-field-fallback ${compact ? 'math-field-compact' : ''}`} aria-label="গাণিতিক রাশি লিখুন" value={safeValue} onChange={(event) => onChangeRef.current?.(event.target.value)} placeholder={placeholder} />
  return (
    <math-field
      ref={mathfieldRef}
      className={`math-field ${compact ? 'math-field-compact' : ''} ${display ? 'math-field-display' : ''}`}
      aria-label={display ? 'গাণিতিক রাশি' : 'গাণিতিক রাশি লিখুন'}
      placeholder={placeholder}
      virtual-keyboard-mode={display ? 'manual' : 'onfocus'}
    />
  )
}

function StaticMathFormula({ value, displayMode = false }) {
  const [markup, setMarkup] = useState('')

  useEffect(() => {
    let active = true
    import('mathlive').then(({ convertLatexToMarkup }) => {
      const latex = displayMode ? `\\displaystyle ${value}` : value
      if (active) setMarkup(convertLatexToMarkup(latex, { defaultMode: 'math' }))
    }).catch(() => setMarkup(''))
    return () => { active = false }
  }, [value, displayMode])

  if (!markup) return <span className={`math-fallback-display ${displayMode ? 'math-static-display-block' : ''}`}>{value}</span>
  return <span className={`math-static-display ${displayMode ? 'math-static-display-block' : ''}`} dangerouslySetInnerHTML={{ __html: markup }} />
}
