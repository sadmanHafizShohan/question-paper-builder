const maximumFileSize = 10 * 1024 * 1024
const maximumQuestionRows = 2000
const builtInFigures = new Set(['triangle', 'circle', 'rectangle'])
const optionAliases = [
  ['optiona', 'option1', 'optionক', 'অপশনক', 'বিকল্পক', 'কঅপশন', 'কবিকল্প', 'ক'],
  ['optionb', 'option2', 'optionখ', 'অপশনখ', 'বিকল্পখ', 'খঅপশন', 'খবিকল্প', 'খ'],
  ['optionc', 'option3', 'optionগ', 'অপশনগ', 'বিকল্পগ', 'গঅপশন', 'গবিকল্প', 'গ'],
  ['optiond', 'option4', 'optionঘ', 'অপশনঘ', 'বিকল্পঘ', 'ঘঅপশন', 'ঘবিকল্প', 'ঘ'],
]
const statementAliases = [
  ['statementi', 'statement1', 'বিবৃতিi', 'বিবৃতি১', 'বিবৃতি1', 'i'],
  ['statementii', 'statement2', 'বিবৃতিii', 'বিবৃতি২', 'বিবৃতি2', 'ii'],
  ['statementiii', 'statement3', 'বিবৃতিiii', 'বিবৃতি৩', 'বিবৃতি3', 'iii'],
]
const headerAliases = {
  type: ['type', 'ধরন', 'প্রশ্নেরধরন', 'প্রশ্নধরন'],
  chapter: ['chapter', 'অধ্যায়', 'অধ্যায়'],
  prompt: ['prompt', 'question', 'questiontext', 'প্রশ্ন', 'প্রশ্নেরবিবরণ', 'প্রশ্নবিবরণ'],
  marks: ['marks', 'mark', 'নম্বর', 'মান'],
  answer: ['answer', 'উত্তর', 'সঠিকউত্তর'],
  statementQuestion: ['statementquestion', 'statementinstruction', 'বিবৃতিরনির্দেশনা', 'বিবৃতিপরেনির্দেশনা'],
  figure: ['figure', 'image', 'চিত্র', 'ছবি'],
  equation: ['equation', 'সূত্র', 'সমীকরণ', 'গাণিতিকরাশি'],
  answerEquation: ['answerequation', 'উত্তরেরসূত্র', 'উত্তরেরসমীকরণ'],
}

const normalizeHeader = (value) => String(value ?? '')
  .normalize('NFKC')
  .toLocaleLowerCase()
  .replace(/[\s_.:/\-()[\]]/g, '')
  .replace(/ঃ|：/g, '')

function cellText(cell) {
  if (cell === null || cell === undefined) return ''
  return String(cell).trim()
}

function normalizeDigits(value) {
  return value.replace(/[০-৯]/g, (digit) => String('০১২৩৪৫৬৭৮৯'.indexOf(digit)))
}

function getColumnMap(headers) {
  const aliases = new Map()
  Object.entries(headerAliases).forEach(([field, names]) => {
    names.forEach((name) => aliases.set(normalizeHeader(name), field))
  })
  optionAliases.forEach((names, index) => {
    names.forEach((name) => aliases.set(normalizeHeader(name), `option${index}`))
  })
  statementAliases.forEach((names, index) => {
    names.forEach((name) => aliases.set(normalizeHeader(name), `statement${index}`))
  })

  const columns = new Map()
  headers.forEach((header, columnIndex) => {
    const field = aliases.get(normalizeHeader(header))
    if (field && !columns.has(field)) columns.set(field, columnIndex)
  })
  return columns
}

function validFigure(value) {
  if (!value || builtInFigures.has(value.toLowerCase())) return true
  if (value.length > 2048) return false
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

function normalizeQuestionType(value) {
  const type = value.trim().toLocaleLowerCase()
  const aliases = {
    mcq: 'mcq',
    বহুনির্বাচনি: 'mcq',
    বহুনির্বাচনী: 'mcq',
    'বহুনির্বাচনি প্রশ্ন': 'mcq',
    short: 'short',
    সংক্ষিপ্ত: 'short',
    'সংক্ষিপ্ত প্রশ্ন': 'short',
    cq: 'cq',
    creative: 'cq',
    সৃজনশীল: 'cq',
    'সৃজনশীল প্রশ্ন': 'cq',
    long: 'long',
    descriptive: 'long',
    বর্ণনামূলক: 'long',
    'বর্ণনামূলক প্রশ্ন': 'long',
    passage: 'passage',
    'reading text': 'passage',
    true_false: 'true_false',
    'true/false': 'true_false',
    fill_in_the_blanks: 'fill_in_the_blanks',
    'fill in the blanks': 'fill_in_the_blanks',
    matching: 'matching',
    rearrange: 'rearrange',
    table_completion: 'table_completion',
    'table completion': 'table_completion',
    synonym_antonym: 'synonym_antonym',
    'synonym/antonym': 'synonym_antonym',
  }
  return aliases[type] ?? ''
}

function answerForOptions(answer, options) {
  const normalizedAnswer = normalizeDigits(answer).toLocaleLowerCase()
    .replace(/[\s()[\].:]/g, '')
    .replace(/ঃ/g, '')
  const answerLabels = [
    ['a', 'ক', 'optiona', 'option1', '1'],
    ['b', 'খ', 'optionb', 'option2', '2'],
    ['c', 'গ', 'optionc', 'option3', '3'],
    ['d', 'ঘ', 'optiond', 'option4', '4'],
  ]
  const matchingLabel = answerLabels.findIndex((labels) => labels.includes(normalizedAnswer))
  if (matchingLabel >= 0) return options[matchingLabel]
  return options.find((option) => option.trim().toLocaleLowerCase() === answer.trim().toLocaleLowerCase()) ?? null
}

function rowValue(row, columns, field) {
  const column = columns.get(field)
  return column === undefined ? '' : cellText(row[column])
}

function parseQuestionRow(row, columns) {
  const value = (field) => rowValue(row, columns, field)
  const type = normalizeQuestionType(value('type'))
  const prompt = value('prompt')
  const marksText = normalizeDigits(value('marks')).replace(/,/g, '')
  const marks = Number(marksText)
  const chapter = value('chapter')
  const answer = value('answer')
  const figureValue = value('figure')
  const figure = builtInFigures.has(figureValue.toLowerCase()) ? figureValue.toLowerCase() : figureValue
  const statements = statementAliases.map((_, index) => value(`statement${index}`))
  const options = optionAliases.map((_, index) => value(`option${index}`))
  const statementQuestion = value('statementQuestion')
  const errors = []

  if (!type) errors.push('ধরন দিন: mcq, short, cq অথবা long।')
  if (!prompt) errors.push('প্রশ্নের বিবরণ ফাঁকা রাখা যাবে না।')
  if (type !== 'passage' && (!Number.isInteger(marks) || marks < 1 || marks > 100)) errors.push('নম্বর ১ থেকে ১০০-এর মধ্যে পূর্ণসংখ্যা হতে হবে।')
  if (type === 'passage' && (!Number.isInteger(marks) || marks < 0 || marks > 100)) errors.push('প্যাসেজের নম্বর ০ থেকে ১০০-এর মধ্যে পূর্ণসংখ্যা হতে হবে।')
  if (!validFigure(figure)) errors.push('চিত্রে triangle/circle/rectangle অথবা সঠিক HTTP(S) ছবির লিংক দিন।')

  let resolvedOptions = []
  let resolvedStatements = []
  let resolvedAnswer = answer
  if (type === 'mcq') {
    const providedStatements = statements.filter(Boolean)
    if (providedStatements.length > 0 && providedStatements.length !== 3) {
      errors.push('বিবৃতিভিত্তিক MCQ-তে statement_i, statement_ii ও statement_iii—তিনটিই দিতে হবে।')
    } else if (providedStatements.length === 3) {
      if (!statementQuestion) errors.push('বিবৃতিভিত্তিক MCQ-তে statement_question দিন।')
      resolvedStatements = statements
      resolvedOptions = ['i ও iii', 'i ও ii', 'ii ও iii', 'i, ii ও iii']
    } else {
      resolvedOptions = options
      if (resolvedOptions.some((option) => !option)) errors.push('MCQ-র option_a, option_b, option_c ও option_d—চারটিই দিতে হবে।')
    }
    if (answer) {
      const selectedAnswer = answerForOptions(answer, resolvedOptions)
      if (selectedAnswer === null) errors.push('MCQ উত্তর option-এর লেখা অথবা A/B/C/D (ক/খ/গ/ঘ) হিসেবে দিন।')
      else resolvedAnswer = selectedAnswer
    }
  }

  if (errors.length > 0) return { errors }
  return {
    errors,
    question: {
      type,
      chapter,
      prompt,
      marks,
      answer: resolvedAnswer,
      options: type === 'mcq' ? resolvedOptions : [],
      statements: resolvedStatements,
      statementQuestion: resolvedStatements.length ? statementQuestion : '',
      figure,
      equation: value('equation'),
      answerEquation: value('answerEquation'),
      inlineEquations: [],
      optionEquations: [],
      optionInlineEquations: [],
      inlineAnswerEquations: [],
    },
  }
}

export async function parseQuestionWorkbook(file) {
  if (file.size > maximumFileSize) throw new Error('ফাইলের আকার সর্বোচ্চ ১০ MB হতে পারবে।')
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Excel-এর .xlsx ফাইল নির্বাচন করুন।')

  const { default: XLSX } = await import('./excelWorkbook.js')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) throw new Error('Excel ফাইলে কোনো worksheet পাওয়া যায়নি।')
  const worksheet = workbook.Sheets[firstSheetName]
  const range = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : null
  if (!range) throw new Error('Excel worksheet-এ কোনো তথ্য পাওয়া যায়নি।')
  if (range.e.r > maximumQuestionRows || range.e.c > 100) throw new Error('Excel worksheet-এ অতিরিক্ত সারি বা কলাম রয়েছে।')

  const sheetRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false })
  const columns = getColumnMap(sheetRows[0] ?? [])
  const missingColumns = ['type', 'prompt', 'marks'].filter((field) => !columns.has(field))
  if (missingColumns.length > 0) {
    throw new Error('প্রথম সারিতে type, prompt ও marks কলাম থাকতে হবে। টেমপ্লেট ডাউনলোড করে ব্যবহার করুন।')
  }

  const rows = []
  sheetRows.slice(1).forEach((row, index) => {
    const hasValues = [...columns.values()].some((column) => cellText(row[column]))
    if (!hasValues) return
    if (rows.length >= maximumQuestionRows) throw new Error('একবারে সর্বোচ্চ ২০০০টি প্রশ্ন ইমপোর্ট করা যাবে।')
    rows.push({ rowNumber: index + 2, ...parseQuestionRow(row, columns) })
  })
  if (rows.length === 0) throw new Error('টেমপ্লেটের শিরোনাম সারির পরে কোনো প্রশ্ন পাওয়া যায়নি।')
  return rows
}

export async function downloadQuestionTemplate() {
  const { default: XLSX } = await import('./excelWorkbook.js')
  const workbook = XLSX.utils.book_new()
  workbook.Props = { Author: 'প্রশ্নঘর', Title: 'Excel প্রশ্ন ইমপোর্ট টেমপ্লেট' }
  const questions = XLSX.utils.aoa_to_sheet([
    ['type', 'chapter', 'prompt', 'marks', 'answer', 'option_a', 'option_b', 'option_c', 'option_d', 'statement_i', 'statement_ii', 'statement_iii', 'statement_question', 'figure', 'equation', 'answer_equation'],
    ['mcq', 'অধ্যায় ১', '২ + ২ = কত?', 1, 'B', '৩', '৪', '৫', '৬'],
    ['mcq', 'অধ্যায় ১', 'নিচের কোন বিবৃতিগুলো সঠিক?', 1, 'D', '', '', '', '', 'প্রথম বিবৃতি', 'দ্বিতীয় বিবৃতি', 'তৃতীয় বিবৃতি', 'নিচের কোনটি সঠিক?'],
    ['short', 'অধ্যায় ২', 'একটি সংক্ষিপ্ত প্রশ্ন লিখুন।', 2, 'ঐচ্ছিক উত্তর'],
    ['cq', 'অধ্যায় ৩', 'উদ্দীপক: এখানে উদ্দীপক লিখুন।\nক. প্রথম উপপ্রশ্ন\nখ. দ্বিতীয় উপপ্রশ্ন', 10, 'ক. উত্তর\nখ. উত্তর'],
    ['long', 'অধ্যায় ৪', 'একটি বর্ণনামূলক প্রশ্ন লিখুন।', 5, 'ঐচ্ছিক উত্তর'],
  ])
  XLSX.utils.book_append_sheet(workbook, questions, 'Questions')

  const instructions = XLSX.utils.aoa_to_sheet([
    ['Excel প্রশ্ন ইমপোর্ট টেমপ্লেট'],
    ['Questions শিটের প্রথম সারির শিরোনাম অপরিবর্তিত রাখুন। উদাহরণ সারিগুলো মুছে নিজের প্রশ্ন লিখুন।'],
    ['type: mcq, short, cq অথবা long। প্রতিটি প্রশ্নে prompt এবং ১–১০০-এর পূর্ণসংখ্যা marks আবশ্যক।'],
    ['সাধারণ MCQ-তে option_a থেকে option_d পূরণ করুন। answer-এ A/B/C/D, ক/খ/গ/ঘ অথবা অপশনের সম্পূর্ণ লেখা দিন।'],
    ['বিবৃতিভিত্তিক MCQ-তে statement_i, statement_ii, statement_iii ও statement_question পূরণ করুন; answer A/B/C/D হতে পারে।'],
    ['chapter, answer, figure, equation ও answer_equation ঐচ্ছিক। figure-এ triangle/circle/rectangle অথবা HTTP(S) ছবির URL দিন।'],
    ['একবারে সর্বোচ্চ ২০০০টি প্রশ্ন (.xlsx, সর্বোচ্চ ১০ MB) ইমপোর্ট করা যাবে।'],
  ])
  XLSX.utils.book_append_sheet(workbook, instructions, 'নির্দেশনা')

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'question-ghor-import-template.xlsx'
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadEnglishQuestionTemplate() {
  const { default: XLSX } = await import('./excelWorkbook.js')
  const workbook = XLSX.utils.book_new()
  workbook.Props = { Author: 'প্রশ্নঘর', Title: 'English Question Import Template' }
  const questions = XLSX.utils.aoa_to_sheet([
    ['type', 'chapter', 'prompt', 'marks', 'answer', 'option_a', 'option_b', 'option_c', 'option_d', 'statement_i', 'statement_ii', 'statement_iii', 'statement_question', 'figure', 'equation', 'answer_equation'],
    ['passage', 'Unit 1', 'Read the text and answer the questions:\nBulbul collects rubbish from the Sankar area in Dhaka...', 0, ''],
    ['mcq', 'Unit 1', 'What time does Bulbul wake up every morning?', 1, '5 o\'clock', '4 o\'clock', '5 o\'clock', '6 o\'clock', '7 o\'clock'],
    ['short', 'Unit 1', 'Why does Bulbul wake up early in the morning?', 2, 'To collect rubbish from the Sankar area.'],
    ['true_false', 'Unit 1', 'Bulbul was sick for two days.', 1, 'True'],
    ['fill_in_the_blanks', 'Unit 1', 'Good health means proper functioning of body organs and feeling _____.', 1, 'well'],
    ['synonym_antonym', 'Unit 1', 'Wealth (Synonym)', 1, 'riches'],
    ['matching', 'Unit 1', 'Match the parts of sentences from Columns A and B.', 5, 'a+ii, b+iii, c+iv, d+i'],
    ['rearrange', 'Unit 1', 'Put the following parts of the story in the correct order:\na) He lost his father in his childhood.\nb) Nazrul Islam was born on the 20th May 1899.', 8, 'b, a'],
    ['long', 'Unit 1', 'Write a paragraph on "Your First Day at School".', 10, ''],
  ])
  XLSX.utils.book_append_sheet(workbook, questions, 'Questions')

  const instructions = XLSX.utils.aoa_to_sheet([
    ['English Question Import Template'],
    ['Keep the header row unchanged. Delete the example rows and add your own questions.'],
    ['types: passage, mcq, short, true_false, fill_in_the_blanks, matching, rearrange, table_completion, synonym_antonym, long.'],
    ['For "passage", the text goes in the "prompt" column. Give it 0 marks.'],
    ['IMPORTANT: Group questions that belong together under the same "chapter" (e.g. Unit 1). They will be printed together sequentially in the final paper under that chapter.'],
    ['You can import up to 2000 questions (.xlsx, max 10 MB) at once.'],
  ])
  XLSX.utils.book_append_sheet(workbook, instructions, 'Instructions')

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'english-question-import-template.xlsx'
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
