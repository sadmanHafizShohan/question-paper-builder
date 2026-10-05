import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import mongoose from 'mongoose'
import process from 'node:process'
import { PaperSettings, Question } from './models.js'

dotenv.config()

const useApplicationDefaultCredentials = Boolean(
  process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_ADMIN_USE_ADC === 'true',
)
if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !useApplicationDefaultCredentials) {
  throw new Error('Configure Firebase Admin credentials with GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_SERVICE_ACCOUNT_JSON, or FIREBASE_ADMIN_USE_ADC=true before starting the API.')
}

const firebaseAdminApp = initializeApp({
  credential: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
    : applicationDefault(),
})
const firebaseAuth = getAuth(firebaseAdminApp)
const app = express()
const port = Number(process.env.PORT || 4000)
const questionBankGrade = (grade) => Number(grade) === 10 ? 9 : Number(grade)
const allowedOrigins = process.env.CLIENT_ORIGIN?.split(',').map((origin) => origin.trim()) ?? []
if (process.env.NODE_ENV !== 'production') allowedOrigins.push(/^http:\/\/localhost:517\d+$/)

app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : undefined))
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_request, response) => {
  response.json({ api: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' })
})

app.use('/api', async (request, response, next) => {
  const authorization = request.get('authorization') || ''
  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i)
  if (!tokenMatch) return response.status(401).json({ error: 'Authentication required' })

  try {
    request.firebaseUser = await firebaseAuth.verifyIdToken(tokenMatch[1])
    next()
  } catch (error) {
    if (error.code?.startsWith('auth/')) return response.status(401).json({ error: 'Invalid or expired authentication token' })
    console.error('Firebase ID token verification failed', error)
    response.status(500).json({ error: 'Authentication service unavailable' })
  }
})

app.get('/api/questions', async (request, response, next) => {
  try {
    const subject = request.query.subject || 'math'
    const grade = Number(request.query.grade || 7)
    const grades = grade === 9 || grade === 10 ? [9, 10] : [grade]
    const questions = await Question.find({ subject, grade: { $in: grades } }).sort({ createdAt: -1 }).lean()
    response.json(questions)
  } catch (error) {
    next(error)
  }
})

app.post('/api/questions', async (request, response, next) => {
  try {
    const { subject = 'math', grade = 7, type, chapter, prompt, equation = '', inlineEquations = [], options = [], statements = [], statementQuestion = '', optionEquations = [], optionInlineEquations = [], answer = '', answerEquation = '', inlineAnswerEquations = [], marks, figure = '' } = request.body
    const question = await Question.create({ subject, grade: questionBankGrade(grade), type, chapter, prompt, equation, inlineEquations, options, statements, statementQuestion, optionEquations, optionInlineEquations, answer, answerEquation, inlineAnswerEquations, marks, figure })
    response.status(201).json(question)
  } catch (error) {
    next(error)
  }
})

app.put('/api/questions/:id', async (request, response, next) => {
  try {
    const { subject = 'math', grade = 7, type, chapter, prompt, equation = '', inlineEquations = [], options = [], statements = [], statementQuestion = '', optionEquations = [], optionInlineEquations = [], answer = '', answerEquation = '', inlineAnswerEquations = [], marks, figure = '' } = request.body
    const question = await Question.findByIdAndUpdate(
      request.params.id,
      { $set: { subject, grade: questionBankGrade(grade), type, chapter, prompt, equation, inlineEquations, options, statements, statementQuestion, optionEquations, optionInlineEquations, answer, answerEquation, inlineAnswerEquations, marks, figure } },
      { new: true, runValidators: true },
    )
    if (!question) return response.status(404).json({ error: 'Question not found' })
    response.json(question)
  } catch (error) {
    next(error)
  }
})

app.delete('/api/questions/:id', async (request, response, next) => {
  try {
    const question = await Question.findByIdAndDelete(request.params.id)
    if (!question) return response.status(404).json({ error: 'Question not found' })
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

app.get('/api/settings/:subject/:grade', async (request, response, next) => {
  try {
    const settings = await PaperSettings.findOne({ subject: request.params.subject, grade: Number(request.params.grade) }).lean()
    if (!settings) return response.status(404).json({ error: 'Paper settings not found' })
    response.json(settings)
  } catch (error) {
    next(error)
  }
})

app.put('/api/settings/:subject/:grade', async (request, response, next) => {
  try {
    const { schoolName, schoolSubtitle, paperSetCode, questionTextColor, showChapters, paperTitle, paperDuration, paperClass, watermark } = request.body
    const settings = await PaperSettings.findOneAndUpdate(
      { subject: request.params.subject, grade: Number(request.params.grade) },
      { $set: { schoolName, schoolSubtitle, paperSetCode, questionTextColor, showChapters, paperTitle, paperDuration, paperClass, watermark } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    )
    response.json(settings)
  } catch (error) {
    next(error)
  }
})

app.use((error, _request, response, _next) => {
  void _next
  const status = error.name === 'ValidationError' || error.name === 'CastError' ? 400 : 500
  response.status(status).json({ error: status === 400 ? error.message : 'Internal server error' })
})

async function start() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing. Copy .env.example to .env and add your MongoDB connection string.')
  }
  await mongoose.connect(process.env.MONGODB_URI)
  app.listen(port, () => console.log(`MongoDB API listening at http://localhost:${port}`))
}

start().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
