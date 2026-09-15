import React, { useState, useEffect, useRef } from "react";
import {
  BookOpen, Sparkles, Play, CheckCircle2, Circle,
  ArrowRight, Youtube, Send, Loader2, Star,
  FlaskConical, Dna, Calculator, Languages,
  Dumbbell, X, GraduationCap, Landmark, Flame, ThumbsUp, ThumbsDown,
  User, Phone, Lock, MapPin, CreditCard, KeyRound, ShieldCheck, Brain, Share2, Eye, EyeOff, Info
} from "lucide-react";

/* ---------------------------------------------------------------
   الهوية البصرية
--------------------------------------------------------------- */
const BRAND = {
  bg: "#FBF7EE",
  card: "#FFFFFF",
  green: "#0F5C46",
  greenDark: "#0A3D30",
  gold: "#C89B3C",
  text: "#1E2521",
  subtext: "#5B6663",
  border: "#E7E0CE",
};

const WILAYAS = [
  "أدرار","الشلف","الأغواط","أم البواقي","باتنة","بجاية","بسكرة","بشار","البليدة","البويرة",
  "تمنراست","تبسة","تلمسان","تيارت","تيزي وزو","الجزائر","الجلفة","جيجل","سطيف","سعيدة",
  "سكيكدة","سيدي بلعباس","عنابة","قالمة","قسنطينة","المدية","مستغانم","المسيلة","معسكر","ورقلة",
  "وهران","البيض","إليزي","برج بوعريريج","بومرداس","الطارف","تندوف","تيسمسيلت","الوادي","خنشلة",
  "سوق أهراس","تيبازة","ميلة","عين الدفلى","النعامة","عين تموشنت","غرداية","غليزان","تيميمون",
  "برج باجي مختار","أولاد جلال","بني عباس","عين صالح","عين قزام","تقرت","جانت","المغير","المنيعة",
];

const SUBSCRIPTION_PRICE = "4000 دج"; // السعر الرسمي للاشتراك السنوي

/* ---------------------------------------------------------------
   تخزين محلي حقيقي (localStorage) — يشتغل على الموقع المنشور فعلياً
--------------------------------------------------------------- */
function lsGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
}
function lsRemove(key) {
  try { localStorage.removeItem(key); } catch (e) {}
}

/* ---------------------------------------------------------------
   ربط Firebase (Firestore) — مشروع نجاح-تطبيق
--------------------------------------------------------------- */
const FIREBASE_PROJECT_ID = "najah-app-62bd9";
const FIREBASE_API_KEY = "AIzaSyCN2oH6TNUtT8fLXnQayHe-4TUrswMbSyI";

// تحويل حساب التلميذ إلى صيغة Firestore وحفظه في قاعدة البيانات الحقيقية
async function syncAccountToFirestore(account) {
  try {
    const studentId = account.phone.replace(/[^0-9]/g, "") || `st_${Date.now()}`;
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/students/${studentId}?key=${FIREBASE_API_KEY}`;
    const fields = {
      firstName: { stringValue: account.firstName || "" },
      lastName: { stringValue: account.lastName || "" },
      phone: { stringValue: account.phone || "" },
      wilaya: { stringValue: account.wilaya || "" },
      subscribedUntil: { stringValue: account.subscribedUntil || "" },
      password: { stringValue: account.password || "" },
      activeDevice: { stringValue: account.activeDevice || "" },
    };
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });
    return res.ok;
  } catch (e) {
    console.error("تعذّر الحفظ في Firebase", e);
    return false;
  }
}

// جلب حساب تلميذ من Firestore عبر رقم هاتفه — يُستعمل عند التسجيل (للتأكد أن الرقم غير مستعمل) وعند تسجيل الدخول
async function fetchStudentFromFirestore(phone) {
  const studentId = phone.replace(/[^0-9]/g, "");
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/students/${studentId}?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("network-error");
  const data = await res.json();
  const obj = {};
  Object.entries(data.fields || {}).forEach(([k, v]) => {
    obj[k] = v.stringValue !== undefined ? v.stringValue : "";
  });
  return obj;
}

/* ---------------------------------------------------------------
   إرسال SMS حقيقي — عبر وسيط (Serverless Function) على Vercel
   يتفادى قيود CORS ويخبّي بيانات اعتماد SMS Gateway عن المتصفح
--------------------------------------------------------------- */
// تحويل رقم هاتف جزائري (0XXXXXXXXX) إلى صيغة دولية (+213XXXXXXXXX)
function toInternationalPhone(phone) {
  const digits = (phone || "").replace(/[^0-9]/g, "");
  if (digits.startsWith("213")) return "+" + digits;
  if (digits.startsWith("0")) return "+213" + digits.slice(1);
  return "+213" + digits;
}

// إرسال رمز التحقق عبر SMS حقيقي؛ يرجع true عند النجاح، false عند أي فشل (بدون توقف التسجيل)
async function sendRealSms(phone, code) {
  try {
    const res = await fetch("/api/send-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: toInternationalPhone(phone), code }),
    });
    const data = await res.json();
    return !!data.ok;
  } catch (e) {
    console.warn("تعذّر إرسال SMS حقيقي، سيُعرض الرمز على الشاشة بدلاً منه", e);
    return false;
  }
}

// معرّف فريد لهذا الجهاز، يُنشأ مرة واحدة ويُحفظ محلياً
function getDeviceId() {
  let id = lsGet("deviceId");
  if (id) return id;
  id = "dev_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  lsSet("deviceId", id);
  return id;
}

/* ---------------------------------------------------------------
   بيانات المواد — شعبة العلوم التجريبية
   (رياضيات، فيزياء، علوم طبيعة، عربية، إنجليزية، إسلامية)
--------------------------------------------------------------- */
const SUBJECTS = [
  {
    id: "math",
    name: "الرياضيات",
    icon: Calculator,
    color: "#0F5C46",
    coef: 4,
    chapters: [
      "الدوال العددية والدراسة التقريبية",
      "النهايات والاتصال",
      "الاشتقاق وتطبيقاته",
      "الدراسة الكاملة للدوال والتمثيل البياني",
      "المتتاليات العددية",
      "الدالة الأسية والدالة اللوغاريتمية",
      "الحساب التكاملي",
      "الأعداد المركبة",
      "الاحتمالات",
    ],
    teachers: ["الأستاذ نور الدين", "مصطفى BDD", "الأستاذ شاوش", "الأستاذ طيايبة"],
    exercises: [
      { q: "أدرس تغيرات الدالة f(x) = x³ − 3x + 1 على مجموعة تعريفها، ثم مثّلها بيانياً.", a: "نحسب f'(x) = 3x² − 3، نحلل إشارتها لإيجاد فترات التزايد والتناقص، نحدد القيم الحدية عند x = ±1، ثم ندرس الاتجاه عند اللانهايتين قبل رسم الجدول والمنحنى." },
      { q: "أحسب النهاية: lim(x→0) (e^x − 1) / x", a: "هذه نهاية نموذجية تساوي 1، وتُحسب مباشرة باستعمال النهاية المرجعية lim(x→0) (e^x−1)/x = 1، أو بتطبيق قاعدة لوبيتال." },
      { q: "بيّن أن المتتالية (Uₙ) المعرفة بـ Uₙ₊₁ = (1/2)Uₙ + 3 و U₀ = 1 متقاربة، ثم أحسب نهايتها.", a: "نبيّن أن المتتالية Vₙ = Uₙ − 6 هندسية أساسها 1/2، ومنه Uₙ تتقارب نحو 6." },
      { q: "أحسب التكامل: ∫[0,1] (2x + 1) dx", a: "المعادلة الأصلية هي x² + x، فنعوض بين 0 و1 لنجد النتيجة 2." },
      { q: "أوجد المرافق واحسب طويلة العدد المركب z = 3 + 4i.", a: "المرافق هو z̄ = 3 − 4i، والطويلة |z| = √(3²+4²) = 5." },
    ],
    bac: [
      { q: "(بكالوريا) الجزء الأول: تمرين في الاحتمالات حول صندوق يحتوي كرات مرقمة، مطلوب حساب احتمالات وقانون الاحتمال.", a: "نحدد الحالات الممكنة (الكون)، نحسب عدد الحالات المناسبة لكل حدث، ثم نطبق نسبة عدد الحالات المناسبة على المجموع لإيجاد كل احتمال، وأخيراً نبني جدول قانون الاحتمال." },
      { q: "(بكالوريا) تمرين تحليلي حول دراسة دالة أسية وحساب مساحة حيز مستوٍ باستعمال التكامل.", a: "ندرس تغيرات الدالة (النهايات، الاشتقاق، الاتجاه)، نمثلها بيانياً، ثم نحسب التكامل بين نقطتي التقاطع لإيجاد المساحة المطلوبة بالوحدات المساحية." },
    ],
  },
  {
    id: "physics",
    name: "الفيزياء والكيمياء",
    icon: FlaskConical,
    color: "#1B4F72",
    coef: 4,
    chapters: [
      "التحولات النووية والنشاط الإشعاعي",
      "متابعة تطور جملة كيميائية (الأكسدة والإرجاع)",
      "تطور جملة كيميائية نحو حالة التوازن",
      "مراقبة تطور جملة كيميائية (التفاعلات المقايسة)",
      "دراسة ثنائي القطب RC",
      "دراسة ثنائي القطب RL",
      "حركة جسم صلب (السقوط الحر، الحركة المستوية)",
      "الحركة الكوكبية وقوانين كيبلر",
    ],
    teachers: ["الأستاذ أحمد ترير", "الأستاذة كتفي شريف زينة", "قناة أيوب للعلوم"],
    exercises: [
      { q: "نواة اليود 131 مشعة، زمن نصف عمرها 8 أيام. احسب النسبة المتبقية من عينة بعد 24 يوماً.", a: "24 يوماً تساوي 3 أزمنة نصف عمر (3×8)، فتتناقص الكمية إلى (1/2)³ = 1/8 من الكمية الابتدائية، أي نسبة متبقية 12.5%." },
      { q: "في دارة RC، ما تأثير زيادة المقاومة R على ثابت الزمن τ؟", a: "ثابت الزمن τ = R×C، فزيادة R تزيد τ، أي يصبح الشحن والتفريغ أبطأ." },
      { q: "جسم يسقط سقوطاً حراً بدون سرعة ابتدائية، احسب سرعته بعد 2 ثانية (g=10 m/s²).", a: "باستعمال العلاقة v = g×t، نجد v = 10×2 = 20 m/s." },
    ],
    bac: [
      { q: "(بكالوريا) تمرين حول متابعة تفاعل الأكسدة والإرجاع بقياس التوصيلية، ورسم منحنى تطور التركيز بدلالة الزمن.", a: "نكتب معادلة التفاعل ونحدد المتفاعل المحد، ننشئ جدول التقدم، نستغل قياسات التوصيلية لحساب التقدم x في لحظات مختلفة، ثم نرسم المنحنى ونستنتج السرعة الحجمية للتفاعل." },
      { q: "(بكالوريا) تمرين ميكانيكي حول حركة قذيفة في مجال الثقالة (دراسة المسار القطعمكافئ).", a: "نطبق القانون الثاني لنيوتن لإيجاد معادلتي الحركة أفقياً وشاقولياً، ثم نستنتج معادلة المسار وموقع أقصى ارتفاع ومدى القذيفة." },
    ],
  },
  {
    id: "svt",
    name: "علوم الطبيعة والحياة",
    icon: Dna,
    color: "#2E7D32",
    coef: 2,
    chapters: [
      "التنسيق الهرموني ووظيفة التكاثر",
      "من المورثة إلى الصفة: التعبير المورثي",
      "التنسيق العصبي والاستجابة الانعكاسية",
      "المناعة والاستجابة المناعية",
      "الإنتاج الطاقوي الخلوي: التنفس والتخمر",
      "دعامة المعلومة الوراثية واستقرارها",
    ],
    teachers: ["قناة Amanesvt", "أساتذة SVT بكالوريا الجزائر"],
    exercises: [
      { q: "فسّر آلية تنظيم إفراز هرمون LH عند الرجل بواسطة التغذية الراجعة.", a: "التستوستيرون المفرز من الخصية يمارس تغذية راجعة سلبية على منطقة تحت المهاد والغدة النخامية، فيثبّط إفراز GnRH وLH للحفاظ على توازن الهرمونات." },
      { q: "ما الفرق بين المناعة الخلطية والمناعة الخلوية؟", a: "المناعة الخلطية تعتمد على إفراز الأجسام المضادة من طرف الخلايا اللمفاوية البائية لتحييد المستضدات خارج الخلية، بينما المناعة الخلوية تعتمد على الخلايا اللمفاوية التائية السامة التي تدمر الخلايا المصابة مباشرة." },
    ],
    bac: [
      { q: "(بكالوريا) تمرين حول استغلال نتائج تجارب لتفسير آلية التعبير المورثي (من المورثة إلى البروتين).", a: "نستغل المعطيات (تسلسل ADN، ARN مرسال، بروتين) لتوضيح مراحل الاستنساخ ثم الترجمة، مع تحديد أثر أي طفرة على التسلسل الببتيدي الناتج." },
    ],
  },
  {
    id: "arabic",
    name: "اللغة العربية وآدابها",
    icon: BookOpen,
    color: "#7B241C",
    coef: 2,
    chapters: [
      "التيار الإحيائي والتجديد الشعري",
      "الشعر الرومانسي وأدب المهجر",
      "الواقعية في الأدب العربي الحديث",
      "المحسنات البديعية والبلاغة",
      "النقد الأدبي ومناهجه",
    ],
    teachers: ["أساتذة اللغة العربية بكالوريا"],
    exercises: [
      { q: "استخرج من نص أدبي محسناً بديعياً واشرح أثره الفني.", a: "نبحث عن طباق أو جناس أو استعارة، ثم نبيّن كيف يخدم المحسّن المعنى ويقوّي الصورة الفنية للنص." },
    ],
    bac: [
      { q: "(بكالوريا) تحليل نص أدبي مع تحديد الخصائص الفنية للتيار الأدبي الذي ينتمي إليه.", a: "نحدد التيار (إحيائي، رومانسي، واقعي...)، نستخرج مظاهره في المعنى والصياغة، ثم نربط ذلك بالسياق التاريخي والفكري للنص." },
    ],
  },
  {
    id: "french",
    name: "اللغة الفرنسية",
    icon: Languages,
    color: "#154360",
    coef: 2,
    chapters: [
      "Le texte argumentatif",
      "L'expression de la cause et de la conséquence",
      "Le discours rapporté",
      "Le texte explicatif scientifique",
    ],
    teachers: ["أساتذة الفرنسية بكالوريا"],
    exercises: [
      { q: "Reformulez cette phrase en discours indirect : « Je viendrai demain », dit-il.", a: "Il a dit qu'il viendrait le lendemain — on adapte le temps du verbe et les indicateurs de temps." },
    ],
    bac: [],
  },
  {
    id: "english",
    name: "اللغة الإنجليزية",
    icon: Languages,
    color: "#4A235A",
    coef: 2,
    chapters: [
      "Reading Comprehension Strategies",
      "Reported Speech",
      "Conditionals (Type 1, 2, 3)",
      "Essay & Letter Writing",
    ],
    teachers: ["أساتذة الإنجليزية بكالوريا"],
    exercises: [
      { q: "Rewrite using reported speech: She said, 'I am studying now.'", a: "She said that she was studying then — the tense shifts back and the time expression changes." },
    ],
    bac: [
      { q: "(Bac) Reading comprehension passage followed by grammar and writing tasks.", a: "Answer comprehension questions using information directly from the text, then apply the grammar rule asked (e.g. reported speech or conditionals) before writing a short paragraph on the given topic." },
    ],
  },
  {
    id: "islamic",
    name: "التربية الإسلامية",
    icon: Star,
    color: "#0E6655",
    coef: 1,
    chapters: [
      "العقيدة الإسلامية وأثرها في السلوك",
      "أحكام الفقه الإسلامي المعاصرة",
      "السيرة النبوية والقيم المستفادة",
      "القيم الإسلامية والمجتمع",
    ],
    teachers: ["أساتذة التربية الإسلامية بكالوريا"],
    exercises: [
      { q: "بيّن أثر الإيمان بالقضاء والقدر على استقرار سلوك الفرد.", a: "الإيمان بالقضاء والقدر يورث الطمأنينة والرضا، ويدفع الفرد للعمل والأخذ بالأسباب دون قلق مفرط من النتائج، لأنه يعلم أن التوفيق بيد الله بعد بذل الجهد." },
    ],
    bac: [
      { q: "(بكالوريا) استخرج من نص شرعي حكماً فقهياً معاصراً وبيّن دليله.", a: "نحدد المسألة الفقهية المطروحة في النص، نذكر الحكم الشرعي المرتبط بها مع دليله من القرآن أو السنة، ثم نبيّن وجه تطبيقه في واقع معاصر." },
    ],
  },
  {
    id: "history",
    name: "التاريخ والجغرافيا",
    icon: Landmark,
    color: "#6E2C00",
    coef: 2,
    chapters: [
      "الحرب العالمية الثانية ونتائجها",
      "الحرب الباردة والصراع الدولي",
      "حركة عدم الانحياز والتحرر من الاستعمار",
      "الثورة التحريرية الجزائرية",
      "القضية الفلسطينية",
      "النظام العالمي الجديد",
      "العولمة والتكتلات الاقتصادية",
      "المشكلات البيئية الكبرى",
    ],
    teachers: ["أساتذة التاريخ والجغرافيا بكالوريا"],
    exercises: [],
    bac: [],
  },
  {
    id: "philo",
    name: "الفلسفة",
    icon: Brain,
    color: "#5B2C6F",
    coef: 2,
    chapters: [
      "إشكالية الشخص والهوية",
      "إشكالية المعرفة العلمية",
      "إشكالية الدولة والمجتمع",
      "منهجية السؤال والجدل الفلسفي",
    ],
    teachers: ["أساتذة الفلسفة بكالوريا"],
    exercises: [],
    bac: [],
  },
];

/* ---------------------------------------------------------------
   استدعاء الذكاء الاصطناعي
--------------------------------------------------------------- */
async function askAI(systemPrompt, apiMessages) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: systemPrompt,
      messages: apiMessages,
    }),
  });
  const data = await response.json();
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function recordAiFeedback(subjectId, vote) {
  try {
    let current = {};
    const raw = lsGet("aiFeedback");
    if (raw) current = JSON.parse(raw);
    const entry = current[subjectId] || { up: 0, down: 0 };
    entry[vote] = (entry[vote] || 0) + 1;
    current[subjectId] = entry;
    lsSet("aiFeedback", JSON.stringify(current));
  } catch (e) {
    console.error("تعذّر حفظ التقييم", e);
  }
}

/* ---------------------------------------------------------------
   أزرار تقييم سريع تحت شرح الذكاء الاصطناعي
--------------------------------------------------------------- */
function RateButtons({ subjectId, color }) {
  const [voted, setVoted] = useState(null);
  if (voted) {
    return (
      <div style={{ fontSize: 10.5, color: BRAND.subtext, marginTop: 4, textAlign: "left" }}>
        شكراً على تقييمك 🌟
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 4, justifyContent: "flex-end" }}>
      <span style={{ fontSize: 10.5, color: BRAND.subtext, alignSelf: "center" }}>هل هذا الشرح واضح؟</span>
      <button
        onClick={() => { setVoted("up"); recordAiFeedback(subjectId, "up"); }}
        style={{ width: 24, height: 24, borderRadius: "999px", background: "#fff", border: `1px solid ${BRAND.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
      >
        <ThumbsUp size={12} color={color} />
      </button>
      <button
        onClick={() => { setVoted("down"); recordAiFeedback(subjectId, "down"); }}
        style={{ width: 24, height: 24, borderRadius: "999px", background: "#fff", border: `1px solid ${BRAND.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
      >
        <ThumbsDown size={12} color={color} />
      </button>
    </div>
  );
}

function useGoogleFonts() {
  useEffect(() => {
    const id = "najah-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&family=Tajawal:wght@400;500;700&display=swap";
    document.head.appendChild(link);
  }, []);
}

function StarBadge({ size = 40 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "999px", background: `linear-gradient(135deg, ${BRAND.gold}, #E8C874)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(200,155,60,0.45)", flexShrink: 0 }}>
      <Star size={size * 0.55} color="#5C4413" fill="#5C4413" strokeWidth={0} />
    </div>
  );
}

function TopBar({ title, color, onBack }) {
  return (
    <div style={{ background: `linear-gradient(135deg, ${color}, ${color}CC)`, padding: "16px 16px 14px", color: "#fff", borderBottomLeftRadius: 20, borderBottomRightRadius: 20, display: "flex", alignItems: "center", gap: 10 }}>
      <button onClick={onBack} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 10, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer", flexShrink: 0 }}>
        <ArrowRight size={17} />
      </button>
      <div className="najah-heading" style={{ fontWeight: 800, fontSize: 16.5 }}>{title}</div>
    </div>
  );
}

/* ---------------------------------------------------------------
   التطبيق الرئيسي
--------------------------------------------------------------- */
export default function NajahApp() {
  useGoogleFonts();
  const [view, setView] = useState("loading");
  const [name, setName] = useState("");
  const [account, setAccount] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [pendingSignup, setPendingSignup] = useState(null);
  const [pendingCode, setPendingCode] = useState(null);
  const [smsSent, setSmsSent] = useState(false);
  const [smsSending, setSmsSending] = useState(false);
  const [activeSubject, setActiveSubject] = useState(null);
  const [activeChapter, setActiveChapter] = useState(null);
  const [exMode, setExMode] = useState("exercises"); // "exercises" | "bac"
  const [progress, setProgress] = useState({});
  const [aiModal, setAiModal] = useState(null); // { subject, text }
  const [streak, setStreak] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const raw = lsGet("progress");
        if (raw) setProgress(JSON.parse(raw));
      } catch (e) {}
      try {
        const today = new Date().toISOString().slice(0, 10);
        let data = null;
        try {
          const raw3 = lsGet("dailyStreak");
          if (raw3) data = JSON.parse(raw3);
        } catch (e) {}
        if (!data) {
          data = { lastDate: today, streak: 1 };
        } else if (data.lastDate !== today) {
          const diffDays = Math.round((new Date(today) - new Date(data.lastDate)) / 86400000);
          data = diffDays === 1 ? { lastDate: today, streak: data.streak + 1 } : { lastDate: today, streak: 1 };
        }
        setStreak(data.streak);
        lsSet("dailyStreak", JSON.stringify(data));
      } catch (e) {}

      // التحقق من وجود حساب واشتراك سابق
      const thisDeviceId = getDeviceId();
      setDeviceId(thisDeviceId);
      let acc = null;
      try {
        const raw4 = lsGet("account");
        if (raw4) acc = JSON.parse(raw4);
      } catch (e) {}
      let determinedView;
      if (!acc) {
        determinedView = "entry";
      } else {
        setAccount(acc);
        setName(acc.firstName);
        const stillActive = acc.subscribedUntil && new Date(acc.subscribedUntil) > new Date();
        determinedView = stillActive ? "subjects" : "subscribe";
      }
      await new Promise((resolve) => setTimeout(resolve, 900)); // مدة عرض شاشة البداية
      setView(determinedView);
    })();
  }, []);

  const saveProgress = async (next) => {
    setProgress(next);
    try { lsSet("progress", JSON.stringify(next)); } catch (e) {}
  };

  const toggleChapter = (subjectId, idx) => {
    const current = new Set(progress[subjectId] || []);
    if (current.has(idx)) current.delete(idx); else current.add(idx);
    saveProgress({ ...progress, [subjectId]: Array.from(current) });
  };

  // الخطوة 1: التأكد أن الرقم غير مسجل من قبل، ثم الانتقال للاشتراك (الدفع)
  const submitSignup = async (data) => {
    try {
      const existing = await fetchStudentFromFirestore(data.phone);
      if (existing) {
        return "هذا الرقم مسجل من قبل. اضغط \"سجّل الدخول\" بدل إنشاء حساب جديد.";
      }
    } catch (e) {
      console.warn("تعذّر التحقق من الرقم مسبقاً، سيتم المتابعة بدون التحقق", e);
    }
    setPendingSignup(data);
    setView("subscribe");
    return null;
  };

  // تسجيل الدخول لحساب موجود من جهاز جديد — يُرفض إذا كان الحساب مفعّلاً على جهاز آخر حالياً
  const submitLogin = async (phone, password) => {
    let student;
    try {
      student = await fetchStudentFromFirestore(phone);
    } catch (e) {
      return "تعذّر الاتصال، تأكد من الإنترنت وأعد المحاولة.";
    }
    if (!student) return "هذا الرقم غير مسجل. سجّل حساباً جديداً أولاً.";
    if (student.password !== password) return "كلمة السر غير صحيحة.";
    if (student.activeDevice && student.activeDevice !== deviceId) {
      return "هذا الحساب مسجَّل الدخول من جهاز آخر حالياً. سجّل الخروج من ذلك الجهاز أولاً، ثم أعد المحاولة هنا.";
    }
    const acc = { ...student, activeDevice: deviceId };
    setAccount(acc);
    setName(acc.firstName);
    try { lsSet("account", JSON.stringify(acc)); } catch (e) {}
    await syncAccountToFirestore(acc);
    const stillActive = acc.subscribedUntil && new Date(acc.subscribedUntil) > new Date();
    setView(stillActive ? "subjects" : "subscribe");
    return null;
  };

  // الخطوة 2: بعد الدفع، توليد رمز تحقق وإرساله (تجريبياً يظهر على الشاشة)
  const startVerification = async () => {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    setPendingCode(code);
    setSmsSending(true);
    setView("verify");
    const ok = await sendRealSms(pendingSignup.phone, code);
    setSmsSent(ok);
    setSmsSending(false);
  };

  // الخطوة 3: التحقق من الرمز، وإن صح نفعّل الاشتراك وندخل التطبيق
  const submitVerify = (code) => {
    if (code === pendingCode) {
      completeSubscription();
      return true;
    }
    return false;
  };

  // تفعيل الاشتراك السنوي وحفظ الحساب (بعد نجاح التحقق من الرمز) — يربط الحساب بهذا الجهاز
  const completeSubscription = async () => {
    const until = new Date();
    until.setDate(until.getDate() + 365);
    const acc = { ...pendingSignup, subscribedUntil: until.toISOString(), activeDevice: deviceId };
    setAccount(acc);
    setName(acc.firstName);
    try { lsSet("account", JSON.stringify(acc)); } catch (e) {}
    await syncAccountToFirestore(acc);
    setView("welcome");
  };

  // تجديد الاشتراك لحساب موجود سابقاً (نفس الجهاز)
  const renewSubscription = async () => {
    const until = new Date();
    until.setDate(until.getDate() + 365);
    const acc = { ...account, subscribedUntil: until.toISOString(), activeDevice: deviceId };
    setAccount(acc);
    try { lsSet("account", JSON.stringify(acc)); } catch (e) {}
    await syncAccountToFirestore(acc);
    setView("welcome");
  };

  // تسجيل الخروج: يحرر قفل الجهاز في Firebase حتى يقدر التلميذ يدخل من جهاز آخر
  const logout = async () => {
    if (account) {
      try { await syncAccountToFirestore({ ...account, activeDevice: "" }); } catch (e) {}
    }
    try { lsRemove("account"); } catch (e) {}
    setAccount(null);
    setPendingSignup(null);
    setPendingCode(null);
    setName("");
    setView("signup");
  };

  const totalChapters = SUBJECTS.reduce((s, x) => s + x.chapters.length, 0);
  const doneChapters = Object.values(progress).reduce((s, arr) => s + (arr ? arr.length : 0), 0);
  const pct = totalChapters ? Math.round((doneChapters / totalChapters) * 100) : 0;

  const showNav = !["welcome", "entry", "signup", "login", "verify", "subscribe", "loading"].includes(view);

  return (
    <div dir="rtl" style={{ fontFamily: "'Tajawal', sans-serif", background: BRAND.bg, color: BRAND.text, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <style>{`
        .najah-heading { font-family: 'Cairo', sans-serif; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #D8CFAE; border-radius: 4px; }
        @keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
        @keyframes splashPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: 0.85; } }
        @keyframes payPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(200,155,60,0.55); } 70% { box-shadow: 0 0 0 12px rgba(200,155,60,0); } }
        @keyframes aiGlow { 0%, 100% { box-shadow: 0 4px 16px rgba(200,155,60,0.4); transform: scale(1); } 50% { box-shadow: 0 4px 24px rgba(200,155,60,0.7); transform: scale(1.015); } }
      `}</style>

      <div style={{ flex: 1, paddingBottom: showNav ? 84 : 0, maxWidth: 480, margin: "0 auto", width: "100%" }}>
        {view === "loading" && <SplashView />}

        {view === "entry" && (
          <EntryView
            onGoSignup={() => setView("signup")}
            onGoLogin={() => setView("login")}
          />
        )}

        {view === "signup" && <SignupView onSubmit={submitSignup} onGoLogin={() => setView("login")} onBack={() => setView("entry")} />}

        {view === "login" && <LoginView onSubmit={submitLogin} onGoSignup={() => setView("signup")} onBack={() => setView("entry")} />}

        {view === "verify" && (
          <VerifyView
            phone={pendingSignup ? pendingSignup.phone : ""}
            demoCode={pendingCode}
            smsSent={smsSent}
            smsSending={smsSending}
            onVerify={submitVerify}
            onBack={() => setView("signup")}
          />
        )}

        {view === "subscribe" && (
          <SubscribeView
            firstName={pendingSignup ? pendingSignup.firstName : (account ? account.firstName : "")}
            renewMode={!pendingSignup && !!account}
            onPay={pendingSignup ? startVerification : renewSubscription}
          />
        )}

        {view === "welcome" && <WelcomeView name={name} onStart={() => setView("subjects")} />}

        {view === "subjects" && (
          <SubjectsHome
            name={name}
            progress={progress}
            pct={pct}
            streak={streak}
            onOpenSubject={(s) => { setActiveSubject(s); setView("subjectMenu"); }}
            onAbout={() => setView("about")}
            onReset={logout}
          />
        )}

        {view === "subjectMenu" && activeSubject && (
          <SubjectMenuView
            subject={activeSubject}
            onBack={() => setView("subjects")}
            onOpen={(section) => {
              if (section === "lessons") setView("lessons");
              if (section === "exercises") { setExMode("exercises"); setView("exercises"); }
              if (section === "bac") { setExMode("bac"); setView("exercises"); }
            }}
          />
        )}

        {view === "lessons" && activeSubject && (
          <LessonsView
            subject={activeSubject}
            progress={progress[activeSubject.id] || []}
            onToggle={(idx) => toggleChapter(activeSubject.id, idx)}
            onOpenChapter={(idx) => { setActiveChapter(idx); setView("lessonVideos"); }}
            onBack={() => setView("subjectMenu")}
          />
        )}

        {view === "lessonVideos" && activeSubject && activeChapter !== null && (
          <LessonVideosView
            subject={activeSubject}
            chapterIndex={activeChapter}
            onBack={() => setView("lessons")}
          />
        )}

        {view === "exercises" && activeSubject && (
          <ExercisesView
            subject={activeSubject}
            mode={exMode}
            onBack={() => setView("subjectMenu")}
            onAsk={(text) => setAiModal({ subject: activeSubject, text })}
          />
        )}

        {view === "ai" && <AiSolverView subjects={SUBJECTS} />}

        {view === "about" && <AboutView onBack={() => setView("subjects")} />}
      </div>

      {showNav && <BottomNav view={view} setView={(v) => { setView(v); }} />}

      {aiModal && (
        <AiAskModal
          subject={aiModal.subject}
          initialText={aiModal.text}
          onClose={() => setAiModal(null)}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   لافتة الترحيب
--------------------------------------------------------------- */
/* ---------------------------------------------------------------
   شاشة تحميل بسيطة (Splash) عند فتح التطبيق
--------------------------------------------------------------- */
function SplashView() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", background: `linear-gradient(160deg, ${BRAND.greenDark}, ${BRAND.green})`, color: "#fff" }}>
      <div style={{ animation: "splashPulse 1.4s ease-in-out infinite" }}>
        <StarBadge size={64} />
      </div>
      <div className="najah-heading" style={{ fontSize: 20, fontWeight: 900, marginTop: 16 }}>
        ناجح <span style={{ color: BRAND.gold }}>بإذن الله</span>
      </div>
    </div>
  );
}

function WelcomeView({ name, onStart }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "32px 24px", background: `linear-gradient(160deg, ${BRAND.greenDark}, ${BRAND.green})`, color: "#fff", textAlign: "center" }}>
      <StarBadge size={72} />
      <div className="najah-heading" style={{ fontSize: 26, fontWeight: 900, marginTop: 18 }}>
        أهلاً بك {name ? name : ""} 👋
      </div>
      <div className="najah-heading" style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>
        ناجح <span style={{ color: BRAND.gold }}>بإذن الله</span>
      </div>
      <div style={{ fontSize: 13.5, opacity: 0.9, marginTop: 10, lineHeight: 1.9, maxWidth: 300 }}>
        رفيقك نحو التفوق في البكالوريا — شعبة العلوم التجريبية
      </div>
      <div style={{ marginTop: 16, background: "rgba(255,255,255,0.12)", borderRadius: 12, padding: "10px 16px", fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}>
        <ShieldCheck size={16} color={BRAND.gold} />
        اشتراكك فعّال الآن لمدة سنة كاملة 🎉
      </div>

      <button
        onClick={onStart}
        style={{ marginTop: 26, background: BRAND.gold, color: "#4A3410", border: "none", borderRadius: 14, padding: "14px 44px", fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: "'Cairo', sans-serif", boxShadow: "0 6px 18px rgba(0,0,0,0.25)" }}
      >
        ابدأ
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------
   الواجهة الأولى — اختيار بين تسجيل الدخول والاشتراك لأول مرة
--------------------------------------------------------------- */
function EntryView({ onGoSignup, onGoLogin }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "36px 24px", background: `linear-gradient(160deg, ${BRAND.greenDark}, ${BRAND.green})`, color: "#fff", textAlign: "center" }}>
      <StarBadge size={78} />
      <div className="najah-heading" style={{ fontSize: 30, fontWeight: 900, marginTop: 20 }}>
        ناجح <span style={{ color: BRAND.gold }}>بإذن الله</span>
      </div>
      <div style={{ fontSize: 14, opacity: 0.9, marginTop: 10, lineHeight: 1.9, maxWidth: 300 }}>
        رفيقك الذكي نحو التفوق في البكالوريا — دروس، تمارين، ومساعد ذكاء اصطناعي بين يديك في أي وقت
      </div>

      <div style={{ width: "100%", maxWidth: 320, marginTop: 40, display: "flex", flexDirection: "column", gap: 14 }}>
        <button
          onClick={onGoSignup}
          style={{ width: "100%", background: BRAND.gold, color: "#4A3410", border: "none", borderRadius: 14, padding: "16px", fontSize: 15.5, fontWeight: 800, cursor: "pointer", fontFamily: "'Cairo', sans-serif", boxShadow: "0 6px 18px rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <Sparkles size={19} />
          ابدأ رحلتك الآن — اشتراك جديد
        </button>

        <button
          onClick={onGoLogin}
          style={{ width: "100%", background: "rgba(255,255,255,0.12)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.5)", borderRadius: 14, padding: "16px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'Cairo', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <Lock size={17} />
          لديّ حساب بالفعل — تسجيل الدخول
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   واجهة إنشاء الحساب (تسجيل الدخول)
--------------------------------------------------------------- */
function SignupView({ onSubmit, onGoLogin, onBack }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [wilaya, setWilaya] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const inputStyle = { width: "100%", padding: "12px 40px 12px 14px", borderRadius: 12, border: `1px solid ${BRAND.border}`, fontSize: 13.5, fontFamily: "'Tajawal', sans-serif", outline: "none", background: "#fff", textAlign: "right" };
  const iconWrapStyle = { position: "relative", marginBottom: 12 };
  const iconStyle = { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: BRAND.subtext };

  const submit = async () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim() || !wilaya || !password.trim()) {
      setError("الرجاء تعبئة جميع الخانات");
      return;
    }
    if (phone.trim().length < 9) {
      setError("رقم الهاتف غير صحيح");
      return;
    }
    if (password.length < 4) {
      setError("كلمة السر يجب أن تكون 4 أحرف على الأقل");
      return;
    }
    setError("");
    setSubmitting(true);
    const err = await onSubmit({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(), wilaya, password });
    if (err) {
      setError(err);
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: BRAND.bg, padding: "36px 20px" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        <StarBadge size={54} />
      </div>
      <div className="najah-heading" style={{ textAlign: "center", fontWeight: 900, fontSize: 20, color: BRAND.greenDark }}>
        إنشاء حساب جديد
      </div>
      <div style={{ textAlign: "center", fontSize: 12, color: BRAND.subtext, marginTop: 4, marginBottom: 22 }}>
        انضم إلى ناجح بإذن الله وابدأ رحلتك نحو التفوق
      </div>

      <div style={{ maxWidth: 340, margin: "0 auto" }}>
        <div style={iconWrapStyle}>
          <User size={16} style={iconStyle} />
          <input style={inputStyle} placeholder="الاسم" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div style={iconWrapStyle}>
          <User size={16} style={iconStyle} />
          <input style={inputStyle} placeholder="اللقب" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div style={iconWrapStyle}>
          <Phone size={16} style={iconStyle} />
          <input style={inputStyle} placeholder="رقم الهاتف" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div style={iconWrapStyle}>
          <MapPin size={16} style={iconStyle} />
          <select style={{ ...inputStyle, appearance: "auto" }} value={wilaya} onChange={(e) => setWilaya(e.target.value)}>
            <option value="">اختر ولايتك</option>
            {WILAYAS.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>
        <div style={iconWrapStyle}>
          <Lock size={16} style={iconStyle} />
          <input style={inputStyle} placeholder="كلمة السر" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", padding: 0, cursor: "pointer", color: BRAND.subtext, display: "flex" }}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {error && <div style={{ color: "#B03A2E", fontSize: 12, marginBottom: 10, textAlign: "center", lineHeight: 1.8 }}>{error}</div>}

        <button
          onClick={submit}
          disabled={submitting}
          style={{ width: "100%", background: "#1565C0", color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 14.5, fontWeight: 800, cursor: submitting ? "default" : "pointer", fontFamily: "'Cairo', sans-serif", marginTop: 6, opacity: submitting ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          {submitting && <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />}
          التالي
        </button>
        <div style={{ fontSize: 11, color: BRAND.subtext, textAlign: "center", marginTop: 10, lineHeight: 1.8 }}>
          سنرسل لك رمزاً سرياً على رقم هاتفك للتأكد من صحته
        </div>
        <button onClick={onGoLogin} style={{ width: "100%", background: "none", border: "none", color: BRAND.green, fontSize: 12.5, fontWeight: 700, cursor: "pointer", marginTop: 16 }}>
          هل لديك حساب مسبقاً؟ سجّل الدخول
        </button>
        <button onClick={onBack} style={{ width: "100%", background: "none", border: "none", color: BRAND.subtext, fontSize: 11.5, cursor: "pointer", marginTop: 8 }}>
          ← الرجوع للصفحة الرئيسية
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   واجهة تسجيل الدخول (لجهاز جديد بحساب موجود)
--------------------------------------------------------------- */
function LoginView({ onSubmit, onGoSignup, onBack }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const inputStyle = { width: "100%", padding: "12px 40px 12px 14px", borderRadius: 12, border: `1px solid ${BRAND.border}`, fontSize: 13.5, fontFamily: "'Tajawal', sans-serif", outline: "none", background: "#fff", textAlign: "right" };
  const iconWrapStyle = { position: "relative", marginBottom: 12 };
  const iconStyle = { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: BRAND.subtext };

  const submit = async () => {
    if (!phone.trim() || !password.trim()) {
      setError("الرجاء إدخال رقم الهاتف وكلمة السر");
      return;
    }
    setError("");
    setSubmitting(true);
    const err = await onSubmit(phone.trim(), password);
    if (err) {
      setError(err);
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: BRAND.bg, padding: "36px 20px" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        <StarBadge size={54} />
      </div>
      <div className="najah-heading" style={{ textAlign: "center", fontWeight: 900, fontSize: 20, color: BRAND.greenDark }}>
        تسجيل الدخول
      </div>
      <div style={{ textAlign: "center", fontSize: 12, color: BRAND.subtext, marginTop: 4, marginBottom: 22, lineHeight: 1.8 }}>
        سجّل الدخول لحسابك الموجود من جهاز جديد
      </div>

      <div style={{ maxWidth: 340, margin: "0 auto" }}>
        <div style={iconWrapStyle}>
          <Phone size={16} style={iconStyle} />
          <input style={inputStyle} placeholder="رقم الهاتف" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div style={iconWrapStyle}>
          <Lock size={16} style={iconStyle} />
          <input style={inputStyle} placeholder="كلمة السر" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", padding: 0, cursor: "pointer", color: BRAND.subtext, display: "flex" }}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {error && <div style={{ color: "#B03A2E", fontSize: 12, marginBottom: 10, textAlign: "center", lineHeight: 1.8 }}>{error}</div>}

        <button
          onClick={submit}
          disabled={submitting}
          style={{ width: "100%", background: BRAND.green, color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 14.5, fontWeight: 800, cursor: submitting ? "default" : "pointer", fontFamily: "'Cairo', sans-serif", marginTop: 6, opacity: submitting ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          {submitting && <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />}
          دخول
        </button>
        <button onClick={onGoSignup} style={{ width: "100%", background: "none", border: "none", color: BRAND.subtext, fontSize: 12.5, fontWeight: 700, cursor: "pointer", marginTop: 16 }}>
          ليس لديك حساب؟ سجّل حساباً جديداً
        </button>
        <button onClick={onBack} style={{ width: "100%", background: "none", border: "none", color: BRAND.subtext, fontSize: 11.5, cursor: "pointer", marginTop: 8 }}>
          ← الرجوع للصفحة الرئيسية
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   واجهة التحقق من رمز الهاتف
--------------------------------------------------------------- */
function VerifyView({ phone, demoCode, smsSent, smsSending, onVerify, onBack }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (onVerify(code.trim())) {
      setError("");
    } else {
      setError("الرمز غير صحيح، حاول مرة أخرى");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: BRAND.bg, padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: "999px", background: BRAND.green + "1A", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <KeyRound size={28} color={BRAND.green} />
      </div>
      <div className="najah-heading" style={{ fontWeight: 900, fontSize: 18, color: BRAND.greenDark }}>تأكيد رقم الهاتف</div>
      <div style={{ fontSize: 12.5, color: BRAND.subtext, marginTop: 6, textAlign: "center", maxWidth: 280, lineHeight: 1.8 }}>
        أدخل الرمز السري المرسل إلى الرقم {phone}
      </div>

      <div style={{ width: "100%", maxWidth: 260, marginTop: 24 }}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="أدخل الرمز"
          style={{ width: "100%", padding: "14px", borderRadius: 12, border: `1px solid ${BRAND.border}`, fontSize: 20, textAlign: "center", letterSpacing: 6, fontFamily: "'Tajawal', sans-serif", outline: "none" }}
          maxLength={4}
        />
        {error && <div style={{ color: "#B03A2E", fontSize: 12, marginTop: 8, textAlign: "center" }}>{error}</div>}

        {smsSending && (
          <div style={{ background: "#EAF3EF", border: `1px dashed ${BRAND.green}`, borderRadius: 10, padding: "8px 10px", fontSize: 11.5, color: BRAND.greenDark, marginTop: 14, textAlign: "center", lineHeight: 1.7, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
            جاري إرسال رسالة SMS إلى هاتفك...
          </div>
        )}
        {!smsSending && smsSent && (
          <div style={{ background: "#EAF3EF", border: `1px solid ${BRAND.green}55`, borderRadius: 10, padding: "8px 10px", fontSize: 11.5, color: BRAND.greenDark, marginTop: 14, textAlign: "center", lineHeight: 1.7 }}>
            ✅ تم إرسال رمز التحقق برسالة SMS إلى هاتفك.
          </div>
        )}
        {!smsSending && !smsSent && (
          <div style={{ background: "#FDF3DF", border: `1px dashed ${BRAND.gold}`, borderRadius: 10, padding: "8px 10px", fontSize: 11, color: "#7A5E28", marginTop: 14, textAlign: "center", lineHeight: 1.7 }}>
            🔧 تعذّر إرسال SMS حقيقي الآن، لكن رمزك هو <b>{demoCode}</b> حتى تقدر تكمل.
          </div>
        )}

        <button
          onClick={submit}
          style={{ width: "100%", background: BRAND.green, color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "'Cairo', sans-serif", marginTop: 16 }}
        >
          التالي
        </button>
        <button onClick={onBack} style={{ width: "100%", background: "none", border: "none", color: BRAND.subtext, fontSize: 12, marginTop: 10, cursor: "pointer" }}>
          تعديل المعلومات
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   واجهة الاشتراك والدفع
--------------------------------------------------------------- */
function SubscribeView({ firstName, renewMode, onPay }) {
  const [paying, setPaying] = useState(false);
  const features = [
    "كل الدروس حسب المنهج الوزاري",
    "كل التمارين المشروحة لكل المواد",
    "كل مواضيع البكالوريا من 2010 إلى 2026",
    "مساعد ذكاء اصطناعي بدون حدود لشرح أي تمرين",
  ];

  const pay = () => {
    setPaying(true);
    setTimeout(() => { onPay(); }, 900);
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${BRAND.greenDark}, ${BRAND.green})`, padding: "36px 20px", color: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        <StarBadge size={54} />
      </div>
      <div className="najah-heading" style={{ textAlign: "center", fontWeight: 900, fontSize: 19 }}>
        {renewMode ? "تجديد الاشتراك السنوي" : `اشتراك سنوي${firstName ? " يا " + firstName : ""}`}
      </div>
      <div style={{ textAlign: "center", fontSize: 12, opacity: 0.85, marginTop: 4, marginBottom: 22 }}>
        خطوة أخيرة قبل الدخول إلى كل محتوى التطبيق
      </div>

      <div style={{ maxWidth: 340, margin: "0 auto", background: "#fff", borderRadius: 18, padding: "22px 20px", color: BRAND.text }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, color: BRAND.subtext }}>الاشتراك السنوي</div>
          <div className="najah-heading" style={{ fontSize: 32, fontWeight: 900, color: BRAND.green, marginTop: 4 }}>
            {SUBSCRIPTION_PRICE}
          </div>
          <div style={{ fontSize: 11.5, color: BRAND.subtext, marginTop: 2 }}>لمدة سنة كاملة</div>
        </div>

        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
          {features.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={16} color={BRAND.green} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12.5 }}>{f}</span>
            </div>
          ))}
        </div>

        <button
          onClick={pay}
          disabled={paying}
          style={{ width: "100%", background: BRAND.gold, color: "#4A3410", border: "none", borderRadius: 12, padding: "14px", fontSize: 14.5, fontWeight: 800, cursor: paying ? "default" : "pointer", fontFamily: "'Cairo', sans-serif", marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: paying ? 0.7 : 1, animation: paying ? "none" : "payPulse 2s infinite" }}
        >
          {paying ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <CreditCard size={16} />}
          {paying ? "جاري تأكيد الدفع..." : "ادفع الآن"}
        </button>

        <div style={{ background: "#FDF3DF", border: `1px dashed ${BRAND.gold}`, borderRadius: 10, padding: "8px 10px", fontSize: 10.5, color: "#7A5E28", marginTop: 12, textAlign: "center", lineHeight: 1.7 }}>
          🔧 وضع تجريبي: الدفع الحقيقي سيُربط لاحقاً ببوابة SATIM (بطاقة الذهبية/CIB) أو بتأكيد يدوي عبر بريدي موب.
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   شريط التنقل السفلي
--------------------------------------------------------------- */
const NAV = [
  { id: "subjects", label: "المواد", icon: BookOpen, matches: ["subjects", "subjectMenu", "lessons", "lessonVideos", "exercises"] },
  { id: "ai", label: "المساعد الذكي", icon: Sparkles, matches: ["ai"] },
];

function BottomNav({ view, setView }) {
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#FFFFFF", borderTop: `1px solid ${BRAND.border}`, display: "flex", justifyContent: "space-around", padding: "8px 4px calc(8px + env(safe-area-inset-bottom))", maxWidth: 480, margin: "0 auto", zIndex: 20 }}>
      {NAV.map((n) => {
        const Icon = n.icon;
        const active = n.matches.includes(view);
        return (
          <button key={n.id} onClick={() => setView(n.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", padding: "4px 10px", color: active ? BRAND.green : "#9AA29E", cursor: "pointer" }}>
            <Icon size={22} strokeWidth={active ? 2.4 : 2} />
            <span style={{ fontSize: 11, fontWeight: active ? 700 : 500 }}>{n.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------
   صفحة المواد (عمودية)
--------------------------------------------------------------- */
function SubjectsHome({ name, progress, pct, streak, onOpenSubject, onReset, onAbout }) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  return (
    <div style={{ padding: "20px 16px" }}>
      <div style={{ background: `linear-gradient(135deg, ${BRAND.greenDark}, ${BRAND.green})`, borderRadius: 18, padding: "16px 16px", color: "#fff", marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
        <StarBadge size={40} />
        <div style={{ flex: 1 }}>
          <div className="najah-heading" style={{ fontWeight: 800, fontSize: 15.5 }}>
            {name ? `أهلاً بك ${name} 👋` : "أهلاً بك 👋"}
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 2 }}>تقدمك الإجمالي: {pct}%</div>
        </div>
      </div>

      <div style={{ background: "#FDF3DF", border: `1px solid ${BRAND.gold}55`, borderRadius: 14, padding: "12px 14px", marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: "999px", background: BRAND.gold, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Flame size={19} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "#5C4413" }}>
            متتالية {streak} {streak === 1 ? "يوم" : "أيام"} 🔥
          </div>
          <div style={{ fontSize: 11, color: "#7A5E28", marginTop: 2 }}>
            لا تنسَ مراجعة درس واحد على الأقل اليوم حتى تحافظ على متتاليتك
          </div>
        </div>
      </div>

      <div className="najah-heading" style={{ fontWeight: 800, fontSize: 17, marginBottom: 12 }}>
        موادّ شعبة العلوم التجريبية
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {SUBJECTS.map((s) => {
          const done = (progress[s.id] || []).length;
          const Icon = s.icon;
          return (
            <button key={s.id} onClick={() => onOpenSubject(s)} style={{ background: BRAND.card, border: `1px solid ${BRAND.border}`, borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "right" }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: s.color + "1A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={21} color={s.color} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{s.name}</div>
                <div style={{ fontSize: 11.5, color: BRAND.subtext, marginTop: 2 }}>
                  {done}/{s.chapters.length} درس مكتمل · معامل {s.coef}
                </div>
              </div>
              <ArrowRight size={17} color={BRAND.subtext} style={{ transform: "rotate(180deg)" }} />
            </button>
          );
        })}
      </div>

      <a
        href={`https://wa.me/?text=${encodeURIComponent("جربت تطبيق ناجح بإذن الله 🌟 فيه دروس وتمارين ومساعد ذكاء اصطناعي لكل مواد الباكالوريا (علوم تجريبية). جرّبه أنت كذلك:\nhttps://najah-app-five.vercel.app")}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#25D366", color: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
      >
        <Share2 size={17} />
        شارك التطبيق مع صديق
      </a>

      <button
        onClick={onAbout}
        style={{ width: "100%", marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "none", border: `1px solid ${BRAND.border}`, borderRadius: 12, padding: "11px 14px", fontSize: 12.5, fontWeight: 700, color: BRAND.subtext, cursor: "pointer" }}
      >
        <Info size={15} />
        عن التطبيق وسياسة الخصوصية
      </button>

      <div style={{ marginTop: 18, textAlign: "center" }}>
        {!confirmingReset ? (
          <button onClick={() => setConfirmingReset(true)} style={{ background: "none", border: "none", color: BRAND.subtext, fontSize: 11.5, cursor: "pointer", textDecoration: "underline" }}>
            هذا ليس حسابي — سجّل من جديد
          </button>
        ) : (
          <div style={{ background: "#FDEAEA", border: "1px solid #E6B8B8", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 12, color: "#8A3A3A", marginBottom: 8 }}>
                سيتم حذف معلوماتك المسجلة محلياً والرجوع لشاشة التسجيل. متأكد؟
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={onReset} style={{ background: "#B03A2E", color: "#fff", border: "none", borderRadius: 8, padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                نعم، امسح وسجّل من جديد
              </button>
              <button onClick={() => setConfirmingReset(false)} style={{ background: "none", border: `1px solid ${BRAND.border}`, borderRadius: 8, padding: "6px 16px", fontSize: 12, cursor: "pointer" }}>
                إلغاء
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   قائمة المادة (دروس / تمارين / باكالوريات)
--------------------------------------------------------------- */
function SubjectMenuView({ subject, onBack, onOpen }) {
  const Icon = subject.icon;
  const items = [
    { id: "lessons", label: "الدروس", desc: `${subject.chapters.length} درس حسب المنهج الوزاري`, icon: BookOpen },
    { id: "exercises", label: "التمارين", desc: "تمارين مشروحة بالحل الكامل", icon: Dumbbell },
    { id: "bac", label: "باكالوريات", desc: "مواضيع بكالوريا سابقة وحلولها", icon: GraduationCap },
  ];
  return (
    <div>
      <TopBar title={subject.name} color={subject.color} onBack={onBack} />
      <div style={{ padding: "18px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: subject.color + "1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={22} color={subject.color} />
          </div>
          <div style={{ fontSize: 13, color: BRAND.subtext }}>اختر ما تريد مذاكرته الآن</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((it) => {
            const ItemIcon = it.icon;
            return (
              <button key={it.id} onClick={() => onOpen(it.id)} style={{ background: BRAND.card, border: `1.5px solid ${BRAND.border}`, borderRadius: 16, padding: "18px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", textAlign: "right" }}>
                <div style={{ width: 48, height: 48, borderRadius: 13, background: subject.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <ItemIcon size={23} color="#fff" />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="najah-heading" style={{ fontWeight: 800, fontSize: 15.5 }}>{it.label}</div>
                  <div style={{ fontSize: 11.5, color: BRAND.subtext, marginTop: 3 }}>{it.desc}</div>
                </div>
                <ArrowRight size={18} color={BRAND.subtext} style={{ transform: "rotate(180deg)" }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   صفحة الدروس (عمودية) — تفتح فيديوهات لكل درس
--------------------------------------------------------------- */
function LessonsView({ subject, progress, onToggle, onOpenChapter, onBack }) {
  return (
    <div>
      <TopBar title={`دروس ${subject.name}`} color={subject.color} onBack={onBack} />
      <div style={{ padding: "16px" }}>
        <div style={{ fontSize: 11.5, color: BRAND.subtext, marginBottom: 12 }}>
          اضغط على أي درس لمشاهدة فيديوهات أفضل الأساتذة فيه
        </div>
        {subject.chapters.map((c, idx) => {
          const done = progress.includes(idx);
          return (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, background: BRAND.card, border: `1px solid ${BRAND.border}`, borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
              <button onClick={() => onToggle(idx)} style={{ background: "none", border: "none", padding: "12px 12px", cursor: "pointer", flexShrink: 0 }}>
                {done ? <CheckCircle2 size={20} color={subject.color} /> : <Circle size={20} color="#C9C2AC" />}
              </button>
              <button onClick={() => onOpenChapter(idx)} style={{ flex: 1, background: "none", border: "none", padding: "12px 4px", textAlign: "right", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, textDecoration: done ? "line-through" : "none", color: done ? BRAND.subtext : BRAND.text }}>
                  {idx + 1}. {c}
                </span>
                <Play size={16} color={subject.color} style={{ flexShrink: 0 }} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   فيديوهات درس محدد
--------------------------------------------------------------- */
function LessonVideosView({ subject, chapterIndex, onBack }) {
  const chapterTitle = subject.chapters[chapterIndex];
  return (
    <div>
      <TopBar title="فيديوهات الدرس" color={subject.color} onBack={onBack} />
      <div style={{ padding: "16px" }}>
        <div style={{ background: BRAND.card, border: `1px solid ${BRAND.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: BRAND.subtext }}>الدرس</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 3 }}>{chapterTitle}</div>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>أفضل الأساتذة لشرح هذا الدرس</div>
        {subject.teachers.map((t, idx) => (
          <a key={idx} href={`https://www.youtube.com/results?search_query=${encodeURIComponent(t + " " + chapterTitle)}`} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, background: BRAND.card, border: `1px solid ${BRAND.border}`, borderRadius: 12, padding: "12px 12px", marginBottom: 8, textDecoration: "none", color: BRAND.text }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FDE7E7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Youtube size={19} color="#D32F2F" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{t}</div>
              <div style={{ fontSize: 11, color: BRAND.subtext }}>مشاهدة شرح هذا الدرس على يوتيوب</div>
            </div>
            <Play size={16} color={BRAND.subtext} />
          </a>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   صفحة التمارين / الباكالوريات
--------------------------------------------------------------- */
function ExercisesView({ subject, mode, onBack, onAsk }) {
  const [selected, setSelected] = useState(null); // null = قائمة، رقم = تمرين محدد
  const [showSolution, setShowSolution] = useState(false);
  const list = mode === "bac" ? subject.bac : subject.exercises;
  const listTitle = mode === "bac" ? `باكالوريات ${subject.name}` : `تمارين ${subject.name}`;
  const itemLabel = (idx, item) =>
    mode === "bac" ? (item.year ? `بكالوريا ${item.year}` : `بكالوريا ${idx + 1}`) : `تمرين ${idx + 1}`;

  // ------- شاشة قائمة التمارين/الباكالوريات -------
  if (selected === null) {
    return (
      <div>
        <TopBar title={listTitle} color={subject.color} onBack={onBack} />
        <div style={{ padding: "16px" }}>
          <div style={{ fontSize: 11.5, color: BRAND.subtext, marginBottom: 12, lineHeight: 1.8 }}>
            {mode === "bac"
              ? "دفعة أولى من مواضيع البكالوريا الرسمية السابقة (2010–2026) — سيتم إضافة المزيد تباعاً."
              : "دفعة أولى من التمارين المشروحة — يتوسّع العدد تدريجياً حتى 200 تمرين."}
          </div>

          {list.length === 0 && (
            <div style={{ textAlign: "center", color: BRAND.subtext, fontSize: 12.5, padding: "26px 10px", lineHeight: 1.8 }}>
              المحتوى قادم قريباً لهذا القسم. جرّب المساعد الذكي إذا عندك سؤال الآن.
            </div>
          )}

          {list.map((ex, idx) => (
            <button
              key={idx}
              onClick={() => { setSelected(idx); setShowSolution(false); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: BRAND.card, border: `1px solid ${BRAND.border}`, borderRadius: 12, padding: "13px 14px", marginBottom: 9, cursor: "pointer", textAlign: "right" }}
            >
              <div style={{ width: 34, height: 34, borderRadius: "999px", background: subject.color + "1A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: subject.color, fontWeight: 800, fontSize: 13 }}>
                {idx + 1}
              </div>
              <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{itemLabel(idx, ex)}</div>
              <ArrowRight size={17} color={BRAND.subtext} style={{ transform: "rotate(180deg)" }} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ------- شاشة تمرين محدد (السؤال + الحل في خانة منفصلة) -------
  const ex = list[selected];
  return (
    <div>
      <TopBar title={itemLabel(selected, ex)} color={subject.color} onBack={() => setSelected(null)} />
      <div style={{ padding: "16px" }}>
        <div style={{ background: BRAND.card, border: `1px solid ${BRAND.border}`, borderRadius: 14, padding: "14px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Dumbbell size={17} color={subject.color} />
            <div style={{ fontSize: 12, fontWeight: 800, color: subject.color, flex: 1 }}>نص التمرين</div>
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.9 }}>{ex.q}</div>
        </div>

        <button
          onClick={() => onAsk(`${itemLabel(selected, ex)}:\n${ex.q}`)}
          style={{
            width: "100%",
            marginBottom: 14,
            background: `linear-gradient(135deg, ${BRAND.gold}, #E8C874)`,
            color: "#4A3410",
            border: "none",
            borderRadius: 14,
            padding: "13px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontSize: 13,
            fontWeight: 800,
            fontFamily: "'Cairo', sans-serif",
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(200,155,60,0.4)",
            animation: "aiGlow 2.4s ease-in-out infinite",
          }}
        >
          <Sparkles size={18} />
          اسأل المساعد الذكي عن هذا التمرين
        </button>

        <div style={{ background: BRAND.card, border: `1px solid ${BRAND.border}`, borderRadius: 14, padding: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: showSolution ? 8 : 0 }}>
            <CheckCircle2 size={17} color={subject.color} />
            <div style={{ fontSize: 12, fontWeight: 800, color: subject.color, flex: 1 }}>الحل</div>
            {!showSolution && (
              <button onClick={() => setShowSolution(true)} style={{ background: subject.color, color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                إظهار الحل
              </button>
            )}
          </div>
          {showSolution && (
            <div style={{ fontSize: 13, color: BRAND.text, lineHeight: 1.9 }}>{ex.a}</div>
          )}
        </div>

        <div style={{ marginTop: 14, fontSize: 11.5, color: BRAND.subtext, textAlign: "center", lineHeight: 1.8 }}>
          ما فهمتش الحل؟ اضغط 🟡 بجانب التمرين ليشرحلك المساعد الذكي بطريقة أبسط.
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   نافذة سؤال الذكاء الاصطناعي عن تمرين محدد
--------------------------------------------------------------- */
function AiAskModal({ subject, initialText, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  const systemPrompt = `أنت أستاذ جزائري متخصص في مادة "${subject.name}" لتلاميذ السنة الثالثة ثانوي شعبة علوم تجريبية، تحضيراً لامتحان البكالوريا. الحلول الرسمية للوزارة عادة تعطي الجواب النهائي فقط بخطوات مختصرة جداً بدون شرح واضح للمنطق وراءها، ومهمتك الأساسية هي سد هذه الفجوة: اشرح كيف نصل لهذا الحل خطوة بخطوة بطريقة مبسطة جداً وودودة، كأنك تشرح لتلميذ متعثر لأول مرة، دون تعقيد. اختم بالنتيجة النهائية بوضوح، وشجّع التلميذ.`;

  useEffect(() => {
    (async () => {
      const firstUser = `لم أفهم هذا التمرين، اشرحه لي بطريقة بسيطة خطوة بخطوة:\n\n${initialText}`;
      setMessages([{ role: "user", content: firstUser }]);
      try {
        const reply = await askAI(systemPrompt, [{ role: "user", content: firstUser }]);
        setMessages((prev) => [...prev, { role: "assistant", content: reply || "عذراً، لم أتمكن من إيجاد شرح الآن." }]);
      } catch (e) {
        setMessages((prev) => [...prev, { role: "assistant", content: "حدث خطأ في الاتصال. أعد المحاولة من فضلك." }]);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const reply = await askAI(systemPrompt, next);
      setMessages((prev) => [...prev, { role: "assistant", content: reply || "عذراً، أعد المحاولة." }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: "حدث خطأ في الاتصال." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,20,17,0.55)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: BRAND.bg, width: "100%", maxWidth: 480, height: "82vh", borderTopLeftRadius: 22, borderTopRightRadius: 22, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: subject.color, color: "#fff", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <Sparkles size={18} color={BRAND.gold} />
          <div className="najah-heading" style={{ fontWeight: 800, fontSize: 14.5, flex: 1 }}>المساعد الذكي — {subject.name}</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer" }}>
            <X size={15} />
          </button>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
          {messages.map((m, idx) => (
            <div key={idx} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: m.role === "user" ? "flex-start" : "flex-end" }}>
                <div style={{ maxWidth: "88%", background: m.role === "user" ? "#EFEAD9" : subject.color, color: m.role === "user" ? BRAND.text : "#fff", borderRadius: 14, padding: "10px 13px", fontSize: 13, lineHeight: 1.85, whiteSpace: "pre-wrap" }}>
                  {m.content}
                </div>
              </div>
              {m.role === "assistant" && <RateButtons subjectId={subject.id} color={subject.color} />}
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{ background: subject.color, color: "#fff", borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                جاري الشرح...
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "10px 14px 14px", display: "flex", gap: 8, borderTop: `1px solid ${BRAND.border}` }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="اسأل سؤالاً إضافياً..."
            rows={1}
            style={{ flex: 1, resize: "none", border: `1px solid ${BRAND.border}`, borderRadius: 12, padding: "10px 12px", fontFamily: "'Tajawal', sans-serif", fontSize: 13, outline: "none" }}
          />
          <button onClick={send} disabled={loading || !input.trim()} style={{ width: 42, height: 42, borderRadius: 12, border: "none", background: subject.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: loading ? "default" : "pointer", opacity: loading || !input.trim() ? 0.6 : 1, flexShrink: 0 }}>
            <Send size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   المساعد الذكي العام (من الشريط السفلي)
--------------------------------------------------------------- */
function AiSolverView({ subjects }) {
  const [subjectId, setSubjectId] = useState(subjects[0].id);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "أهلاً بك! أنا مساعدك الذكي 🌟 اكتب لي التمرين أو الفكرة التي لم تفهمها، وسأشرحها لك خطوة بخطوة." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const subject = subjects.find((s) => s.id === subjectId);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    const systemPrompt = `أنت أستاذ جزائري متخصص في مادة "${subject.name}" لتلاميذ السنة الثالثة ثانوي شعبة علوم تجريبية، تحضيراً لامتحان البكالوريا. اشرح بأسلوب مبسط وودود خطوة بخطوة، واختم بالنتيجة بوضوح.`;
    try {
      const apiMessages = next.slice(1).map((m) => ({ role: m.role, content: m.content }));
      const reply = await askAI(systemPrompt, apiMessages);
      setMessages((prev) => [...prev, { role: "assistant", content: reply || "عذراً، أعد المحاولة." }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: "حدث خطأ في الاتصال." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 84px)" }}>
      <div style={{ padding: "16px 16px 8px" }}>
        <div className="najah-heading" style={{ fontWeight: 900, fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={19} color={BRAND.gold} /> المساعد الذكي
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 10, paddingBottom: 4 }}>
          {subjects.map((s) => (
            <button key={s.id} onClick={() => setSubjectId(s.id)} style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 99, border: `1px solid ${subjectId === s.id ? s.color : BRAND.border}`, background: subjectId === s.id ? s.color : "#fff", color: subjectId === s.id ? "#fff" : BRAND.text, fontSize: 11.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "8px 16px" }}>
        {messages.map((m, idx) => (
          <div key={idx} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: m.role === "user" ? "flex-start" : "flex-end" }}>
              <div style={{ maxWidth: "85%", background: m.role === "user" ? "#EFEAD9" : BRAND.green, color: m.role === "user" ? BRAND.text : "#fff", borderRadius: 14, padding: "10px 13px", fontSize: 13, lineHeight: 1.85, whiteSpace: "pre-wrap" }}>
                {m.content}
              </div>
            </div>
            {m.role === "assistant" && idx > 0 && <RateButtons subjectId={subject.id} color={BRAND.green} />}
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <div style={{ background: BRAND.green, color: "#fff", borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
              <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
              جاري التفكير في الحل...
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "10px 16px 14px", display: "flex", gap: 8, borderTop: `1px solid ${BRAND.border}`, background: BRAND.bg }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={`اكتب تمرين ${subject.name} هنا...`}
          rows={1}
          style={{ flex: 1, resize: "none", border: `1px solid ${BRAND.border}`, borderRadius: 12, padding: "10px 12px", fontFamily: "'Tajawal', sans-serif", fontSize: 13, outline: "none" }}
        />
        <button onClick={send} disabled={loading || !input.trim()} style={{ width: 42, height: 42, borderRadius: 12, border: "none", background: BRAND.green, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: loading ? "default" : "pointer", opacity: loading || !input.trim() ? 0.6 : 1, flexShrink: 0 }}>
          <Send size={17} />
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   صفحة تقدّمي
--------------------------------------------------------------- */
function ProgressView({ subjects, progress, pct }) {
  return (
    <div style={{ padding: "20px 16px" }}>
      <div className="najah-heading" style={{ fontWeight: 900, fontSize: 20, marginBottom: 4 }}>تقدّمك نحو النجاح</div>
      <div style={{ fontSize: 12.5, color: BRAND.subtext, marginBottom: 16 }}>
        نسبة إنجازك الإجمالية: <b style={{ color: BRAND.green }}>{pct}%</b>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {subjects.map((s) => {
          const done = (progress[s.id] || []).length;
          const total = s.chapters.length;
          const p = total ? Math.round((done / total) * 100) : 0;
          const Icon = s.icon;
          return (
            <div key={s.id} style={{ background: BRAND.card, border: `1px solid ${BRAND.border}`, borderRadius: 14, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Icon size={17} color={s.color} />
                <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{s.name}</span>
                <span style={{ fontSize: 11.5, color: BRAND.subtext }}>{done}/{total}</span>
              </div>
              <div style={{ height: 7, background: "#EFEAD9", borderRadius: 99 }}>
                <div style={{ width: `${p}%`, height: "100%", background: s.color, borderRadius: 99 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   عن التطبيق وسياسة الخصوصية
--------------------------------------------------------------- */
function AboutView({ onBack }) {
  const Section = ({ title, children }) => (
    <div style={{ background: BRAND.card, border: `1px solid ${BRAND.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 12 }}>
      <div className="najah-heading" style={{ fontWeight: 800, fontSize: 14, color: BRAND.green, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: BRAND.text, lineHeight: 2 }}>{children}</div>
    </div>
  );

  return (
    <div>
      <TopBar title="عن التطبيق" color={BRAND.green} onBack={onBack} />
      <div style={{ padding: "16px" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <StarBadge size={56} />
        </div>

        <Section title="من نحن">
          "ناجح بإذن الله" تطبيق تعليمي جزائري يهدف لمساعدة تلاميذ البكالوريا على المذاكرة بطريقة منظمة وفعالة: دروس حسب المنهج الوزاري، تمارين مشروحة، مواضيع بكالوريا سابقة، وفيديوهات لأفضل الأساتذة على يوتيوب — كل هذا في مكان واحد.
        </Section>

        <Section title="الميزة المميزة: المساعد الذكي">
          إذا تعثّر التلميذ في فهم تمرين، يقدر يسأل المساعد الذكي المدمج في التطبيق ليشرحله الحل خطوة بخطوة بأسلوب مبسط، بدل ما يتوقف عند الدرس أو يتخطى التمرين.
        </Section>

        <Section title="سياسة الخصوصية — ما نجمعه من معلومات">
          عند التسجيل، نجمع فقط: الاسم واللقب، رقم الهاتف، الولاية، وكلمة السر الخاصة بحسابك. نستعمل هذه المعلومات حصرياً لإدارة حسابك واشتراكك، ولا نبيعها ولا نشاركها مع أي طرف ثالث لأغراض تجارية.
        </Section>

        <Section title="المساعد الذكي وخصوصيتك">
          عندما تسأل المساعد الذكي عن تمرين، يُرسل نص سؤالك إلى خدمة ذكاء اصطناعي (Claude من Anthropic) لتوليد الشرح فقط، ولا يُستعمل هذا النص لأي غرض آخر.
        </Section>

        <Section title="الاشتراك والدفع">
          الاشتراك سنوي مقابل مبلغ محدد يمنحك الوصول الكامل لكل الدروس والتمارين والمساعد الذكي بدون حدود. التفاصيل الكاملة لطرق الدفع تظهر داخل شاشة الاشتراك.
        </Section>

        <Section title="تواصل معنا">
          إذا عندك أي سؤال أو ملاحظة، تقدر تتواصل معنا مباشرة عبر واتساب.
        </Section>

        <a
          href={`https://wa.me/?text=${encodeURIComponent("مرحباً، عندي سؤال بخصوص تطبيق ناجح بإذن الله.")}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#25D366", color: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 13, fontWeight: 700, textDecoration: "none", marginTop: 4 }}
        >
          <Share2 size={16} />
          راسلنا عبر واتساب
        </a>
      </div>
    </div>
  );
}
