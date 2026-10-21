# প্রশ্নঘর

পঞ্চম থেকে দশম শ্রেণির প্রশ্ন ব্যাংক ও প্রশ্নপত্র তৈরির অ্যাপ। Admin অনুমোদিত প্রশ্ন MongoDB-তে সংরক্ষিত হয়; Teacher-এর তৈরি প্রশ্ন প্রথমে তার account-ভিত্তিক browser localStorage-এ থাকে। MongoDB সংযোগ না থাকলেও Teacher নিজের local প্রশ্ন দেখতে ও সম্পাদনা করতে পারেন। প্রশ্নপত্রের বিন্যাসও browser-এর localStorage-এ থাকে।

## কোডের বিন্যাস

- `src/features/`: builder, questions, student, admin, auth ও landing page-এর feature-ভিত্তিক UI এবং logic।
- `src/components/`: একাধিক feature-এ ব্যবহৃত সাধারণ UI component।
- `src/shared/`: frontend-এর shared API, Firebase, academic data ও event helper।
- `src/styles/`: application-wide stylesheet; feature/component-এর stylesheet সংশ্লিষ্ট folder-এ থাকে।
- `server/config/`, `server/models/`: backend credentials/configuration এবং MongoDB model।
- `server/scripts/`: backend-এর administrative command-line script।
- `server/index.js`: Express API entry point ও route registration।
- `public/`: সরাসরি serve করা static file; `src/assets/`: frontend bundle-এ import করা asset।

## কোড পরিবর্তনের নিয়ম

- নতুন code লেখার বা পুরোনো code বদলানোর আগে একই কাজের component, helper, constant ও validation logic আছে কি না খুঁজে দেখুন। থাকলে সেটি reuse বা উন্নত করুন; একই উদ্দেশ্যে আরেকটি copy তৈরি করবেন না।
- একাধিক feature-এ সত্যিই একই আচরণের logic লাগলে উপযুক্ত `src/shared/` বা `src/components/`-এ একবার রাখুন। Feature-নির্দিষ্ট UI ও logic সংশ্লিষ্ট `src/features/<feature>/`-এ রাখুন।
- দেখতে একই হলেও input, output বা আচরণে পার্থক্য থাকলে অন্ধভাবে এক helper-এ মেশাবেন না। প্রয়োজন হলে আলাদা, স্পষ্টভাবে নামকরণ করা helper রাখুন এবং কেন আলাদা তা যাচাই করুন।
- কোনো code সরালে পুরোনো copy ও অপ্রয়োজনীয় import সরিয়ে দিন; শুধু নতুন file বানিয়ে পুরোনো implementation রেখে দেবেন না। সব reference নতুন implementation-এ গেছে কি না খুঁজে নিশ্চিত করুন।
- পরিবর্তনের পর অন্তত `npm run build` চালান; সম্ভব হলে সংশ্লিষ্ট lint/test-ও চালিয়ে ফলাফল জানান। Behavior বদলালে সংশ্লিষ্ট feature পরীক্ষা করুন।

## শ্রেণি ও বিষয়

শ্রেণি: ৫–১০। বিষয়: গণিত, বাংলা ১ম/২য় পত্র, English 1st/2nd Paper, Global Studies, ইসলাম ও নৈতিক শিক্ষা, এবং তথ্য ও যোগাযোগ প্রযুক্তি। প্রতিটি প্রশ্নে grade, subject, chapter ও type আলাদা metadata হিসেবে MongoDB-তে থাকে; তাই class-wise folder দরকার নেই।

প্রশ্ন যোগ করার সময় শ্রেণি, বিষয় ও প্রশ্নের ধরন select করুন। MCQ-তে সাধারণ ধরন অথবা বিবৃতিভিত্তিক ধরন বেছে নিন। বিবৃতিভিত্তিক MCQ-তে মূল প্রশ্ন, তিনটি i/ii/iii বিবৃতি এবং নির্দেশনা লিখুন; চারটি সমন্বয় বিকল্প (i ও iii, i ও ii, ii ও iii, i, ii ও iii) অ্যাপ নিজে তৈরি করে। সাধারণ MCQ-তে চারটি উত্তর বিকল্প হাতে লিখুন। প্রশ্ন, উত্তর, বিবৃতি ও MCQ বিকল্পে `$x^2 + y^2$` বা `\( \frac{a}{b} \)` লিখলে সূত্রটি লেখার সময় preview-তে এবং প্রশ্নপত্রে render হয়; আলাদা লাইনের সূত্রের জন্য `\[ ... \]` বা `$$ ... $$` ব্যবহার করুন। প্রিভিউতে প্রশ্ন, বিবৃতি, নির্দেশনা ও স্বয়ংক্রিয় বিকল্প এই ক্রমে দেখাবে। এই ধরন যেকোনো বিষয়ের জন্য ব্যবহার করা যায়। অধ্যায়ে ওই grade/subject-এর আগের chapter suggestion থেকে বাছুন অথবা প্রথমবারের জন্য নাম লিখুন। Teacher-এর তৈরি প্রশ্ন localStorage-এ থাকে; প্রশ্নের পাশে পাঠানোর অনুরোধ দিলে Admin অনুমোদন না করা পর্যন্ত সেটি local-এই থাকে। অনুমোদন করলে প্রশ্ন MongoDB-তে প্রকাশিত হয়, প্রত্যাখ্যান করলে local কপি থাকে। MongoDB-র অধ্যায়ের নাম বদলানো বা merge করার অনুরোধও Teacher পাঠাতে পারেন; Admin ব্যবহারকারী পৃষ্ঠার “প্রশ্ন ও অধ্যায়ের অনুরোধ” অংশ থেকে সেগুলো অনুমোদন বা বাতিল করেন। Admin সরাসরি প্রশ্ন ও অধ্যায় পরিচালনা করতে পারেন। প্রশ্ন ব্যাংকে একাধিক অধ্যায় নির্বাচন করে সব নির্বাচিত অধ্যায় মিলিয়ে প্রতিটি প্রশ্নের ধরনের random সংখ্যা এক জায়গায় সেট করা যায়; অ্যাপ ওই অধ্যায়গুলো থেকে মোট নির্ধারিত সংখ্যক প্রশ্ন বেছে নেয়। নির্দিষ্ট chapter catalog এখনো prefilled নয়, কারণ class ও subject অনুযায়ী syllabus-এর chapter আলাদা।

## চালু করা

প্রয়োজন: Node.js 20.19+ এবং একটি MongoDB Atlas cluster বা local MongoDB server।

1. `npm install` চালান।
2. `.env.example` কপি করে `.env` নামে রাখুন। PowerShell-এ: `Copy-Item .env.example .env`
3. `.env`-এর `MONGODB_URI`-তে নিজের MongoDB connection string দিন। আসল URI কখনো Git-এ commit করবেন না।
4. MongoDB demo প্রশ্ন যোগ করতে `npm run seed:demo` চালান। এটি পুনরায় চালালেও একই demo duplicate হবে না।
5. একটি terminal-এ `npm run server` চালান। আরেকটি terminal-এ `npm run dev` চালান। Vite যদি 5173 ব্যবহার করতে না পারে, terminal-এ দেখানো 5174 URL-টি খুলুন।

## Firebase লগইন, admin, student ও teacher role

1. Firebase Console-এ project ও Web App তৈরি করে **Authentication → Sign-in method → Google** চালু করুন। **Authentication → Settings → Authorized domains**-এ local ও production website domain যোগ করুন। এই app-এ শুধু Google sign-in থাকবে; পুরোনো Email/Password account থাকলে provider বন্ধ করার আগে সেগুলো Google-এর সঙ্গে link/migrate করুন।
2. project root-এ `.env` ফাইলে Firebase Web App-এর মানগুলো যোগ করুন:

   ```dotenv
   VITE_FIREBASE_API_KEY=আপনার-web-api-key
   VITE_FIREBASE_AUTH_DOMAIN=আপনার-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=আপনার-project-id
   VITE_FIREBASE_STORAGE_BUCKET=আপনার-project.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=আপনার-sender-id
   VITE_FIREBASE_APP_ID=আপনার-app-id
   ```

   এগুলো Firebase Console → **Project settings → Your apps**-এ পাবেন। `.env` Git-এ commit করবেন না।
3. Express API-র ID token যাচাই ও role পরিচালনার জন্য Firebase Console → **Project settings → Service accounts** থেকে Admin SDK service-account JSON ডাউনলোড করুন। JSON ফাইলটি repository-র বাইরে নিরাপদ স্থানে রাখুন এবং `.env`-এ `GOOGLE_APPLICATION_CREDENTIALS`-এ তার absolute path দিন (যেমন Windows-এ `C:/secure/firebase-service-account.json`)। Service-account key কখনো Git-এ commit করবেন না। Google Cloud environment-এ Application Default Credentials-ও ব্যবহার করা যায়।
4. Login screen-এ **Google দিয়ে চালিয়ে যান** বেছে প্রথম account তৈরি করুন। এরপর API server বন্ধ করে terminal-এ `npm run user:role -- you@example.com admin` চালিয়ে সেই Firebase account-কে প্রথম admin বানান, তারপর API server আবার চালু করে sign out/sign in করুন। Google Cloud-এ service identity/Application Default Credentials যুক্ত থাকলে `FIREBASE_ADMIN_USE_ADC=true` সেট করতে পারেন।
5. পরবর্তী account-গুলো signup করলে স্বয়ংক্রিয়ভাবে `student` role পাবে। Student পোর্টাল থেকে teacher role-এর অনুরোধ পাঠানো যায়; Admin **ব্যবহারকারী** পৃষ্ঠার অনুরোধ তালিকা থেকে অনুমোদন করলে role `teacher` হবে। Admin account থেকে account-কে `admin`, `student` বা `teacher` করা, block/unblock, অথবা Firebase Authentication থেকে স্থায়ীভাবে delete করা যাবে। Teacher প্রশ্ন ব্যাংক ও প্রশ্নপত্র ব্যবহার করবেন; student শুধু শ্রেণি ও বিষয় বেছে MCQ পরীক্ষা দিতে এবং সাপ্তাহিক র‍্যাঙ্ক দেখতে পারবে। পুরোনো `user` role account-গুলো teacher হিসেবে গণ্য হবে। Block করা account login করতে পারবে না; তার refresh token-ও বাতিল হয়। Delete confirmation-এ সতর্কবার্তা দেখায়। নিজের account block/delete করা এবং শেষ সক্রিয় admin-কে block/delete করা যায় না। Role update-এর পর সংশ্লিষ্ট account-এর refresh token বাতিল হয়; নতুন role-এ পুনরায় login করতে হবে।

Admin/student/teacher custom role Firebase Authentication-এর signed custom claim-এ থাকে। Server role API-তে claim যাচাই করে; forged client-side role গ্রহণ করা হয় না। Google দিয়ে login করা account-এর profile picture Firebase/Google account থেকে student profile, সাপ্তাহিক র‍্যাঙ্ক, admin user list এবং পরীক্ষার activity-তে দেখানো হয়। পুরোনো পরীক্ষার rank entry-তে picture snapshot না থাকলে API Firebase account থেকে profile picture নিয়ে আসে। Student class, subject ও ঐচ্ছিক chapter বেছে সর্বোচ্চ ২০টি random MCQ একবারে একটি করে পায়; পরীক্ষার সময় default ১০ মিনিট, যা শিক্ষার্থী ১–২০ মিনিটের মধ্যে নির্ধারণ করতে পারে এবং server সময়সীমা শেষ হলে unanswered প্রশ্নগুলো ভুল হিসেবে জমা দেয়। পরীক্ষার counter বর্তমান প্রশ্ন ও মোট প্রশ্ন দেখায়; ফলাফল ও সাপ্তাহিক সেরা স্কোরের পাশে পরীক্ষায় ব্যয় হওয়া সময়ও দেখানো হয়। Student portal-এ dark mode চালু/বন্ধ করা যায়; পছন্দটি browser-এ সংরক্ষিত থাকে। `$...$`, `$$...$$`, `\(...\)`, `\[...\]`, `\text{...}` এবং প্রশ্নের equation marker math formula হিসেবে render হয়। পরীক্ষা জমা দেওয়ার পর শিক্ষার্থী সঠিক উত্তর ও নিজের উত্তর মিলিয়ে দেখতে পারে; submit-এর আগে উত্তর প্রকাশ করা হয় না। সার্ভার সঠিক উত্তর ও ফলাফল হিসাব করে। প্রতি সোমবার UTC-তে নতুন rank week শুরু হয়; একটি সপ্তাহে প্রতি শিক্ষার্থীর ওই class/subject-এর সেরা শতাংশ স্কোর leaderboard-এ গণনা হয়, tie হলে একই rank দেওয়া হয়। পুরোনো result leaderboard query-তে স্বয়ংক্রিয়ভাবে বাদ পড়ে। Admin ও Teacher **শিক্ষার্থী activity** পৃষ্ঠায় completed MCQ পরীক্ষার ফলাফল দেখতে এবং প্রতিটি পরীক্ষার সঙ্গে যুক্ত লিখিত feedback পাঠাতে পারেন; শিক্ষার্থী নিজের portal-এর **Teacher-এর feedback** অংশে তা দেখতে পায়। Activity তালিকা সাম্প্রতিক পরীক্ষা থেকে শুরু হয় এবং পুরোনো পরীক্ষার জন্য pagination আছে। Admin-এর Excel import, নতুন প্রশ্ন, edit/delete ও bulk delete এবং settings পরিবর্তন main MongoDB-তে সংরক্ষিত হয়। Teacher-এর Excel import, নতুন প্রশ্ন, edit/delete এবং format settings শুধু সেই Firebase account-এর browser localStorage-এ থাকে; অন্য device-এ sync হয় না এবং browser storage মুছলে local প্রশ্নও মুছে যেতে পারে। Main database-এর প্রশ্ন teacher-এর জন্য read-only; API-তেও প্রশ্ন create/edit/delete (bulk delete-সহ) এবং shared settings write admin-only। `/api/health` public; অন্যান্য API-তে Firebase ID token আবশ্যক। Production-এ অবশ্যই HTTPS এবং নির্দিষ্ট `CLIENT_ORIGIN` ব্যবহার করুন।

প্রশ্ন ব্যাংক একবারে সর্বোচ্চ ৫০টি প্রশ্ন লোড করে; **আরও প্রশ্ন দেখুন** দিয়ে পরের batch আনা যায়। Search, question type ও chapter filter server-side-এ প্রয়োগ হয়, আর grade/subject অনুযায়ী index ব্যবহার করে ফলাফল সাজানো হয়—তাই একসঙ্গে পুরো question bank browser-এ পাঠাতে হয় না।

## MongoDB credential কোথায় পাবেন

MongoDB Atlas-এ cluster তৈরি করুন, **Database Access** থেকে database user ও password বানান, এবং **Network Access**-এ আপনার বর্তমান IP allow করুন। এরপর cluster-এর **Connect → Drivers** থেকে Node.js connection string নিন। `.env`-এ `<database-user>`, `<database-password>`, `<cluster-host>` এবং `<database-name>` নিজের মান দিয়ে বদলান। Password-এ `@`, `:`, `/`-এর মতো reserved character থাকলে URI-তে ব্যবহারের আগে percent-encode করুন। Atlas database user এবং Atlas account login এক জিনিস নয়।

Example:

```dotenv
MONGODB_URI=mongodb+srv://my-user:encoded-password@cluster.example.mongodb.net/class_seven_questions?retryWrites=true&w=majority
PORT=4000
CLIENT_ORIGIN=http://localhost:5173,http://localhost:5174
VITE_API_URL=http://localhost:4000/api
AUTH_SECRET=replace-with-a-unique-random-secret-at-least-32-bytes
```

উদাহরণের URI-টি কাল্পনিক; নিজের Atlas dashboard থেকে পাওয়া URI ব্যবহার করবেন। `.env` ইতিমধ্যে `.gitignore`-এ বাদ দেওয়া আছে।

## MongoDB-তে কী জমা হয়

- `questions` collection: `subject`, `grade`, `chapter`, `type`, প্রশ্ন, MCQ options ও ঐচ্ছিক বিবৃতি, উত্তর, marks এবং ঐচ্ছিক `figure` (`triangle`, `circle`, `rectangle`)।
- `papersettings` collection: বিদ্যালয়ের নাম, subtitle, প্রশ্নের HEX color, পরীক্ষার শিরোনাম/সময় এবং watermark সেটিংস। watermark-এ লেখা বা ৫১২ KB পর্যন্ত ছবি, রং/tint, আকার, স্বচ্ছতা ও অবস্থান বেছে নেওয়া যায়।

প্রশ্নপত্রের প্রিভিউতে প্রশ্নগুলো উত্তরের আগে দেখানো হয়; উত্তর থাকলে MCQ, সংক্ষিপ্ত, সৃজনশীল ও বর্ণনামূলক প্রশ্নের উত্তর আলাদা উত্তরমালায় পরের পৃষ্ঠা থেকে শুরু হয়। লাইভ এডিট চালু রেখে কোনো অংশ নির্বাচন করলে edit bar-এর লেখার ঘরে তার লেখা সম্পাদনা করা যায়; Ctrl/⌘+click দিয়ে একাধিক অংশ বাছুন, একসঙ্গে সরান বা আকার বদলান, আর Alt+drag দিয়ে একক লেখার অংশ সরান। একই প্রিভিউর অপশন তালিকা থেকে MCQ label-এর বিন্যাস বদলানো যায়; পছন্দটি নির্বাচিত শ্রেণি ও বিষয়ের জন্য ব্রাউজারে সংরক্ষিত থাকে। এই বিন্যাস ও watermark-ও PDF/প্রিন্টে অন্তর্ভুক্ত হয়।

বাংলা ২য় পত্র নির্বাচন করলেও প্রশ্ন বাছাইয়ের পেজ ও preview অন্য বিষয়গুলোর মতোই থাকবে। Preview ও PDF-তে প্রশ্নগুলো ছবির মতো নম্বর, বাম-ডান alignment এবং বিষয় কোডসহ ছাপা হয়। প্রশ্নে answer থাকলে আগের মতো আলাদা উত্তরমালায় ছাপা হবে।

## Excel থেকে একসঙ্গে প্রশ্ন আমদানি

প্রশ্ন ব্যাংকে **Excel ইমপোর্ট** বেছে টেমপ্লেট ডাউনলোড করুন। `Questions` শিটের উদাহরণ সারি বদলে `.xlsx` ফাইল আপলোড করুন; প্রথম worksheet পড়া হবে। MCQ, সংক্ষিপ্ত, সৃজনশীল (`cq`) ও বর্ণনামূলক (`long`)—সব ধরন ইমপোর্ট করা যায়। `type`, `prompt` ও ১–১০০-এর পূর্ণসংখ্যা `marks` আবশ্যক। সাধারণ MCQ-তে `option_a` থেকে `option_d` দিন; বিবৃতিভিত্তিক MCQ-তে `statement_i`, `statement_ii`, `statement_iii` ও `statement_question` দিন। MCQ-র `answer`-এ A/B/C/D, ক/খ/গ/ঘ অথবা সঠিক অপশনের সম্পূর্ণ লেখা গ্রহণ করা হয়। `chapter`, `answer`, `figure`, `equation` ও `answer_equation` ঐচ্ছিক।

বাংলা ২য় পত্রের জন্য আলাদা **বাংলা ২য় পত্র Excel ইমপোর্ট** ব্যবহার করুন। এই `.xlsx` টেমপ্লেটে `section`, `prompt`, `alternative`, `marks` ও `answer` কলাম থাকে; প্রতিটি row একটি প্রশ্ন, একই section-এ যত খুশি প্রশ্নের আলাদা row যোগ করা যায়। প্রতিটি section তার নিজস্ব question type হিসেবে সংরক্ষিত হয়—সবগুলোকে বর্ণনামূলক type-এ মেশানো হয় না। `alternative` দিলে প্রশ্নপত্রে “অথবা” দিয়ে দেখানো হয়। ইমপোর্ট করা প্রশ্নগুলো সাধারণ প্রশ্ন বাছাই পেজ থেকে বেছে নিন; `answer` অন্য বিষয়ের মতো উত্তরমালায় ছাপা হবে।

ইমপোর্টের আগে প্রতিটি সারির যাচাই ও ত্রুটি দেখানো হয়; ভুল সারি বাদ দিয়ে বৈধ সারিগুলো ইমপোর্ট করা যায়। একবারে সর্বোচ্চ ২০০০টি প্রশ্ন এবং ১০ MB `.xlsx` ফাইল সমর্থিত। প্রশ্ন সংরক্ষণে MongoDB সংযোগ থাকা দরকার।

## Tampermonkey দিয়ে সংক্ষিপ্ত প্রশ্ন আমদানি

`tampermonkey/short-bulk-import.user.js` Tampermonkey-তে যোগ করলে প্রশ্ন ব্যাংক পেজে **সংক্ষিপ্ত প্রশ্ন আমদানি** বোতাম আসবে। বর্তমান শ্রেণি ও বিষয় বেছে, নম্বর দিয়ে একাধিক `প্রশ্ন:` / `উত্তর:` জোড়া পেস্ট করুন; অধ্যায় ঐচ্ছিক। `tampermonkey/cq-bulk-import.user.js` দিয়ে একই `প্রশ্ন:` / `উত্তর:` format-এ একাধিক সৃজনশীল প্রশ্ন ও সমাধান আমদানি করা যাবে; এর নম্বর ডিফল্ট ১০ এবং অধ্যায় ঐচ্ছিক। দুই importer-এই গণিতের সূত্র `$...$` দিয়ে ঘিরলে সেগুলো আলাদা inline equation হিসেবে সংরক্ষিত ও প্রশ্নপত্রের preview-তে render হয়। MCQ আমদানির জন্য `tampermonkey/mcq-bulk-import.user.js` আগের মতোই ব্যবহার করা যাবে।

Mongo mode-এ app চালু হলে নির্বাচিত class ও subject-এর প্রশ্ন আনে। প্রশ্ন তৈরি, edit ও delete সরাসরি API-তে যায়। Geometry demo প্রশ্নগুলো সপ্তম শ্রেণির গণিতে `npm run seed:demo` দিয়ে যোগ করা যায়।

## API

- `GET /api/questions?subject=math&grade=7`: নির্বাচিত subject ও grade-এর সব প্রশ্ন।
- `POST /api/questions`: প্রশ্ন তৈরি।
- `PUT /api/questions/:id`: প্রশ্ন update।
- `DELETE /api/questions/:id`: প্রশ্ন delete।
- `GET /api/settings/:subject/:grade` এবং `PUT /api/settings/:subject/:grade`: প্রশ্নপত্রের format পড়া/সংরক্ষণ।
- `GET /api/health`: API ও Mongo connection status।

নতুন subject যোগ করলে `src/shared/academic.js`-এর frontend subject catalog এবং `server/models/index.js` ও `server/index.js`-এর allowed subject list—সবখানে একই ID যোগ করতে হবে। API-তে Firebase ID token যাচাই ও role-based authorization আছে; production deployment-এ HTTPS এবং নির্দিষ্ট `CLIENT_ORIGIN` ব্যবহার করুন।
