import type { Dictionary } from "./en";

/**
 * हिन्दी — Hindi.
 *
 * Typed as `Dictionary`, so a key missing here or renamed in English fails the
 * build rather than silently serving an English string on a Hindi page.
 *
 * Terminology follows the scheme's own official Hindi usage where it exists —
 * सांसद स्थानीय क्षेत्र विकास योजना for MPLADS, कार्यान्वयन एजेंसी for the
 * implementing agency, स्वीकृति for sanction — rather than translating each
 * word independently. Administrative Hindi is fairly settled for this domain
 * and an officer reading it expects the department's vocabulary.
 */
export const hi: Dictionary = {
  locale: {
    name: "हिन्दी",
    switchTo: "View in English",
    partial:
      "इंटरफ़ेस हिन्दी में उपलब्ध है। चेतावनियों के कारण और साक्ष्य डिटेक्टर द्वारा तैयार किए जाते हैं और अंग्रेज़ी में ही रहते हैं।",
  },

  app: {
    name: "सतर्कAI",
    tagline: "सांसद स्थानीय क्षेत्र विकास योजना — निगरानी एवं विसंगति पहचान",
    ministry:
      "सांख्यिकी एवं कार्यक्रम कार्यान्वयन मंत्रालय · डेटा इन्फ़ॉर्मेटिक्स एवं नवाचार प्रभाग",
  },

  nav: {
    dashboard: "डैशबोर्ड",
    alerts: "चेतावनियाँ",
    forecast: "पूर्व चेतावनी",
    works: "कार्य",
    audit: "अंकेक्षण अभिलेख",
    notifications: "सूचनाएँ",
    signOut: "साइन आउट",
    skipToContent: "मुख्य सामग्री पर जाएँ",
    main: "मुख्य",
  },

  auth: {
    signIn: "साइन इन करें",
    signingIn: "साइन इन हो रहा है…",
    email: "सरकारी ईमेल",
    password: "पासवर्ड",
    demoAccounts: "प्रदर्शन खाते",
    demoNote: "प्रत्येक खाता केवल अपने क्षेत्राधिकार का विवरण देखता है। पासवर्ड:",
    incorrect: "ईमेल या पासवर्ड ग़लत है।",
    demoFooter:
      "यह कृत्रिम आँकड़ों पर आधारित प्रदर्शन संस्करण है। यहाँ उत्पन्न संकेत मानव समीक्षा के लिए संकेत मात्र हैं, धोखाधड़ी का निष्कर्ष नहीं।",
    noJurisdiction:
      "इस खाते को कोई क्षेत्राधिकार नहीं सौंपा गया है, इसलिए योजना का कोई विवरण नहीं दिखाया जा सकता। कृपया प्रशासक से संपर्क कर खाते के साथ राज्य, ज़िला, निर्वाचन क्षेत्र या एजेंसी जुड़वाएँ।",
  },

  notice: {
    syntheticTitle: "कृत्रिम प्रदर्शन आँकड़े",
    synthetic:
      "यहाँ दिखाया गया प्रत्येक आँकड़ा, कार्य, सांसद, एजेंसी और विक्रेता केवल प्रदर्शन हेतु तैयार किया गया है। किसी भी वास्तविक MPLADS अभिलेख की प्रतिकृति नहीं है। वास्तविक राज्य एवं ज़िलों के नाम केवल भौगोलिक यथार्थ के लिए प्रयुक्त हैं।",
    humanDecidesTitle: "AI संकेत देता है, निर्णय मनुष्य लेता है।",
    humanDecides:
      "इस मंच का प्रत्येक संकेत समीक्षा हेतु प्राथमिकता-क्रम में रखा गया संकेत है, धोखाधड़ी का निष्कर्ष नहीं। प्रत्येक चेतावनी के साथ उसका कारण और आधार-अभिलेख संलग्न रहते हैं, और अधिकारी की प्रत्येक कार्रवाई अंकेक्षण अभिलेख में दर्ज होती है।",
    coverageTitle: "उपलब्ध अवधि:",
  },

  scope: {
    national: "समस्त राज्य एवं संघ राज्यक्षेत्र",
    state: "राज्य क्षेत्राधिकार",
    district: "ज़िला क्षेत्राधिकार",
    constituency: "अपने निर्वाचन क्षेत्र के कार्य",
    agency: "सौंपे गए कार्य",
    none: "कोई क्षेत्राधिकार नहीं",
  },

  hint: {
    scoreAtLeast80: "80 या अधिक अंक",
    noActionYet: "अभी कोई कार्रवाई दर्ज नहीं",
    acrossFlagged: "समस्त चिह्नित कार्यों में",
    closedWithReason: "कारण सहित बंद",
    sentUpward: "उच्च स्तर पर भेजे गए",
  },

  kpi: {
    works: "कार्य",
    recommended: "संस्तुत राशि",
    sanctioned: "स्वीकृत राशि",
    released: "विक्रेताओं को जारी",
    completionRate: "पूर्णता दर",
    pastOneYear: "एक-वर्ष नियम से अधिक",
    awaitingMarking: "पूर्णता अंकन शेष",
    criticalAlerts: "अति गंभीर चेतावनियाँ",
    alertsInScope: "क्षेत्राधिकार की चेतावनियाँ",
    awaitingReview: "समीक्षा हेतु लंबित",
    valueFlagged: "चिह्नित स्वीकृत राशि",
    evidenceOnFile: "अभिलेख में साक्ष्य",
    decisionsRecorded: "दर्ज निर्णय",
    explained: "स्पष्टीकृत",
    escalated: "उच्च स्तर पर भेजे गए",
    officersInvolved: "संबंधित अधिकारी",
  },

  table: {
    work: "कार्य",
    workCode: "कार्य संख्या",
    district: "ज़िला",
    state: "राज्य",
    agency: "एजेंसी",
    stage: "चरण",
    status: "स्थिति",
    amount: "राशि",
    progress: "प्रगति",
    due: "नियत तिथि",
    released: "जारी",
    vendor: "विक्रेता",
    evidence: "साक्ष्य",
    share: "हिस्सा",
    alerts: "चेतावनियाँ",
    critical: "अति गंभीर",
    completed: "पूर्ण",
    recommendedBy: "संस्तुतकर्ता",
    when: "कब",
    officer: "अधिकारी",
    decision: "निर्णय",
    reasonGiven: "दर्ज कारण",
    type: "प्रकार",
    severity: "गंभीरता",
    score: "अंक",
    category: "श्रेणी",
    year: "वर्ष",
    entitlement: "पात्रता",
    paid: "भुगतान",
    location: "स्थान",
  },

  workStatus: {
    RECOMMENDED: "सांसद द्वारा संस्तुत",
    SANCTIONED: "स्वीकृत",
    IN_PROGRESS: "प्रगति पर",
    COMPLETED_UNMARKED: "पूर्ण, अंकित नहीं",
    COMPLETED: "पूर्ण",
    CANCELLED: "निरस्त",
    notShownPublicly: "सार्वजनिक रूप से पूर्ण नहीं दिखता",
  },

  alertType: {
    OVERDUE: "निर्धारित अवधि से विलंबित",
    PAYMENT_AHEAD: "प्रगति से अधिक भुगतान",
    COST_OVERRUN: "लागत में अधिकता",
    ENTITLEMENT_BREACH: "पात्रता से अधिक संस्तुति",
    MISSING_EVIDENCE: "परिसंपत्ति साक्ष्य अनुपलब्ध",
    STUCK_UNMARKED: "पूर्ण किंतु अंकित नहीं",
    DUPLICATE: "संभावित दोहरा कार्य",
    FY_END_SPIKE: "वित्त-वर्ष के अंत में संकेंद्रण",
    COST_OUTLIER: "समकक्ष कार्यों की तुलना में असामान्य लागत",
    IA_CONCENTRATION: "कार्यान्वयन एजेंसी का संकेंद्रण",
    ML_ANOMALY: "बहुआयामी विसंगति",
  },

  alertState: {
    OPEN: "समीक्षा हेतु लंबित",
    ACKNOWLEDGED: "संज्ञान लिया गया",
    CLARIFICATION_SOUGHT: "स्पष्टीकरण माँगा गया",
    EXPLAINED: "स्पष्टीकृत",
    ESCALATED: "उच्च स्तर पर भेजा गया",
  },

  severity: {
    CRITICAL: "अति गंभीर",
    HIGH: "गंभीर",
    MEDIUM: "मध्यम",
    LOW: "कम",
    INFO: "सूचनार्थ",
  },

  role: {
    MINISTRY: "मंत्रालय / केंद्रीय नोडल एजेंसी (MoSPI)",
    SNA: "राज्य नोडल प्राधिकरण",
    DISTRICT: "ज़िला प्राधिकरण (NDA/IDA)",
    MP: "माननीय सांसद",
    IA: "कार्यान्वयन एजेंसी",
  },

  review: {
    heading: "अपना निर्णय दर्ज करें",
    subtitle:
      "इस मंच पर कोई चेतावनी स्वतः बंद नहीं होती। प्रत्येक स्थिति-परिवर्तन के साथ निर्णय लेने वाले अधिकारी का नाम दर्ज रहता है।",
    action: "कार्रवाई",
    note: "टिप्पणी",
    required: "आवश्यक",
    optional: "वैकल्पिक",
    record: "दर्ज करें",
    recording: "दर्ज किया जा रहा है…",
    currently: "वर्तमान स्थिति",
    history: "समीक्षा इतिहास",
    noAction: "अभी कोई कार्रवाई दर्ज नहीं। यह चेतावनी समीक्षा हेतु लंबित है।",
    readOnly:
      "आपकी भूमिका को इस चेतावनी पर केवल पठन अधिकार है। निगरानी चेतावनियों पर कार्रवाई ज़िला, राज्य एवं मंत्रालय प्राधिकरणों के पास है।",
    footer:
      "निर्णय दर्ज करना किसी पर आरोप नहीं है, और इससे स्वतः कोई दंड या प्रतिवेदन नहीं होता। यह केवल अधिकारी के निष्कर्ष को दर्ज करता है, ताकि इस प्रकरण को अगली बार खोलने वाला व्यक्ति उसे देख सके।",
  },

  common: {
    all: "सभी",
    filters: "छानने के विकल्प",
    filtersNote:
      "ये विकल्प केवल आपकी पहुँच को सीमित करते हैं, बढ़ाते कभी नहीं।",
    previous: "पिछला",
    next: "अगला",
    newer: "नवीनतर",
    older: "पुराने",
    of: "में से",
    page: "पृष्ठ",
    showFigures: "आँकड़े देखें",
    showChart: "चित्र देखें",
    exportCsv: "इस सूची को निर्यात करें (CSV)",
    downloadPdf: "प्रकरण टिप्पणी डाउनलोड करें (PDF)",
    fullTimeline: "पूर्ण क्रम",
    allWorks: "सभी कार्य",
    alertQueue: "चेतावनी सूची",
    allForecasts: "सभी पूर्वानुमान",
    markAllRead: "सभी पढ़ा हुआ अंकित करें",
    unread: "अपठित",
    source: "स्रोत:",
    orderedByScore: "विसंगति-प्राथमिकता अंक के क्रम में।",
    loading: "लोड हो रहा है…",
  },

  empty: {
    noAlertsTitle: "समीक्षा हेतु कुछ नहीं",
    noAlertsBody:
      "आपके क्षेत्राधिकार में इन विकल्पों से मेल खाती कोई चेतावनी नहीं है। संभव है कि विकल्प बहुत सीमित हों, या आँकड़े बदलने के बाद से नियम-इंजन नहीं चलाया गया हो।",
    noWorksTitle: "आपके क्षेत्राधिकार में कोई कार्य नहीं",
    noWorksBody:
      "इस खाते से जुड़े राज्य, ज़िले, निर्वाचन क्षेत्र या एजेंसी के लिए MPLADS के अंतर्गत कोई कार्य संस्तुत नहीं है।",
    noAuditTitle: "अभी कुछ दर्ज नहीं",
    noAuditBody:
      "आपके क्षेत्राधिकार में किसी अधिकारी ने अब तक किसी चेतावनी पर कार्रवाई नहीं की है। सूची से कोई चेतावनी खोलकर निर्णय दर्ज करें।",
    noNotificationsTitle: "अभी कुछ नहीं",
    noNotificationsBody:
      "जब कोई अधिकारी आपके क्षेत्राधिकार की चेतावनी पर कार्रवाई करेगा या उसे आपके पास भेजेगा, तब आपको सूचना मिलेगी।",
    noForecastTitle: "कोई पूर्वानुमान उपलब्ध नहीं",
    noForecastBody:
      "या तो आपके क्षेत्राधिकार में कोई कार्य प्रगति पर नहीं है, या मॉडल सेवा नहीं चलाई गई है। पूर्वानुमान के लिए `npm run detect:ml` आवश्यक है; शेष मंच के लिए नहीं।",
  },

  error: {
    title: "इस पृष्ठ पर कुछ त्रुटि हुई",
    body: "त्रुटि दर्ज कर ली गई है। आप पुनः प्रयास कर सकते हैं या डैशबोर्ड पर लौट सकते हैं। इस विफलता से किसी आँकड़े में परिवर्तन नहीं हुआ है।",
    retry: "पुनः प्रयास करें",
    backToDashboard: "डैशबोर्ड पर लौटें",
    notFoundTitle: "अभिलेख उपलब्ध नहीं",
    notFoundBody:
      "यह अभिलेख या तो मौजूद नहीं है, या आपके खाते से जुड़े राज्य, ज़िले, निर्वाचन क्षेत्र या एजेंसी के बाहर है। सतर्कAI आपके क्षेत्राधिकार के बाहर किसी अभिलेख के होने की पुष्टि नहीं करता।",
  },
};
