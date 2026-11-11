import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Lang } from "./types";

/** Citizen-facing strings in English, Hindi and Marathi. Staff screens are English. */
const STRINGS = {
  en: {
    chatGreeting: "Hello. Tell me what problem you are facing, in English, हिंदी or मराठी. You can type or use the microphone.",
    chatPlaceholder: "Describe the problem…",
    send: "Send",
    draftNow: "Create draft now",
    thinking: "Reading your message",
    voiceReview: "Check the transcript, edit if needed, then send.",
    listen: "Listen",
    assistant: "Assistant",
    you: "You",
    tagline: "Report a civic problem in your own language. Track it until it is fixed.",
    fileComplaint: "File a grievance",
    myGrievances: "My grievances",
    notifications: "Notifications",
    describe: "Describe the problem",
    describeHint: "Write in English, हिंदी or मराठी. Mention the place, how long it has been happening and who is affected.",
    location: "Location or landmark (optional)",
    analyze: "Analyse my complaint",
    speak: "Speak instead",
    stop: "Stop recording",
    reviewTitle: "Check the details before submitting",
    reviewHint: "The assistant filled these in from your description. Correct anything that is wrong. Nothing is submitted until you confirm.",
    confirmSubmit: "Confirm and submit",
    edit: "Edit description",
    consent: "I confirm these details are correct and want to submit this grievance.",
    submitted: "Grievance registered",
    track: "Track grievance",
    timeline: "Status history",
    confirmResolution: "Yes, it is fixed",
    dispute: "No, it is not fixed",
    disputeReason: "What is still wrong?",
    rate: "Rate the resolution",
    emptyGrievances: "You have not filed any grievances yet.",
    category: "Category",
    department: "Department",
    urgency: "Urgency",
    title: "Title",
    expected: "Expected resolution by",
    sensitiveNote: "This is a sensitive matter. It will be handled by an authorised officer and your identity will be protected.",
    reviewNote: "An officer will review this grievance before it is assigned.",
    language: "Language",
  },
  hi: {
    chatGreeting: "नमस्ते। बताइए आपको क्या समस्या है, हिंदी, मराठी या अंग्रेज़ी में। आप लिख सकते हैं या माइक्रोफ़ोन का उपयोग कर सकते हैं।",
    chatPlaceholder: "समस्या का विवरण लिखें…",
    send: "भेजें",
    draftNow: "अभी मसौदा बनाएं",
    thinking: "आपका संदेश पढ़ रहे हैं",
    voiceReview: "लिखित पाठ जाँचें, ज़रूरत हो तो सुधारें, फिर भेजें।",
    listen: "सुनें",
    assistant: "सहायक",
    you: "आप",
    tagline: "अपनी भाषा में नागरिक समस्या दर्ज करें। समाधान होने तक उसकी स्थिति देखें।",
    fileComplaint: "शिकायत दर्ज करें",
    myGrievances: "मेरी शिकायतें",
    notifications: "सूचनाएँ",
    describe: "समस्या का विवरण दें",
    describeHint: "अंग्रेज़ी, हिंदी या मराठी में लिखें। स्थान, समस्या कब से है और कौन प्रभावित है, बताएं।",
    location: "स्थान या पहचान चिह्न (वैकल्पिक)",
    analyze: "मेरी शिकायत का विश्लेषण करें",
    speak: "बोलकर बताएं",
    stop: "रिकॉर्डिंग रोकें",
    reviewTitle: "जमा करने से पहले विवरण जाँचें",
    reviewHint: "सहायक ने आपके विवरण से ये जानकारी भरी है। जो गलत हो उसे सुधारें। पुष्टि करने तक कुछ भी जमा नहीं होगा।",
    confirmSubmit: "पुष्टि करें और जमा करें",
    edit: "विवरण बदलें",
    consent: "मैं पुष्टि करता/करती हूँ कि विवरण सही है और यह शिकायत जमा करना चाहता/चाहती हूँ।",
    submitted: "शिकायत दर्ज हो गई",
    track: "शिकायत की स्थिति",
    timeline: "स्थिति इतिहास",
    confirmResolution: "हाँ, समस्या हल हो गई",
    dispute: "नहीं, समस्या हल नहीं हुई",
    disputeReason: "अब भी क्या समस्या है?",
    rate: "समाधान को रेटिंग दें",
    emptyGrievances: "आपने अभी तक कोई शिकायत दर्ज नहीं की है।",
    category: "श्रेणी",
    department: "विभाग",
    urgency: "तात्कालिकता",
    title: "शीर्षक",
    expected: "अपेक्षित समाधान तिथि",
    sensitiveNote: "यह संवेदनशील मामला है। इसे अधिकृत अधिकारी देखेंगे और आपकी पहचान सुरक्षित रहेगी।",
    reviewNote: "सौंपे जाने से पहले एक अधिकारी इस शिकायत की समीक्षा करेगा।",
    language: "भाषा",
  },
  mr: {
    chatGreeting: "नमस्कार. तुम्हाला कोणती समस्या आहे ते सांगा, मराठी, हिंदी किंवा इंग्रजीत. तुम्ही लिहू शकता किंवा मायक्रोफोन वापरू शकता.",
    chatPlaceholder: "समस्येचे वर्णन लिहा…",
    send: "पाठवा",
    draftNow: "आता मसुदा तयार करा",
    thinking: "तुमचा संदेश वाचत आहोत",
    voiceReview: "लिखित मजकूर तपासा, गरज असल्यास दुरुस्त करा, मग पाठवा.",
    listen: "ऐका",
    assistant: "सहाय्यक",
    you: "तुम्ही",
    tagline: "आपल्या भाषेत नागरी समस्या नोंदवा. ती सुटेपर्यंत तिची स्थिती पाहा.",
    fileComplaint: "तक्रार नोंदवा",
    myGrievances: "माझ्या तक्रारी",
    notifications: "सूचना",
    describe: "समस्येचे वर्णन करा",
    describeHint: "इंग्रजी, हिंदी किंवा मराठीत लिहा. ठिकाण, समस्या कधीपासून आहे आणि कोण बाधित आहे ते सांगा.",
    location: "ठिकाण किंवा खूण (ऐच्छिक)",
    analyze: "माझ्या तक्रारीचे विश्लेषण करा",
    speak: "बोलून सांगा",
    stop: "रेकॉर्डिंग थांबवा",
    reviewTitle: "सबमिट करण्यापूर्वी तपशील तपासा",
    reviewHint: "सहाय्यकाने तुमच्या वर्णनावरून हे तपशील भरले आहेत. चुकीचे असल्यास दुरुस्त करा. तुम्ही पुष्टी करेपर्यंत काहीही सबमिट होणार नाही.",
    confirmSubmit: "पुष्टी करा आणि सबमिट करा",
    edit: "वर्णन बदला",
    consent: "हे तपशील बरोबर असल्याची मी पुष्टी करतो/करते आणि ही तक्रार सबमिट करू इच्छितो/इच्छिते.",
    submitted: "तक्रार नोंदवली गेली",
    track: "तक्रारीची स्थिती",
    timeline: "स्थिती इतिहास",
    confirmResolution: "होय, समस्या सुटली",
    dispute: "नाही, समस्या सुटली नाही",
    disputeReason: "अजून काय चुकीचे आहे?",
    rate: "निराकरणाला रेटिंग द्या",
    emptyGrievances: "तुम्ही अद्याप कोणतीही तक्रार नोंदवलेली नाही.",
    category: "प्रकार",
    department: "विभाग",
    urgency: "तातडी",
    title: "शीर्षक",
    expected: "अपेक्षित निराकरण दिनांक",
    sensitiveNote: "हे संवेदनशील प्रकरण आहे. अधिकृत अधिकारी ते हाताळतील आणि तुमची ओळख सुरक्षित राहील.",
    reviewNote: "नेमणूक होण्यापूर्वी अधिकारी या तक्रारीचे पुनरावलोकन करतील.",
    language: "भाषा",
  },
} as const;

export type StringKey = keyof (typeof STRINGS)["en"];

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: StringKey) => string;
}

const Ctx = createContext<I18n | null>(null);
const KEY = "grievance.lang";

function initialLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "en" || v === "hi" || v === "mr") return v;
  } catch {
    /* ignore */
  }
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang: (l) => {
        setLangState(l);
        try {
          localStorage.setItem(KEY, l);
        } catch {
          /* ignore */
        }
      },
      t: (k) => STRINGS[lang][k] ?? STRINGS.en[k],
    }),
    [lang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n outside provider");
  return c;
}

export const LANG_LABEL: Record<Lang, string> = { en: "English", hi: "हिंदी", mr: "मराठी" };

export function categoryName(c: { name_en: string; name_hi?: string | null; name_mr?: string | null } | null | undefined, lang: Lang) {
  if (!c) return "n/a";
  return (lang === "hi" ? c.name_hi : lang === "mr" ? c.name_mr : null) || c.name_en;
}
