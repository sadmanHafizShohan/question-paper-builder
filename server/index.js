import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { Buffer } from 'node:buffer'
import mongoose from 'mongoose'
import process from 'node:process'
import { firebaseAdminAuth } from './firebaseAdmin.js'
import { PaperSettings, Question } from './models.js'

dotenv.config()

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
    request.firebaseUser = await firebaseAdminAuth.verifyIdToken(tokenMatch[1], true)
    next()
  } catch (error) {
    if (error.code?.startsWith('auth/')) return response.status(401).json({ error: 'Invalid or expired authentication token' })
    console.error('Firebase ID token verification failed', error)
    response.status(500).json({ error: 'Authentication service unavailable' })
  }
})

function requireAdmin(request, response, next) {
  if (request.firebaseUser.role !== 'admin') {
    return response.status(403).json({ error: 'Admin role required' })
  }
  next()
}

async function countEnabledAdmins() {
  let count = 0
  let pageToken
  do {
    const page = await firebaseAdminAuth.listUsers(1000, pageToken)
    count += page.users.filter((user) => !user.disabled && user.customClaims?.role === 'admin').length
    pageToken = page.pageToken
  } while (pageToken)
  return count
}

app.get('/api/admin/users', requireAdmin, async (_request, response, next) => {
  try {
    const users = []
    let pageToken
    do {
      const page = await firebaseAdminAuth.listUsers(1000, pageToken)
      users.push(...page.users.map((user) => ({
        uid: user.uid,
        email: user.email ?? '',
        displayName: user.displayName ?? '',
        disabled: user.disabled,
        role: user.customClaims?.role === 'admin' ? 'admin' : 'user',
        createdAt: user.metadata.creationTime,
        lastSignInAt: user.metadata.lastSignInTime ?? null,
      })))
      pageToken = page.pageToken
    } while (pageToken)

    users.sort((left, right) => left.email.localeCompare(right.email))
    response.json(users)
  } catch (error) {
    next(error)
  }
})

app.put('/api/admin/users/:uid/role', requireAdmin, async (request, response, next) => {
  try {
    const { role } = request.body
    if (role !== 'admin' && role !== 'user') {
      return response.status(400).json({ error: 'Role must be admin or user' })
    }
    if (request.params.uid === request.firebaseUser.uid) {
      return response.status(400).json({ error: 'You cannot change your own role' })
    }

    const targetUser = await firebaseAdminAuth.getUser(request.params.uid)
    const previousRole = targetUser.customClaims?.role === 'admin' ? 'admin' : 'user'
    if (previousRole === 'admin' && role === 'user') {
      if (!targetUser.disabled && await countEnabledAdmins() <= 1) {
        return response.status(409).json({ error: 'The last admin cannot be demoted' })
      }
    }

    await firebaseAdminAuth.setCustomUserClaims(request.params.uid, {
      ...targetUser.customClaims,
      role,
    })
    await firebaseAdminAuth.revokeRefreshTokens(request.params.uid)
    response.json({ uid: targetUser.uid, email: targetUser.email ?? '', role })
  } catch (error) {
    next(error)
  }
})

app.put('/api/admin/users/:uid/status', requireAdmin, async (request, response, next) => {
  try {
    const { disabled } = request.body
    if (typeof disabled !== 'boolean') {
      return response.status(400).json({ error: 'disabled must be a boolean' })
    }
    if (request.params.uid === request.firebaseUser.uid && disabled) {
      return response.status(400).json({ error: 'You cannot block your own account' })
    }

    const targetUser = await firebaseAdminAuth.getUser(request.params.uid)
    if (disabled && !targetUser.disabled && targetUser.customClaims?.role === 'admin' && await countEnabledAdmins() <= 1) {
      return response.status(409).json({ error: 'The last active admin cannot be blocked' })
    }

    await firebaseAdminAuth.updateUser(targetUser.uid, { disabled })
    await firebaseAdminAuth.revokeRefreshTokens(targetUser.uid)
    response.json({
      uid: targetUser.uid,
      email: targetUser.email ?? '',
      disabled,
    })
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return response.status(404).json({ error: 'User not found' })
    }
    next(error)
  }
})

app.delete('/api/admin/users/:uid', requireAdmin, async (request, response, next) => {
  try {
    if (request.params.uid === request.firebaseUser.uid) {
      return response.status(400).json({ error: 'You cannot delete your own account' })
    }

    const targetUser = await firebaseAdminAuth.getUser(request.params.uid)
    if (!targetUser.disabled && targetUser.customClaims?.role === 'admin' && await countEnabledAdmins() <= 1) {
      return response.status(409).json({ error: 'The last active admin cannot be deleted' })
    }

    await firebaseAdminAuth.deleteUser(targetUser.uid)
    response.status(204).end()
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return response.status(404).json({ error: 'User not found' })
    }
    next(error)
  }
})

app.get('/api/questions', async (request, response, next) => {
  try {
    const subject = request.query.subject || 'math'
    const grade = Number(request.query.grade || 7)
    const grades = grade === 9 || grade === 10 ? [9, 10] : [grade]
    const limit = 50
    const sortDirection = request.query.sort === 'asc' ? 1 : -1
    const filter = { subject, grade: { $in: grades } }
    const types = request.query.type
    if (types && types !== 'all') filter.type = types

    const chapters = (Array.isArray(request.query.chapter) ? request.query.chapter : [request.query.chapter])
      .filter((chapter) => typeof chapter === 'string' && chapter.length <= 120)
    if (chapters.length > 0) filter.chapter = { $in: chapters.slice(0, 20) }

    const search = typeof request.query.search === 'string' ? request.query.search.trim() : ''
    if (search.length > 100) return response.status(400).json({ error: 'Search text must be 100 characters or fewer' })
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const searchPattern = new RegExp(escapedSearch, 'i')
      filter.$or = ['prompt', 'equation', 'inlineEquations', 'chapter', 'statements', 'statementQuestion', 'options']
        .map((field) => ({ [field]: searchPattern }))
    }

    if (request.query.cursor) {
      try {
        const decodedCursor = JSON.parse(Buffer.from(String(request.query.cursor), 'base64url').toString())
        const cursorDate = new Date(decodedCursor.createdAt)
        if (!Number.isFinite(cursorDate.getTime()) || !/^[a-f\d]{24}$/i.test(decodedCursor.id)) throw new Error('Invalid cursor')
        filter.$and = [
          ...(filter.$or ? [{ $or: filter.$or }] : []),
          {
            $or: sortDirection === -1
              ? [{ createdAt: { $lt: cursorDate } }, { createdAt: cursorDate, _id: { $lt: decodedCursor.id } }]
              : [{ createdAt: { $gt: cursorDate } }, { createdAt: cursorDate, _id: { $gt: decodedCursor.id } }],
          },
        ]
        delete filter.$or
      } catch {
        return response.status(400).json({ error: 'Invalid question cursor' })
      }
    }

    const questions = await Question.find(filter)
      .sort({ createdAt: sortDirection, _id: sortDirection })
      .limit(limit + 1)
      .lean()
    const hasMore = questions.length > limit
    if (hasMore) questions.pop()
    const lastQuestion = questions.at(-1)
    const nextCursor = hasMore && lastQuestion
      ? Buffer.from(JSON.stringify({ createdAt: lastQuestion.createdAt, id: String(lastQuestion._id) })).toString('base64url')
      : null
    response.json({ questions, nextCursor, hasMore })
  } catch (error) {
    next(error)
  }
})

app.get('/api/questions/meta', async (request, response, next) => {
  try {
    const subject = request.query.subject || 'math'
    const grade = Number(request.query.grade || 7)
    const grades = grade === 9 || grade === 10 ? [9, 10] : [grade]
    const [metadata = { summary: [], chapters: [], types: [] }] = await Question.aggregate([
      { $match: { subject, grade: { $in: grades } } },
      {
        $facet: {
          summary: [{ $count: 'total' }],
          chapters: [
            { $match: { chapter: { $ne: '' } } },
            { $group: { _id: '$chapter' } },
            { $sort: { _id: 1 } },
          ],
          types: [{ $group: { _id: '$type', count: { $sum: 1 } } }],
        },
      },
    ])
    response.json({
      total: metadata.summary[0]?.total ?? 0,
      chapters: metadata.chapters.map(({ _id }) => _id),
      typeCounts: Object.fromEntries(metadata.types.map(({ _id, count }) => [_id, count])),
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/questions', requireAdmin, async (request, response, next) => {
  try {
    const { subject = 'math', grade = 7, type, chapter, prompt, equation = '', inlineEquations = [], options = [], statements = [], statementQuestion = '', optionEquations = [], optionInlineEquations = [], answer = '', answerEquation = '', inlineAnswerEquations = [], marks, figure = '' } = request.body
    const question = await Question.create({ subject, grade: questionBankGrade(grade), type, chapter, prompt, equation, inlineEquations, options, statements, statementQuestion, optionEquations, optionInlineEquations, answer, answerEquation, inlineAnswerEquations, marks, figure })
    response.status(201).json(question)
  } catch (error) {
    next(error)
  }
})

app.delete('/api/questions', requireAdmin, async (request, response, next) => {
  try {
    const { ids } = request.body
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500) {
      return response.status(400).json({ error: 'Provide between 1 and 500 question IDs' })
    }
    if (ids.some((id) => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id))) {
      return response.status(400).json({ error: 'Every question ID must be a valid MongoDB ID' })
    }

    const uniqueIds = [...new Set(ids)]
    const existingQuestions = await Question.find({ _id: { $in: uniqueIds } }).select('_id').lean()
    const existingIds = existingQuestions.map((question) => String(question._id))
    if (existingIds.length === 0) {
      return response.json({ deletedCount: 0, deletedIds: [] })
    }

    const result = await Question.deleteMany({ _id: { $in: existingIds } })
    response.json({
      deletedCount: result.deletedCount,
      deletedIds: existingIds,
    })
  } catch (error) {
    next(error)
  }
})

app.put('/api/questions/:id', requireAdmin, async (request, response, next) => {
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

app.delete('/api/questions/:id', requireAdmin, async (request, response, next) => {
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

app.put('/api/settings/:subject/:grade', requireAdmin, async (request, response, next) => {
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
