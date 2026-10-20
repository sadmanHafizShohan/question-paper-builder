export const banglaSecondPaperSections = [
  { id: 'paragraph', label: 'অনুচ্ছেদ রচনা', aliases: ['অনুচ্ছেদ'], marks: 10 },
  { id: 'letter', label: 'পত্র রচনা', aliases: ['পত্র'], marks: 10 },
  { id: 'summary', label: 'সারাংশ / সারমর্ম', aliases: ['সারাংশ', 'সারমর্ম'], marks: 10 },
  { id: 'expansion', label: 'ভাবসম্প্রসারণ', aliases: ['ভাব সম্প্রসারণ'], marks: 10 },
  { id: 'report', label: 'প্রতিবেদন রচনা', aliases: ['প্রতিবেদন'], marks: 10 },
  { id: 'essay', label: 'প্রবন্ধ রচনা', aliases: ['প্রবন্ধ'], marks: 20 },
]

export const banglaSecondPaperChapter = (sectionId) => `বাংলা ২য় পত্র/${sectionId}`
