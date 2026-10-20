import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Check,
  ClipboardList,
  Code2,
  FileText,
  Layers3,
  Menu,
  Printer,
  Quote,
  Shapes,
  Star,
  X,
} from 'lucide-react'
import './PublicLandingPage.css'
import QuestionBankTotal from '../../components/question-bank/QuestionBankTotal.jsx'
import { apiUrl } from '../../shared/api.js'

const features = [
  {
    icon: Layers3,
    title: 'শ্রেণিভিত্তিক প্রশ্ন ব্যবস্থাপনা',
    description: 'পঞ্চম থেকে দশম শ্রেণির জন্য সাজানো প্রশ্ন ব্যাংক থেকে আপনার শ্রেণির প্রশ্ন দেখুন।',
  },
  {
    icon: BookOpen,
    title: 'বিষয় ও অধ্যায় অনুযায়ী',
    description: 'বিষয় এবং অধ্যায় বেছে প্রাসঙ্গিক প্রশ্ন খুঁজে নিন—প্রস্তুতি থাকে গোছানো।',
  },
  {
    icon: Shapes,
    title: 'বিভিন্ন ধরনের প্রশ্ন',
    description: 'MCQ-এর পাশাপাশি সংক্ষিপ্ত, সৃজনশীল, বর্ণনামূলক ও অন্যান্য প্রশ্নের ধরন ব্যবহার করুন।',
  },
  {
    icon: ClipboardList,
    title: 'নিজের মতো প্রশ্নপত্র',
    description: 'প্রশ্ন বেছে নিন অথবা ধরনভিত্তিক সংখ্যা ঠিক করে পছন্দমতো প্রশ্নপত্র সাজান।',
  },
  {
    icon: Check,
    title: 'শিক্ষকের কাজের উপযোগী',
    description: 'প্রশ্ন খোঁজা থেকে বাছাই—একটি সহজ কর্মপ্রবাহে প্রস্তুতির ধাপগুলো এগিয়ে নিন।',
  },
  {
    icon: Printer,
    title: 'PDF বা প্রিন্ট',
    description: 'তৈরি প্রশ্নপত্রের প্রিভিউ দেখে PDF হিসেবে সংরক্ষণ করুন বা প্রিন্ট করুন।',
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
            ['.landing-review-card', '.landing-review-grid'],
            ['.landing-price-card', '.landing-pricing-grid'],
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
            <span><strong>প্রশ্নঘর</strong><small>প্রশ্নপত্র তৈরি হোক সহজে</small></span>
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
            <a href="#reviews" onClick={closeMenu}>রিভিউ</a>
            <a href="#pricing" onClick={closeMenu}>প্রাইসিং</a>
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
              <span className="landing-eyebrow"><span /> শিক্ষকদের প্রশ্নপত্র প্রস্তুতির সহজ সঙ্গী</span>
              <h1>সহজেই তৈরি করুন আপনার <span>পছন্দের প্রশ্নপত্র</span></h1>
              <p>শ্রেণি, বিষয় ও অধ্যায়ভিত্তিক প্রশ্ন ব্যাংক থেকে প্রশ্ন বেছে নিন। নিজের প্রয়োজনমতো সাজিয়ে তৈরি করুন প্রশ্নপত্র—এক জায়গায়, সহজেই।</p>
              <div className="landing-hero-actions">
                <a className="landing-button-primary" href="#/register">শুরু করুন <ArrowRight size={18} /></a>
                <a className="landing-button-secondary" href="#/login">লগইন করুন</a>
              </div>
              <QuestionBankTotal apiUrl={apiUrl} className="landing-question-bank-total" />
              <div className="landing-hero-note"><Check size={16} /> Google দিয়ে সাইন ইন করে শুরু করুন</div>
            </div>
            <div className="landing-hero-art"><PaperPreview /></div>
          </div>
          <div className="landing-hero-bottom" aria-hidden="true" />
        </section>

        <section className="landing-features landing-section" id="features">
          <div className="landing-section-heading">
            <span className="landing-section-kicker">আপনার প্রস্তুতিতে সহায়ক</span>
            <h2>প্রশ্নপত্র তৈরির দরকারি সবকিছু</h2>
            <p>প্রশ্ন খোঁজা, বাছাই এবং প্রিন্ট—শিক্ষকের পরিচিত কাজগুলোকে রাখুন এক সহজ ধারায়।</p>
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

        <section className="landing-reviews landing-section" id="reviews">
          <div className="landing-section-heading">
            <span className="landing-section-kicker">ব্যবহারকারীদের মতামত</span>
            <h2>রিভিউ দিয়ে সাজুক প্রশ্নঘর</h2>
            <p>এখানে প্রকৃত ব্যবহারকারীর অনুমতিপ্রাপ্ত মতামত যোগ করুন। নিচের লেখাগুলো পরিবর্তনযোগ্য demo placeholder।</p>
            <span className="landing-demo-notice">DEMO CONTENT · প্রকাশের আগে বাস্তব রিভিউ দিয়ে বদলান</span>
          </div>
          <div className="landing-review-grid">
            {[
              { quote: 'এখানে একজন শিক্ষকের বাস্তব অভিজ্ঞতা ও মতামত যোগ করুন।', label: 'রিভিউ placeholder ০১' },
              { quote: 'প্রশ্ন বাছাই ও প্রশ্নপত্র তৈরির অভিজ্ঞতা সম্পর্কে প্রকৃত রিভিউ লিখুন।', label: 'রিভিউ placeholder ০২' },
              { quote: 'প্রকাশের আগে ব্যবহারকারীর সম্মতি নিয়ে তাঁর সঠিক পরিচয় যোগ করুন।', label: 'রিভিউ placeholder ০৩' },
            ].map((review) => (
              <article className="landing-review-card" key={review.label}>
                <div className="landing-review-stars" aria-label="রেটিং placeholder">
                  {Array.from({ length: 5 }, (_, index) => <Star key={index} size={16} fill="currentColor" />)}
                </div>
                <Quote className="landing-review-quote-icon" size={25} aria-hidden="true" />
                <p>“{review.quote}”</p>
                <div className="landing-review-person">
                  <span className="landing-review-avatar"><BookOpen size={18} /></span>
                  <span><strong>{review.label}</strong><small>বাস্তব পরিচয় যোগ করুন</small></span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-pricing-section" id="pricing">
          <div className="landing-section landing-pricing-inner">
            <div className="landing-section-heading">
              <span className="landing-section-kicker">সহজ ও স্বচ্ছ পরিকল্পনা</span>
              <h2>আপনার জন্য উপযুক্ত পরিকল্পনা</h2>
              <p>নিচের পরিকল্পনা ও মূল্য demo—প্রকৃত মূল্য, সুবিধা এবং প্রাপ্যতা নিশ্চিত করে আপডেট করুন।</p>
              <span className="landing-demo-notice">DEMO PRICING · বর্তমান অ্যাপে পেমেন্ট/সাবস্ক্রিপশন চালু নেই</span>
            </div>
            <div className="landing-pricing-grid">
              <article className="landing-price-card">
                <span className="landing-price-demo-tag">DEMO</span>
                <span className="landing-price-name">শিক্ষক</span>
                <h3>৳০ <small>/ মাস</small></h3>
                <p>ব্যক্তিগতভাবে প্রশ্নপত্র তৈরির জন্য demo plan</p>
                <ul>
                  <li><Check size={16} /> প্রশ্ন ব্যাংক ব্রাউজ</li>
                  <li><Check size={16} /> প্রশ্নপত্র তৈরি ও প্রিভিউ</li>
                  <li><Check size={16} /> PDF / প্রিন্ট</li>
                </ul>
                <a href="#/register">শুরু করুন <ArrowRight size={16} /></a>
              </article>
              <article className="landing-price-card landing-price-card-featured">
                <span className="landing-price-demo-tag">DEMO · সম্পাদনা করুন</span>
                <span className="landing-price-name">শিক্ষক প্লাস</span>
                <h3>৳২৯৯ <small>/ মাস</small></h3>
                <p>মূল্য ও পরিকল্পনার বিবরণ পরিবর্তনযোগ্য demo</p>
                <ul>
                  <li><Check size={16} /> বিষয় ও অধ্যায়ভিত্তিক নির্বাচন</li>
                  <li><Check size={16} /> নিজের মতো প্রশ্নপত্র সাজানো</li>
                  <li><Check size={16} /> PDF / প্রিন্ট</li>
                </ul>
                <a href="#/register">শুরু করুন <ArrowRight size={16} /></a>
              </article>
              <article className="landing-price-card">
                <span className="landing-price-demo-tag">DEMO</span>
                <span className="landing-price-name">প্রতিষ্ঠান</span>
                <h3>৳৯৯৯ <small>/ মাস</small></h3>
                <p>প্রতিষ্ঠানের জন্য প্রস্তাবিত demo plan</p>
                <ul>
                  <li><Check size={16} /> একাধিক শিক্ষকের ব্যবহার</li>
                  <li><Check size={16} /> প্রশ্নপত্র তৈরির কর্মপ্রবাহ</li>
                  <li><Check size={16} /> পরিকল্পনা সম্পর্কে যোগাযোগ</li>
                </ul>
                <a href="#/register">শুরু করুন <ArrowRight size={16} /></a>
              </article>
            </div>
          </div>
        </section>

        <section className="landing-about landing-section" id="about">
          <div className="landing-about-mark"><FileText size={27} /></div>
          <div>
            <span className="landing-section-kicker">শিক্ষার জন্য তৈরি</span>
            <h2>প্রশ্ন তৈরি হোক আরও গোছানো</h2>
            <p>প্রশ্নঘর শ্রেণি ও বিষয়ভিত্তিক প্রশ্ন ব্যবস্থাপনা এবং প্রশ্নপত্র তৈরির একটি টুল। শিক্ষকরা প্রশ্ন বাছাই করে প্রিভিউ দেখতে এবং সমর্থিত প্রিন্ট/PDF অপশন ব্যবহার করতে পারেন।</p>
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
          </div>
        </section>

        <section className="landing-cta">
          <div className="landing-cta-inner">
            <div>
              <span>আজই শুরু করুন</span>
              <h2>আপনার পরের প্রশ্নপত্রটি তৈরি করুন সহজে।</h2>
            </div>
            <a className="landing-cta-button" href="#/register">প্রশ্নঘরে প্রবেশ করুন <ArrowRight size={18} /></a>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <a className="landing-brand landing-footer-brand" href="#">
            <span className="landing-brand-icon"><BookOpen size={22} aria-hidden="true" /></span>
            <span><strong>প্রশ্নঘর</strong><small>প্রশ্নপত্র তৈরি হোক সহজে</small></span>
          </a>
          <p>শিক্ষকদের জন্য প্রশ্ন ব্যাংক ও প্রশ্নপত্র তৈরির টুল।</p>
          <span className="landing-footer-copyright">© {new Date().getFullYear()} প্রশ্নঘর</span>
        </div>
      </footer>
    </div>
  )
}
