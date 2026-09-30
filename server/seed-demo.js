import dotenv from 'dotenv'
import mongoose from 'mongoose'
import process from 'node:process'
import { Question } from './models.js'

dotenv.config()

const demoQuestions = [
  {
    type: 'short',
    chapter: 'জ্যামিতি',
    prompt: 'চিত্রের ত্রিভুজ ABC-তে AB = ৩ সেমি, BC = ৪ সেমি ও CA = ৫ সেমি। ত্রিভুজটির পরিসীমা নির্ণয় কর।',
    answer: '১২ সেমি',
    marks: 2,
    figure: 'triangle',
  },
  {
    type: 'short',
    chapter: 'জ্যামিতি',
    prompt: 'চিত্রে O কেন্দ্রবিশিষ্ট বৃত্তের ব্যাসার্ধ ৭ সেমি। বৃত্তটির ব্যাস কত?',
    answer: '১৪ সেমি',
    marks: 2,
    figure: 'circle',
  },
  {
    type: 'long',
    chapter: 'জ্যামিতি',
    prompt: 'চিত্রের আয়তক্ষেত্রের দৈর্ঘ্য ৮ সেমি ও প্রস্থ ৫ সেমি। এর ক্ষেত্রফল ও পরিসীমা নির্ণয় কর।',
    answer: 'ক্ষেত্রফল ৪০ বর্গসেমি এবং পরিসীমা ২৬ সেমি।',
    marks: 4,
    figure: 'rectangle',
  },
]

async function seed() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing. Set it in .env first.')
  await mongoose.connect(process.env.MONGODB_URI)
  for (const question of demoQuestions) {
    await Question.updateOne(
      { subject: 'math', grade: 7, prompt: question.prompt },
      { $setOnInsert: { ...question, subject: 'math', grade: 7 } },
      { upsert: true },
    )
  }
  console.log('Geometry demo questions are ready in MongoDB.')
  await mongoose.disconnect()
}

seed().catch(async (error) => {
  console.error(error.message)
  await mongoose.disconnect()
  process.exitCode = 1
})
