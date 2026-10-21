import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Building2,
  Check,
  ClipboardList,
  Code2,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Layers3,
  Menu,
  Printer,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import './PublicLandingPage.css'
import QuestionBankTotal from '../../components/question-bank/QuestionBankTotal.jsx'
import { apiUrl } from '../../shared/api.js'

const features = [
  {
    icon: Layers3,
    title: 'শ্রেণি ও বিষয়ভিত্তিক প্রশ্ন ব্যাংক',
    description: 'শ্রেণি, বিষয় ও অধ্যায় ধরে প্রশ্ন খুঁজুন—প্রশ্নের ধরন অনুযায়ী সাজানো ব্যাংক থেকে।',
  },
  {
    icon: BookOpen,
    title: 'প্রশ্ন তৈরি ও সম্পাদনা',
    description: 'MCQ, সংক্ষিপ্ত, সৃজনশীলসহ বিভিন্ন ধরনে প্রশ্ন ও উত্তর তৈরি বা সম্পাদনা করুন।',
  },
  {
    icon: FileSpreadsheet,
    title: 'Excel থেকে প্রশ্ন যোগ',
    description: 'Bulk importer দিয়ে স্প্রেডশিটের প্রশ্ন আনুন; ডুপ্লিকেট শনাক্ত করে ব্যাংক গোছান।',
  },
  {
    icon: ClipboardList,
    title: 'নিজের মতো প্রশ্নপত্র',
    description: 'প্রশ্ন বেছে নিন, ধরনভিত্তিক সংখ্যা ঠিক করুন এবং প্রিভিউতে সাজানো প্রশ্নপত্র দেখুন।',
  },
  {
    icon: GraduationCap,
    title: 'শিক্ষার্থীদের অনলাইন পরীক্ষা',
    description: 'সময় ধরে পরীক্ষা দিন, উত্তর জমা দিন এবং ফলাফল, উত্তর পর্যালোচনা ও leaderboard দেখুন।',
  },
  {
    icon: Building2,
    title: 'কোচিং সেন্টার পরিচালনা',
    description: 'শিক্ষার্থী, শিক্ষক, ব্যাচ, উপস্থিতি, ফি, পরীক্ষা-ফলাফল ও নোটিশ এক জায়গায় সামলান।',
  },
  {
    icon: Users,
    title: 'দল ও অ্যাক্সেস ব্যবস্থাপনা',
    description: 'প্রতিষ্ঠানের সদস্যদের ভূমিকা অনুযায়ী কাজের সুযোগ দিন; admin content request-ও পরিচালনা করুন।',
  },
  {
    icon: Printer,
    title: 'PDF বা প্রিন্ট',
    description: 'প্রশ্নপত্রের প্রিভিউ থেকে লাইভ এডিট করুন, PDF হিসেবে সংরক্ষণ করুন বা প্রিন্ট করুন।',
  },
]

const audiences = [
  {
    icon: BookOpen,
    className: 'teacher',
    title: 'শিক্ষকের কাজ',
    description: 'প্রশ্ন সাজানো থেকে ক্লাসের জন্য প্রশ্নপত্র—প্রস্তুতির পুরো কাজ এক workspace-এ।',
    points: ['প্রশ্ন ব্যাংক তৈরি ও খোঁজা', 'নির্বাচিত প্রশ্নে paper set', 'প্রিভিউ, সম্পাদনা ও প্রিন্ট'],
  },
  {
    icon: GraduationCap,
    className: 'student',
    title: 'শিক্ষার্থীর শেখা',
    description: 'অনুশীলনমূলক পরীক্ষা দিয়ে নিজের অগ্রগতি দেখুন, ভুল উত্তর থেকে শিখুন।',
    points: ['সময়-নির্ধারিত পরীক্ষা', 'ফলাফল ও উত্তর পর্যালোচনা', 'Leaderboard ও শিক্ষক অনুরোধ'],
  },
  {
    icon: Building2,
    className: 'coaching',
    title: 'কোচিং সেন্টারের পরিচালনা',
    description: 'কেন্দ্রের দৈনন্দিন একাডেমিক ও প্রশাসনিক কাজ একই জায়গা থেকে পরিচালনা করুন।',
    points: ['শিক্ষার্থী, শিক্ষক ও ব্যাচ', 'উপস্থিতি ও ফি রেকর্ড', 'পরীক্ষা, ফলাফল ও নোটিশ'],
  },
]

const steps = [
  {
    number: '০১',
    title: 'শ্রেণি, বিষয় ও অধ্যায় নির্বাচন করুন।',
    description: 'যে পাঠের জন্য প্রশ্নপত্র তৈরি করবেন, তার প্রাসঙ্গিক বিষয় ও অধ্যায় বেছে নিন।',
  },
  {
    number: '০২',
    title: 'পছন্দের প্রশ্নগুলো নির্বাচন করুন।',
    description: 'প্রশ্ন ব্যাংক থেকে প্রশ্ন বাছুন, অথবা প্রশ্নের ধরন অনুযায়ী প্রশ্নসংখ্যা নির্ধারণ করুন।',
  },
  {
    number: '০৩',
    title: 'প্রশ্নপত্র তৈরি করুন এবং ব্যবহার করুন।',
    description: 'প্রিভিউ দেখে তৈরি প্রশ্নপত্র PDF হিসেবে সংরক্ষণ বা প্রিন্ট করুন।',
  },
]

function PaperPreview() {
  return (
    <div className="landing-preview" aria-label="প্রশ্নপত্রের নমুনা প্রিভিউ" role="img">
      <div className="landing-preview-toolbar">
        <span className="landing-toolbar-dot" />
        <span className="landing-toolbar-dot" />
        <span className="landing-toolbar-dot" />
        <span className="landing-toolbar-label">প্রশ্নপত্র প্রিভিউ</span>
        <Printer size={15} aria-hidden="true" />
      </div>
      <div className="landing-paper">
        <div className="landing-paper-topline">প্রশ্নঘর <span>নমুনা প্রিভিউ</span></div>
        <h2>বার্ষিক মূল্যায়ন</h2>
        <p className="landing-paper-subtitle">শ্রেণি: অষ্টম <span>বিষয়: গণিত</span></p>
        <div className="landing-paper-meta"><span>সময়: ২ ঘণ্টা</span><span>পূর্ণমান: ৫০</span></div>
        <div className="landing-paper-rule" />
        <div className="landing-paper-section">
          <strong>ক. বহুনির্বাচনি প্রশ্ন</strong>
          <span>সঠিক উত্তরটি নির্বাচন করো।</span>
        </div>
        <div className="landing-paper-question">
          <b>১.</b><span> ১২ ও ১৮-এর গ.সা.গু কত?</span>
          <div className="landing-paper-options"><span>ক) ২</span><span>খ) ৩</span><span>গ) ৬</span><span>ঘ) ৯</span></div>
        </div>
        <div className="landing-paper-question">
          <b>২.</b><span> একটি বর্গের বাহু ৫ সেমি হলে ক্ষেত্রফল কত?</span>
          <div className="landing-paper-options"><span>ক) ১০</span><span>খ) ২০</span><span>গ) ২৫</span><span>ঘ) ৩০</span></div>
        </div>
        <div className="landing-paper-section landing-paper-second-section">
          <strong>খ. সংক্ষিপ্ত প্রশ্ন</strong>
          <span>যেকোনো দুটি প্রশ্নের উত্তর দাও।</span>
        </div>
        <div className="landing-paper-lines"><i /><i /><i /></div>
      </div>
      <div className="landing-preview-chip"><Check size={15} aria-hidden="true" /> নিজের মতো সাজান</div>
    </div>
  )
}

function PlatformIllustration() {
  return (
    <div className="landing-platform-visual" aria-label="প্রশ্নঘরের প্রশ্ন ব্যাংক, শিক্ষক, শিক্ষার্থী ও প্রতিষ্ঠানের কাজের ভিজ্যুয়াল সারাংশ" role="img">
      <svg className="landing-platform-orbit" viewBox="0 0 600 520" aria-hidden="true">
        <ellipse cx="300" cy="260" rx="260" ry="196" />
        <ellipse cx="300" cy="260" rx="210" ry="153" />
        <path d="M67 260h466M300 47v426" />
        <circle cx="300" cy="64" r="5" />
        <circle cx="526" cy="260" r="5" />
        <circle cx="300" cy="456" r="5" />
        <circle cx="74" cy="260" r="5" />
      </svg>
      <span className="landing-visual-shape landing-visual-shape-one" aria-hidden="true" />
      <span className="landing-visual-shape landing-visual-shape-two" aria-hidden="true" />
      <span className="landing-visual-shape landing-visual-shape-three" aria-hidden="true" />
      <div className="landing-orbit-card landing-orbit-bank">
        <span><Search size={16} /></span><b>প্রশ্ন ব্যাংক</b><i><i /></i>
      </div>
      <div className="landing-orbit-card landing-orbit-teacher">
        <span><BookOpen size={16} /></span><b>শিক্ষক</b><small>প্রশ্নপত্র তৈরি</small>
      </div>
      <div className="landing-orbit-card landing-orbit-student">
        <span><GraduationCap size={17} /></span><b>শিক্ষার্থী</b><small>অনলাইন পরীক্ষা</small>
      </div>
      <div className="landing-orbit-card landing-orbit-center">
        <span><Building2 size={16} /></span><b>কোচিং সেন্টার</b><small>দৈনন্দিন পরিচালনা</small>
      </div>
      <div className="landing-orbit-centerpiece"><PaperPreview /></div>
      <span className="landing-visual-spark landing-visual-spark-one"><Sparkles size={22} /></span>
      <span className="landing-visual-spark landing-visual-spark-two"><Sparkles size={15} /></span>
    </div>
  )
}

export default function PublicLandingPage() {
  const pageRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  useEffect(() => {
    const page = pageRef.current
    if (!page) return undefined

    let active = true
    let media
    Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
      .then(([gsapModule, scrollTriggerModule]) => {
        if (!active) return

        const { gsap } = gsapModule
        gsap.registerPlugin(scrollTriggerModule.ScrollTrigger)
        media = gsap.matchMedia(page)
        media.add('(prefers-reduced-motion: no-preference)', () => {
          const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
          intro.from('.landing-header .landing-brand', {
            autoAlpha: 0,
            y: -14,
            duration: 0.55,
          })
            .from('.landing-nav > *, .landing-nav-actions > *', {
              autoAlpha: 0,
              y: -10,
              duration: 0.4,
              stagger: 0.055,
            }, '-=0.28')
            .from('.landing-hero-copy > *', {
              autoAlpha: 0,
              y: 22,
              duration: 0.65,
              stagger: 0.11,
            }, '-=0.12')
            .fromTo('.landing-preview', {
              autoAlpha: 0,
              y: 38,
              rotate: 4,
              scale: 0.95,
            }, {
              autoAlpha: 1,
              y: 0,
              rotate: 1.3,
              scale: 1,
              duration: 0.9,
            }, '-=0.55')
            .from('.landing-preview-chip', {
              autoAlpha: 0,
              x: 18,
              y: 8,
              duration: 0.5,
            }, '-=0.35')

          gsap.to('.landing-preview', {
            y: -8,
            rotate: 0.6,
            duration: 3.2,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            delay: 1,
          })
          gsap.to('.landing-preview-chip', {
            y: -6,
            duration: 2.4,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            delay: 1.2,
          })
          gsap.from('.landing-paper > *', {
            autoAlpha: 0,
            y: 5,
            duration: 0.35,
            stagger: 0.08,
            delay: 0.65,
            ease: 'power2.out',
          })

          const revealGroups = [
            ['.landing-feature-card', '.landing-feature-grid'],
            ['.landing-step', '.landing-steps'],
            ['.landing-audience-card', '.landing-audience-grid'],
          ]

          revealGroups.forEach(([items, trigger]) => {
            gsap.from(items, {
              autoAlpha: 0,
              y: 32,
              scale: 0.97,
              duration: 0.7,
              stagger: 0.12,
              ease: 'power3.out',
              scrollTrigger: {
                trigger,
                start: 'top 82%',
                once: true,
              },
            })
          })

          gsap.utils.toArray(
            '.landing-section-heading, .landing-about-mark, .landing-about > div:nth-child(2), .landing-developer-photo-wrap, .landing-developer-copy, .landing-faq-list',
            page,
          ).forEach((element) => {
            gsap.from(element, {
              autoAlpha: 0,
              y: 28,
              duration: 0.75,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: element,
                start: 'top 86%',
                once: true,
              },
            })
          })
        })
      })

      .catch((error) => {
        console.error('Public landing page animations could not be loaded', error)
      })

    return () => {
      active = false
      media?.revert()
    }
  }, [])

  return (
    <div className="public-landing" ref={pageRef}>
      <header className="landing-header">
        <div className="landing-header-inner">
          <a className="landing-brand" href="#" aria-label="প্রশ্নঘর হোম">
            <span className="landing-brand-icon"><BookOpen size={23} aria-hidden="true" /></span>
            <span><strong>প্রশ্নঘর</strong><small>শিক্ষার সব কাজ এক জায়গায়</small></span>
          </a>
          <button
            className="landing-menu-toggle"
            type="button"
            aria-label={menuOpen ? 'মেনু বন্ধ করুন' : 'মেনু খুলুন'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <nav className={`landing-nav ${menuOpen ? 'landing-nav-open' : ''}`} aria-label="প্রধান নেভিগেশন">
            <a href="#" onClick={closeMenu}>হোম</a>
            <a href="#features" onClick={closeMenu}>ফিচার</a>
            <a href="#how-it-works" onClick={closeMenu}>যেভাবে কাজ করে</a>
            <a href="#roles" onClick={closeMenu}>কার জন্য</a>
            <a href="#about" onClick={closeMenu}>আমাদের কথা</a>
            <a href="#developer" onClick={closeMenu}>ডেভেলপার</a>
            <div className="landing-nav-actions">
              <a className="landing-login-link" href="#/login" onClick={closeMenu}>লগইন</a>
              <a className="landing-register-link" href="#/register" onClick={closeMenu}>নিবন্ধন <ArrowRight size={15} /></a>
            </div>
          </nav>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-inner">
            <div className="landing-hero-copy">
              <span className="landing-eyebrow"><span /> শিক্ষক · শিক্ষার্থী · শিক্ষা প্রতিষ্ঠান</span>
              <h1>শেখানো, শেখা আর পরিচালনা—<span>সব এক প্রশ্নঘরে</span></h1>
              <p>প্রশ্ন ব্যাংক ও প্রশ্নপত্র তৈরি থেকে অনলাইন পরীক্ষা এবং কোচিং সেন্টার পরিচালনা—আপনার শিক্ষার কাজগুলো এক জায়গায় গুছিয়ে নিন।</p>
              <div className="landing-hero-actions">
                <a className="landing-button-primary" href="#/register">শুরু করুন <ArrowRight size={18} /></a>
                <a className="landing-button-secondary" href="#/login">লগইন করুন</a>
              </div>
              <QuestionBankTotal apiUrl={apiUrl} className="landing-question-bank-total" />
              <div className="landing-hero-note"><Check size={16} /> Google দিয়ে সাইন ইন করে শুরু করুন</div>
            </div>
            <div className="landing-hero-art"><PlatformIllustration /></div>
          </div>
          <div className="landing-hero-bottom" aria-hidden="true" />
        </section>

        <section className="landing-features landing-section" id="features">
          <div className="landing-section-heading">
            <span className="landing-section-kicker">একটি প্ল্যাটফর্মে সম্পূর্ণ workflow</span>
            <h2>শুধু প্রশ্নপত্র নয়—শিক্ষার পুরো কাজ</h2>
            <p>প্রশ্ন তৈরি, পরীক্ষা নেওয়া ও প্রতিষ্ঠান পরিচালনার দরকারি টুলগুলো একসঙ্গে ব্যবহার করুন।</p>
          </div>
          <div className="landing-feature-grid">
            {features.map(({ icon: Icon, title, description }, index) => (
              <article className="landing-feature-card" key={title}>
                <span className={`landing-feature-icon landing-feature-icon-${index + 1}`}><Icon size={21} strokeWidth={1.9} /></span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-work-section" id="how-it-works">
          <div className="landing-section landing-work-inner">
            <div className="landing-section-heading landing-work-heading">
              <span className="landing-section-kicker">সহজ তিনটি ধাপ</span>
              <h2>ভাবনা থেকে প্রশ্নপত্র</h2>
              <p>আপনার পাঠের চাহিদা অনুযায়ী প্রশ্ন বেছে নিন, তারপর তৈরি প্রশ্নপত্রটি ব্যবহার করুন।</p>
            </div>
            <div className="landing-steps">
              {steps.map((step) => (
                <article className="landing-step" key={step.number}>
                  <span className="landing-step-number">{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-audience-section landing-section" id="roles">
          <div className="landing-section-heading">
            <span className="landing-section-kicker">আপনার ভূমিকার জন্য আলাদা workspace</span>
            <h2>আপনি যেখানেই থাকুন, কাজ এগোবে</h2>
            <p>নিজের account-এ প্রবেশ করলেই আপনার ভূমিকা অনুযায়ী দরকারি কাজগুলো সামনে পাবেন।</p>
          </div>
          <div className="landing-audience-grid">
            {audiences.map(({ icon: Icon, className, title, description, points }) => (
              <article className={`landing-audience-card landing-audience-${className}`} key={title}>
                <span className="landing-audience-icon"><Icon size={25} strokeWidth={1.8} /></span>
                <span className="landing-audience-orbit" aria-hidden="true" />
                <h3>{title}</h3>
                <p>{description}</p>
                <ul>{points.map((point) => <li key={point}><Check size={15} />{point}</li>)}</ul>
                <a href="#/register">শুরু করুন <ArrowRight size={16} /></a>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-about landing-section" id="about">
          <div className="landing-about-mark"><FileText size={27} /></div>
          <div>
            <span className="landing-section-kicker">শিক্ষার জন্য তৈরি</span>
            <h2>শিক্ষার কাজ হোক আরও গোছানো</h2>
            <p>প্রশ্নঘর একসঙ্গে আনে শ্রেণি ও বিষয়ভিত্তিক প্রশ্ন ব্যাংক, প্রশ্নপত্র তৈরি, শিক্ষার্থীদের অনলাইন পরীক্ষা এবং কোচিং সেন্টারের একাডেমিক ও প্রশাসনিক কাজ।</p>
          </div>
        </section>

        <section className="landing-developer-section" id="developer">
          <div className="landing-developer-inner">
            <div className="landing-developer-photo-wrap">
              <img src="/login_Image2.jpg" alt="প্রশ্নঘরের ডেভেলপার Md. Shohanoor Rahman Shohan" />
              <span className="landing-developer-photo-badge"><Code2 size={16} /> প্রশ্নঘরের নির্মাতা</span>
            </div>
            <div className="landing-developer-copy">
              <span className="landing-section-kicker">পরিচয়ের পেছনের মানুষ</span>
              <h2>যার হাতে এই জাদু</h2>
              <span className="landing-developer-name">Md. Shohanoor Rahman Shohan</span>
              <p>প্রশ্নঘর তৈরি করেছেন এমন একটি সহজ কর্মক্ষেত্র হিসেবে, যেখানে শিক্ষকরা প্রশ্ন খুঁজে, বেছে এবং সাজিয়ে নিজেদের প্রয়োজনমতো প্রশ্নপত্র তৈরি করতে পারেন।</p>
              <a href="#/register">প্রশ্নঘর ঘুরে দেখুন <ArrowRight size={17} /></a>
            </div>
          </div>
        </section>

        <section className="landing-faq landing-section" aria-labelledby="landing-faq-title">
          <div className="landing-section-heading">
            <span className="landing-section-kicker">সাধারণ জিজ্ঞাসা</span>
            <h2 id="landing-faq-title">জেনে নিন</h2>
          </div>
          <div className="landing-faq-list">
            <details>
              <summary>কীভাবে অ্যাকাউন্টে প্রবেশ করব?</summary>
              <p>লগইন বা নিবন্ধন বেছে Google দিয়ে সাইন ইন করুন। নতুন Google account স্বয়ংক্রিয়ভাবে Student account হিসেবে তৈরি হয়।</p>
            </details>
            <details>
              <summary>শিক্ষক হিসেবে কীভাবে ব্যবহার শুরু করব?</summary>
              <p>Student account থেকে শিক্ষক হওয়ার অনুরোধ পাঠানো যায়। Admin অনুমোদন করলে শিক্ষক role দেওয়া হয়।</p>
            </details>
            <details>
              <summary>প্রশ্নপত্র কি PDF বা প্রিন্ট করা যাবে?</summary>
              <p>হ্যাঁ। প্রশ্নপত্রের প্রিভিউতে PDF / প্রিন্ট অপশন ব্যবহার করে সংরক্ষণ বা প্রিন্ট করতে পারবেন।</p>
            </details>
            <details>
              <summary>কোচিং সেন্টারের কী কী কাজ করা যায়?</summary>
              <p>সেন্টার, সদস্য, শিক্ষার্থী, শিক্ষক, ব্যাচ, উপস্থিতি, ফি, পরীক্ষা-ফলাফল এবং নোটিশ পরিচালনা করা যায়।</p>
            </details>
            <details>
              <summary>শিক্ষার্থীরা কি অনলাইনে পরীক্ষা দিতে পারে?</summary>
              <p>হ্যাঁ। শিক্ষার্থীরা সময়-নির্ধারিত পরীক্ষা দিতে, ফলাফল ও উত্তর পর্যালোচনা করতে এবং leaderboard দেখতে পারে।</p>
            </details>
          </div>
        </section>

        <section className="landing-cta">
          <div className="landing-cta-inner">
            <div>
              <span>আজই শুরু করুন</span>
              <h2>শিক্ষার কাজগুলো এক জায়গায় গুছিয়ে শুরু করুন।</h2>
            </div>
            <a className="landing-cta-button" href="#/register">প্রশ্নঘরে প্রবেশ করুন <ArrowRight size={18} /></a>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <a className="landing-brand landing-footer-brand" href="#">
            <span className="landing-brand-icon"><BookOpen size={22} aria-hidden="true" /></span>
            <span><strong>প্রশ্নঘর</strong><small>শিক্ষার সব কাজ এক জায়গায়</small></span>
          </a>
          <p>প্রশ্ন ব্যাংক, অনলাইন পরীক্ষা ও শিক্ষা প্রতিষ্ঠান পরিচালনার workspace।</p>
          <span className="landing-footer-copyright">© {new Date().getFullYear()} প্রশ্নঘর</span>
        </div>
      </footer>
    </div>
  )
}
