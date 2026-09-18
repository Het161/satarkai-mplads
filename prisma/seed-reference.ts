/**
 * Reference data for the synthetic seed.
 *
 * States, districts and constituencies are REAL place names — the platform has
 * to look and behave like the real thing for officials to judge it.
 *
 * Every PERSON, IMPLEMENTING AGENCY and VENDOR name below is FICTIONAL and was
 * invented for this demo. No real Member of Parliament, official, agency or
 * contractor is named anywhere in this dataset. Planted anomalies are attached
 * only to these fictional entities. See README.md § Data provenance.
 */

export const GEOGRAPHY: {
  state: string;
  code: string;
  districts: { name: string; code: string }[];
}[] = [
  {
    state: "Gujarat",
    code: "GJ",
    districts: [
      { name: "Ahmedabad", code: "GJ-AHD" },
      { name: "Surat", code: "GJ-SRT" },
      { name: "Vadodara", code: "GJ-VAD" },
      { name: "Rajkot", code: "GJ-RJT" },
      { name: "Bhavnagar", code: "GJ-BHV" },
      { name: "Mehsana", code: "GJ-MSA" },
    ],
  },
  {
    state: "Maharashtra",
    code: "MH",
    districts: [
      { name: "Pune", code: "MH-PUN" },
      { name: "Nagpur", code: "MH-NAG" },
      { name: "Nashik", code: "MH-NSK" },
      { name: "Thane", code: "MH-THN" },
      { name: "Chhatrapati Sambhajinagar", code: "MH-CSN" },
      { name: "Solapur", code: "MH-SOL" },
    ],
  },
  {
    state: "Uttar Pradesh",
    code: "UP",
    districts: [
      { name: "Lucknow", code: "UP-LKO" },
      { name: "Varanasi", code: "UP-VNS" },
      { name: "Kanpur Nagar", code: "UP-KNP" },
      { name: "Gorakhpur", code: "UP-GKP" },
      { name: "Prayagraj", code: "UP-PRJ" },
      { name: "Meerut", code: "UP-MRT" },
    ],
  },
  {
    state: "Tamil Nadu",
    code: "TN",
    districts: [
      { name: "Chennai", code: "TN-MAA" },
      { name: "Coimbatore", code: "TN-CBE" },
      { name: "Madurai", code: "TN-MDU" },
      { name: "Salem", code: "TN-SLM" },
      { name: "Tiruchirappalli", code: "TN-TRY" },
      { name: "Erode", code: "TN-ERD" },
    ],
  },
  {
    state: "West Bengal",
    code: "WB",
    districts: [
      { name: "Kolkata", code: "WB-KOL" },
      { name: "Howrah", code: "WB-HWH" },
      { name: "Darjeeling", code: "WB-DAR" },
      { name: "Murshidabad", code: "WB-MSD" },
      { name: "Purba Bardhaman", code: "WB-PBD" },
      { name: "Nadia", code: "WB-NDA" },
    ],
  },
  {
    state: "Assam",
    code: "AS",
    districts: [
      { name: "Kamrup Metropolitan", code: "AS-KAM" },
      { name: "Dibrugarh", code: "AS-DIB" },
      { name: "Cachar", code: "AS-CAC" },
      { name: "Nagaon", code: "AS-NAG" },
      { name: "Sonitpur", code: "AS-SON" },
      { name: "Jorhat", code: "AS-JOR" },
    ],
  },
];

/**
 * Real constituency names, grouped by state.
 *
 * Index i lines up with district i in GEOGRAPHY: the Lok Sabha member for
 * constituency i sits in district i, which is what lets the seed honour the
 * rule that a Lok Sabha member recommends works within their own constituency.
 * The final entry in each list is the Rajya Sabha seat, whose "constituency"
 * is the whole state, so its name is replaced at seed time.
 */
export const CONSTITUENCIES: Record<string, string[]> = {
  GJ: ["Ahmedabad East", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Patan"],
  MH: [
    "Pune",
    "Nagpur",
    "Nashik",
    "Thane",
    "Chhatrapati Sambhajinagar",
    "Solapur",
  ],
  UP: ["Lucknow", "Varanasi", "Kanpur", "Gorakhpur", "Phulpur", "Meerut"],
  TN: [
    "Chennai Central",
    "Coimbatore",
    "Madurai",
    "Salem",
    "Tiruchirappalli",
    "Erode",
  ],
  WB: [
    "Kolkata Dakshin",
    "Howrah",
    "Darjeeling",
    "Murshidabad",
    "Bardhaman Purba",
    "Krishnanagar",
  ],
  AS: ["Guwahati", "Dibrugarh", "Silchar", "Nagaon", "Sonitpur", "Jorhat"],
};

/**
 * FICTIONAL MP names. Two-part pools combined deterministically so the set is
 * plainly invented rather than drawn from any real list of parliamentarians.
 */
export const FICTIONAL_FIRST_NAMES = [
  "Anilkumar",
  "Brijesh",
  "Chitralekha",
  "Devnarayan",
  "Ezhilarasi",
  "Falguni",
  "Gopinath",
  "Harshvardhan",
  "Indrani",
  "Jaswantrai",
  "Kamalakshi",
  "Lalitmohan",
  "Manjushree",
  "Nandkishore",
  "Omprakash",
  "Padmavati",
  "Rukminidevi",
  "Shyamsundar",
  "Tejaswini",
  "Umakant",
  "Vasudevan",
  "Yashodhara",
  "Bhupendranath",
  "Sarvesh",
  "Nilanjana",
  "Thangavelu",
  "Kaushalya",
  "Girdharilal",
  "Meenakshi",
  "Prabhakaran",
];

export const FICTIONAL_SURNAMES = [
  "Vagheshwari",
  "Chandrabhan",
  "Deshpandey",
  "Ramanathapuram",
  "Bhattacharjya",
  "Goswamiratna",
  "Talukdarhazarika",
  "Sundaravadivel",
  "Mahapatrasingh",
  "Kulkarnipatil",
  "Shrivastavya",
  "Nambiarkutty",
  "Choudharymal",
  "Senguptaroy",
  "Parmarvala",
  "Iyengarswamy",
  "Rathodbhai",
  "Mukhopadhyaya",
  "Venkatachalam",
  "Barmanphukan",
  "Solankibhai",
  "Wagholikar",
  "Tripathidubey",
  "Perumalselvam",
  "Chakrabortty",
  "Gogoisaikia",
  "Jethwavala",
  "Khedekarrao",
  "Yadavpandey",
  "Arumugasamy",
];

/** FICTIONAL implementing-agency name stems, combined with the district name. */
export const AGENCY_TEMPLATES: { suffix: string; type: string }[] = [
  { suffix: "Public Works Division", type: "State PWD" },
  { suffix: "Municipal Corporation", type: "Urban Local Body" },
  { suffix: "Zilla Parishad Works Cell", type: "District Panchayat" },
  { suffix: "Rural Development Agency", type: "Rural Works Department" },
  { suffix: "Water Supply & Sanitation Board", type: "Parastatal Board" },
  { suffix: "District Education Works Unit", type: "Education Department" },
];

/** FICTIONAL vendor names for payment vouchers. */
export const FICTIONAL_VENDORS = [
  "Girnar Infrabuild (Fictional) Pvt Ltd",
  "Sahyadri Constructions (Fictional)",
  "Triveni Civil Works (Fictional)",
  "Cauvery Engineering (Fictional) Pvt Ltd",
  "Hooghly Structurals (Fictional)",
  "Brahmaputra Contractors (Fictional)",
  "Aravalli Buildtech (Fictional) Pvt Ltd",
  "Vindhya Projects (Fictional)",
  "Konkan Enterprises (Fictional)",
  "Deccan Works & Services (Fictional)",
];

/**
 * Work types with realistic MPLADS cost bands (rupees) and a unit basis for
 * cost-per-unit peer comparison. Bands are drawn from the kinds of durable
 * community assets the scheme funds.
 *
 * `complexity` scales how long a work of this type takes to execute. A borewell
 * is drilled in weeks; a health sub-centre needs foundations, services and
 * inspections. Encoding it here gives the delay-risk model a genuine, learnable
 * relationship — without it the model has only agency track records to go on,
 * and with three agencies per district there is rarely enough history for that
 * to mean anything.
 */
export const WORK_TYPES: {
  type: string;
  category: string;
  min: number;
  max: number;
  unit: string;
  multiUnit: boolean;
  complexity: number;
}[] = [
  { type: "Community Hall", category: "Community Assets", min: 2_500_000, max: 8_000_000, unit: "hall", multiUnit: false, complexity: 1.35 },
  { type: "Borewell with Handpump", category: "Drinking Water", min: 300_000, max: 1_200_000, unit: "borewell", multiUnit: true, complexity: 0.72 },
  { type: "Anganwadi Centre Building", category: "Women & Child", min: 1_200_000, max: 3_500_000, unit: "centre", multiUnit: false, complexity: 1.15 },
  { type: "School Classroom Block", category: "Education", min: 2_000_000, max: 6_000_000, unit: "classroom", multiUnit: true, complexity: 1.2 },
  { type: "Cement Concrete Road", category: "Roads & Connectivity", min: 1_500_000, max: 7_000_000, unit: "km", multiUnit: true, complexity: 0.95 },
  { type: "Solar Street Lighting", category: "Energy", min: 500_000, max: 2_500_000, unit: "pole", multiUnit: true, complexity: 0.7 },
  { type: "Primary Health Sub-Centre", category: "Health", min: 3_000_000, max: 9_000_000, unit: "centre", multiUnit: false, complexity: 1.5 },
  { type: "Public Library Building", category: "Education", min: 2_000_000, max: 5_000_000, unit: "library", multiUnit: false, complexity: 1.25 },
  { type: "Covered Drainage Line", category: "Sanitation", min: 1_000_000, max: 4_500_000, unit: "km", multiUnit: true, complexity: 1.05 },
  { type: "Crematorium Shed", category: "Community Assets", min: 800_000, max: 2_500_000, unit: "shed", multiUnit: false, complexity: 0.85 },
  { type: "Bus Passenger Shelter", category: "Roads & Connectivity", min: 300_000, max: 900_000, unit: "shelter", multiUnit: true, complexity: 0.65 },
  { type: "RO Drinking Water Plant", category: "Drinking Water", min: 800_000, max: 3_000_000, unit: "plant", multiUnit: false, complexity: 0.9 },
  { type: "Sports Ground Development", category: "Sports & Youth", min: 1_500_000, max: 5_500_000, unit: "ground", multiUnit: false, complexity: 1.1 },
  { type: "Public Toilet Block", category: "Sanitation", min: 500_000, max: 1_800_000, unit: "block", multiUnit: true, complexity: 0.8 },
  { type: "Village Pond Renovation", category: "Water Conservation", min: 700_000, max: 2_800_000, unit: "pond", multiUnit: false, complexity: 0.95 },
];

/** Locality name fragments used to build plausible work titles. */
export const LOCALITIES = [
  "Ward No. 4",
  "Ward No. 11",
  "Ward No. 17",
  "Gram Panchayat Kherva",
  "Gram Panchayat Ranipur",
  "Nehru Nagar",
  "Indira Colony",
  "Shastri Nagar",
  "Subhash Chowk",
  "Vivekananda Marg",
  "Gandhi Bazaar",
  "Tagore Para",
  "Ambedkar Basti",
  "Patel Faliya",
  "Anna Nagar Extension",
  "Bharathi Street",
  "Rabindra Pally",
  "Sivaji Peth",
  "Station Road",
  "Old Market Area",
];

/** MPLADS annual entitlement per Member of Parliament (rupees). */
export const ANNUAL_ENTITLEMENT = 50_000_000; // ₹5 crore
