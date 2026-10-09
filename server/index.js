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
app.use(express.json({ limit: '16mb' }))

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
    const [metadata = { summary: [], chapters: [], types: [], chapterTypes: [] }] = await Question.aggregate([
      { $match: { subject, grade: { $in: grades } } },
      {
        $facet: {
          summary: [{ $count: 'total' }],
          chapters: [
            { $match: { chapter: { $type: 'string', $ne: '' } } },
            { $group: { _id: '$chapter' } },
            { $sort: { _id: 1 } },
          ],
          types: [{ $group: { _id: '$type', count: { $sum: 1 } } }],
          chapterTypes: [
            { $match: { chapter: { $type: 'string', $ne: '' } } },
            { $group: { _id: { chapter: '$chapter', type: '$type' }, count: { $sum: 1 } } },
          ],
        },
      },
    ])
    const chapterCounts = new Map()
    metadata.chapterTypes.forEach(({ _id: { chapter, type }, count }) => {
      const chapterCount = chapterCounts.get(chapter) ?? { chapter, total: 0, typeCounts: {} }
      chapterCount.total += count
      chapterCount.typeCounts[type] = count
      chapterCounts.set(chapter, chapterCount)
    })
    response.json({
      total: metadata.summary[0]?.total ?? 0,
      chapters: metadata.chapters.map(({ _id }) => _id),
      typeCounts: Object.fromEntries(metadata.types.map(({ _id, count }) => [_id, count])),
      chapterCounts: [...chapterCounts.values()],
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/questions/random', async (request, response, next) => {
  try {
    const { subject, grade, chapters, excludeIds = [] } = request.body ?? {}
    const validSubjects = ['math', 'bangla-1', 'bangla-2', 'english-1', 'english-2', 'global-studies','general-science', 'islam','hindu', 'ict']
    const validTypes = ['mcq', 'short', 'cq', 'long', 'passage', 'true_false', 'fill_in_the_blanks', 'matching', 'rearrange', 'table_completion', 'synonym_antonym']
    if (!validSubjects.includes(subject) || !Number.isInteger(grade) || grade < 5 || grade > 10) {
      return response.status(400).json({ error: 'A valid subject and grade are required' })
    }
    if (!Array.isArray(chapters) || chapters.length === 0 || chapters.length > 20) {
      return response.status(400).json({ error: 'Provide between 1 and 20 chapter selections' })
    }
    if (!Array.isArray(excludeIds) || excludeIds.length > 25000 || excludeIds.some((id) => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id))) {
      return response.status(400).json({ error: 'Excluded question IDs must be valid MongoDB IDs' })
    }

    let requestedTotal = 0
    const normalizedChapters = []
    for (const selection of chapters) {
      if (!selection || typeof selection.chapter !== 'string' || selection.chapter.trim().length === 0 || selection.chapter.length > 120) {
        return response.status(400).json({ error: 'Every selection must have a valid chapter' })
      }
      if (!selection.counts || typeof selection.counts !== 'object' || Array.isArray(selection.counts)) {
        return response.status(400).json({ error: 'Every chapter selection must include question type counts' })
      }
      const counts = {}
      for (const [type, count] of Object.entries(selection.counts)) {
        if (!validTypes.includes(type) || !Number.isInteger(count) || count < 0 || count > 100) {
          return response.status(400).json({ error: 'Question type counts must be whole numbers from 0 to 100' })
        }
        if (count > 0) {
          counts[type] = count
          requestedTotal += count
        }
      }
      normalizedChapters.push({ chapter: selection.chapter.trim(), counts })
    }
    if (new Set(normalizedChapters.map(({ chapter }) => chapter)).size !== normalizedChapters.length) {
      return response.status(400).json({ error: 'Chapter selections must be unique' })
    }
    if (requestedTotal < 1 || requestedTotal > 200) {
      return response.status(400).json({ error: 'Request between 1 and 200 random questions' })
    }

    const grades = questionBankGrade(grade) === 9 ? [9, 10] : [questionBankGrade(grade)]
    const excludedObjectIds = excludeIds.map((id) => new mongoose.Types.ObjectId(id))
    const questions = []
    for (const { chapter, counts } of normalizedChapters) {
      const facets = Object.fromEntries(Object.entries(counts).map(([type, count]) => [
        `type_${type}`,
        [{ $match: { type } }, { $sample: { size: count } }],
      ]))
      if (Object.keys(facets).length === 0) continue
      const [sampledByType = {}] = await Question.aggregate([
        {
          $match: {
            subject,
            grade: { $in: grades },
            chapter,
            ...(excludedObjectIds.length > 0 ? { _id: { $nin: excludedObjectIds } } : {}),
          },
        },
        { $facet: facets },
      ])
      Object.values(sampledByType).forEach((sampledQuestions) => questions.push(...sampledQuestions))
    }
    response.json({ questions })
  } catch (error) {
    next(error)
  }
})

app.get('/api/questions/duplicates', requireAdmin, async (request, response, next) => {
  try {
    const subject = request.query.subject || 'math'
    const grade = Number(request.query.grade || 7)
    const grades = grade === 9 || grade === 10 ? [9, 10] : [grade]

    // Fetch all questions for this subject/grade (only fields needed for comparison)
    const questions = await Question.find({ subject, grade: { $in: grades } })
      .select('_id type prompt chapter marks createdAt')
      .lean()

    // Normalize prompt: lowercase, collapse whitespace, strip trailing question numbers and basic punctuation
    const normalize = (text) => {
      let t = (text ?? '').toLowerCase()
      // Remove trailing question numbers like "- (প্রশ্ন 17)", "(নং 5)"
      t = t.replace(/\s*[-–—(]*\s*(প্রশ্ন|নং|q|question)\s*[0-9০-৯]+\s*[)]*\s*$/gi, '')
      // Remove punctuation that might differ (like dashes, quotes, question marks)
      t = t.replace(/['"‘’'""?।!,:;_-]/g, ' ')
      return t.replace(/[\s\u00a0]+/g, ' ').trim()
    }

    // Group by (type, normalizedPrompt)
    const groups = new Map()
    for (const question of questions) {
      const key = `${question.type}::${normalize(question.prompt)}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(question)
    }

    // Keep only groups with 2+ questions
    const duplicateGroups = [...groups.values()]
      .filter((group) => group.length >= 2)
      .map((group) => ({
        type: group[0].type,
        prompt: group[0].prompt,
        count: group.length,
        questions: group.map((question) => ({
          id: String(question._id),
          type: question.type,
          prompt: question.prompt,
          chapter: question.chapter,
          marks: question.marks,
          createdAt: question.createdAt,
        })),
      }))
      .sort((a, b) => b.count - a.count)

    response.json({
      totalGroups: duplicateGroups.length,
      totalDuplicates: duplicateGroups.reduce((sum, group) => sum + group.count - 1, 0),
      groups: duplicateGroups,
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

app.put('/api/questions/merge-chapters', requireAdmin, async (request, response, next) => {
  try {
    const { subject, grade, chapters, targetChapter } = request.body ?? {}
    if (typeof subject !== 'string' || subject.trim().length === 0 || subject.length > 80) {
      return response.status(400).json({ error: 'Provide a valid subject' })
    }
    if (!Number.isFinite(Number(grade)) || Number(grade) < 5 || Number(grade) > 10) {
      return response.status(400).json({ error: 'Provide a valid grade' })
    }
    if (!Array.isArray(chapters) || chapters.length !== 2
      || chapters.some((chapter) => typeof chapter !== 'string' || chapter.trim().length === 0 || chapter.length > 120)
      || new Set(chapters).size !== 2) {
      return response.status(400).json({ error: 'Provide two different valid chapters' })
    }
    if (typeof targetChapter !== 'string' || targetChapter.trim().length === 0 || targetChapter.trim().length > 120) {
      return response.status(400).json({ error: 'Provide a valid destination chapter name' })
    }

    const grades = Number(grade) === 9 || Number(grade) === 10 ? [9, 10] : [questionBankGrade(grade)]
    const result = await Question.updateMany(
      { subject: subject.trim(), grade: { $in: grades }, chapter: { $in: chapters } },
      { $set: { chapter: targetChapter.trim() } },
      { runValidators: true },
    )
    response.json({ updatedCount: result.modifiedCount })
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
    const { schoolName, schoolSubtitle, schoolLogo, paperSetCode, questionTextColor, showChapters, paperTitle, paperDuration, paperClass, watermark } = request.body
    const settings = await PaperSettings.findOneAndUpdate(
      { subject: request.params.subject, grade: Number(request.params.grade) },
      { $set: { schoolName, schoolSubtitle, schoolLogo, paperSetCode, questionTextColor, showChapters, paperTitle, paperDuration, paperClass, watermark } },
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
