import AnimatedNumber from '../../components/ui/AnimatedNumber.jsx'

const subjectIcons = {
  math: '🧮',
  science: '🧪',
  english: '🔤',
  bangla: '✏️',
  'bangla-1': '✏️',
  'bangla-2': '✏️',
  'english-1': '🔤',
  'english-2': '🔤',
  'general-science': '🧪',
  'global-studies': '🗺️',
  ict: '💻',
  Agriculture: '🌱',
  HigherMath: '🧮',
  islam: '🕌',
  hindu: '🪔',
}

export function Mascot({ mood = 'happy', className = '' }) {
  return (
    <span className={`student-mascot student-mascot-${mood} ${className}`} role="img" aria-label="তোমার বন্ধু পেঁচু">
      <span className="student-mascot-face">🦉</span>
      <span className="student-mascot-cheek student-mascot-cheek-left" />
      <span className="student-mascot-cheek student-mascot-cheek-right" />
    </span>
  )
}

export function FloatingDecorations() {
  return (
    <div className="student-floating-decorations" aria-hidden="true">
      <span>⭐</span><span>☁️</span><span>📚</span><span>✨</span><span>🚀</span>
    </div>
  )
}

export function XPBar({ xp }) {
  const level = Math.floor(xp / 100) + 1
  const progress = xp % 100

  return (
    <div className="student-xp-card">
      <div className="student-xp-heading">
        <span className="student-xp-icon" aria-hidden="true">⚡</span>
        <div><strong>লেভেল {level}</strong><small><AnimatedNumber value={xp} /> XP</small></div>
        <span className="student-xp-next">আর {100 - progress} XP-তে পরের লেভেল</span>
      </div>
      <div className="student-xp-track" role="progressbar" aria-label="পরের লেভেলে এগোনোর অগ্রগতি" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

export function StreakBadge({ streak, badges }) {
  const badgeLabels = {
    firstExam: 'প্রথম পরীক্ষা',
    fiveDayStreak: '৫ দিনের স্ট্রিক',
    mathMaster: 'গণিত মাস্টার',
  }

  return (
    <div className="student-collectibles">
      <div className="student-streak-badge"><span aria-hidden="true">🔥</span><div><strong>{streak} দিনের স্ট্রিক</strong><small>শিখতে থাকো!</small></div></div>
      <div className="student-star-badge"><span aria-hidden="true">🏅</span><div><strong>{badges.length}টি ব্যাজ</strong><small>তোমার সংগ্রহ</small></div></div>
      <div className="student-badge-list">{badges.length > 0
        ? badges.map((badge) => <span key={badge}>🏅 {badgeLabels[badge] || 'শিক্ষার্থী ব্যাজ'}</span>)
        : <span>প্রথম ব্যাজের পথে! ⭐</span>}</div>
    </div>
  )
}

export function Podium({ entries, bengaliNumber }) {
  if (!entries?.length) return null
  const places = [
    { entry: entries[1], place: 2, medal: '🥈' },
    { entry: entries[0], place: 1, medal: '👑' },
    { entry: entries[2], place: 3, medal: '🥉' },
  ]

  return (
    <div className="student-podium" aria-label="সাপ্তাহিক র‍্যাঙ্কের সেরা তিনজন">
      {places.map(({ entry, place, medal }) => (
        <div className={`student-podium-place student-podium-place-${place}`} key={place}>
          {entry ? <>
            <span className="student-podium-medal" aria-hidden="true">{medal}</span>
            <span className="student-podium-avatar">{entry.photoURL && <img src={entry.photoURL} alt="" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none' }} />}{(entry.displayName || '?').trim().charAt(0)}</span>
            <strong title={entry.displayName}>{entry.displayName}</strong>
            <small>{bengaliNumber(entry.score)} / {bengaliNumber(entry.totalQuestions)}</small>
            <span className="student-podium-step">{bengaliNumber(place)}</span>
          </> : <span className="student-podium-empty" aria-hidden="true">⭐</span>}
        </div>
      ))}
    </div>
  )
}

export function SubjectIcon({ subject }) {
  return <span className="student-subject-icon" aria-hidden="true">{subjectIcons[subject] || '📖'}</span>
}
