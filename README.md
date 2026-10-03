# প্রশ্নঘর

পঞ্চম থেকে দশম শ্রেণির প্রশ্ন ব্যাংক ও প্রশ্নপত্র তৈরির অ্যাপ। MongoDB চালু থাকলে প্রশ্ন এবং প্রশ্নপত্রের ফরম্যাট MongoDB-তে সংরক্ষিত হয়; API না চললে browser-এর localStorage fallback হিসেবে কাজ করে।

## শ্রেণি ও বিষয়

শ্রেণি: ৫–১০। বিষয়: গণিত, বাংলা ১ম/২য় পত্র, English 1st/2nd Paper, Global Studies, ইসলাম ও নৈতিক শিক্ষা, এবং তথ্য ও যোগাযোগ প্রযুক্তি। প্রতিটি প্রশ্নে grade, subject, chapter ও type আলাদা metadata হিসেবে MongoDB-তে থাকে; তাই class-wise folder দরকার নেই।

প্রশ্ন যোগ করার সময় শ্রেণি, বিষয় ও প্রশ্নের ধরন select করুন। MCQ-তে সাধারণ ধরন অথবা বিবৃতিভিত্তিক ধরন বেছে নিন। বিবৃতিভিত্তিক MCQ-তে মূল প্রশ্ন, তিনটি i/ii/iii বিবৃতি এবং নির্দেশনা লিখুন; চারটি সমন্বয় বিকল্প (i ও iii, i ও ii, ii ও iii, i, ii ও iii) অ্যাপ নিজে তৈরি করে। সাধারণ MCQ-তে চারটি উত্তর বিকল্প হাতে লিখুন। প্রিভিউতে প্রশ্ন, বিবৃতি, নির্দেশনা ও স্বয়ংক্রিয় বিকল্প এই ক্রমে দেখাবে। এই ধরন যেকোনো বিষয়ের জন্য ব্যবহার করা যায়। অধ্যায়ে ওই grade/subject-এর আগের chapter suggestion থেকে বাছুন অথবা প্রথমবারের জন্য নাম লিখুন। নির্দিষ্ট chapter catalog এখনো prefilled নয়, কারণ class ও subject অনুযায়ী syllabus-এর chapter আলাদা।

## চালু করা

প্রয়োজন: Node.js 20.19+ এবং একটি MongoDB Atlas cluster বা local MongoDB server।

1. `npm install` চালান।
2. `.env.example` কপি করে `.env` নামে রাখুন। PowerShell-এ: `Copy-Item .env.example .env`
3. `.env`-এর `MONGODB_URI`-তে নিজের MongoDB connection string দিন। আসল URI কখনো Git-এ commit করবেন না।
4. MongoDB demo প্রশ্ন যোগ করতে `npm run seed:demo` চালান। এটি পুনরায় চালালেও একই demo duplicate হবে না।
5. একটি terminal-এ `npm run server` চালান। আরেকটি terminal-এ `npm run dev` চালান। Vite যদি 5173 ব্যবহার করতে না পারে, terminal-এ দেখানো 5174 URL-টি খুলুন।

## MongoDB credential কোথায় পাবেন

MongoDB Atlas-এ cluster তৈরি করুন, **Database Access** থেকে database user ও password বানান, এবং **Network Access**-এ আপনার বর্তমান IP allow করুন। এরপর cluster-এর **Connect → Drivers** থেকে Node.js connection string নিন। `.env`-এ `<database-user>`, `<database-password>`, `<cluster-host>` এবং `<database-name>` নিজের মান দিয়ে বদলান। Password-এ `@`, `:`, `/`-এর মতো reserved character থাকলে URI-তে ব্যবহারের আগে percent-encode করুন। Atlas database user এবং Atlas account login এক জিনিস নয়।

Example:

```dotenv
MONGODB_URI=mongodb+srv://my-user:encoded-password@cluster.example.mongodb.net/class_seven_questions?retryWrites=true&w=majority
PORT=4000
CLIENT_ORIGIN=http://localhost:5173,http://localhost:5174
VITE_API_URL=http://localhost:4000/api
```

উদাহরণের URI-টি কাল্পনিক; নিজের Atlas dashboard থেকে পাওয়া URI ব্যবহার করবেন। `.env` ইতিমধ্যে `.gitignore`-এ বাদ দেওয়া আছে।

## MongoDB-তে কী জমা হয়

- `questions` collection: `subject`, `grade`, `chapter`, `type`, প্রশ্ন, MCQ options ও ঐচ্ছিক বিবৃতি, উত্তর, marks এবং ঐচ্ছিক `figure` (`triangle`, `circle`, `rectangle`)।
- `papersettings` collection: বিদ্যালয়ের নাম, subtitle, প্রশ্নের HEX color, পরীক্ষার শিরোনাম/সময় এবং watermark সেটিংস। watermark-এ লেখা বা ৫১২ KB পর্যন্ত ছবি, রং/tint, আকার, স্বচ্ছতা ও অবস্থান বেছে নেওয়া যায়।

প্রশ্নপত্রের প্রিভিউতে লাইভ এডিট চালু রেখে কাগজের অংশ টেনে সরান বা handle দিয়ে আকার বদলান। একই প্রিভিউর অপশন তালিকা থেকে MCQ label-এর বিন্যাস বদলানো যায়; পছন্দটি নির্বাচিত শ্রেণি ও বিষয়ের জন্য ব্রাউজারে সংরক্ষিত থাকে। এই বিন্যাস ও watermark-ও PDF/প্রিন্টে অন্তর্ভুক্ত হয়।

Mongo mode-এ app চালু হলে নির্বাচিত class ও subject-এর প্রশ্ন আনে। প্রশ্ন তৈরি, edit ও delete সরাসরি API-তে যায়। Geometry demo প্রশ্নগুলো সপ্তম শ্রেণির গণিতে `npm run seed:demo` দিয়ে যোগ করা যায়।

## API

- `GET /api/questions?subject=math&grade=7`: নির্বাচিত subject ও grade-এর সব প্রশ্ন।
- `POST /api/questions`: প্রশ্ন তৈরি।
- `PUT /api/questions/:id`: প্রশ্ন update।
- `DELETE /api/questions/:id`: প্রশ্ন delete।
- `GET /api/settings/:subject/:grade` এবং `PUT /api/settings/:subject/:grade`: প্রশ্নপত্রের format পড়া/সংরক্ষণ।
- `GET /api/health`: API ও Mongo connection status।

নতুন subject যোগ করলে frontend-এর subject catalog এবং `server/models.js`-এর allowed subject list—দুটোতেই একই ID যোগ করতে হবে। Public deployment-এর আগে API authentication, per-user authorization এবং production CORS policy যোগ করতে হবে।
