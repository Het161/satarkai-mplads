/**
 * English — the reference dictionary.
 *
 * Every other locale is typed against this one, so a missing or renamed key is
 * a compile error rather than a string that quietly falls back to English in
 * production. That matters more than it sounds: a half-translated government
 * page is read as a half-working one.
 *
 * What is here is the **interface**: navigation, headings, card titles and the
 * prose under them, table headers, KPI labels, statuses, buttons, notices,
 * empty states, timeline steps and forecast copy. If an officer can read it
 * without an alert being open, it is translated.
 *
 * What is deliberately NOT here is detector-generated content — an alert's
 * reason sentence and its evidence rows. Those are composed by the detectors
 * with figures interpolated into them and then *stored on the Alert row* as
 * finished text. Translating them means having each detector emit a message
 * key plus parameters, storing those instead of a sentence, and rendering at
 * read time — a schema change, eleven detectors and a re-run of detection.
 * Worth doing; too large to smuggle in behind a font change. The limitation is
 * stated in the language notice and in the README rather than hidden behind a
 * toggle that only half works.
 */

export const en = {
  locale: {
    name: "English",
    switchTo: "हिन्दी में देखें",
    partial:
      "The interface is available in Hindi. The reason sentence on an alert, and the evidence rows beneath it, are composed by the detectors and remain in English.",
  },

  app: {
    name: "SatarkAI",
    tagline: "MPLADS monitoring & anomaly detection",
    ministry:
      "Ministry of Statistics and Programme Implementation · Data Informatics & Innovation Division",
  },

  nav: {
    dashboard: "Dashboard",
    alerts: "Alerts",
    forecast: "Early warning",
    works: "Works",
    audit: "Audit trail",
    notifications: "Notifications",
    signOut: "Sign out",
    skipToContent: "Skip to main content",
    main: "Main",
  },

  auth: {
    signIn: "Sign in",
    signingIn: "Signing in…",
    email: "Official email",
    password: "Password",
    demoAccounts: "Demonstration accounts",
    demoNote: "Each sees only its own jurisdiction. Password:",
    incorrect: "Email or password is incorrect.",
    demoFooter:
      "Demonstration build on synthetic data. Signals produced here are prompts for human review, never findings of fraud.",
    noJurisdiction:
      "This account has no jurisdiction assigned, so no scheme data can be shown. Contact the administrator to attach a state, district, constituency or agency to the account.",
  },

  notice: {
    syntheticTitle: "Synthetic demonstration data",
    synthetic:
      "every figure, work, Member of Parliament, agency and vendor shown here is generated for demonstration. No official MPLADS record is reproduced. Real state and district names are used for geographic realism only.",
    humanDecidesTitle: "AI flags, a human decides.",
    humanDecides:
      "Every signal on this platform is a risk-prioritised prompt for review, not a finding of fraud. Alerts carry the reason and the records behind them, and every action an officer takes is recorded in the audit trail.",
    coverageTitle: "Coverage:",
    coverage:
      "eSAKSHI holds MPLADS data from 1 April 2023 onward. For the 17th Lok Sabha, FY 2019-20 to 2022-23 is not available on the portal, and Rajya Sabha details are unavailable before FY 2023-24.",
    modelledOn: "modelled on {url}",
  },

  scope: {
    national: "All States & Union Territories",
    state: "State jurisdiction",
    district: "District jurisdiction",
    constituency: "Own constituency works",
    agency: "Assigned works",
    none: "No jurisdiction assigned",
  },

  /* The jurisdiction line in the header — what this account can actually see. */
  jurisdiction: {
    stateAll: "{state} — all districts",
    noState: "No state assigned",
    districtIn: "{district} district, {state}",
    noDistrict: "No district assigned",
    constituency: "{constituency} · {house}",
    noConstituency: "No constituency assigned",
    noAgency: "No agency assigned",
  },

  hint: {
    scoreAtLeast80: "score 80 and above",
    noActionYet: "no action recorded yet",
    acrossFlagged: "across all flagged works",
    closedWithReason: "closed with a reason",
    sentUpward: "sent upward",
  },

  kpi: {
    works: "Works",
    recommended: "Recommended",
    sanctioned: "Sanctioned",
    released: "Released to vendors",
    completionRate: "Completion rate",
    pastOneYear: "Past one-year rule",
    awaitingMarking: "Awaiting completion marking",
    criticalAlerts: "Critical alerts",
    alertsInScope: "Alerts in scope",
    awaitingReview: "Awaiting review",
    valueFlagged: "Sanctioned value flagged",
    evidenceOnFile: "Evidence on file",
    decisionsRecorded: "Decisions recorded",
    explained: "Explained",
    escalated: "Escalated",
    officersInvolved: "Officers involved",
  },

  table: {
    work: "Work",
    works: "Works",
    sanctioned: "Sanctioned",
    recommended: "Recommended",
    workCode: "Work code",
    district: "District",
    state: "State",
    agency: "Agency",
    stage: "Stage",
    status: "Status",
    amount: "Amount",
    progress: "Progress",
    due: "Due",
    released: "Released",
    vendor: "Vendor",
    evidence: "Evidence",
    share: "Share",
    alerts: "Alerts",
    critical: "Critical",
    completed: "Completed",
    recommendedBy: "Recommended by",
    when: "When",
    officer: "Officer",
    decision: "Decision",
    reasonGiven: "Reason given",
    type: "Type",
    severity: "Severity",
    score: "Score",
    category: "Category",
    month: "Month",
    year: "Year",
    entitlement: "Entitlement",
    paid: "Paid",
    location: "Location",
  },

  workStatus: {
    RECOMMENDED: "Recommended by MP",
    SANCTIONED: "Sanctioned",
    IN_PROGRESS: "In progress",
    COMPLETED_UNMARKED: "Complete, not marked",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    notShownPublicly: "not shown as completed publicly",
  },

  alertType: {
    OVERDUE: "Overdue completion",
    PAYMENT_AHEAD: "Payment ahead of progress",
    COST_OVERRUN: "Cost overrun",
    ENTITLEMENT_BREACH: "Entitlement breach",
    MISSING_EVIDENCE: "Missing asset evidence",
    STUCK_UNMARKED: "Complete but not marked",
    DUPLICATE: "Possible duplicate work",
    FY_END_SPIKE: "Financial-year-end clustering",
    COST_OUTLIER: "Cost outlier vs peers",
    IA_CONCENTRATION: "Implementing agency concentration",
    ML_ANOMALY: "Multivariate anomaly",
  },

  alertState: {
    OPEN: "Awaiting review",
    ACKNOWLEDGED: "Acknowledged",
    CLARIFICATION_SOUGHT: "Clarification sought",
    EXPLAINED: "Explained",
    ESCALATED: "Escalated",
  },

  severity: {
    CRITICAL: "critical",
    HIGH: "high",
    MEDIUM: "medium",
    LOW: "low",
    INFO: "info",
  },

  role: {
    MINISTRY: "Ministry / Central Nodal Agency (MoSPI)",
    SNA: "State Nodal Authority",
    DISTRICT: "District Authority (NDA/IDA)",
    MP: "Hon'ble Member of Parliament",
    IA: "Implementing Agency",
  },

  review: {
    heading: "Record your decision",
    subtitle:
      "Nothing on this platform closes an alert by itself. Every state change carries the name of the person who made it.",
    action: "Action",
    note: "Note",
    required: "required",
    optional: "optional",
    record: "Record",
    recording: "Recording…",
    currently: "Currently",
    history: "Review history",
    noAction: "No action recorded yet. This alert is awaiting review.",
    readOnly:
      "Your role has read access to this alert. Action on oversight alerts rests with the district, state and ministry authorities.",
    currentlyState: "Currently {state}.",
    escalationNotice: " This will notify {target}.",
    placeholderExplained:
      "What is the legitimate reason? Be specific enough that someone reading this in a year understands it.",
    placeholderClarification: "What have you asked for, and from whom?",
    placeholderEscalated: "Why does this need attention above your level?",
    placeholderDefault: "Anything worth recording.",
    footer:
      "Recording a decision does not accuse anyone of anything, and no penalty or report follows from it automatically. It records what an officer concluded, so that the next person to open this case can see it.",
  },

  common: {
    all: "All",
    filters: "Filters",
    filtersNote:
      "Filters narrow what you already have access to. They never widen it.",
    previous: "Previous",
    next: "Next",
    newer: "Newer",
    older: "Older",
    of: "of",
    page: "Page",
    showFigures: "Show figures",
    showChart: "Show chart",
    exportCsv: "Export this queue (CSV)",
    downloadPdf: "Download case note (PDF)",
    fullTimeline: "Full timeline",
    allWorks: "All works",
    alertQueue: "Alert queue",
    allForecasts: "All forecasts",
    markAllRead: "Mark all read",
    unread: "unread",
    source: "Source:",
    syntheticData: "synthetic demonstration data",
    officialRecord: "official record",
    asOf: "as of {date}",
    alertQueueSubtitle:
      "{scope} · highest priority first. Each alert carries the rule it broke and the records behind it.",
    orderedByScore: "Ordered by Anomaly-Priority Score.",
    loading: "Loading…",
    pagination: "Pagination",
    reference: "Reference:",
  },

  /* Who an escalation reaches, by the escalating officer's role. */
  escalate: {
    MINISTRY: "the Ministry's own review",
    SNA: "the Ministry",
    DISTRICT: "the State Nodal Authority",
    MP: "a higher authority",
    IA: "a higher authority",
  },

  /* A single work's record. */
  audit: {
    subtitle:
      "{scope} · every decision recorded against an alert, newest first. Records are append-only: a decision is answered by recording another, never by removing it.",
    closesItselfLead: "Nothing on this platform closes itself.",
    closesItselfBody:
      "Every row below was written by a named person. The detection engine refreshes an alert's score and evidence when it re-runs, but never its review state — so an alert somebody marked as explained does not quietly reopen, and one nobody has looked at never quietly closes.",
    decisionsOne: "{count} decision",
    decisionsMany: "{count} decisions",
    allJurisdictions: "All jurisdictions.",
    yoursAndBelow: "Your jurisdiction, and those below it.",
  },

  workDetail: {
    back: "← All works",
    particulars: "Particulars",
    worksTitle: "Recommended works",
    worksSubtitle:
      "Newest recommendation first. Select a work to open its full timeline.",
    worksCaption: "MPLADS works within your jurisdiction",
    fyTag: "FY {fy}",
    workType: "Work type",
    implementingAgency: "Implementing agency",
    notYetDesignated: "Not yet designated",
    recommendedOn: "Recommended on",
    recommendedAmount: "Recommended amount",
    sanctionedOn: "Sanctioned on",
    sanctionedAmount: "Sanctioned amount",
    dueForCompletion: "Due for completion",
    dueValue: "{date} (one year from sanction)",
    recordedProgress: "Recorded progress",
    completeOnGround: "Complete on the ground",
    markedByAgency: "Marked complete by agency",
    releasedToVendors: "Released to vendors",
    releasedShare: "Released as share of sanction",
    overdueNote:
      "{days} days past the scheme's one-year completion guideline, and not yet marked complete by the implementing agency.",
  },

  empty: {
    noAlertsTitle: "Nothing to review",
    noAlertsBody:
      "No alert in your jurisdiction matches these filters. That may mean the filters are too narrow, or that the rule engine has not been run since the data last changed.",
    noWorksTitle: "No works in your jurisdiction",
    noWorksBody:
      "Nothing has been recommended under MPLADS for the state, district, constituency or agency attached to this account.",
    noAuditTitle: "Nothing recorded yet",
    noAuditBody:
      "No officer has acted on an alert in your jurisdiction. Open an alert from the queue and record a decision to start the trail.",
    noNotificationsTitle: "Nothing yet",
    noNotificationsBody:
      "You will be notified when an officer acts on an alert in your jurisdiction, or escalates one to you.",
    noForecastTitle: "No forecasts available",
    noForecastBody:
      "Either no works in your jurisdiction are still running, or the model service has not been run. Forecasts need `npm run detect:ml`; the rest of the platform does not.",
  },

  error: {
    title: "Something went wrong on this page",
    body: "The error has been logged. You can try again, or go back to the dashboard. No data was changed by this failure.",
    retry: "Try again",
    backToDashboard: "Back to dashboard",
    notFoundTitle: "Record not available",
    notFoundBody:
      "This record either does not exist or falls outside the state, district, constituency or agency attached to your account. SatarkAI does not confirm the existence of records beyond your jurisdiction.",
  },

  /* ---------------------------------------------------------------------
   * Role dashboards.
   *
   * Strings carrying a `{token}` are filled through `fill()` rather than
   * concatenated, so a translator can move the value to wherever the sentence
   * needs it. See the note on `fill` in ./index.ts.
   * ------------------------------------------------------------------ */
  dash: {
    ministryTitle: "National overview",
    ministrySubtitle:
      "Every state and Union Territory. Scheme-wide position, where risk is concentrated, and the cases waiting on someone's decision.",
    stateTitle: "{state} — district oversight",
    stateSubtitle:
      "All {count} districts in {state}. Districts are compared against each other, because the decision an SNA makes is which one to chase.",
    districtTitle: "{district} district",
    districtSubtitle:
      "{state}. The works this office sanctioned, how the designated agencies are performing, and what is waiting on an action here.",
    mpSubtitle:
      "Works recommended by {mp} under MPLADS, and where each one has reached. {house}.",
    agencySubtitle:
      "Works designated to this agency, and the records still outstanding against them.",

    houseLS: "Lok Sabha",
    houseRS: "Rajya Sabha",

    pipelineTitle: "Works through the pipeline",
    pipelineSubtitle:
      "Monthly count of works recommended, sanctioned, and marked complete. All three count works, so they share one scale.",
    pipelineSubtitleIn:
      "Monthly count of works recommended, sanctioned, and marked complete across {place}.",
    spendTitle: "Vendor payments released",
    spendSubtitle:
      "Money moves on a different scale from work counts, so it gets its own chart rather than a second axis.",
    seriesRecommended: "Recommended",
    seriesSanctioned: "Sanctioned",
    seriesMarkedComplete: "Marked complete",
    seriesReleased: "Released",

    needsAttentionTitle: "Needs attention first",
    needsAttentionSubtitle:
      "Open alerts, highest Anomaly-Priority Score first. Each carries the rule it broke and the records behind it.",
    allOf: "All {count} →",
    nothingAwaitingTitle: "Nothing awaiting review",
    noAlertsNational:
      "No open alert in any state. Either the detectors have not run since the data last changed, or every signal has been reviewed.",
    noAlertsIn:
      "No open alert in {place}. Either the detectors have not run since the data last changed, or every signal has been reviewed.",

    concentrationTitle: "Where alerts are concentrated",
    concentrationSubtitle:
      "Open and reviewed alerts by state. Bar length is the count; hover for the critical share.",
    flaggedTitle: "What is being flagged",
    flaggedSubtitle: "Alert volume by type, across the country.",
    criticalWorks: "{critical} critical · {works} works",
    worksCount: "{count} works",

    statesComparedTitle: "States compared",
    statesComparedSubtitle:
      "Ordered by critical alerts. Every figure is a link into that state's works.",
    districtsComparedTitle: "Districts compared",
    districtsComparedSubtitle: "Ordered by critical alerts.",
    agenciesComparedTitle: "Implementing agencies compared",
    agenciesComparedSubtitle:
      "Ordered by critical alerts. A dominant agency is not itself a problem — the district may have one capable body — but it is worth knowing.",
    nothingToCompareTitle: "Nothing to compare",
    nothingToCompareBody:
      "No {unit} in your jurisdiction has any works recorded.",
    pastOneYearCol: "Past one year",

    stagesTitle: "Works by stage",
    stagesSubtitle:
      "The eSAKSHI lifecycle, from an MP's recommendation to the agency marking the work complete.",
    stagesCaption: "Count of works at each stage",

    watchlistTitle: "Watch list",
    watchlistSubtitle:
      "Running works the model expects to miss the one-year mark. A forecast, not a finding — the useful response is a call to the agency.",
    watchlistEmptyTitle: "No works flagged",
    watchlistEmptyBody:
      "Either nothing in your jurisdiction is at elevated risk, or the model service has not been run — forecasts need `npm run detect:ml`, which the rest of the platform does not.",
    watchlistMeta: "{district} · {agency} · {progress}% done · due {due}",

    overdueTitle: "Works past the one-year rule",
    overdueSubtitle:
      "Sanctioned over a year ago and still not marked complete. These are the escalations — named, because a count by district is already a column in the table below.",
    overdueEmptyTitle: "Nothing past the guideline",
    overdueEmptyBody:
      "Every sanctioned work in {place} is either inside the one-year window or already marked complete.",
    daysOver: "{days} days over",
    overdueMeta: "{progress}% done · {district} · {agency} · due {due}",
    lowestCompletionTitle: "Lowest completion rates",
    lowestCompletionSubtitle:
      "Share of each district's works marked complete. Weakest first — a low rate can mean slow execution or slow marking, and the district table separates the two.",
    completionRateSeries: "Completion rate",
    alertsSeries: "Alerts",

    noEvidenceTitle: "Payment stages with no evidence",
    noEvidenceSubtitle:
      "Money released with no asset photograph or document on record. The sanction order requires one at each stage.",
    noEvidenceEmptyTitle: "Every stage is documented",
    noEvidenceEmptyBody:
      "Each payment released in this district has at least one photograph or document against it.",
    noEvidenceCaption: "Payment stages released without evidence",
    unmarkedTitle: "Finished but not marked complete",
    unmarkedSubtitle:
      "Works recorded at 100% and complete on the ground, which the agency has not marked. Until it does, they do not count as completed anywhere.",
    unmarkedEmptyTitle: "Nothing pending",
    unmarkedEmptyBody:
      "Every completed work in this district has been marked complete by its implementing agency.",
    completeSinceMeta: "complete since {date} · {agency} · {amount}",

    moneyStandsTitle: "Where the money stands",
    moneyStandsTitleFy: "Where the money stands — FY {fy}",
    moneyStandsSubtitle:
      "Each step is a smaller figure than the one before it, and the gaps are where money is waiting rather than working.",
    flowEntitlement: "Entitlement authorised",
    flowRecommended: "You recommended",
    flowSanctioned: "District sanctioned",
    flowPaid: "Paid to vendors",
    noEntitlementTitle: "No entitlement on record",
    noEntitlementBody:
      "No annual entitlement has been authorised for this Member in the period covered by the portal.",
    yearByYearTitle: "Year by year",
    yearByYearSubtitle:
      "Entitlement authorised against what was recommended, sanctioned and paid.",
    yearByYearCaption: "Entitlement and utilisation by financial year",
    overRecommendedNote:
      "A year shown in red has recommendations totalling more than the entitlement authorised for it. That needs reconciling with the district authority.",
    lateTitle: "Works running late",
    lateSubtitle:
      "Sanctioned more than {days} days ago and still not marked complete by the implementing agency.",
    lateEmptyTitle: "Nothing running late",
    lateEmptyBody:
      "Every work recommended from this constituency is either inside the one-year window or already marked complete.",
    lateMeta:
      "{days} days past the one-year mark · {progress}% done · {agency} · {district}",
    categoriesTitle: "What the works are for",
    categoriesSubtitle: "Recommended amount by category of asset.",
    categoriesCaption: "Recommended amount by category",
    recentTitle: "Most recent recommendations",
    recentSubtitle: "Newest first.",
    reachedTitle: "Where the works have reached",
    reachedSubtitle:
      "Every recommendation passes through these stages. A work only counts as completed once the agency marks it so.",
    awaitingAgencyRecord: "finished, waiting on the agency to record it",

    uploadTitle: "Photographs and documents to upload",
    uploadSubtitle:
      "Payment stages released with nothing on record against them. The sanction order requires an asset photograph at each stage.",
    uploadEmptyTitle: "Nothing outstanding",
    uploadEmptyBody:
      "Every payment stage released to this agency has at least one photograph or document uploaded.",
    markTitle: "Works to mark complete",
    markSubtitle:
      "Recorded at 100% and finished on the ground. Until this agency marks them complete they do not appear as completed anywhere.",
    markEmptyTitle: "Nothing pending",
    markEmptyBody:
      "Every finished work assigned to this agency has been marked complete.",
    markMeta: "complete since {date} · {amount}",
    stageMeta: "stage {stage} · {amount} · released {date}",
    inHandTitle: "Works in hand",
    inHandSubtitle: "Sanctioned or under execution, soonest due first.",
    inHandEmptyTitle: "No works in hand",
    inHandEmptyBody:
      "This agency has no sanctioned or in-progress works at present.",
    inHandCaption: "Works currently assigned",

    kpiWorksRecommended: "Works recommended",
    kpiEntitlementAuthorised: "Entitlement authorised",
    kpiRecommendedAgainst: "Recommended against it",
    kpiReachedVendors: "Reached vendors",
    kpiWorksAssigned: "Works assigned",
    kpiSanctionedValue: "Sanctioned value",
    kpiAwaitingYourMarking: "Awaiting your completion marking",

    hintAcrossDistricts: "across {count} districts",
    hintEarmarkedByMps: "earmarked by MPs",
    hintOfSanctioned: "{pct} of sanctioned",
    hintMarkedComplete: "{count} marked complete",
    hintCompleted: "{count} completed",
    hintSanctionedOver365: "sanctioned > 365 days, unmarked",
    hintNeedsEscalation: "needs escalation",
    hintOfAwaiting: "of {count} awaiting review",
    hintAgenciesEngaged: "{count} agencies engaged",
    hintPaymentStages: "{documented} of {total} payment stages",
    hintFinishedNotMarked: "finished, not marked by the agency",
    hintFinishedOnGround: "finished on the ground",
    hintAcrossYears: "across {count} financial years",
    hintOfEntitlement: "{pct} of entitlement",
    hintActuallyPaidOut: "actually paid out for work done",

    noAgency: "No agency",
    noAgencyDesignated: "No agency designated",
    noAgencyDesignatedLower: "no agency designated",
    notDesignated: "Not designated",
  },

  /* The work timeline — one card, but the densest prose in the product. */
  timeline: {
    title: "The work, in order",
    subtitle:
      "Recommendation through to completion marking, with every risk signal attached to the step it concerns.",
    pending: "pending",
    implementingAgency: "Implementing agency",
    schemeGuideline: "Scheme guideline",
    districtAuthority: "{district} District Authority",

    recommendedTitle: "Recommended and funds earmarked",
    recommendedDetail:
      "{amount} earmarked against the Member's annual entitlement, for {locality}, {district}.",
    sanctionTitle: "Sanctioned after feasibility checks",
    sanctionDetail:
      "{amount} sanctioned. Due for completion by {due}, one year from sanction.",
    sanctionCancelled: "The recommendation was cancelled before sanction.",
    sanctionPending:
      "Awaiting feasibility checks and sanction by the district authority.",
    agencyTitle: "Implementing agency designated",
    agencyDetail: "Responsible for execution and for raising payment requests.",
    agencyPending: "No agency designated yet.",

    paymentsTitle: "Vendor payments and asset evidence",
    paymentsNone: "No vendor payment has been released against this work yet.",
    paymentsSummary:
      "{stages} stages released, {documented} with evidence on file ({files} files).",
    paymentsSummaryOne:
      "{stages} stage released, {documented} with evidence on file ({files} file).",
    stageLabel: "Stage {stage}",
    releasedOn: "released {date}",
    paidTo: "to {vendor}",
    noEvidenceForStage:
      "No asset photograph or document on record for this stage",
    evidenceUploaded: "{kind} uploaded {date}",

    windowTitle: "One-year completion window",
    windowDetail:
      "Sanctioned works are generally required to be completed within one year. Progress currently recorded at {progress}%.",
    windowPending: "Not applicable until the work is sanctioned.",
    groundTitle: "Complete on the ground",
    groundDetail: "Work physically finished.",
    groundPending: "Not yet reported as finished.",
    markedTitle: "Marked complete by the implementing agency",
    markedDetail:
      "The work now appears as completed. This final step is what makes a finished work visible as finished.",
    markedPending:
      "Not marked. Until the agency records completion, this work does not appear as completed anywhere — including on the public dashboard.",
  },

  /* The evidence behind an alert — the part that makes it arguable. */
  evidence: {
    ruleTitle: "The rule that fired",
    factsTitle: "Figures relied on",
    factsSubtitle:
      "Read directly from the work's record at the time of detection.",
    recordsTitle: "Records",
    recordsSubtitle: "Rows marked in red are the ones that breach the rule.",
    driversTitle: "What drove the score",
    driversSubtitle:
      "Each measure, this work's value against the typical one, and how much of the score it accounts for.",
    recordsCaption: "Underlying records this alert relied on",
    recordColumn: "Record",
    scoringTitle: "How this was prioritised",
    scoringSubtitle:
      "The score is a weighted sum, shown in full so it can be challenged.",
    scoringCaption: "Components of the anomaly-priority score",
    component: "Component",
    basis: "Basis",
    weight: "Weight",
    value: "Value",
    contribution: "Contribution",
    total: "Anomaly-Priority Score",
  },

  /* Forecasts. Deliberately quieter language than alerts. */
  forecast: {
    heading: "Early warning",
    subtitle:
      "{scope} · works still running, ranked by the estimated chance of passing {days} days from sanction without being marked complete.",
    notFindingsLead: "These are predictions, not findings.",
    notFindingsBody:
      "Nothing on this page is an alert, and no case is opened by it. A work shown as likely to overrun has done nothing wrong — the estimate is drawn from how works with similar characteristics have fared before, and the useful response is to ask the implementing agency how it is going, not to open a file.",
    kpiForecast: "Works forecast",
    kpiForecastHint: "still running",
    kpiLikely: "Likely to overrun",
    kpiLikelyHint: "high or very high",
    kpiSomeRisk: "Some risk",
    kpiOnTrack: "On track",
    tableTitle: "Works by estimated risk",
    tableSubtitle:
      "Highest first. Open a work to see what the estimate rests on.",
    tableCaption: "Works still running, ranked by estimated delay risk",
    colEstimate: "Estimate",
    colOutlook: "Outlook",
    emptyTitle: "No forecasts available",
    emptyBody:
      "Either no works in your jurisdiction are still running, or the model service has not been run. Forecasts are produced by `npm run detect:ml` and need the Python service; the rest of the platform does not.",
    provenance:
      "Forecasts computed {date} by {model}, from attributes known when each work was sanctioned — size, work type, how long the district took to sanction, the season, and the past record of the agency, district and work type. Nothing recorded after sanction is used, so the model cannot read the outcome it is predicting.",
  },

  /* Delay-risk bands and the per-work forecast panel. */
  delay: {
    VERY_HIGH: "Very likely to overrun",
    HIGH: "Likely to overrun",
    MODERATE: "Some risk of overrun",
    LOW: "On track",
    panelTitle: "Delay-risk forecast",
    panelSubtitle:
      "A prediction about what may happen, not a finding about what has. Nothing here is an alert and no case is opened.",
    chanceOf:
      "estimated chance of passing one year from sanction without being marked complete",
    restsOn: "What the estimate rests on",
    driversCaption: "Features driving the delay-risk estimate for this work",
    factor: "Factor",
    thisWork: "This work",
    typical: "Typical",
    effect: "Effect",
    typicalValue: "typical {value}",
    points: "+{points} pts",
    nothingStandsOut:
      "Nothing about this work stands out from the works the model learned from, so no single factor explains the estimate.",
    ablationNote:
      "{model} · computed {date}. Each factor's effect is measured by asking what the estimate would have been had this work been ordinary on that one point. Because factors interact, they do not sum to the total.",
    lateShare: "{pct}% late",
    worksCount: "{count} works",
    daysCount: "{count} days",
    daysBeforeClose: "{count} days before close",
  },

  /* Notifications — including the ones that failed to send. */
  notifications: {
    heading: "Notifications",
    subtitle:
      "Raised when an officer records a decision that concerns your jurisdiction. Each attempt is listed with the channel and what happened to it.",
    recentTitle: "Recent",
    recentSubtitle:
      "Newest first, one entry per event with every channel it was sent on.",
  },

  /* The alert case file. */
  alertDetail: {
    back: "← Alert queue",
    outOf: "/ 100",
    detectedBy: "Detected {date} by {source}.",
    sourceModel: "the model service",
    sourceStatistical: "a statistical test",
    sourceRules: "the rule engine",
    workTitle: "The work",
    implementingAgency: "Implementing agency",
    sanctionedAmount: "Sanctioned amount",
    financialYear: "Financial year",
    relatedTitle: "Related works",
    relatedSubtitle: "Other works this finding compared against.",
    relatedHiddenOne:
      "{count} further related work is outside your jurisdiction and not shown.",
    relatedHiddenMany:
      "{count} further related works are outside your jurisdiction and not shown.",
  },

  /* Review actions. Mirrors ACTIONS in lib/review.ts. */
  action: {
    ACKNOWLEDGED: {
      label: "Acknowledge",
      meaning:
        "You have seen this and are looking into it. The alert stays open in the queue.",
    },
    CLARIFICATION_SOUGHT: {
      label: "Seek clarification",
      meaning:
        "You have asked the implementing agency or district for an explanation. Record what you asked for.",
    },
    EXPLAINED: {
      label: "Mark as explained",
      meaning:
        "There is a legitimate reason and no further action is needed. Record the reason — it is what lets the detector be tuned later, and it is what a future reviewer will read.",
    },
    ESCALATED: {
      label: "Escalate",
      meaning:
        "This warrants attention above your level. Record why. Escalation does not accuse anyone of anything; it moves the question up.",
    },
    noteTooShort: "Please record a reason of at least {min} characters.",
    escalatesTo: "Escalates to: {target}",
  },
} as const;

/**
 * Widens the literal types `as const` produces, so a translation may hold any
 * string — while the KEYS stay exact. A locale file missing a key, or inventing
 * one, is a compile error; a locale file with different words is the point.
 */
type Translated<T> = {
  [K in keyof T]: T[K] extends string ? string : Translated<T[K]>;
};

export type Dictionary = Translated<typeof en>;
