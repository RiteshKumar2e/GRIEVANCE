import type { Lang } from "../../lib/types";

/**
 * Landing-page copy in English, Hindi and Marathi.
 * Every claim here must describe something the deployed system actually does.
 * Voice input is mentioned only through the `voiceOn` / `voiceOff` strings, which the page
 * picks from the live /meta/status response.
 */
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
    langTitle: string;
    langBody: string;
    voiceExtra: string;
    trackTitle: string;
    trackBody: string;
  };
  before: { title: string; intro: string; items: string[]; sensitive: string; help: string };
  how: { eyebrow: string; title: string; steps: [string, string][] };
  services: {
    eyebrow: string;
    title: string;
    intro: string;
    items: [string, string][];
    voiceOn: string;
    voiceOff: string;
    notYet: string;
    categoriesTitle: string;
    categoriesNote: string;
    categoriesError: string;
  };
  about: { eyebrow: string; title: string; bodySynthetic: string; body: string; rows: [string, string][] };
  faqSection: { eyebrow: string; title: string; items: [string, string][] };
  cta: { title: string; body: string; help: string };
}

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
    title: "Your voice deserves to be heard.",
    lead: "Report civic issues, follow your complaint and stay informed about its progress — in a language you understand.",
    submit: "Submit a grievance",
    track: "Track a complaint",
    accountNote: "Filing and tracking need a free citizen account.",
    createAccount: "Create an account",
    langTitle: "English, हिंदी and मराठी",
    langBody: "Write in the language you are comfortable with.",
    voiceExtra: " You can also speak: voice input is enabled on this service.",
    trackTitle: "A visible record",
    trackBody: "Every grievance gets an ID and a dated history of each status change.",
  },
  before: {
    title: "Before you start",
    intro: "Keep these details ready. The assistant will ask if something is missing.",
    items: [
      "What the problem is, in your own words",
      "Where it is: locality, ward or a nearby landmark",
      "Since when it has been happening, if you know",
    ],
    sensitive: "Reports of harassment, corruption or child safety are seen only by authorised officers.",
    help: "Read answers to common questions",
  },
  how: {
    eyebrow: "How it works",
    title: "Three steps from report to resolution",
    steps: [
      [
        "Describe the issue",
        "Type in English, Hindi or Marathi, or speak where voice input is available. The assistant asks for the location or timing if they are missing.",
      ],
      [
        "Review and submit",
        "Check the category, location and urgency prepared from your description. Correct anything, then confirm. Nothing is filed until you do.",
      ],
      [
        "Track progress",
        "You get a grievance ID and a notification at each step. If the fix does not hold, dispute it and the grievance reopens.",
      ],
    ],
  },
  services: {
    eyebrow: "Services",
    title: "What the service does with your grievance",
    intro: "Automated suggestions are checked by rules, and officers make the decisions. Only capabilities that work in this deployment are listed.",
    items: [
      ["Multilingual intake", "Describe the problem in English, Hindi or Marathi and get a structured draft to confirm."],
      ["Department routing", "The category decides the responsible department and deadline, and the case goes to an officer covering your ward."],
      ["Similar-complaint detection", "Reports of the same problem are linked so officers handle them together. Your grievance keeps its own ID and updates."],
      ["Status tracking", "See the current status, the expected resolution date, and who changed what and when."],
      ["Escalation and alerts", "Officers are warned before a deadline is missed. Overdue cases escalate, and a second dispute goes to senior officers."],
      ["Human review of sensitive cases", "Sensitive or uncertain cases wait for an authorised officer and are never closed automatically."],
    ],
    voiceOn: "Voice input is enabled on this service.",
    voiceOff: "Voice input is not enabled on this service at the moment.",
    notYet: "Not yet available: SMS and WhatsApp updates. Updates appear in the app and on your tracking page.",
    categoriesTitle: "Issues you can report",
    categoriesNote: "From the category list loaded on this service.",
    categoriesError: "The category list could not be loaded right now.",
  },
  about: {
    eyebrow: "Accountability",
    title: "You can see what happens to your grievance, and so can the people responsible for it.",
    bodySynthetic:
      "GRIEVANCE is an agentic grievance redressal system built for HackFusion 4.0. This deployment runs on synthetic demonstration data and is not affiliated with any government body.",
    body: "GRIEVANCE is an agentic grievance redressal system built for HackFusion 4.0. It is not affiliated with any government body.",
    rows: [
      ["Citizens", "See every status change with its date and who made it. Confirm a resolution, or dispute it to reopen the case."],
      ["Officers", "Receive a summary, the reasons behind the rule-based routing decision and similar past cases. They accept, correct or override every suggestion."],
      ["Sensitive cases", "Harassment, child-safety and corruption reports are hidden from general queues, reviewed by authorised officers, and never closed automatically."],
      ["Audit", "Every automated step is recorded with the model used, its confidence and the rule that applied."],
    ],
  },
  faqSection: {
    eyebrow: "FAQ",
    title: "Frequently asked questions",
    items: [
      ["How do I file a grievance?", "Create a citizen account, choose Submit a grievance and describe the problem in Marathi, Hindi or English. The assistant may ask where it is or since when. It then prepares a draft that you check and confirm. Nothing is filed until you confirm."],
      ["Can I speak instead of typing?", "Yes, if voice input is enabled on this service. Press Speak, talk, then press Stop. The transcript appears in the message box so you can correct it before sending. Recordings are deleted after transcription."],
      ["How do I track my grievance?", "Sign in and open My grievances. Each grievance shows its ID, current status, expected resolution date and the full history of who changed what and when. You also get a notification at every step."],
      ["What if the problem is not actually fixed?", "When an officer marks your grievance resolved, you can confirm it or dispute it. A dispute reopens the grievance and notifies the officer. A second dispute escalates it to senior officers. You can dispute up to 30 days after closure."],
      ["Someone else reported the same problem. Will my complaint be dropped?", "No. Related reports are linked so officers handle them together, but your grievance keeps its own ID, status and updates."],
      ["Who sees my name and phone number?", "Only the officer handling your grievance sees a masked version. For sensitive matters such as harassment or corruption, your identity is hidden from officers entirely and only authorised officers can open the case."],
      ["Does the AI decide my case?", "No. The assistant suggests a category and summary, rule-based checks decide routing, and sensitive or uncertain cases always go to a human officer. The system never rejects a grievance and never closes a sensitive one on its own."],
    ],
  },
  cta: {
    title: "Something in your area needs attention?",
    body: "Reporting takes a few minutes, and you can follow every step until it is resolved.",
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
    title: "आपकी आवाज़ सुनी जानी चाहिए।",
    lead: "नागरिक समस्याओं की शिकायत करें, अपनी शिकायत पर नज़र रखें और उसकी प्रगति की जानकारी पाते रहें — उस भाषा में जो आप समझते हैं।",
    submit: "शिकायत दर्ज करें",
    track: "शिकायत की स्थिति देखें",
    accountNote: "शिकायत दर्ज करने और उसकी स्थिति देखने के लिए एक निःशुल्क नागरिक खाता चाहिए।",
    createAccount: "खाता बनाएँ",
    langTitle: "English, हिंदी और मराठी",
    langBody: "जिस भाषा में आप सहज हों, उसमें लिखें।",
    voiceExtra: " आप बोलकर भी बता सकते हैं: इस सेवा पर आवाज़ से इनपुट उपलब्ध है।",
    trackTitle: "हर कदम का रिकॉर्ड",
    trackBody: "हर शिकायत को एक आईडी मिलती है, और स्थिति में हर बदलाव तारीख के साथ दर्ज होता है।",
  },
  before: {
    title: "शुरू करने से पहले",
    intro: "ये जानकारियाँ तैयार रखें। कुछ छूट जाए तो सहायक आपसे पूछ लेगा।",
    items: ["समस्या क्या है, आपके अपने शब्दों में", "समस्या कहाँ है: मोहल्ला, वार्ड या पास का कोई पहचान चिह्न", "यह कब से हो रहा है, अगर आपको पता हो"],
    sensitive: "उत्पीड़न, भ्रष्टाचार या बाल सुरक्षा से जुड़ी शिकायतें केवल अधिकृत अधिकारी ही देख सकते हैं।",
    help: "सामान्य प्रश्नों के उत्तर पढ़ें",
  },
  how: {
    eyebrow: "यह कैसे काम करता है",
    title: "शिकायत से समाधान तक तीन कदम",
    steps: [
      ["समस्या बताएँ", "हिंदी, मराठी या अंग्रेज़ी में लिखें, या जहाँ उपलब्ध हो वहाँ बोलकर बताएँ। स्थान या समय छूट जाए तो सहायक पूछ लेगा।"],
      ["जाँचें और जमा करें", "आपके विवरण से तैयार श्रेणी, स्थान और तात्कालिकता जाँचें। ज़रूरत हो तो सुधारें, फिर पुष्टि करें। आपकी पुष्टि के बिना कुछ भी दर्ज नहीं होता।"],
      ["प्रगति देखें", "आपको एक शिकायत आईडी और हर चरण पर सूचना मिलती है। अगर समस्या ठीक न हो, तो आपत्ति दर्ज करें और शिकायत फिर से खुल जाएगी।"],
    ],
  },
  services: {
    eyebrow: "सेवाएँ",
    title: "आपकी शिकायत के साथ यह सेवा क्या करती है",
    intro: "स्वचालित सुझावों की जाँच नियमों से होती है, और निर्णय अधिकारी लेते हैं। यहाँ केवल वही सुविधाएँ दी गई हैं जो इस सेवा पर काम कर रही हैं।",
    items: [
      ["बहुभाषी शिकायत दर्ज करना", "हिंदी, मराठी या अंग्रेज़ी में समस्या बताएँ और पुष्टि के लिए एक व्यवस्थित मसौदा पाएँ।"],
      ["विभाग तक पहुँचाना", "श्रेणी से ज़िम्मेदार विभाग और समय-सीमा तय होती है, और मामला आपके वार्ड के अधिकारी को जाता है।"],
      ["मिलती-जुलती शिकायतों की पहचान", "एक ही समस्या की शिकायतें आपस में जोड़ी जाती हैं ताकि अधिकारी उन्हें साथ में निपटाएँ। आपकी शिकायत की अपनी आईडी और जानकारी बनी रहती है।"],
      ["स्थिति की जानकारी", "वर्तमान स्थिति, समाधान की अनुमानित तारीख, और किसने कब क्या बदला — सब देखें।"],
      ["समय पर चेतावनी और एस्केलेशन", "समय-सीमा चूकने से पहले अधिकारियों को चेतावनी मिलती है। देरी वाले मामले ऊपर भेजे जाते हैं, और दूसरी आपत्ति वरिष्ठ अधिकारियों तक जाती है।"],
      ["संवेदनशील मामलों की मानवीय समीक्षा", "संवेदनशील या अस्पष्ट मामले अधिकृत अधिकारी की समीक्षा का इंतज़ार करते हैं और कभी अपने आप बंद नहीं होते।"],
    ],
    voiceOn: "इस सेवा पर आवाज़ से इनपुट उपलब्ध है।",
    voiceOff: "इस सेवा पर अभी आवाज़ से इनपुट उपलब्ध नहीं है।",
    notYet: "अभी उपलब्ध नहीं: SMS और WhatsApp से सूचना। सूचनाएँ ऐप में और आपके ट्रैकिंग पेज पर दिखती हैं।",
    categoriesTitle: "आप इन समस्याओं की शिकायत कर सकते हैं",
    categoriesNote: "इस सेवा पर लोड की गई श्रेणी सूची से।",
    categoriesError: "श्रेणी सूची अभी लोड नहीं हो सकी।",
  },
  about: {
    eyebrow: "जवाबदेही",
    title: "आपकी शिकायत के साथ क्या होता है, यह आप भी देख सकते हैं और उसके ज़िम्मेदार लोग भी।",
    bodySynthetic:
      "GRIEVANCE, HackFusion 4.0 के लिए बनाई गई एक एजेंटिक शिकायत निवारण प्रणाली है। यह संस्करण कृत्रिम (डेमो) डेटा पर चलता है और किसी सरकारी संस्था से संबद्ध नहीं है।",
    body: "GRIEVANCE, HackFusion 4.0 के लिए बनाई गई एक एजेंटिक शिकायत निवारण प्रणाली है। यह किसी सरकारी संस्था से संबद्ध नहीं है।",
    rows: [
      ["नागरिक", "स्थिति में हर बदलाव तारीख और बदलने वाले के नाम के साथ देखें। समाधान की पुष्टि करें, या आपत्ति दर्ज करके मामला फिर से खुलवाएँ।"],
      ["अधिकारी", "उन्हें सारांश, नियम-आधारित निर्णय के कारण और मिलते-जुलते पुराने मामले मिलते हैं। हर सुझाव को वे स्वीकार कर सकते हैं, सुधार सकते हैं या बदल सकते हैं।"],
      ["संवेदनशील मामले", "उत्पीड़न, बाल सुरक्षा और भ्रष्टाचार की शिकायतें सामान्य सूची में नहीं दिखतीं, केवल अधिकृत अधिकारी उनकी समीक्षा करते हैं, और वे कभी अपने आप बंद नहीं होतीं।"],
      ["ऑडिट", "हर स्वचालित कदम दर्ज होता है: कौन-सा मॉडल इस्तेमाल हुआ, उसका भरोसा स्तर, और कौन-सा नियम लागू हुआ।"],
    ],
  },
  faqSection: {
    eyebrow: "सामान्य प्रश्न",
    title: "अक्सर पूछे जाने वाले प्रश्न",
    items: [
      ["शिकायत कैसे दर्ज करें?", "एक नागरिक खाता बनाएँ, शिकायत दर्ज करें चुनें और समस्या हिंदी, मराठी या अंग्रेज़ी में बताएँ। सहायक पूछ सकता है कि समस्या कहाँ है या कब से है। फिर वह एक मसौदा तैयार करता है, जिसे आप जाँचकर पुष्टि करते हैं। आपकी पुष्टि के बिना कुछ भी दर्ज नहीं होता।"],
      ["क्या मैं लिखने के बजाय बोलकर बता सकता हूँ?", "हाँ, अगर इस सेवा पर आवाज़ से इनपुट उपलब्ध है। बोलें बटन दबाएँ, अपनी बात कहें, फिर रोकें दबाएँ। लिखित पाठ संदेश बॉक्स में आ जाता है, ताकि भेजने से पहले आप उसे सुधार सकें। लिखित रूप बनने के बाद रिकॉर्डिंग हटा दी जाती है।"],
      ["मैं अपनी शिकायत की स्थिति कैसे देखूँ?", "साइन इन करें और मेरी शिकायतें खोलें। हर शिकायत में उसकी आईडी, वर्तमान स्थिति, समाधान की अनुमानित तारीख और किसने कब क्या बदला, इसका पूरा इतिहास दिखता है। हर चरण पर आपको सूचना भी मिलती है।"],
      ["अगर समस्या सच में ठीक न हुई हो तो?", "जब अधिकारी आपकी शिकायत को हल बताता है, तो आप उसकी पुष्टि कर सकते हैं या आपत्ति दर्ज कर सकते हैं। आपत्ति से शिकायत फिर से खुल जाती है और अधिकारी को सूचना जाती है। दूसरी आपत्ति पर मामला वरिष्ठ अधिकारियों के पास जाता है। बंद होने के 30 दिन तक आप आपत्ति दर्ज कर सकते हैं।"],
      ["किसी और ने भी यही समस्या बताई है। क्या मेरी शिकायत हटा दी जाएगी?", "नहीं। मिलती-जुलती शिकायतें आपस में जोड़ी जाती हैं ताकि अधिकारी उन्हें साथ में निपटाएँ, लेकिन आपकी शिकायत की अपनी आईडी, स्थिति और सूचनाएँ बनी रहती हैं।"],
      ["मेरा नाम और फ़ोन नंबर कौन देखता है?", "केवल आपकी शिकायत संभालने वाला अधिकारी, वह भी आंशिक रूप से छिपा हुआ। उत्पीड़न या भ्रष्टाचार जैसे संवेदनशील मामलों में आपकी पहचान अधिकारियों से पूरी तरह छिपी रहती है और केवल अधिकृत अधिकारी ही मामला खोल सकते हैं।"],
      ["क्या AI मेरे मामले का फ़ैसला करता है?", "नहीं। सहायक केवल श्रेणी और सारांश सुझाता है, नियम-आधारित जाँच तय करती है कि मामला कहाँ जाए, और संवेदनशील या अस्पष्ट मामले हमेशा किसी अधिकारी के पास जाते हैं। प्रणाली कभी कोई शिकायत अस्वीकार नहीं करती और किसी संवेदनशील शिकायत को अपने आप बंद नहीं करती।"],
    ],
  },
  cta: {
    title: "आपके इलाके में कुछ ठीक करने की ज़रूरत है?",
    body: "शिकायत दर्ज करने में कुछ ही मिनट लगते हैं, और समाधान होने तक आप हर कदम देख सकते हैं।",
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
    title: "तुमचा आवाज ऐकला गेलाच पाहिजे.",
    lead: "नागरी समस्यांची तक्रार करा, तुमच्या तक्रारीचा पाठपुरावा करा आणि तिच्या प्रगतीची माहिती मिळवत राहा — तुम्हाला समजणाऱ्या भाषेत.",
    submit: "तक्रार नोंदवा",
    track: "तक्रारीची स्थिती पाहा",
    accountNote: "तक्रार नोंदवण्यासाठी आणि तिची स्थिती पाहण्यासाठी मोफत नागरिक खाते आवश्यक आहे.",
    createAccount: "खाते तयार करा",
    langTitle: "English, हिंदी आणि मराठी",
    langBody: "तुम्हाला सोयीच्या भाषेत लिहा.",
    voiceExtra: " तुम्ही बोलूनही सांगू शकता: या सेवेवर आवाजाद्वारे माहिती देण्याची सोय उपलब्ध आहे.",
    trackTitle: "प्रत्येक टप्प्याची नोंद",
    trackBody: "प्रत्येक तक्रारीला एक आयडी मिळतो, आणि स्थितीतील प्रत्येक बदल तारखेसह नोंदवला जातो.",
  },
  before: {
    title: "सुरू करण्यापूर्वी",
    intro: "ही माहिती तयार ठेवा. काही राहिले तर सहाय्यक तुम्हाला विचारेल.",
    items: ["समस्या काय आहे, तुमच्या स्वतःच्या शब्दांत", "समस्या कुठे आहे: परिसर, प्रभाग किंवा जवळची एखादी खूण", "हे कधीपासून होत आहे, माहीत असल्यास"],
    sensitive: "छळ, भ्रष्टाचार किंवा बालसुरक्षेशी संबंधित तक्रारी फक्त अधिकृत अधिकारीच पाहू शकतात.",
    help: "सामान्य प्रश्नांची उत्तरे वाचा",
  },
  how: {
    eyebrow: "हे कसे काम करते",
    title: "तक्रारीपासून निराकरणापर्यंत तीन टप्पे",
    steps: [
      ["समस्या सांगा", "मराठी, हिंदी किंवा इंग्रजीत लिहा, किंवा सोय उपलब्ध असल्यास बोलून सांगा. ठिकाण किंवा वेळ राहिली तर सहाय्यक विचारेल."],
      ["तपासा आणि सादर करा", "तुमच्या वर्णनावरून तयार केलेली श्रेणी, ठिकाण आणि तातडी तपासा. आवश्यक असल्यास दुरुस्त करा, मग पुष्टी करा. तुमच्या पुष्टीशिवाय काहीही नोंदवले जात नाही."],
      ["प्रगती पाहा", "तुम्हाला तक्रार आयडी आणि प्रत्येक टप्प्यावर सूचना मिळते. समस्या खरोखर सुटली नसेल, तर आक्षेप नोंदवा आणि तक्रा�