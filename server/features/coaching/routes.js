import express from 'express'
import mongoose from 'mongoose'
import { firebaseAdminAuth } from '../../config/firebaseAdmin.js'
import {
  CoachingBatch,
  CoachingAttendance,
  CoachingCenter,
  CoachingCenterRequest,
  CoachingExam,
  CoachingExamResult,
  CoachingEnrollment,
  CoachingFeeRecord,
  CoachingMembership,
  CoachingNotice,
  CoachingNoticeRead,
  CoachingStudent,
  CoachingTeacher,
} from '../../models/coaching.js'

const router = express.Router()
const managementRoles = ['owner', 'manager']
const membershipRoles = ['owner', 'manager', 'teacher', 'student', 'accountant']
const admissionTextFields = {
  englishName: 120,
  fatherName: 120,
  motherName: 120,
  permanentDistrict: 100,
  permanentPostOffice: 100,
  permanentVillage: 100,
  permanentArea: 100,
  presentDistrict: 100,
  presentPostOffice: 100,
  presentVillage: 100,
  presentArea: 100,
  guardianDistrict: 100,
  guardianPostOffice: 100,
  guardianVillage: 100,
  guardianArea: 100,
  nationality: 80,
  religion: 80,
  previousGrade: 40,
}

function serialize(document) {
  if (!document) return document
  const result = { ...document, id: String(document._id) }
  delete result._id
  delete result.__v
  for (const [key, value] of Object.entries(result)) {
    if (Array.isArray(value)) {
      result[key] = value.map((item) => item && typeof item === 'object' && item._id ? serialize(item) : item)
    } else if (value && typeof value === 'object' && value._id) {
      result[key] = serialize(value)
    }
  }
  return result
}

function requirePlatformAdmin(request, response, next) {
  if (request.firebaseUser?.role !== 'admin') {
    return response.status(403).json({ error: 'Platform admin role required' })
  }
  next()
}

async function requireCenterMembership(request, response, next) {
  try {
    if (!mongoose.isValidObjectId(request.params.centerId)) {
      return response.status(400).json({ error: 'Invalid coaching center' })
    }
    const [membership, center] = await Promise.all([
      CoachingMembership.findOne({
        centerId: request.params.centerId,
        userId: request.firebaseUser.uid,
        status: 'active',
      }).lean(),
      CoachingCenter.findOne({ _id: request.params.centerId, status: 'active' }).lean(),
    ])
    if (!membership || !center) return response.status(403).json({ error: 'Active membership in this coaching center is required' })
    request.coachingMembership = membership
    request.coachingCenter = center
    next()
  } catch (error) {
    next(error)
  }
}

async function findOptionalFirebaseAccount(email) {
  if (!email) return null
  try {
    return await firebaseAdminAuth.getUserByEmail(email)
  } catch (error) {
    if (error.code === 'auth/user-not-found') return null
    throw error
  }
}

function requireCenterRoles(...roles) {
  return (request, response, next) => {
    if (!roles.includes(request.coachingMembership?.role)) {
      return response.status(403).json({ error: `This action requires ${roles.join(' or ')} center role` })
    }
    next()
  }
}

function normalizeRequiredString(value, label, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new Error(`${label} must contain 1-${maxLength} characters`)
  }
  return value.trim()
}

function normalizeEmail(value, { required = false, label = 'Email' } = {}) {
  if (typeof value !== 'string' || !value.trim()) {
    if (required) throw new Error(`${label} is required`)
    return ''
  }

  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`${label} must be a valid email address`)
  }
  return email
}

function normalizePhotoURL(value) {
  if (typeof value !== 'string' || !value.trim()) return ''
  const url = value.trim()
  if (url.length > 500) throw new Error('Student photo URL cannot exceed 500 characters')
  let parsedURL
  try {
    parsedURL = new URL(url)
  } catch {
    throw new Error('Student photo URL must be a valid HTTPS URL')
  }
  if (parsedURL.protocol !== 'https:') {
    throw new Error('Student photo URL must be a valid HTTPS URL')
  }
  return url
}

function normalizeOptionalString(value, field, maxLength) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string' || value.trim().length > maxLength) {
    throw new Error(`Student ${field} must be at most ${maxLength} characters`)
  }
  return value.trim()
}

function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function isTodayOrEarlier(value) {
  const todayParts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const today = ['year', 'month', 'day']
    .map((type) => todayParts.find((part) => part.type === type)?.value)
    .join('-')
  return value <= today
}

function isFeeMonth(value) {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

async function teacherCanAccessBatch(batch, membership, userId, centerId) {
  if (membership.role !== 'teacher') return true
  return Boolean(batch.teacherId && await CoachingTeacher.exists({
    _id: batch.teacherId,
    centerId,
    linkedUserId: userId,
    status: 'active',
  }))
}

async function getMemberStudentIds(centerId, userId) {
  return CoachingStudent.find({ centerId, linkedUserId: userId, status: 'active' }).distinct('_id')
}

async function getMemberBatchIds(centerId, membership) {
  if (membership.role === 'teacher') {
    const teacherIds = await CoachingTeacher.find({
      centerId,
      linkedUserId: membership.userId,
      status: 'active',
    }).distinct('_id')
    return CoachingBatch.find({ centerId, teacherId: { $in: teacherIds }, status: 'active' }).distinct('_id')
  }
  if (membership.role === 'student') {
    const studentIds = await getMemberStudentIds(centerId, membership.userId)
    return CoachingEnrollment.find({ centerId, studentId: { $in: studentIds }, status: 'active' }).distinct('batchId')
  }
  return null
}

router.get('/centers', async (request, response, next) => {
  try {
    const memberships = await CoachingMembership.find({ userId: request.firebaseUser.uid, status: 'active' })
      .populate({ path: 'centerId', match: { status: 'active' }, select: 'name address contactPhone status' })
      .lean()
    response.json(memberships
      .filter((membership) => membership.centerId)
      .map((membership) => ({
        ...serialize(membership.centerId),
        role: membership.role,
        membershipId: String(membership._id),
      })))
  } catch (error) {
    next(error)
  }
})

router.post('/center-requests', async (request, response, next) => {
  try {
    const name = normalizeRequiredString(request.body?.name, 'Center name', 120)
    const address = typeof request.body?.address === 'string' ? request.body.address.trim().slice(0, 300) : ''
    const contactPhone = typeof request.body?.contactPhone === 'string' ? request.body.contactPhone.trim().slice(0, 30) : ''
    const existingPending = await CoachingCenterRequest.exists({
      requesterId: request.firebaseUser.uid,
      status: 'pending',
    })
    if (existingPending) return response.status(409).json({ error: 'You already have a pending coaching center request' })
    const centerRequest = await CoachingCenterRequest.create({
      name,
      address,
      contactPhone,
      requesterId: request.firebaseUser.uid,
      requesterName: request.firebaseUser.name ?? '',
      requesterEmail: request.firebaseUser.email ?? '',
      requesterPhotoURL: request.firebaseUser.picture ?? '',
    })
    response.status(201).json(serialize(centerRequest.toObject()))
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ error: 'You already have a pending coaching center request' })
    if (error instanceof Error && error.message.startsWith('Center name')) return response.status(400).json({ error: error.message })
    next(error)
  }
})

router.get('/center-requests/mine', async (request, response, next) => {
  try {
    const centerRequests = await CoachingCenterRequest.find({ requesterId: request.firebaseUser.uid })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
    response.json(centerRequests.map(serialize))
  } catch (error) {
    next(error)
  }
})

router.get('/admin/center-requests', requirePlatformAdmin, async (_request, response, next) => {
  try {
    const centerRequests = await CoachingCenterRequest.find({ status: 'pending' })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean()
    response.json(centerRequests.map(serialize))
  } catch (error) {
    next(error)
  }
})

router.post('/admin/center-requests/:requestId/decision', requirePlatformAdmin, async (request, response, next) => {
  let centerRequest
  try {
    if (!mongoose.isValidObjectId(request.params.requestId)) {
      return response.status(400).json({ error: 'Invalid coaching center request' })
    }
    const { decision } = request.body ?? {}
    if (!['approve', 'reject'].includes(decision)) {
      return response.status(400).json({ error: 'Decision must be approve or reject' })
    }
    if (decision === 'reject') {
      centerRequest = await CoachingCenterRequest.findOneAndUpdate(
        { _id: request.params.requestId, status: 'pending' },
        { $set: { status: 'rejected', reviewedBy: request.firebaseUser.uid, reviewedAt: new Date() } },
        { new: true },
      )
      if (!centerRequest) return response.status(404).json({ error: 'Pending coaching center request not found' })
      return response.json(serialize(centerRequest.toObject()))
    }

    centerRequest = await CoachingCenterRequest.findOneAndUpdate(
      { _id: request.params.requestId, status: 'pending' },
      { $set: { status: 'processing', reviewedBy: request.firebaseUser.uid } },
      { new: true },
    )
    if (!centerRequest) return response.status(404).json({ error: 'Pending coaching center request not found' })

    const center = centerRequest.centerId
      ? await CoachingCenter.findById(centerRequest.centerId)
      : await CoachingCenter.create({
          name: centerRequest.name,
          address: centerRequest.address,
          contactPhone: centerRequest.contactPhone,
          createdBy: centerRequest.requesterId,
        })
    await CoachingCenterRequest.updateOne(
      { _id: centerRequest._id, status: 'processing' },
      { $set: { centerId: center._id } },
    )
    await CoachingMembership.updateOne(
      { centerId: center._id, userId: centerRequest.requesterId },
      {
        $setOnInsert: {
          displayName: centerRequest.requesterName,
          email: centerRequest.requesterEmail,
          photoURL: centerRequest.requesterPhotoURL,
          role: 'owner',
          status: 'active',
        },
      },
      { upsert: true },
    )
    const approvedRequest = await CoachingCenterRequest.findOneAndUpdate(
      { _id: centerRequest._id, status: 'processing' },
      { $set: { status: 'approved', centerId: center._id, reviewedAt: new Date() } },
      { new: true },
    )
    response.json({ request: serialize(approvedRequest.toObject()), center: serialize(center.toObject()) })
  } catch (error) {
    if (centerRequest?._id) {
      await CoachingCenterRequest.updateOne(
        { _id: centerRequest._id, status: 'processing' },
        { $set: { status: 'pending' } },
      ).catch((restoreError) => console.error('Could not restore a failed coaching center request', restoreError))
    }
    next(error)
  }
})

router.get('/centers/:centerId/overview', requireCenterMembership, async (request, response, next) => {
  try {
    const { centerId, userId } = request.coachingMembership
    const role = request.coachingMembership.role
    const [teachers, students, batches] = await Promise.all([
      ['owner', 'manager', 'accountant'].includes(role)
        ? CoachingTeacher.find({ centerId, status: 'active' }).sort({ name: 1 }).lean()
        : role === 'teacher'
          ? CoachingTeacher.find({ centerId, linkedUserId: userId, status: 'active' }).lean()
          : [],
      ['owner', 'manager', 'accountant'].includes(role)
        ? CoachingStudent.find({ centerId, status: 'active' }).sort({ name: 1 }).lean()
        : role === 'student'
          ? CoachingStudent.find({ centerId, linkedUserId: userId, status: 'active' }).lean()
          : [],
      role === 'student'
        ? CoachingEnrollment.find({ centerId, studentId: { $in: await CoachingStudent.find({ centerId, linkedUserId: userId }).distinct('_id') }, status: 'active' })
            .populate({ path: 'batchId', match: { status: 'active' } }).lean()
            .then((enrollments) => enrollments.map((enrollment) => enrollment.batchId).filter(Boolean))
        : role === 'teacher'
          ? CoachingBatch.find({
              centerId,
              teacherId: { $in: await CoachingTeacher.find({ centerId, linkedUserId: userId }).distinct('_id') },
              status: 'active',
            }).populate({ path: 'teacherId', select: 'name email' }).sort({ name: 1 }).lean()
          : CoachingBatch.find({ centerId, status: 'active' })
              .populate({ path: 'teacherId', select: 'name email' }).sort({ name: 1 }).lean(),
    ])
    const enrollments = managementRoles.includes(role)
      ? await CoachingEnrollment.find({ centerId, status: 'active' })
          .populate({ path: 'studentId', select: 'name studentCode' })
          .populate({ path: 'batchId', select: 'name' })
          .lean()
      : []
    const members = await CoachingMembership.find({
      centerId,
      ...(managementRoles.includes(role) ? {} : { userId, status: 'active' }),
    }).sort({ role: 1, displayName: 1 }).lean()
    response.json({
      center: serialize(request.coachingCenter),
      role,
      members: members.map(serialize),
      teachers: teachers.map(serialize),
      students: students.map(serialize),
      batches: batches.map(serialize),
      enrollments: enrollments.map(serialize),
    })
  } catch (error) {
    next(error)
  }
})

router.post('/centers/:centerId/members', requireCenterMembership, requireCenterRoles('owner', 'manager'), async (request, response, next) => {
  try {
    const email = normalizeEmail(request.body?.email, { required: true, label: 'Member email' })
    const role = request.body?.role
    if (!membershipRoles.includes(role)
      || (['owner', 'manager'].includes(role) && request.coachingMembership.role !== 'owner')) {
      return response.status(400).json({ error: 'Choose a valid center role; only the owner can assign another owner' })
    }
    const account = await firebaseAdminAuth.getUserByEmail(email)
    if (account.disabled) return response.status(409).json({ error: 'A disabled Firebase account cannot be added' })
    const member = await CoachingMembership.findOneAndUpdate(
      { centerId: request.params.centerId, userId: account.uid },
      { $set: { role, status: 'active', email: account.email ?? email, displayName: account.displayName ?? '', photoURL: account.photoURL ?? '' } },
      { new: true, upsert: true, runValidators: true },
    )
    const linkedTeacher = await CoachingTeacher.findOne({ centerId: request.params.centerId, email }).lean()
    if (linkedTeacher) await CoachingTeacher.updateOne({ _id: linkedTeacher._id }, { $set: { linkedUserId: account.uid } })
    const linkedStudent = await CoachingStudent.findOne({ centerId: request.params.centerId, email }).lean()
    if (linkedStudent) await CoachingStudent.updateOne({ _id: linkedStudent._id }, { $set: { linkedUserId: account.uid } })
    response.status(201).json({
      id: String(member._id),
      uid: account.uid,
      email: account.email,
      displayName: account.displayName ?? '',
      role: member.role,
    })
  } catch (error) {
    if (error.code === 'auth/user-not-found') return response.status(404).json({ error: 'No Firebase account was found for this email' })
    if (error instanceof Error && error.message.startsWith('Member email')) return response.status(400).json({ error: error.message })
    if (error.code === 11000) return response.status(409).json({ error: 'This account already belongs to the coaching center' })
    next(error)
  }
})

router.patch('/centers/:centerId/members/:userId', requireCenterMembership, requireCenterRoles('owner', 'manager'), async (request, response, next) => {
  try {
    const targetUserId = normalizeRequiredString(request.params.userId, 'Member account ID', 128)
    if (targetUserId === request.firebaseUser.uid) {
      return response.status(409).json({ error: 'You cannot change your own coaching membership' })
    }
    const member = await CoachingMembership.findOne({
      centerId: request.params.centerId,
      userId: targetUserId,
    })
    if (!member) return response.status(404).json({ error: 'Coaching center member not found' })

    const { role, status } = request.body ?? {}
    if (role !== undefined && !membershipRoles.includes(role)) {
      return response.status(400).json({ error: 'Choose a valid coaching center role' })
    }
    if (status !== undefined && !['active', 'suspended'].includes(status)) {
      return response.status(400).json({ error: 'Member status must be active or suspended' })
    }
    if (request.coachingMembership.role !== 'owner'
      && (['owner', 'manager'].includes(member.role) || role === 'owner' || role === 'manager')) {
      return response.status(403).json({ error: 'Only the center owner can manage owner or manager roles' })
    }
    if (member.role === 'owner'
      && ((role !== undefined && role !== 'owner') || status === 'suspended')) {
      const activeOwners = await CoachingMembership.countDocuments({
        centerId: request.params.centerId,
        role: 'owner',
        status: 'active',
      })
      if (activeOwners <= 1) return response.status(409).json({ error: 'The last active center owner cannot be removed or demoted' })
    }

    if (role !== undefined) member.role = role
    if (status !== undefined) member.status = status
    await member.save()
    response.json(serialize(member.toObject()))
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Member account ID')) return response.status(400).json({ error: error.message })
    next(error)
  }
})

router.post('/centers/:centerId/students', requireCenterMembership, requireCenterRoles(...managementRoles), async (request, response, next) => {
  try {
    const { name, studentCode, grade } = request.body ?? {}
    const normalizedName = normalizeRequiredString(name, 'Student name', 120)
    const normalizedCode = normalizeRequiredString(studentCode, 'Student ID', 40)
    const normalizedGrade = Number(grade)
    if (!Number.isInteger(normalizedGrade) || normalizedGrade < 1 || normalizedGrade > 12) {
      return response.status(400).json({ error: 'Student grade must be between 1 and 12' })
    }
    if (request.body.dateOfBirth && !isCalendarDate(request.body.dateOfBirth)) {
      return response.status(400).json({ error: 'Provide date of birth in YYYY-MM-DD format' })
    }
    const email = normalizeEmail(request.body.email)
    const account = await findOptionalFirebaseAccount(email)
    const student = await CoachingStudent.create({
      centerId: request.params.centerId,
      name: normalizedName,
      studentCode: normalizedCode,
      ...Object.fromEntries(Object.entries(admissionTextFields).map(([field, maxLength]) => [
        field,
        normalizeOptionalString(request.body[field], field, maxLength),
      ])),
      grade: normalizedGrade,
      phone: typeof request.body.phone === 'string' ? request.body.phone.trim().slice(0, 30) : '',
      email,
      linkedUserId: account?.uid ?? '',
      guardianName: typeof request.body.guardianName === 'string' ? request.body.guardianName.trim().slice(0, 120) : '',
      guardianPhone: typeof request.body.guardianPhone === 'string' ? request.body.guardianPhone.trim().slice(0, 30) : '',
      dateOfBirth: request.body.dateOfBirth || '',
      photoURL: normalizePhotoURL(request.body.photoURL),
      createdBy: request.firebaseUser.uid,
    })
    response.status(201).json(serialize(student.toObject()))
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ error: 'This student ID is already used in the center' })
    if (error instanceof Error && error.message.startsWith('Student name')) return response.status(400).json({ error: error.message })
    if (error instanceof Error && error.message.startsWith('Student ID')) return response.status(400).json({ error: error.message })
    if (error instanceof Error && error.message.startsWith('Email')) return response.status(400).json({ error: error.message })
    if (error instanceof Error && error.message.startsWith('Student photo URL')) return response.status(400).json({ error: error.message })
    if (error instanceof Error && error.message.startsWith('Student ')) return response.status(400).json({ error: error.message })
    next(error)
  }
})

router.patch('/centers/:centerId/students/:studentId', requireCenterMembership, requireCenterRoles(...managementRoles), async (request, response, next) => {
  try {
    const { studentId } = request.params
    if (!mongoose.isValidObjectId(studentId)) return response.status(400).json({ error: 'Invalid student profile' })
    const student = await CoachingStudent.findOne({ _id: studentId, centerId: request.params.centerId, status: 'active' })
    if (!student) return response.status(404).json({ error: 'Active student profile not found in this center' })

    const { name, studentCode, grade, phone, email, guardianName, guardianPhone, photoURL, dateOfBirth } = request.body ?? {}
    if (name !== undefined) student.name = normalizeRequiredString(name, 'Student name', 120)
    if (studentCode !== undefined) student.studentCode = normalizeRequiredString(studentCode, 'Student ID', 40)
    for (const [field, maxLength] of Object.entries(admissionTextFields)) {
      if (request.body[field] !== undefined) student[field] = normalizeOptionalString(request.body[field], field, maxLength)
    }
    if (grade !== undefined) {
      const normalizedGrade = Number(grade)
      if (!Number.isInteger(normalizedGrade) || normalizedGrade < 1 || normalizedGrade > 12) {
        return response.status(400).json({ error: 'Student grade must be between 1 and 12' })
      }
      student.grade = normalizedGrade
    }
    if (phone !== undefined) student.phone = typeof phone === 'string' ? phone.trim().slice(0, 30) : ''
    if (email !== undefined) {
      student.email = normalizeEmail(email)
      const account = await findOptionalFirebaseAccount(student.email)
      student.linkedUserId = account?.uid ?? ''
    }
    if (guardianName !== undefined) student.guardianName = typeof guardianName === 'string' ? guardianName.trim().slice(0, 120) : ''
    if (guardianPhone !== undefined) student.guardianPhone = typeof guardianPhone === 'string' ? guardianPhone.trim().slice(0, 30) : ''
    if (dateOfBirth !== undefined) {
      if (dateOfBirth && !isCalendarDate(dateOfBirth)) return response.status(400).json({ error: 'Provide date of birth in YYYY-MM-DD format' })
      student.dateOfBirth = dateOfBirth || ''
    }
    if (photoURL !== undefined) student.photoURL = normalizePhotoURL(photoURL)
    await student.save()
    response.json(serialize(student.toObject()))
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ error: 'This student ID is already used in the center' })
    if (error instanceof Error && ['Student name', 'Student ID', 'Email', 'Student photo URL', 'Student '].some((prefix) => error.message.startsWith(prefix))) {
      return response.status(400).json({ error: error.message })
    }
    next(error)
  }
})

router.delete('/centers/:centerId/students/:studentId', requireCenterMembership, requireCenterRoles(...managementRoles), async (request, response, next) => {
  try {
    const { studentId } = request.params
    if (!mongoose.isValidObjectId(studentId)) return response.status(400).json({ error: 'Invalid student profile' })
    const student = await CoachingStudent.findOneAndUpdate(
      { _id: studentId, centerId: request.params.centerId, status: 'active' },
      { $set: { status: 'inactive' } },
      { new: true, runValidators: true },
    )
    if (!student) return response.status(404).json({ error: 'Active student profile not found in this center' })
    await CoachingEnrollment.updateMany(
      { centerId: request.params.centerId, studentId, status: 'active' },
      { $set: { status: 'withdrawn' } },
    )
    response.json({ id: String(student._id), status: student.status })
  } catch (error) {
    next(error)
  }
})

router.post('/centers/:centerId/teachers', requireCenterMembership, requireCenterRoles(...managementRoles), async (request, response, next) => {
  try {
    const name = normalizeRequiredString(request.body?.name, 'Teacher name', 120)
    const email = normalizeEmail(request.body?.email)
    const account = await findOptionalFirebaseAccount(email)
    const subjects = Array.isArray(request.body?.subjects)
      ? request.body.subjects.filter((subject) => typeof subject === 'string').map((subject) => subject.trim()).filter(Boolean).slice(0, 20)
      : []
    const teacher = await CoachingTeacher.create({
      centerId: request.params.centerId,
      name,
      phone: typeof request.body?.phone === 'string' ? request.body.phone.trim().slice(0, 30) : '',
      email,
      linkedUserId: account?.uid ?? '',
      subjects,
      createdBy: request.firebaseUser.uid,
    })
    response.status(201).json(serialize(teacher.toObject()))
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Teacher name')) return response.status(400).json({ error: error.message })
    if (error instanceof Error && error.message.startsWith('Email')) return response.status(400).json({ error: error.message })
    next(error)
  }
})

router.post('/centers/:centerId/batches', requireCenterMembership, requireCenterRoles(...managementRoles), async (request, response, next) => {
  try {
    const name = normalizeRequiredString(request.body?.name, 'Batch name', 120)
    const subject = normalizeRequiredString(request.body?.subject, 'Batch subject', 80)
    const grade = Number(request.body?.grade)
    if (!Number.isInteger(grade) || grade < 1 || grade > 12) {
      return response.status(400).json({ error: 'Batch grade must be between 1 and 12' })
    }
    let teacherId = null
    if (request.body?.teacherId) {
      if (!mongoose.isValidObjectId(request.body.teacherId)) return response.status(400).json({ error: 'Invalid teacher profile' })
      const teacher = await CoachingTeacher.exists({
        _id: request.body.teacherId,
        centerId: request.params.centerId,
        status: 'active',
      })
      if (!teacher) return response.status(404).json({ error: 'Active teacher profile not found in this center' })
      teacherId = request.body.teacherId
    }
    const batch = await CoachingBatch.create({
      centerId: request.params.centerId,
      name,
      grade,
      subject,
      teacherId,
      schedule: typeof request.body?.schedule === 'string' ? request.body.schedule.trim().slice(0, 300) : '',
      createdBy: request.firebaseUser.uid,
    })
    const populatedBatch = await CoachingBatch.findById(batch._id).populate({ path: 'teacherId', select: 'name email' }).lean()
    response.status(201).json(serialize(populatedBatch))
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Batch name')) return response.status(400).json({ error: error.message })
    if (error instanceof Error && error.message.startsWith('Batch subject')) return response.status(400).json({ error: error.message })
    next(error)
  }
})

router.post('/centers/:centerId/batches/:batchId/enrollments', requireCenterMembership, requireCenterRoles(...managementRoles), async (request, response, next) => {
  try {
    const { batchId } = request.params
    const { studentId } = request.body ?? {}
    if (!mongoose.isValidObjectId(batchId) || !mongoose.isValidObjectId(studentId)) {
      return response.status(400).json({ error: 'Provide valid batch and student IDs' })
    }
    const [batch, student] = await Promise.all([
      CoachingBatch.exists({ _id: batchId, centerId: request.params.centerId, status: 'active' }),
      CoachingStudent.exists({ _id: studentId, centerId: request.params.centerId, status: 'active' }),
    ])
    if (!batch || !student) return response.status(404).json({ error: 'Active batch or student not found in this center' })
    const enrollment = await CoachingEnrollment.findOneAndUpdate(
      { centerId: request.params.centerId, batchId, studentId },
      { $set: { status: 'active' }, $setOnInsert: { enrolledAt: new Date() } },
      { new: true, upsert: true, runValidators: true },
    )
    response.status(201).json(serialize(enrollment.toObject()))
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ error: 'Student is already enrolled in this batch' })
    next(error)
  }
})

router.get('/centers/:centerId/attendance', requireCenterMembership, requireCenterRoles(...managementRoles, 'teacher'), async (request, response, next) => {
  try {
    const { batchId, date } = request.query
    if (!mongoose.isValidObjectId(batchId)) return response.status(400).json({ error: 'Choose a valid batch' })
    if (!isCalendarDate(date)) return response.status(400).json({ error: 'Provide a valid attendance date in YYYY-MM-DD format' })
    if (!isTodayOrEarlier(date)) return response.status(400).json({ error: 'Attendance cannot be viewed or recorded for a future date' })

    const { centerId, userId } = request.coachingMembership
    const batch = await CoachingBatch.findOne({ _id: batchId, centerId, status: 'active' }).lean()
    if (!batch) return response.status(404).json({ error: 'Active batch not found in this center' })
    if (!await teacherCanAccessBatch(batch, request.coachingMembership, userId, centerId)) {
      return response.status(403).json({ error: 'Teachers can only manage attendance for their assigned batches' })
    }

    const enrollments = await CoachingEnrollment.find({ centerId, batchId, status: 'active' })
      .populate({ path: 'studentId', match: { status: 'active' }, select: 'name studentCode' })
      .lean()
    const studentsById = new Map(enrollments
      .map((enrollment) => enrollment.studentId)
      .filter(Boolean)
      .map((student) => [String(student._id), student]))
    const attendance = await CoachingAttendance.find({ centerId, batchId, date })
      .populate({ path: 'studentId', select: 'name studentCode' })
      .lean()
    const attendanceByStudent = new Map(attendance
      .filter((record) => record.studentId)
      .map((record) => {
        const student = record.studentId
        studentsById.set(String(student._id), student)
        return [String(student._id), record.status]
      }))
    response.json({
      batch: serialize(batch),
      date,
      students: [...studentsById.values()].map((student) => ({
        id: String(student._id),
        name: student.name,
        studentCode: student.studentCode,
        status: attendanceByStudent.get(String(student._id)) ?? '',
        savedStatus: attendanceByStudent.get(String(student._id)) ?? '',
      })),
    })
  } catch (error) {
    next(error)
  }
})

router.post('/centers/:centerId/batches/:batchId/attendance', requireCenterMembership, requireCenterRoles(...managementRoles, 'teacher'), async (request, response, next) => {
  try {
    const { batchId } = request.params
    const { date, entries } = request.body ?? {}
    if (!mongoose.isValidObjectId(batchId)) return response.status(400).json({ error: 'Choose a valid batch' })
    if (!isCalendarDate(date)) return response.status(400).json({ error: 'Provide a valid attendance date in YYYY-MM-DD format' })
    if (!isTodayOrEarlier(date)) return response.status(400).json({ error: 'Attendance cannot be recorded for a future date' })
    const validStatuses = ['present', 'absent', 'late', 'excused']
    if (!Array.isArray(entries) || entries.length < 1 || entries.length > 1000) {
      return response.status(400).json({ error: 'Provide between 1 and 1,000 attendance entries' })
    }
    if (entries.some((entry) => !entry || !mongoose.isValidObjectId(entry.studentId) || !validStatuses.includes(entry.status))) {
      return response.status(400).json({ error: 'Each attendance entry must have a valid student and status' })
    }
    const normalizedEntries = entries.map((entry) => ({ studentId: String(entry.studentId).toLowerCase(), status: entry.status }))
    const studentIds = normalizedEntries.map((entry) => entry.studentId)
    if (new Set(studentIds).size !== studentIds.length) {
      return response.status(400).json({ error: 'A student can only appear once in an attendance submission' })
    }

    const { centerId, userId } = request.coachingMembership
    const batch = await CoachingBatch.findOne({ _id: batchId, centerId, status: 'active' }).lean()
    if (!batch) return response.status(404).json({ error: 'Active batch not found in this center' })
    if (!await teacherCanAccessBatch(batch, request.coachingMembership, userId, centerId)) {
      return response.status(403).json({ error: 'Teachers can only manage attendance for their assigned batches' })
    }
    const [enrolledIds, activeStudentIds] = await Promise.all([
      CoachingEnrollment.find({
        centerId,
        batchId,
        studentId: { $in: studentIds },
        status: 'active',
      }).distinct('studentId'),
      CoachingStudent.find({ centerId, _id: { $in: studentIds }, status: 'active' }).distinct('_id'),
    ])
    if (enrolledIds.length !== studentIds.length || activeStudentIds.length !== studentIds.length) {
      return response.status(400).json({ error: 'Attendance can only be recorded for students actively enrolled in this batch' })
    }

    await CoachingAttendance.bulkWrite(normalizedEntries.map((entry) => ({
      updateOne: {
        filter: { centerId, batchId, date, studentId: entry.studentId },
        update: { $set: { status: entry.status, markedBy: request.firebaseUser.uid } },
        upsert: true,
      },
    })))
    response.json({ saved: entries.length, date, batchId })
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ error: 'Attendance changed at the same time; reload and try again' })
    next(error)
  }
})

router.get('/centers/:centerId/fees', requireCenterMembership, requireCenterRoles(...managementRoles, 'accountant'), async (request, response, next) => {
  try {
    const month = request.query.month
    if (!isFeeMonth(month)) return response.status(400).json({ error: 'Provide a valid fee month in YYYY-MM format' })
    const { centerId } = request.coachingMembership
    const filter = { centerId, feeMonth: month }
    const [records, [summary = { count: 0, total: 0 }]] = await Promise.all([
      CoachingFeeRecord.find(filter)
        .populate({ path: 'studentId', select: 'name studentCode' })
        .sort({ paymentDate: -1, createdAt: -1 })
        .limit(500)
        .lean(),
      CoachingFeeRecord.aggregate([
        { $match: { centerId: new mongoose.Types.ObjectId(String(centerId)), feeMonth: month } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$amount' } } },
      ]),
    ])
    response.json({
      month,
      total: summary.total,
      count: summary.count,
      truncated: summary.count > records.length,
      records: records.map(serialize),
    })
  } catch (error) {
    next(error)
  }
})

router.post('/centers/:centerId/fees', requireCenterMembership, requireCenterRoles(...managementRoles, 'accountant'), async (request, response, next) => {
  try {
    const { studentId, feeMonth, amount, paymentDate, category, method, reference, note } = request.body ?? {}
    if (!mongoose.isValidObjectId(studentId)) return response.status(400).json({ error: 'Choose a valid student' })
    if (!isFeeMonth(feeMonth)) return response.status(400).json({ error: 'Provide a valid fee month in YYYY-MM format' })
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100_000_000) {
      return response.status(400).json({ error: 'Fee amount must be a whole number between 1 and 100,000,000 BDT' })
    }
    if (!isCalendarDate(paymentDate)) return response.status(400).json({ error: 'Provide a valid payment date in YYYY-MM-DD format' })
    if (!['tuition', 'admission', 'exam', 'other'].includes(category)) {
      return response.status(400).json({ error: 'Choose a valid fee category' })
    }
    if (!['cash', 'bank', 'mobile_banking', 'other'].includes(method)) {
      return response.status(400).json({ error: 'Choose a valid payment method' })
    }
    const { centerId } = request.coachingMembership
    const student = await CoachingStudent.exists({ _id: studentId, centerId, status: 'active' })
    if (!student) return response.status(404).json({ error: 'Active student profile not found in this center' })
    const record = await CoachingFeeRecord.create({
      centerId,
      studentId,
      feeMonth,
      amount,
      paymentDate,
      category,
      method,
      reference: typeof reference === 'string' ? reference.trim().slice(0, 80) : '',
      note: typeof note === 'string' ? note.trim().slice(0, 300) : '',
      recordedBy: request.firebaseUser.uid,
    })
    const populatedRecord = await CoachingFeeRecord.findById(record._id)
      .populate({ path: 'studentId', select: 'name studentCode' })
      .lean()
    response.status(201).json(serialize(populatedRecord))
  } catch (error) {
    next(error)
  }
})

router.get('/centers/:centerId/exams', requireCenterMembership, requireCenterRoles(...managementRoles, 'teacher', 'student'), async (request, response, next) => {
  try {
    const { centerId } = request.coachingMembership
    const batchIds = await getMemberBatchIds(centerId, request.coachingMembership)
    const exams = await CoachingExam.find({
      centerId,
      status: 'active',
      ...(batchIds ? { batchId: { $in: batchIds } } : {}),
    })
      .populate({ path: 'batchId', select: 'name subject grade' })
      .sort({ examDate: -1, createdAt: -1 })
      .limit(200)
      .lean()
    response.json({
      truncated: exams.length === 200,
      exams: exams.map(serialize),
    })
  } catch (error) {
    next(error)
  }
})

router.post('/centers/:centerId/exams', requireCenterMembership, requireCenterRoles(...managementRoles, 'teacher'), async (request, response, next) => {
  try {
    const { batchId, title, examDate, totalMarks } = request.body ?? {}
    if (!mongoose.isValidObjectId(batchId)) return response.status(400).json({ error: 'Choose a valid batch' })
    const normalizedTitle = normalizeRequiredString(title, 'Exam title', 120)
    if (!isCalendarDate(examDate)) return response.status(400).json({ error: 'Provide a valid exam date in YYYY-MM-DD format' })
    if (!Number.isSafeInteger(totalMarks) || totalMarks < 1 || totalMarks > 100_000) {
      return response.status(400).json({ error: 'Total marks must be a whole number between 1 and 100,000' })
    }
    const { centerId, userId } = request.coachingMembership
    const batch = await CoachingBatch.findOne({ _id: batchId, centerId, status: 'active' }).lean()
    if (!batch) return response.status(404).json({ error: 'Active batch not found in this center' })
    if (!await teacherCanAccessBatch(batch, request.coachingMembership, userId, centerId)) {
      return response.status(403).json({ error: 'Teachers can only create exams for their assigned batches' })
    }
    const exam = await CoachingExam.create({
      centerId,
      batchId,
      title: normalizedTitle,
      examDate,
      totalMarks,
      createdBy: request.firebaseUser.uid,
    })
    response.status(201).json({ ...serialize(exam.toObject()), batch: serialize(batch), results: [] })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Exam title')) return response.status(400).json({ error: error.message })
    next(error)
  }
})

router.get('/centers/:centerId/exams/:examId/results', requireCenterMembership, requireCenterRoles(...managementRoles, 'teacher', 'student'), async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.examId)) return response.status(400).json({ error: 'Invalid exam' })
    const { centerId, userId, role } = request.coachingMembership
    const exam = await CoachingExam.findOne({ _id: request.params.examId, centerId, status: 'active' })
      .populate({ path: 'batchId', select: 'name subject grade' })
      .lean()
    if (!exam) return response.status(404).json({ error: 'Active exam not found in this center' })
    const batch = await CoachingBatch.findOne({ _id: exam.batchId?._id ?? exam.batchId, centerId, status: 'active' }).lean()
    if (!batch) return response.status(404).json({ error: 'Active batch not found for this exam' })
    if (!await teacherCanAccessBatch(batch, request.coachingMembership, userId, centerId)) {
      return response.status(403).json({ error: 'This exam belongs to a batch you cannot access' })
    }

    if (role === 'student') {
      const studentIds = await getMemberStudentIds(centerId, userId)
      const enrolled = await CoachingEnrollment.exists({
        centerId,
        batchId: exam.batchId?._id ?? exam.batchId,
        studentId: { $in: studentIds },
        status: 'active',
      })
      if (!enrolled) return response.status(403).json({ error: 'This exam is not available for your enrolled batches' })
      const results = await CoachingExamResult.find({
        centerId,
        examId: exam._id,
        studentId: { $in: studentIds },
      })
        .populate({ path: 'studentId', select: 'name studentCode' })
        .lean()
      return response.json({ exam: serialize(exam), results: results.map(serialize) })
    }

    const enrollments = await CoachingEnrollment.find({
      centerId,
      batchId: exam.batchId?._id ?? exam.batchId,
      status: 'active',
    })
      .populate({ path: 'studentId', match: { status: 'active' }, select: 'name studentCode' })
      .lean()
    const students = enrollments.map((enrollment) => enrollment.studentId).filter(Boolean)
    const recordedResults = students.length
      ? await CoachingExamResult.find({
          centerId,
          examId: exam._id,
          studentId: { $in: students.map((student) => student._id) },
        }).lean()
      : []
    const resultsByStudent = new Map(recordedResults.map((result) => [String(result.studentId), result]))
    response.json({
      exam: serialize(exam),
      results: students.map((student) => {
        const result = resultsByStudent.get(String(student._id))
        return {
          id: result ? String(result._id) : '',
          studentId: String(student._id),
          studentName: student.name,
          studentCode: student.studentCode,
          marks: result?.marks ?? '',
          remarks: result?.remarks ?? '',
        }
      }),
    })
  } catch (error) {
    next(error)
  }
})

router.put('/centers/:centerId/exams/:examId/results', requireCenterMembership, requireCenterRoles(...managementRoles, 'teacher'), async (request, response, next) => {
  try {
    const { examId } = request.params
    const { entries } = request.body ?? {}
    if (!mongoose.isValidObjectId(examId)) return response.status(400).json({ error: 'Invalid exam' })
    if (!Array.isArray(entries) || entries.length < 1 || entries.length > 1000) {
      return response.status(400).json({ error: 'Provide between 1 and 1,000 result entries' })
    }
    if (entries.some((entry) => (
      !entry
      || !mongoose.isValidObjectId(entry.studentId)
      || !Number.isSafeInteger(entry.marks)
      || entry.marks < 0
      || typeof entry.remarks !== 'undefined' && typeof entry.remarks !== 'string'
    ))) {
      return response.status(400).json({ error: 'Each result needs a valid student, whole-number marks, and optional text remarks' })
    }
    if (entries.some((entry) => typeof entry.remarks === 'string' && entry.remarks.trim().length > 300)) {
      return response.status(400).json({ error: 'Result remarks cannot exceed 300 characters' })
    }
    const normalizedEntries = entries.map((entry) => ({
      studentId: String(entry.studentId).toLowerCase(),
      marks: entry.marks,
      remarks: typeof entry.remarks === 'string' ? entry.remarks.trim() : '',
    }))
    const studentIds = normalizedEntries.map((entry) => entry.studentId)
    if (new Set(studentIds).size !== studentIds.length) {
      return response.status(400).json({ error: 'A student can only appear once in a result submission' })
    }

    const { centerId, userId } = request.coachingMembership
    const exam = await CoachingExam.findOne({ _id: examId, centerId, status: 'active' }).lean()
    if (!exam) return response.status(404).json({ error: 'Active exam not found in this center' })
    if (normalizedEntries.some((entry) => entry.marks > exam.totalMarks)) {
      return response.status(400).json({ error: 'A student mark cannot exceed the exam total marks' })
    }
    const batch = await CoachingBatch.findOne({ _id: exam.batchId, centerId, status: 'active' }).lean()
    if (!batch) return response.status(404).json({ error: 'Active batch not found for this exam' })
    if (!await teacherCanAccessBatch(batch, request.coachingMembership, userId, centerId)) {
      return response.status(403).json({ error: 'Teachers can only record results for their assigned batches' })
    }
    const [enrolledIds, activeStudentIds] = await Promise.all([
      CoachingEnrollment.find({
        centerId,
        batchId: exam.batchId,
        studentId: { $in: studentIds },
        status: 'active',
      }).distinct('studentId'),
      CoachingStudent.find({ centerId, _id: { $in: studentIds }, status: 'active' }).distinct('_id'),
    ])
    if (enrolledIds.length !== studentIds.length || activeStudentIds.length !== studentIds.length) {
      return response.status(400).json({ error: 'Results can only be recorded for active students enrolled in this exam batch' })
    }

    await CoachingExamResult.bulkWrite(normalizedEntries.map((entry) => ({
      updateOne: {
        filter: { centerId, examId, studentId: entry.studentId },
        update: {
          $set: {
            batchId: exam.batchId,
            marks: entry.marks,
            remarks: entry.remarks,
            recordedBy: request.firebaseUser.uid,
          },
        },
        upsert: true,
      },
    })))
    response.json({ saved: normalizedEntries.length, examId })
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ error: 'Results changed at the same time; reload and try again' })
    next(error)
  }
})

router.get('/centers/:centerId/notices', requireCenterMembership, async (request, response, next) => {
  try {
    const { centerId } = request.coachingMembership
    const batchIds = await getMemberBatchIds(centerId, request.coachingMembership)
    const today = new Date().toISOString().slice(0, 10)
    const notices = await CoachingNotice.find({
      centerId,
      status: 'active',
      $and: [
        { $or: [{ expiresAt: '' }, { expiresAt: { $gte: today } }] },
        batchIds
          ? { $or: [{ audience: 'all' }, { batchId: { $in: batchIds } }] }
          : {},
      ],
    })
      .populate({ path: 'batchId', select: 'name' })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()
    const readNotices = notices.length
      ? await CoachingNoticeRead.find({
          centerId,
          userId: request.firebaseUser.uid,
          noticeId: { $in: notices.map((notice) => notice._id) },
        }).distinct('noticeId')
      : []
    const readNoticeIds = new Set(readNotices.map(String))
    response.json({
      notices: notices.map((notice) => ({ ...serialize(notice), isRead: readNoticeIds.has(String(notice._id)) })),
      unreadCount: notices.filter((notice) => !readNoticeIds.has(String(notice._id))).length,
      truncated: notices.length === 200,
    })
  } catch (error) {
    next(error)
  }
})

router.post('/centers/:centerId/notices/:noticeId/read', requireCenterMembership, async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.noticeId)) return response.status(400).json({ error: 'Invalid notice' })
    const { centerId, userId } = request.coachingMembership
    const batchIds = await getMemberBatchIds(centerId, request.coachingMembership)
    const today = new Date().toISOString().slice(0, 10)
    const notice = await CoachingNotice.findOne({
      _id: request.params.noticeId,
      centerId,
      status: 'active',
      $and: [
        { $or: [{ expiresAt: '' }, { expiresAt: { $gte: today } }] },
        batchIds ? { $or: [{ audience: 'all' }, { batchId: { $in: batchIds } }] } : {},
      ],
    }).lean()
    if (!notice) return response.status(404).json({ error: 'Active notice not found for this coaching member' })
    const noticeRead = await CoachingNoticeRead.findOneAndUpdate(
      { centerId, noticeId: notice._id, userId },
      { $setOnInsert: { readAt: new Date() } },
      { new: true, upsert: true, runValidators: true },
    )
    response.json({ noticeId: String(notice._id), isRead: true, readAt: noticeRead.readAt })
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ error: 'Notice read status changed; refresh the notice list' })
    next(error)
  }
})

router.post('/centers/:centerId/notices', requireCenterMembership, requireCenterRoles(...managementRoles, 'teacher'), async (request, response, next) => {
  try {
    const { title, message, audience = 'all', batchId, expiresAt = '' } = request.body ?? {}
    const normalizedTitle = normalizeRequiredString(title, 'Notice title', 120)
    const normalizedMessage = normalizeRequiredString(message, 'Notice message', 3000)
    if (!['all', 'batch'].includes(audience)) return response.status(400).json({ error: 'Choose a valid notice audience' })
    if (expiresAt && !isCalendarDate(expiresAt)) return response.status(400).json({ error: 'Provide a valid expiry date in YYYY-MM-DD format' })
    const { centerId, userId, role } = request.coachingMembership
    let targetBatchId = null
    if (audience === 'batch') {
      if (!mongoose.isValidObjectId(batchId)) return response.status(400).json({ error: 'Choose a valid batch for this notice' })
      const batch = await CoachingBatch.findOne({ _id: batchId, centerId, status: 'active' }).lean()
      if (!batch) return response.status(404).json({ error: 'Active batch not found in this center' })
      if (!await teacherCanAccessBatch(batch, request.coachingMembership, userId, centerId)) {
        return response.status(403).json({ error: 'Teachers can only send notices to their assigned batches' })
      }
      targetBatchId = batch._id
    } else if (role === 'teacher') {
      return response.status(403).json({ error: 'Teachers can only send notices to their assigned batches' })
    }
    const notice = await CoachingNotice.create({
      centerId,
      title: normalizedTitle,
      message: normalizedMessage,
      audience,
      batchId: targetBatchId,
      expiresAt,
      createdBy: userId,
      creatorName: request.firebaseUser.name ?? '',
    })
    const populatedNotice = await CoachingNotice.findById(notice._id)
      .populate({ path: 'batchId', select: 'name' })
      .lean()
    response.status(201).json(serialize(populatedNotice))
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Notice title')) return response.status(400).json({ error: error.message })
    if (error instanceof Error && error.message.startsWith('Notice message')) return response.status(400).json({ error: error.message })
    next(error)
  }
})

router.patch('/centers/:centerId/notices/:noticeId', requireCenterMembership, requireCenterRoles(...managementRoles), async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.noticeId)) return response.status(400).json({ error: 'Invalid notice' })
    const { status } = request.body ?? {}
    if (!['active', 'archived'].includes(status)) return response.status(400).json({ error: 'Notice status must be active or archived' })
    const notice = await CoachingNotice.findOneAndUpdate(
      { _id: request.params.noticeId, centerId: request.params.centerId },
      { $set: { status } },
      { new: true, runValidators: true },
    )
      .populate({ path: 'batchId', select: 'name' })
      .lean()
    if (!notice) return response.status(404).json({ error: 'Notice not found in this center' })
    response.json(serialize(notice))
  } catch (error) {
    next(error)
  }
})

export default router
