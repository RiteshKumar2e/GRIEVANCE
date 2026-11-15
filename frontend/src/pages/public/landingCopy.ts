import type { Lang } from "../../lib/types";

/**
 * Landing-page copy in English, Hindi and Marathi.
 *
 * Every claim must describe something the deployed system does (see docs/landing/LANDING_PAGE_REDESIGN_AUDIT.md,
 * section 2). Statements that depend on configuration (voice input, synthetic data) are chosen at runtime
 * from /meta/status. The assistant's follow-up question in `languages.samples` and `product.chat.followUp`
 * is quoted verbatim from backend/app/agents/conversation.py.
 */
export type Actor = "you" | "auto" | "officer";

export interface LandingCopy {
  nav: {
    home: string;
    how: string;
    services: string;
    about: string;
    faq: string;
    signIn: string;
    dashboard: string;
    submit: string;
    menuOpen: string;
    menuClose: string;
    language: string;
    skip: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    lead: string;
    submit: string;
    track: string;
    accountNote: string;
    createAccount: string;
    promise: [string, string, string];
    promiseLabel: string;
  };
  record: {
    label: string;
    caption: string;
    referenceLabel: string;
    status: string;
    category: string;
    place: string;
    deptLabel: string;
    dept: string;
    targetLabel: string;
    target: string;
    historyLabel: string;
    steps: { status: string; text: string; actor: Actor; when: string; pending?: boolean }[];
    footnote: string;
  };
  actors: Record<Actor, string>;
  services: {
    eyebrow: string;
    title: string;
    intro: string;
    start: string;
    sourceNote: string;
    targetLabel: string;
    hours: (n: number) => string;
    days: (n: number) => string;
    confidential: string;
    confidentialNote: string;
    loading: string;
    error: string;
  };
  how: {
    eyebrow: string;
    title: string;
    intro: string;
    acts: { name: string; line: string; steps: { title: string; body: string; actor: Actor }[] }[];
  };
  product: {
    eyebrow: string;
    title: string;
    intro: string;
    illustrative: string;
    chat: { title: string; caption: string; you: string; assistant: string; example: string; followUp: string };
    draft: { title: string; caption: string; fields: [string, string][]; check: string; note: string };
  };
  behind: {
    eyebrow: string;
    title: string;
    lead: string;
    items: [string, string][];
    voiceOn: string;
    voiceOff: string;
    notYet: string;
  };
  about: { eyebrow: string; title: string; bodySynthetic: string; body: string; rows: [string, string][] };
  languages: { eyebrow: string; title: string; body: string; sampleCaption: string };
  care: { eyebrow: string; title: string; items: [string, string][] };
  faqSection: { eyebrow: string; title: string; items: [string, string][] };
  cta: { title: string; body: string; help: string };
}

/** The assistant's location question, verbatim from the backend, shown side by side in the language section. */
export const ASSISTANT_QUESTION: Record<Lang, string> = {
  en: "Where exactly is this? Please share the area, ward or a nearby landmark.",
  hi: "यह समस्या ठीक कहाँ है? कृपया इलाका, वार्ड या पास का कोई पहचान चिह्न बताएं।",
  mr: "ही समस्या नेमकी कुठे आहे? कृपया परिसर, प्रभाग किंवा जवळची खूण सांगा.",
};

const en: LandingCopy = {
  nav: {
    home: "Home",
    how: "How it works",
    services: "Services",
    about: "About",
    faq: "FAQ",
    signIn: "Sign in",
    dashboard: "Your dashboard",
    submit: "Submit a grievance",
    menuOpen: "Open menu",
    menuClose: "Close menu",
    language: "Language",
    skip: "Skip to main content",
  },
  hero: {
    eyebrow: "Civic grievance redressal",
    title: "Public concerns deserve clear answers.",
    lead: "Report civic issues, follow your complaint and stay informed about its progress — in a language you understand.",
    submit: "Submit a grievance",
    track: "Track a complaint",
    accountNote: "Filing and tracking need a free citizen account.",
    createAccount: "Create an account",
    promise: ["Speak", "Track", "Resolve"],
    promiseLabel: "The three stages of every grievance",
  },
  record: {
    label: "Illustrative example",
    caption: "What a grievance record looks like after it is filed. The reference number is issued when you submit.",
    referenceLabel: "Reference",
    status: "In progress",
    category: "Streetlight not working",
    place: "Gandhi Chowk, Ward 4",
    deptLabel: "Department",
    dept: "Electricity & Street Lighting",
    targetLabel: "Response target",
    target: "72 hours",
    historyLabel: "Status history",
    steps: [
      { status: "Submitted", text: "You checked the draft and confirmed it.", actor: "you", when: "Day 1 · 09:40" },
      { status: "Assigned", text: "Routed to the department and assigned to the officer covering the ward.", actor: "auto", when: "Day 1 · 09:40" },
      { status: "In progress", text: "Work started. You were notified.", actor: "officer", when: "Day 2 · 11:15" },
      { status: "Resolved", text: "You confirm the fix, or dispute it to reopen the case.", actor: "you", when: "Next", pending: true },
    ],
    footnote: "Every change is dated and shows who made it.",
  },
  actors: { you: "You", auto: "Automatic", officer: "Officer" },
  services: {
    eyebrow: "Services",
    title: "Issues you can report",
    intro:
      "Each kind of problem has a responsible department and a response target. You don't need to choose one: describe the problem, a category is suggested, and you can change it before filing.",
    start: "Describe your problem",
    sourceNote: "Loaded from this service's Category Master.",
    targetLabel: "Target",
    hours: (n) => `${n} hours`,
    days: (n) => `${n} days`,
    confidential: "Confidential",
    confidentialNote: "Confidential categories are seen only by authorised officers.",
    loading: "Loading the list of issues…",
    error: "The list of issues could not be loaded right now. You can still describe your problem.",
  },
  how: {
    eyebrow: "How it works",
    title: "Three stages, five steps, and you always know who is acting.",
    intro: "Some steps are yours, some are automatic checks, and some belong to an officer. Each is labelled.",
    acts: [
      {
        name: "Speak",
        line: "Tell us what is wrong.",
        steps: [
          { title: "Describe the problem", body: "Type, or speak where voice input is available. The assistant asks only for what is missing: what, where and since when.", actor: "you" },
          { title: "Check the draft and confirm", body: "Category, location and urgency are filled in from your words. Correct anything. Nothing is filed until you confirm.", actor: "you" },
        ],
      },
      {
        name: "Track",
        line: "See who is handling it.",
        steps: [
          { title: "Checks and routing", body: "The department and response target come from the Category Master. Reports of the same problem are linked. Sensitive or unclear cases go to a person first.", actor: "auto" },
          { title: "An officer takes it up", body: "The case moves from Assigned to In progress to Resolved, and you are notified at every change.", actor: "officer" },
        ],
      },
      {
        name: "Resolve",
        line: "Decide whether it is fixed.",
        steps: [
          { title: "Confirm or dispute", body: "Confirm the fix, or dispute it up to 30 days after closure to reopen the case. A second dispute goes to senior officers.", actor: "you" },
        ],
      },
    ],
  },
  product: {
    eyebrow: "The service",
    title: "See it before you start",
    intro: "Filing a grievance is a short conversation followed by a check. These previews use the assistant's own wording; your case will use your words.",
    illustrative: "Illustrative example",
    chat: {
      title: "The conversation",
      caption: "The assistant asks only for what is missing.",
      you: "You",
      assistant: "Assistant",
      example: "Three streetlights in our lane have not worked for a week. It is completely dark at night.",
      followUp: ASSISTANT_QUESTION.en,
    },
    draft: {
      title: "The draft you confirm",
      caption: "Everything stays editable until you confirm.",
      fields: [
        ["Category", "Streetlight not working"],
        ["Location", "Gandhi Chowk, Ward 4"],
        ["Urgency", "Medium"],
        ["Department", "Electricity & Street Lighting"],
        ["Response target", "72 hours"],
      ],
      check: "I have checked these details",
      note: "Nothing is filed until you confirm.",
    },
  },
  behind: {
    eyebrow: "Behind the scenes",
    title: "Software does the sorting. People make the decisions.",
    lead: "Automation takes care of routine work so that officers can spend their time on the problem itself. This is what it does, and where it stops.",
    items: [
      ["Reports of the same problem are linked", "If your neighbours report the same broken pipe, officers see the reports together. Each keeps its own reference, status and updates. Nothing is merged or deleted."],
      ["The right department, every time", "The Category Master decides which department handles each kind of problem and how quickly. The case goes to an officer who covers your ward."],
      ["Deadlines are watched", "Officers are warned when three quarters of the time has passed, or earlier when similar past cases suggest a delay. Overdue cases go to senior officers."],
      ["Officers see how similar cases were solved", "Resolved cases like yours are shown to the officer as reference. They inform the work; they never decide it."],
      ["A person decides when it matters", "Sensitive reports, unclear descriptions and anything the checks are unsure about wait for an authorised officer."],
    ],
    voiceOn: "Voice input is enabled on this service.",
    voiceOff: "Voice input is not enabled on this service at the moment.",
    notYet: "Not yet available: SMS and WhatsApp updates. Updates appear in the app and on your tracking page.",
  },
  about: {
    eyebrow: "About",
    title: "You can see what happens to your grievance, and so can the people responsible for it.",
    bodySynthetic:
      "GRIEVANCE is an agentic grievance redressal system built for HackFusion 4.0. This deployment runs on synthetic demonstration data and is not affiliated with any government body.",
    body: "GRIEVANCE is an agentic grievance redressal system built for HackFusion 4.0. It is not affiliated with any government body.",
    rows: [
      ["Citizens", "See every status change with its date and who made it. Confirm a resolution, or dispute it to reopen the case."],
      ["Officers", "Receive a summary, the reasons behind the rule-based routing decision and similar past cases. They accept, correct or override every suggestion."],
      ["Audit", "Every automated step is recorded with the model used, its confidence and the rule that applied."],
    ],
  },
  languages: {
    eyebrow: "Your language",
    title: "Write the way you speak.",
    body: "Use these pages in English, हिंदी or मराठी, and write your complaint in whichever you prefer. The assistant asks its questions in the language you write in, and officers see your original words alongside a summary.",
    sampleCaption: "The assistant's question about location, as it appears in each language.",
  },
  care: {
    eyebrow: "Handled with care",
    title: "Some complaints need more than speed.",
    items: [
      ["Sensitive reports stay with authorised officers", "Harassment, child-safety and corruption reports are kept out of general queues, reviewed by authorised officers, and never closed automatically."],
      ["Your identity is protected", "The officer handling your case sees a masked name and phone number. In sensitive cases your identity is hidden from officers entirely."],
      ["No complaint is rejected by software", "There is no automatic rejection. Automated checks can route a case or ask for a review; only people decide its outcome."],
      ["Recordings are not kept", "Voice recordings are deleted once they are turned into text. Phone numbers and e-mail addresses are removed before any text is sent to a language model."],
    ],
  },
  faqSection: {
    eyebrow: "FAQ",
    title: "Frequently asked questions",
    items: [
      ["How do I file a grievance?", "Create a citizen account, choose Submit a grievance and describe the problem in Marathi, Hindi or English. The assistant may ask where it is or since when. It then prepares a draft that you check and confirm. Nothing is filed until you confirm."],
      ["Can I speak instead of typing?", "Yes, if voice input is enabled on this service. Press Speak instead, talk, then press Stop recording. The transcript appears in the message box so you can correct it before sending. Recordings are deleted after transcription."],
      ["How do I track my grievance?", "Sign in and open My grievances. Each grievance shows its ID, current status, expected resolution date and the full history of who changed what and when. You also get a notification at every step."],
      ["What if the problem is not actually fixed?", "When an officer marks your grievance resolved, you can confirm it or dispute it. A dispute reopens the grievance and notifies the officer. A second dispute escalates it to senior officers. You can dispute up to 30 days after closure."],
      ["Someone else reported the same problem. Will my complaint be dropped?", "No. Related reports are linked so officers handle them together, but your grievance keeps its own ID, status and updates."],
      ["Who sees my name and phone number?", "Only the officer handling your grievance sees a masked version. For sensitive matters such as harassment or corruption, your identity is hidden from officers entirely and only authorised officers can open the case."],
      ["Does the AI decide my case?", "No. The assistant suggests a category and summary, rule-based checks decide routing, and sensitive or uncertain cases always go to a human officer. The system never rejects a grievance and never closes a sensitive one on its own."],
    ],
  },
  cta: {
    title: "Make your concern count.",
    body: "Describe it in your own words. You get a reference number and can follow every step until it is resolved.",
    help: "Questions first? Visit help and support",
  },
};

const hi: LandingCopy = {
  nav: {
    home: "मुख्य पृष्ठ",
    how: "यह कैसे काम करता है",
    services: "सेवाएँ",
    about: "परिचय",
    faq: "सामान्य प्रश्न",
    signIn: "साइन इन करें",
    dashboard: "आपका डैशबोर्ड",
    submit: "शिकायत दर्ज करें",
    menuOpen: "मेनू खोलें",
    menuClose: "मेनू बंद करें",
    language: "भाषा",
    skip: "मुख्य सामग्री पर जाएँ",
  },
  hero: {
    eyebrow: "नागरिक शिकायत निवारण",
    title: "जनता की समस्याओं को साफ़ जवाब मिलना चाहिए।",
    lead: "नागरिक समस्याओं की शिकायत करें, अपनी शिकायत पर नज़र रखें और उसकी प्रगति की जानकारी पाते रहें — उस भाषा में जो आप समझते हैं।",
    submit: "शिकायत दर्ज करें",
    track: "शिकायत की स्थिति देखें",
    accountNote: "शिकायत दर्ज करने और उसकी स्थिति देखने के लिए एक निःशुल्क नागरिक खाता चाहिए।",
    createAccount: "खाता बनाएँ",
    promise: ["बताइए", "देखिए", "सुलझाइए"],
    promiseLabel: "हर शिकायत के तीन चरण",
  },
  record: {
    label: "उदाहरण के लिए",
    caption: "दर्ज होने के बाद शिकायत का रिकॉर्ड ऐसा दिखता है। संदर्भ संख्या शिकायत जमा करने पर मिलती है।",
    referenceLabel: "संदर्भ",
    status: "प्रगति पर",
    category: "स्ट्रीट लाइट खराब",
    place: "गांधी चौक, वार्ड 4",
    deptLabel: "विभाग",
    dept: "विद्युत एवं स्ट्रीट लाइट विभाग",
    targetLabel: "निपटान का लक्ष्य",
    target: "72 घंटे",
    historyLabel: "स्थिति का इतिहास",
    steps: [
      { status: "दर्ज", text: "आपने मसौदा जाँचकर उसकी पुष्टि की।", actor: "you", when: "दिन 1 · 09:40" },
      { status: "सौंपा गया", text: "विभाग तक पहुँचाया गया और वार्ड के अधिकारी को सौंपा गया।", actor: "auto", when: "दिन 1 · 09:40" },
      { status: "प्रगति पर", text: "काम शुरू हुआ। आपको सूचना भेजी गई।", actor: "officer", when: "दिन 2 · 11:15" },
      { status: "हल", text: "आप समाधान की पुष्टि करें, या आपत्ति दर्ज करके मामला फिर खुलवाएँ।", actor: "you", when: "आगे", pending: true },
    ],
    footnote: "हर बदलाव तारीख के साथ दर्ज होता है और दिखता है कि किसने किया।",
  },
  actors: { you: "आप", auto: "स्वचालित", officer: "अधिकारी" },
  services: {
    eyebrow: "सेवाएँ",
    title: "आप इन समस्याओं की शिकायत कर सकते हैं",
    intro:
      "हर तरह की समस्या के लिए एक ज़िम्मेदार विभाग और निपटान का लक्ष्य तय है। आपको खुद श्रेणी चुनने की ज़रूरत नहीं: समस्या बताइए, श्रेणी सुझाई जाएगी, और दर्ज करने से पहले आप उसे बदल सकते हैं।",
    start: "अपनी समस्या बताएँ",
    sourceNote: "इस सेवा की श्रेणी सूची (Category Master) से।",
    targetLabel: "लक्ष्य",
    hours: (n) => `${n} घंटे`,
    days: (n) => `${n} दिन`,
    confidential: "गोपनीय",
    confidentialNote: "गोपनीय श्रेणियाँ केवल अधिकृत अधिकारी ही देख सकते हैं।",
    loading: "समस्याओं की सूची लोड हो रही है…",
    error: "समस्याओं की सूची अभी लोड नहीं हो सकी। आप फिर भी अपनी समस्या बता सकते हैं।",
  },
  how: {
    eyebrow: "यह कैसे काम करता है",
    title: "तीन चरण, पाँच कदम, और हर समय पता रहता है कि काम कौन कर रहा है।",
    intro: "कुछ कदम आपके हैं, कुछ स्वचालित जाँच हैं, और कुछ अधिकारी के। हर कदम पर यह लिखा है।",
    acts: [
      {
        name: "बताइए",
        line: "बताइए कि क्या गड़बड़ है।",
        steps: [
          { title: "समस्या बताएँ", body: "लिखें, या जहाँ आवाज़ से इनपुट उपलब्ध हो वहाँ बोलें। सहायक केवल वही पूछता है जो छूट गया हो: क्या, कहाँ और कब से।", actor: "you" },
          { title: "मसौदा जाँचें और पुष्टि करें", body: "श्रेणी, स्थान और तात्कालिकता आपके शब्दों से भरी जाती हैं। जो गलत हो उसे सुधारें। आपकी पुष्टि के बिना कुछ भी दर्ज नहीं होता।", actor: "you" },
        ],
      },
      {
        name: "देखिए",
        line: "देखिए कि मामला कौन संभाल रहा है।",
        steps: [
          { title: "जाँच और विभाग तक पहुँचाना", body: "विभाग और निपटान का लक्ष्य श्रेणी सूची से तय होते हैं। एक ही समस्या की शिकायतें जोड़ी जाती हैं। संवेदनशील या अस्पष्ट मामले पहले किसी व्यक्ति के पास जाते हैं।", actor: "auto" },
          { title: "अधिकारी काम शुरू करता है", body: "मामला सौंपा गया से प्रगति पर और फिर हल तक जाता है, और हर बदलाव पर आपको सूचना मिलती है।", actor: "officer" },
        ],
      },
      {
        name: "सुलझाइए",
        line: "तय कीजिए कि समस्या ठीक हुई या नहीं।",
        steps: [
          { title: "पुष्टि करें या आपत्ति दर्ज करें", body: "समाधान की पुष्टि करें, या बंद होने के 30 दिन तक आपत्ति दर्ज करके मामला फिर खुलवाएँ। दूसरी आपत्ति वरिष्ठ अधिकारियों तक जाती है।", actor: "you" },
        ],
      },
    ],
  },
  product: {
    eyebrow: "सेवा",
    title: "शुरू करने से पहले देख लीजिए",
    intro: "शिकायत दर्ज करना एक छोटी बातचीत और फिर एक जाँच है। इन झलकियों में सहायक के अपने शब्द हैं; आपके मामले में आपके शब्द होंगे।",
    illustrative: "उदाहरण के लिए",
    chat: {
      title: "बातचीत",
      caption: "सहायक केवल वही पूछता है जो छूट गया हो।",
      you: "आप",
      assistant: "सहायक",
      example: "हमारी गली की तीन स्ट्रीट लाइटें एक हफ्ते से बंद हैं। रात में पूरा अंधेरा रहता है।",
      followUp: ASSISTANT_QUESTION.hi,
    },
    draft: {
      title: "मसौदा, जिसकी आप पुष्टि करते हैं",
      caption: "पुष्टि करने तक सब कुछ बदला जा सकता है।",
      fields: [
        ["श्रेणी", "स्ट्रीट लाइट खराब"],
        ["स्थान", "गांधी चौक, वार्ड 4"],
        ["तात्कालिकता", "मध्यम"],
        ["विभाग", "विद्युत एवं स्ट्रीट लाइट विभाग"],
        ["निपटान का लक्ष्य", "72 घंटे"],
      ],
      check: "मैंने ये विवरण जाँच लिए हैं",
      note: "आपकी पुष्टि के बिना कुछ भी दर्ज नहीं होता।",
    },
  },
  behind: {
    eyebrow: "पर्दे के पीछे",
    title: "छँटाई सॉफ़्टवेयर करता है। फ़ैसले लोग लेते हैं।",
    lead: "रोज़मर्रा का काम स्वचालित है, ताकि अधिकारी अपना समय असली समस्या पर लगा सकें। यह क्या करता है, और कहाँ रुक जाता है:",
    items: [
      ["एक ही समस्या की शिकायतें जोड़ी जाती हैं", "अगर आपके पड़ोसी भी उसी टूटी पाइपलाइन की शिकायत करें, तो अधिकारी सभी शिकायतें साथ देखते हैं। हर शिकायत की अपनी संदर्भ संख्या, स्थिति और सूचनाएँ बनी रहती हैं। कुछ भी मिलाया या हटाया नहीं जाता।"],
      ["हर बार सही विभाग", "श्रेणी सूची तय करती है कि कौन-सा विभाग किस समस्या को और कितनी जल्दी संभालेगा। मामला आपके वार्ड के अधिकारी के पास जाता है।"],
      ["समय-सीमा पर नज़र", "तीन-चौथाई समय बीतने पर, या पुराने मिलते-जुलते मामलों से देरी का अंदेशा हो तो उससे पहले, अधिकारियों को चेतावनी मिलती है। देरी वाले मामले वरिष्ठ अधिकारियों के पास जाते हैं।"],
      ["अधिकारी देखते हैं कि ऐसे मामले कैसे सुलझे", "आपके जैसे हल हो चुके मामले अधिकारी को संदर्भ के लिए दिखाए जाते हैं। वे काम में मदद करते हैं; फ़ैसला नहीं करते।"],
      ["ज़रूरी मामलों में फ़ैसला व्यक्ति करता है", "संवेदनशील शिकायतें, अस्पष्ट विवरण और जिन मामलों पर जाँच निश्चित न हो, वे अधिकृत अधिकारी का इंतज़ार करते हैं।"],
    ],
    voiceOn: "इस सेवा पर आवाज़ से इनपुट उपलब्ध है।",
    voiceOff: "इस सेवा पर अभी आवाज़ से इनपुट उपलब्ध नहीं है।",
    notYet: "अभी उपलब्ध नहीं: SMS और WhatsApp से सूचना। सूचनाएँ ऐप में और आपके ट्रैकिंग पेज पर दिखती हैं।",
  },
  about: {
    eyebrow: "परिचय",
    title: "आपकी शिकायत के साथ क्या होता है, यह आप भी देख सकते हैं और उसके ज़िम्मेदार लोग भी।",
    bodySynthetic:
      "GRIEVANCE, HackFusion 4.0 के लिए बनाई गई एक एजेंटिक शिकायत निवारण प्रणाली है। यह संस्करण कृत्रिम (डेमो) डेटा पर चलता है और किसी सरकारी संस्था से संबद्ध नहीं है।",
    body: "GRIEVANCE, HackFusion 4.0 के लिए बनाई गई एक एजेंटिक शिकायत निवारण प्रणाली है। यह किसी सरकारी संस्था से संबद्ध नहीं है।",
    rows: [
      ["नागरिक", "स्थिति में हर बदलाव तारीख और बदलने वाले के नाम के साथ देखें। समाधान की पुष्टि करें, या आपत्ति दर्ज करके मामला फिर से खुलवाएँ।"],
      ["अधिकारी", "उन्हें सारांश, नियम-आधारित निर्णय के कारण और मिलते-जुलते पुराने मामले मिलते हैं। हर सुझाव को वे स्वीकार कर सकते हैं, सुधार सकते हैं या बदल सकते हैं।"],
      ["ऑडिट", "हर स्वचालित कदम दर्ज होता है: कौन-सा मॉडल इस्तेमाल हुआ, उसका भरोसा स्तर, और कौन-सा नियम लागू हुआ।"],
    ],
  },
  languages: {
    eyebrow: "आपकी भाषा",
    title: "जैसे बोलते हैं, वैसे लिखिए।",
    body: "ये पेज English, हिंदी या मराठी में देखें, और अपनी शिकायत जिस भाषा में चाहें लिखें। सहायक उसी भाषा में सवाल पूछता है जिसमें आप लिखते हैं, और अधिकारियों को सारांश के साथ आपके मूल शब्द भी दिखते हैं।",
    sampleCaption: "स्थान के बारे में सहायक का सवाल, हर भाषा में जैसा दिखता है।",
  },
  care: {
    eyebrow: "सावधानी से",
    title: "कुछ शिकायतों को जल्दी से ज़्यादा कुछ चाहिए।",
    items: [
      ["संवेदनशील शिकायतें केवल अधिकृत अधिकारियों के पास", "उत्पीड़न, बाल सुरक्षा और भ्रष्टाचार की शिकायतें सामान्य सूची में नहीं दिखतीं, अधिकृत अधिकारी उनकी समीक्षा करते हैं, और वे कभी अपने आप बंद नहीं होतीं।"],
      ["आपकी पहचान सुरक्षित रहती है", "आपका मामला संभालने वाले अधिकारी को आपका नाम और फ़ोन नंबर आंशिक रूप से छिपा हुआ दिखता है। संवेदनशील मामलों में आपकी पहचान अधिकारियों से पूरी तरह छिपी रहती है।"],
      ["कोई शिकायत सॉफ़्टवेयर से अस्वीकार नहीं होती", "स्वचालित अस्वीकृति होती ही नहीं। स्वचालित जाँच मामले को आगे भेज सकती है या समीक्षा माँग सकती है; नतीजा केवल लोग तय करते हैं।"],
      ["रिकॉर्डिंग रखी नहीं जाती", "आवाज़ की रिकॉर्डिंग लिखित रूप बनने के बाद हटा दी जाती है। किसी भाषा मॉडल को पाठ भेजने से पहले फ़ोन नंबर और ई-मेल पते हटा दिए जाते हैं।"],
    ],
  },
  faqSection: {
    eyebrow: "सामान्य प्रश्न",
    title: "अक्सर पूछे जाने वाले प्रश्न",
    items: [
      ["शिकायत कैसे दर्ज करें?", "एक नागरिक खाता बनाएँ, शिकायत दर्ज करें चुनें और समस्या हिंदी, मराठी या अंग्रेज़ी में बताएँ। सहायक पूछ सकता है कि समस्या कहाँ है या कब से है। फिर वह एक मसौदा तैयार करता है, जिसे आप जाँचकर पुष्टि करते हैं। आपकी पुष्टि के बिना कुछ भी दर्ज नहीं होता।"],
      ["क्या मैं लिखने के बजाय बोलकर बता सकता हूँ?", "हाँ, अगर इस सेवा पर आवाज़ से इनपुट उपलब्ध है। “बोलकर बताएं” दबाएँ, अपनी बात कहें, फिर “रिकॉर्डिंग रोकें” दबाएँ। लिखित पाठ संदेश बॉक्स में आ जाता है, ताकि भेजने से पहले आप उसे सुधार सकें। लिखित रूप बनने के बाद रिकॉर्डिंग हटा दी जाती है।"],
      ["मैं अपनी शिकायत की स्थिति कैसे देखूँ?", "साइन इन करें और मेरी शिकायतें खोलें। हर शिकायत में उसकी आईडी, वर्तमान स्थिति, समाधान की अनुमानित तारीख और किसने कब क्या बदला, इसका पूरा इतिहास दिखता है। हर चरण पर आपको सूचना भी मिलती है।"],
      ["अगर समस्या सच में ठीक न हुई हो तो?", "जब अधिकारी आपकी शिकायत को हल बताता है, तो आप उसकी पुष्टि कर सकते हैं या आपत्ति दर्ज कर सकते हैं। आपत्ति से शिकायत फिर से खुल जाती है और अधिकारी को सूचना जाती है। दूसरी आपत्ति पर मामला वरिष्ठ अधिकारियों के पास जाता है। बंद होने के 30 दिन तक आप आपत्ति दर्ज कर सकते हैं।"],
      ["किसी और ने भी यही समस्या बताई है। क्या मेरी शिकायत हटा दी जाएगी?", "नहीं। मिलती-जुलती शिकायतें आपस में जोड़ी जाती हैं ताकि अधिकारी उन्हें साथ में निपटाएँ, लेकिन आपकी शिकायत की अपनी आईडी, स्थिति और सूचनाएँ बनी रहती हैं।"],
      ["मेरा नाम और फ़ोन नंबर कौन देखता है?", "केवल आपकी शिकायत संभालने वाला अधिकारी, वह भी आंशिक रूप से छिपा हुआ। उत्पीड़न या भ्रष्टाचार जैसे संवेदनशील मामलों में आपकी पहचान अधिकारियों से पूरी तरह छिपी रहती है और केवल अधिकृत अधिकारी ही मामला खोल सकते हैं।"],
      ["क्या AI मेरे मामले का फ़ैसला करता है?", "नहीं। सहायक केवल श्रेणी और सारांश सुझाता है, नियम-आधारित जाँच तय करती है कि मामला कहाँ जाए, और संवेदनशील या अस्पष्ट मामले हमेशा किसी अधिकारी के पास जाते हैं। प्रणाली कभी कोई शिकायत अस्वीकार नहीं करती और किसी संवेदनशील शिकायत को अपने आप बंद नहीं करती।"],
    ],
  },
  cta: {
    title: "अपनी बात दर्ज कराइए।",
    body: "अपने शब्दों में बताइए। आपको एक संदर्भ संख्या मिलेगी, और समाधान होने तक आप हर कदम देख सकेंगे।",
    help: "पहले कुछ पूछना है? सहायता पेज देखें",
  },
};

const mr: LandingCopy = {
  nav: {
    home: "मुख्यपृष्ठ",
    how: "हे कसे काम करते",
    services: "सेवा",
    about: "माहिती",
    faq: "नेहमीचे प्रश्न",
    signIn: "साइन इन करा",
    dashboard: "तुमचा डॅशबोर्ड",
    submit: "तक्रार नोंदवा",
    menuOpen: "मेनू उघडा",
    menuClose: "मेनू बंद करा",
    language: "भाषा",
    skip: "मुख्य मजकुराकडे जा",
  },
  hero: {
    eyebrow: "नागरी तक्रार निवारण",
    title: "लोकांच्या प्रश्नांना स्पष्ट उत्तरे मिळायलाच हवीत.",
    lead: "नागरी समस्यांची तक्रार करा, तुमच्या तक्रारीचा पाठपुरावा करा आणि तिच्या प्रगतीची माहिती मिळवत राहा — तुम्हाला समजणाऱ्या भाषेत.",
    submit: "तक्रार नोंदवा",
    track: "तक्रारीची स्थिती पाहा",
    accountNote: "तक्रार नोंदवण्यासाठी आणि तिची स्थिती पाहण्यासाठी मोफत नागरिक खाते आवश्यक आहे.",
    createAccount: "खाते तयार करा",
    promise: ["सांगा", "पाहा", "सोडवा"],
    promiseLabel: "प्रत्येक तक्रारीचे तीन टप्पे",
  },
  record: {
    label: "उदाहरणादाखल",
    caption: "नोंदवल्यानंतर तक्रारीची नोंद अशी दिसते. संदर्भ क्रमांक तक्रार सादर केल्यावर मिळतो.",
    referenceLabel: "संदर्भ",
    status: "काम सुरू",
    category: "पथदिवा बंद",
    place: "गांधी चौक, प्रभाग 4",
    deptLabel: "विभाग",
    dept: "वीज व पथदिवे विभाग",
    targetLabel: "निराकरणाचे उद्दिष्ट",
    target: "72 तास",
    historyLabel: "स्थितीचा इतिहास",
    steps: [
      { status: "नोंदवली", text: "तुम्ही मसुदा तपासून पुष्टी केली.", actor: "you", when: "दिवस 1 · 09:40" },
      { status: "सोपवली", text: "विभागाकडे पाठवली आणि प्रभागातील अधिकाऱ्याकडे सोपवली.", actor: "auto", when: "दिवस 1 · 09:40" },
      { status: "काम सुरू", text: "काम सुरू झाले. तुम्हाला सूचना पाठवली.", actor: "officer", when: "दिवस 2 · 11:15" },
      { status: "निकाली", text: "तुम्ही निराकरणाची पुष्टी करा, किंवा आक्षेप नोंदवून प्रकरण पुन्हा उघडा.", actor: "you", when: "पुढे", pending: true },
    ],
    footnote: "प्रत्येक बदल तारखेसह नोंदवला जातो आणि तो कोणी केला ते दिसते.",
  },
  actors: { you: "तुम्ही", auto: "स्वयंचलित", officer: "अधिकारी" },
  services: {
    eyebrow: "सेवा",
    title: "तुम्ही या समस्यांची तक्रार करू शकता",
    intro:
      "प्रत्येक प्रकारच्या समस्येसाठी एक जबाबदार विभाग आणि निराकरणाचे उद्दिष्ट ठरलेले आहे. तुम्हाला श्रेणी निवडण्याची गरज नाही: समस्या सांगा, श्रेणी सुचवली जाईल, आणि नोंदवण्यापूर्वी तुम्ही ती बदलू शकता.",
    start: "तुमची समस्या सांगा",
    sourceNote: "या सेवेच्या श्रेणी सूचीतून (Category Master).",
    targetLabel: "उद्दिष्ट",
    hours: (n) => `${n} तास`,
    days: (n) => `${n} दिवस`,
    confidential: "गोपनीय",
    confidentialNote: "गोपनीय श्रेणी फक्त अधिकृत अधिकारीच पाहू शकतात.",
    loading: "समस्यांची यादी लोड होत आहे…",
    error: "समस्यांची यादी सध्या लोड होऊ शकली नाही. तरीही तुम्ही तुमची समस्या सांगू शकता.",
  },
  how: {
    eyebrow: "हे कसे काम करते",
    title: "तीन टप्पे, पाच पायऱ्या, आणि काम कोण करत आहे हे नेहमी कळते.",
    intro: "काही पायऱ्या तुमच्या आहेत, काही स्वयंचलित तपासण्या आहेत, आणि काही अधिकाऱ्याच्या. प्रत्येक पायरीवर तसे लिहिलेले आहे.",
    acts: [
      {
        name: "सांगा",
        line: "काय बिघडले आहे ते सांगा.",
        steps: [
          { title: "समस्या सांगा", body: "लिहा, किंवा आवाजाची सोय उपलब्ध असल्यास बोला. सहाय्यक फक्त जे राहिले ते विचारतो: काय, कुठे आणि कधीपासून.", actor: "you" },
          { title: "मसुदा तपासा आणि पुष्टी करा", body: "श्रेणी, ठिकाण आणि तातडी तुमच्या शब्दांवरून भरली जाते. जे चुकीचे असेल ते दुरुस्त करा. तुमच्या पुष्टीशिवाय काहीही नोंदवले जात नाही.", actor: "you" },
        ],
      },
      {
        name: "पाहा",
        line: "प्रकरण कोण हाताळत आहे ते पाहा.",
        steps: [
          { title: "तपासणी आणि विभागाकडे पाठवणे", body: "विभाग आणि निराकरणाचे उद्दिष्ट श्रेणी सूचीवरून ठरते. एकाच समस्येच्या तक्रारी जोडल्या जातात. संवेदनशील किंवा अस्पष्ट प्रकरणे आधी एखाद्या व्यक्तीकडे जातात.", actor: "auto" },
          { title: "अधिकारी काम हाती घेतो", body: "प्रकरण सोपवली पासून काम सुरू आणि मग निकाली पर्यंत जाते, आणि प्रत्येक बदलावर तुम्हाला सूचना मिळते.", actor: "officer" },
        ],
      },
      {
        name: "सोडवा",
        line: "समस्या सुटली की नाही ते ठरवा.",
        steps: [
          { title: "पुष्टी करा किंवा आक्षेप नोंदवा", body: "निराकरणाची पुष्टी करा, किंवा तक्रार बंद झाल्यानंतर 30 दिवसांपर्यंत आक्षेप नोंदवून प्रकरण पुन्हा उघडा. दुसरा आक्षेप वरिष्ठ अधिकाऱ्यांकडे जातो.", actor: "you" },
        ],
      },
    ],
  },
  product: {
    eyebrow: "सेवा",
    title: "सुरू करण्यापूर्वी पाहून घ्या",
    intro: "तक्रार नोंदवणे म्हणजे एक छोटा संवाद आणि मग एक तपासणी. या झलकांमध्ये सहाय्यकाचे स्वतःचे शब्द आहेत; तुमच्या प्रकरणात तुमचे शब्द असतील.",
    illustrative: "उदाहरणादाखल",
    chat: {
      title: "संवाद",
      caption: "सहाय्यक फक्त जे राहिले तेच विचारतो.",
      you: "तुम्ही",
      assistant: "सहाय्यक",
      example: "आमच्या गल्लीतील तीन पथदिवे आठवडाभर बंद आहेत. रात्री पूर्ण अंधार असतो.",
      followUp: ASSISTANT_QUESTION.mr,
    },
    draft: {
      title: "तुम्ही पुष्टी करता तो मसुदा",
      caption: "पुष्टी करेपर्यंत सर्व काही बदलता येते.",
      fields: [
        ["श्रेणी", "पथदिवा बंद"],
        ["ठिकाण", "गांधी चौक, प्रभाग 4"],
        ["तातडी", "मध्यम"],
        ["विभाग", "वीज व पथदिवे विभाग"],
        ["निराकरणाचे उद्दिष्ट", "72 तास"],
      ],
      check: "मी हे तपशील तपासले आहेत",
      note: "तुमच्या पुष्टीशिवाय काहीही नोंदवले जात नाही.",
    },
  },
  behind: {
    eyebrow: "पडद्यामागे",
    title: "वर्गीकरण सॉफ्टवेअर करते. निर्णय माणसे घेतात.",
    lead: "नेहमीचे काम स्वयंचलित आहे, जेणेकरून अधिकारी आपला वेळ प्रत्यक्ष समस्येवर देऊ शकतील. ते काय करते, आणि कुठे थांबते:",
    items: [
      ["एकाच समस्येच्या तक्रारी जोडल्या जातात", "तुमच्या शेजाऱ्यांनीही त्याच फुटलेल्या पाइपलाइनची तक्रार केली, तर अधिकारी सर्व तक्रारी एकत्र पाहतात. प्रत्येक तक्रारीचा स्वतंत्र संदर्भ क्रमांक, स्थिती आणि सूचना कायम राहतात. काहीही एकत्र केले किंवा हटवले जात नाही."],
      ["प्रत्येक वेळी योग्य विभाग", "कोणता विभाग कोणती समस्या आणि किती लवकर हाताळेल, हे श्रेणी सूची ठरवते. प्रकरण तुमच्या प्रभागातील अधिकाऱ्याकडे जाते."],
      ["मुदतीवर लक्ष", "तीन-चतुर्थांश वेळ उलटल्यावर, किंवा जुन्या सारख्या प्रकरणांवरून उशीर होण्याची शक्यता दिसल्यास त्याआधीच, अधिकाऱ्यांना इशारा मिळतो. उशीर झालेली प्रकरणे वरिष्ठ अधिकाऱ्यांकडे जातात."],
      ["सारखी प्रकरणे कशी सुटली हे अधिकारी पाहतात", "तुमच्यासारखी निकाली निघालेली प्रकरणे अधिकाऱ्याला संदर्भासाठी दाखवली जातात. ती कामात मदत करतात; निर्णय घेत नाहीत."],
      ["महत्त्वाच्या प्रकरणांत निर्णय माणूस घेतो", "संवेदनशील तक्रारी, अस्पष्ट वर्णने आणि ज्याबद्दल तपासणी खात्रीशीर नाही अशी प्रकरणे अधिकृत अधिकाऱ्याची वाट पाहतात."],
    ],
    voiceOn: "या सेवेवर आवाजाद्वारे माहिती देण्याची सोय उपलब्ध आहे.",
    voiceOff: "या सेवेवर सध्या आवाजाद्वारे माहिती देण्याची सोय उपलब्ध नाही.",
    notYet: "अद्याप उपलब्ध नाही: SMS आणि WhatsApp द्वारे सूचना. सूचना ॲपमध्ये आणि तुमच्या ट्रॅकिंग पानावर दिसतात.",
  },
  about: {
    eyebrow: "माहिती",
    title: "तुमच्या तक्रारीचे काय होते हे तुम्हीही पाहू शकता, आणि त्यासाठी जबाबदार असलेले लोकही.",
    bodySynthetic:
      "GRIEVANCE ही HackFusion 4.0 साठी तयार केलेली एजंटिक तक्रार निवारण प्रणाली आहे. ही आवृत्ती कृत्रिम (डेमो) डेटावर चालते आणि कोणत्याही सरकारी संस्थेशी संलग्न नाही.",
    body: "GRIEVANCE ही HackFusion 4.0 साठी तयार केलेली एजंटिक तक्रार निवारण प्रणाली आहे. ती कोणत्याही सरकारी संस्थेशी संलग्न नाही.",
    rows: [
      ["नागरिक", "स्थितीतील प्रत्येक बदल तारीख आणि बदल करणाऱ्याच्या नावासह पाहा. निराकरणाची पुष्टी करा, किंवा आक्षेप नोंदवून प्रकरण पुन्हा उघडा."],
      ["अधिकारी", "त्यांना सारांश, नियमाधारित निर्णयाची कारणे आणि सारखी जुनी प्रकरणे मिळतात. प्रत्येक सूचना ते स्वीकारू, दुरुस्त करू किंवा नाकारू शकतात."],
      ["लेखापरीक्षण", "प्रत्येक स्वयंचलित टप्प्याची नोंद होते: कोणते मॉडेल वापरले, त्याची खात्री पातळी, आणि कोणता नियम लागू झाला."],
    ],
  },
  languages: {
    eyebrow: "तुमची भाषा",
    title: "जसे बोलता, तसे लिहा.",
    body: "ही पाने English, हिंदी किंवा मराठीत वापरा, आणि तुमची तक्रार हव्या त्या भाषेत लिहा. तुम्ही ज्या भाषेत लिहिता त्याच भाषेत सहाय्यक प्रश्न विचारतो, आणि अधिकाऱ्यांना सारांशासोबत तुमचे मूळ शब्दही दिसतात.",
    sampleCaption: "ठिकाणाबद्दल सहाय्यकाचा प्रश्न, प्रत्येक भाषेत जसा दिसतो तसा.",
  },
  care: {
    eyebrow: "काळजीपूर्वक",
    title: "काही तक्रारींना वेगापेक्षा जास्त काही हवे असते.",
    items: [
      ["संवेदनशील तक्रारी फक्त अधिकृत अधिकाऱ्यांकडे", "छळ, बालसुरक्षा आणि भ्रष्टाचाराच्या तक्रारी सामान्य यादीत दिसत नाहीत, अधिकृत अधिकारी त्यांची तपासणी करतात, आणि त्या कधीही आपोआप बंद होत नाहीत."],
      ["तुमची ओळख सुरक्षित राहते", "तुमचे प्रकरण हाताळणाऱ्या अधिकाऱ्याला तुमचे नाव आणि फोन नंबर अंशतः लपवलेल्या स्वरूपात दिसतात. संवेदनशील प्रकरणांत तुमची ओळख अधिकाऱ्यांपासून पूर्णपणे लपवली जाते."],
      ["कोणतीही तक्रार सॉफ्टवेअरकडून नाकारली जात नाही", "स्वयंचलित नकार नाहीच. स्वयंचलित तपासणी प्रकरण पुढे पाठवू शकते किंवा तपासणीची मागणी करू शकते; निकाल फक्त माणसे ठरवतात."],
      ["रेकॉर्डिंग ठेवले जात नाही", "आवाजाचे रेकॉर्डिंग लिखित स्वरूपात रूपांतरित झाल्यावर हटवले जाते. कोणत्याही भाषा मॉडेलकडे मजकूर पाठवण्यापूर्वी फोन नंबर आणि ई-मेल पत्ते काढून टाकले जातात."],
    ],
  },
  faqSection: {
    eyebrow: "नेहमीचे प्रश्न",
    title: "वारंवार विचारले जाणारे प्रश्न",
    items: [
      ["तक्रार कशी नोंदवायची?", "नागरिक खाते तयार करा, तक्रार नोंदवा निवडा आणि समस्या मराठी, हिंदी किंवा इंग्रजीत सांगा. समस्या कुठे आहे किंवा कधीपासून आहे, हे सहाय्यक विचारू शकतो. मग तो एक मसुदा तयार करतो, जो तुम्ही तपासून पुष्टी करता. तुमच्या पुष्टीशिवाय काहीही नोंदवले जात नाही."],
      ["लिहिण्याऐवजी मी बोलून सांगू शकतो का?", "हो, या सेवेवर आवाजाद्वारे माहिती देण्याची सोय उपलब्ध असल्यास. “बोलून सांगा” दाबा, तुमचे म्हणणे सांगा, मग “रेकॉर्डिंग थांबवा” दाबा. लिखित मजकूर संदेश चौकटीत येतो, त्यामुळे पाठवण्यापूर्वी तुम्ही तो दुरुस्त करू शकता. लिखित रूप तयार झाल्यावर रेकॉर्डिंग हटवले जाते."],
      ["माझ्या तक्रारीची स्थिती कशी पाहायची?", "साइन इन करा आणि माझ्या तक्रारी उघडा. प्रत्येक तक्रारीत तिचा आयडी, सध्याची स्थिती, निराकरणाची अपेक्षित तारीख आणि कोणी कधी काय बदलले याचा पूर्ण इतिहास दिसतो. प्रत्येक टप्प्यावर तुम्हाला सूचनाही मिळते."],
      ["समस्या खरोखर सुटली नसेल तर?", "अधिकाऱ्याने तुमची तक्रार सुटली असे नोंदवल्यावर तुम्ही पुष्टी करू शकता किंवा आक्षेप नोंदवू शकता. आक्षेपामुळे तक्रार पुन्हा उघडते आणि अधिकाऱ्याला सूचना जाते. दुसऱ्या आक्षेपानंतर प्रकरण वरिष्ठ अधिकाऱ्यांकडे जाते. तक्रार बंद झाल्यानंतर 30 दिवसांपर्यंत तुम्ही आक्षेप नोंदवू शकता."],
      ["दुसऱ्या कोणीतरी हीच समस्या नोंदवली आहे. माझी तक्रार काढून टाकली जाईल का?", "नाही. सारख्या तक्रारी एकमेकांशी जोडल्या जातात, जेणेकरून अधिकारी त्या एकत्र हाताळतील, पण तुमच्या तक्रारीचा स्वतंत्र आयडी, स्थिती आणि सूचना कायम राहतात."],
      ["माझे नाव आणि फोन नंबर कोण पाहू शकतो?", "फक्त तुमची तक्रार हाताळणारा अधिकारी, तोही अंशतः लपवलेल्या स्वरूपात. छळ किंवा भ्रष्टाचारासारख्या संवेदनशील प्रकरणांत तुमची ओळख अधिकाऱ्यांपासून पूर्णपणे लपवली जाते आणि फक्त अधिकृत अधिकारीच प्रकरण उघडू शकतात."],
      ["माझ्या प्रकरणाचा निर्णय AI घेतो का?", "नाही. सहाय्यक फक्त श्रेणी आणि सारांश सुचवतो, प्रकरण कुठे जाईल हे नियमाधारित तपासणी ठरवते, आणि संवेदनशील किंवा अस्पष्ट प्रकरणे नेहमी अधिकाऱ्याकडे जातात. प्रणाली कधीही तक्रार नाकारत नाही आणि संवेदनशील तक्रार आपोआप बंद करत नाही."],
    ],
  },
  cta: {
    title: "तुमची तक्रार महत्त्वाची ठरू द्या.",
    body: "तुमच्या शब्दांत सांगा. तुम्हाला संदर्भ क्रमांक मिळेल, आणि निराकरण होईपर्यंत तुम्ही प्रत्येक टप्पा पाहू शकाल.",
    help: "आधी काही विचारायचे आहे? मदत पान पाहा",
  },
};

export const LANDING_COPY: Record<Lang, LandingCopy> = { en, hi, mr };
