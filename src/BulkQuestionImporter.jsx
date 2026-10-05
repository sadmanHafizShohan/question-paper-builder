import { useState } from 'react'
import { Check, Download, FileSpreadsheet, Upload, X } from 'lucide-react'
import { downloadQuestionTemplate, parseQuestionWorkbook } from './questionImport.js'
import authenticatedFetch from './authenticatedFetch.js'
import LoadingStatus from './LoadingStatus.jsx'

const concurrency = 4
const questionTypeLabels = { mcq: 'MCQ', short: 'সংক্ষিপ্ত', cq: 'সৃজনশীল', long: 'বর্ণনামূলক' }

function responseError(result, status) {
  return result && typeof result.error === 'string' ? result.error : `সার্ভার থেকে HTTP ${status} ত্রুটি এসেছে।`
}

export default function BulkQuestionImporter({ apiUrl, grade, subject, isAdmin, onImported, onNotice, onClose }) {
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState('')
  const [isReading, setIsReading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)
  const [progress, setProgress] = useState(0)

  async function selectFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setRows([])
    setFileName(file.name)
    setParseError('')
    setIsReading(true)
    try {
      setRows(await parseQuestionWorkbook(file))
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Excel ফাইলটি পড়া যায়নি।')
    } finally {
      setIsReading(false)
    }
  }

  async function saveQuestions() {
    const validRows = rows.filter((row) => row.question && row.errors.length === 0)
    if (validRows.length === 0 || isImporting) return

    setIsImporting(true)
    setProgress(0)
    if (!isAdmin) {
      const importedQuestions = validRows.map((row) => ({
        ...row.question,
        id: `local-${crypto.randomUUID()}`,
        isLocal: true,
        subject,
        grade,
      }))
      if (onImported(importedQuestions) === false) {
        setIsImporting(false)
        return
      }
      setProgress(validRows.length)
      setRows((current) => current.filter((row) => row.errors.length > 0))
      setIsImporting(false)
      onNotice(`${importedQuestions.length}টি প্রশ্ন এই ডিভাইসে ইমপোর্ট হয়েছে; MongoDB-তে নয়।`)
      onClose()
      return
    }

    const savedQuestions = []
    const failedRows = new Map()
    let completed = 0
    try {
      for (let index = 0; index < validRows.length; index += concurrency) {
        const batch = validRows.slice(index, index + concurrency)
        const results = await Promise.all(batch.map(async (row) => {
          try {
            const response = await authenticatedFetch(`${apiUrl}/questions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...row.question, subject, grade }),
            })
            let result = null
            try {
              result = await response.json()
            } catch {
              if (response.ok) throw new Error('সার্ভার থেকে সংরক্ষিত প্রশ্নের তথ্য পাওয়া যায়নি।')
            }
            if (!response.ok) throw new Error(responseError(result, response.status))
            return {
              rowNumber: row.rowNumber,
              question: { ...row.question, ...result, id: result._id ?? result.id },
            }
          } catch (error) {
            return {
              rowNumber: row.rowNumber,
              error: error instanceof Error ? error.message : 'প্রশ্নটি সংরক্ষণ করা যায়নি।',
            }
          }
        }))

        results.forEach((result) => {
          if (result.question) savedQuestions.push(result.question)
          else failedRows.set(result.rowNumber, result.error)
        })
        completed += batch.length
        setProgress(completed)
      }
    } finally {
      setIsImporting(false)
    }

    const successfulRowNumbers = new Set(validRows
      .filter((row) => !failedRows.has(row.rowNumber))
      .map((row) => row.rowNumber))
    const remainingCount = rows.length - successfulRowNumbers.size

    if (onImported(savedQuestions) === false) {
      setRows((current) => current.map((row) => validRows.some((validRow) => validRow.rowNumber === row.rowNumber)
        ? { ...row, saveError: 'এই ডিভাইসে প্রশ্ন সংরক্ষণ করা যায়নি।' }
        : row))
      return
    }
    setRows((current) => current
      .filter((row) => !successfulRowNumbers.has(row.rowNumber))
      .map((row) => failedRows.has(row.rowNumber)
        ? { ...row, saveError: failedRows.get(row.rowNumber) }
        : row))
    if (remainingCount === 0) {
      onNotice(`${savedQuestions.length}টি প্রশ্ন সফলভাবে ইমপোর্ট হয়েছে।`)
      onClose()
      return
    }
    onNotice(`${savedQuestions.length}টি প্রশ্ন ইমপোর্ট হয়েছে; ${remainingCount}টি সারি এখনো ইমপোর্ট হয়নি।`)
  }

  async function saveTemplate() {
    setIsDownloadingTemplate(true)
    setParseError('')
    try {
      await downloadQuestionTemplate()
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'টেমপ্লেট তৈরি করা যায়নি।')
    } finally {
      setIsDownloadingTemplate(false)
    }
  }

  const validCount = rows.filter((row) => row.question && row.errors.length === 0).length
  const invalidCount = rows.filter((row) => row.errors.length > 0 || row.saveError).length

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isImporting) onClose() }}>
      <section className="question-modal bulk-import-modal" role="dialog" aria-modal="true" aria-labelledby="bulk-import-title">
        <header className="modal-heading">
          <div><span className="modal-icon"><FileSpreadsheet size={18} /></span><div><h2 id="bulk-import-title">Excel থেকে প্রশ্ন ইমপোর্ট</h2><p>MCQ, সংক্ষিপ্ত, সৃজনশীল ও বর্ণনামূলক প্রশ্ন</p></div></div>
          <button type="button" className="icon-button" aria-label="ইমপোর্ট বন্ধ করুন" disabled={isImporting} onClick={onClose}><X size={17} /></button>
        </header>
        <div className="bulk-import-content">
          <div className="bulk-import-help">
            <p>টেমপ্লেট ডাউনলোড করে প্রশ্ন পূরণ করুন। Excel .xlsx ফাইলের প্রথম worksheet পড়া হবে; সর্বোচ্চ ৫০০টি প্রশ্ন ও ১০ MB পর্যন্ত ফাইল সমর্থিত।</p>
            <button type="button" className="quiet-button" disabled={isDownloadingTemplate || isImporting} onClick={saveTemplate}>
              {isDownloadingTemplate ? <span className="loading-spinner loading-spinner-button" aria-hidden="true" /> : <Download size={15} />}
              {isDownloadingTemplate ? 'টেমপ্লেট তৈরি হচ্ছে…' : 'টেমপ্লেট ডাউনলোড'}
            </button>
          </div>
          <label className="bulk-file-picker">
            <Upload size={18} />
            <strong>{fileName || 'Excel ফাইল বেছে নিন'}</strong>
            <span>.xlsx · সর্বোচ্চ ১০ MB</span>
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={selectFile} disabled={isReading || isImporting || isDownloadingTemplate} />
          </label>
          {isAdmin
            ? <p className="bulk-import-status">Admin হিসেবে ইমপোর্ট করলে প্রশ্নগুলো main MongoDB-তে সংরক্ষিত হবে।</p>
            : <p className="bulk-import-status">এই account-এর ইমপোর্ট করা প্রশ্ন শুধু এই ডিভাইসেই সংরক্ষিত হবে; main database অপরিবর্তিত থাকবে।</p>}
          {isReading && <LoadingStatus compact label="Excel ফাইল পড়া হচ্ছে…" detail="প্রশ্নগুলো যাচাই ও প্রস্তুত করা হচ্ছে" />}
          {parseError && <p className="bulk-import-error" role="alert">{parseError}</p>}
          {rows.length > 0 && <>
            <div className="bulk-import-summary">
              <strong>{validCount}টি ইমপোর্টের জন্য প্রস্তুত</strong>
              <span>{invalidCount}টি সারিতে সমস্যা</span>
            </div>
            <div className="bulk-import-preview" aria-live="polite">
              {rows.map((row) => (
                <div className={`bulk-preview-row ${row.errors.length || row.saveError ? 'has-error' : ''}`} key={row.rowNumber}>
                  <span>সারি {row.rowNumber}</span>
                  <strong>{row.question?.prompt || 'প্রশ্নের বিবরণ নেই'}</strong>
                  <small>{row.errors.length ? row.errors.join(' ') : row.saveError || `${questionTypeLabels[row.question.type]} · ${row.question.marks} নম্বর`}</small>
                </div>
              ))}
            </div>
          </>}
          {isImporting && <LoadingStatus
            compact
            label={`সংরক্ষণ হচ্ছে: ${progress.toLocaleString('bn-BD')} / ${validCount.toLocaleString('bn-BD')}টি`}
            detail={isAdmin ? 'প্রশ্নগুলো MongoDB-তে পাঠানো হচ্ছে' : 'প্রশ্নগুলো এই device-এ সংরক্ষণ করা হচ্ছে'}
            progress={validCount ? (progress / validCount) * 100 : 0}
          />}
        </div>
        <footer className="modal-footer">
          <button type="button" className="quiet-button" disabled={isImporting} onClick={onClose}>বাতিল</button>
          <button type="button" className="primary-button" disabled={validCount === 0 || isImporting || isReading || isDownloadingTemplate} onClick={saveQuestions}>
            {isImporting ? <span className="loading-spinner loading-spinner-button" aria-hidden="true" /> : <Check size={16} />}
            {isImporting ? 'সংরক্ষণ হচ্ছে…' : ` ${validCount}টি প্রশ্ন ইমপোর্ট করুন`}
          </button>
        </footer>
      </section>
    </div>
  )
}
