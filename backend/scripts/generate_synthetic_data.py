"""Generate the SYNTHETIC demo datasets used until official HackFusion data is supplied.

    python scripts/generate_synthetic_data.py            # writes backend/data/synthetic/*.csv

Everything produced here is fictional and labelled `data_source=SYNTHETIC`. It is NOT
official HackFusion data. Output is deterministic (fixed seed) so demos are repeatable.
"""
from __future__ import annotations

import csv
import math
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "data" / "synthetic"
SEED = 20261111
NOW = datetime(2026, 11, 1, 9, 0, tzinfo=timezone.utc)  # fixed anchor => reproducible

DEPARTMENTS = [
    # code, name_en, name_hi, name_mr, head_officer_code
    ("WATER", "Water Supply Department", "जल आपूर्ति विभाग", "पाणीपुरवठा विभाग", "OFF-WATER-01"),
    ("ROADS", "Roads & Public Works", "सड़क एवं लोक निर्माण विभाग", "रस्ते व सार्वजनिक बांधकाम विभाग", "OFF-ROADS-01"),
    ("SWM", "Solid Waste Management", "ठोस अपशिष्ट प्रबंधन विभाग", "घनकचरा व्यवस्थापन विभाग", "OFF-SWM-01"),
    ("ELEC", "Electricity & Street Lighting", "विद्युत एवं स्ट्रीट लाइट विभाग", "वीज व पथदिवे विभाग", "OFF-ELEC-01"),
    ("DRAIN", "Drainage & Sewerage", "जल निकासी एवं सीवरेज विभाग", "मलनिःसारण विभाग", "OFF-DRAIN-01"),
    ("HEALTH", "Public Health", "जन स्वास्थ्य विभाग", "सार्वजनिक आरोग्य विभाग", "OFF-HEALTH-01"),
    ("REVENUE", "Revenue & Property Tax", "राजस्व एवं संपत्ति कर विभाग", "महसूल व मालमत्ता कर विभाग", "OFF-REVENUE-01"),
    ("TOWNPLAN", "Town Planning & Encroachment", "नगर नियोजन एवं अतिक्रमण विभाग", "नगररचना व अतिक्रमण विभाग", "OFF-TOWNPLAN-01"),
    ("TRANSPORT", "Public Transport", "सार्वजनिक परिवहन विभाग", "सार्वजनिक वाहतूक विभाग", "OFF-TRANSPORT-01"),
    ("VIGILANCE", "Vigilance & Anti-Corruption Cell", "सतर्कता एवं भ्रष्टाचार निरोधक प्रकोष्ठ", "दक्षता व भ्रष्टाचार प्रतिबंधक कक्ष", "OFF-VIGILANCE-01"),
    ("SAFETY", "Women & Child Safety Cell", "महिला एवं बाल सुरक्षा प्रकोष्ठ", "महिला व बाल सुरक्षा कक्ष", "OFF-SAFETY-01"),
    ("GENERAL", "Citizen Facilitation Centre", "नागरिक सुविधा केंद्र", "नागरिक सुविधा केंद्र", "OFF-GENERAL-01"),
]

# code, en, hi, mr, dept, sla_h, sensitive, hide_identity, threshold, auto_close, urgency, desc, kw_en, kw_hi, kw_mr
CATEGORIES = [
    ("WATER_SUPPLY", "No or irregular water supply", "पानी की आपूर्ति बाधित", "पाणीपुरवठा खंडित", "WATER", 48, 0, 0, 0.70, 1, "medium",
     "Taps dry, low pressure, irregular supply timings or pipeline leakage.",
     "water supply;no water;water;tap;pipeline;low pressure;water tanker;leakage;leak;dry", "पानी;नल;पाइपलाइन;पानी नहीं;टैंकर;लीकेज", "पाणी;नळ;पाइपलाइन;पाणी येत नाही;टँकर;गळती"),
    ("WATER_CONTAMINATION", "Contaminated or dirty water", "दूषित पानी", "दूषित पाणी", "WATER", 24, 0, 0, 0.70, 1, "high",
     "Muddy, foul-smelling or discoloured drinking water.",
     "dirty water;contaminated;muddy;smell;yellow water;foul;drinking water", "गंदा पानी;दूषित;बदबू;मटमैला", "गढूळ;दूषित;घाण पाणी;वास;पिण्याचे पाणी"),
    ("POTHOLE", "Potholes or damaged road", "सड़क में गड्ढे", "रस्त्यावर खड्डे", "ROADS", 120, 0, 0, 0.70, 1, "medium",
     "Potholes, broken road surface, damaged speed breakers.",
     "pothole;potholes;road damage;broken road;crater;road repair", "गड्ढा;गड्ढे;सड़क टूटी;सड़क खराब", "खड्डा;खड्डे;रस्ता खराब;रस्ता फुटला"),
    ("STREETLIGHT", "Streetlight not working", "स्ट्रीट लाइट खराब", "पथदिवा बंद", "ELEC", 72, 0, 0, 0.70, 1, "medium",
     "Street lights off, flickering or damaged poles.",
     "street light;streetlight;lamp post;dark street;light not working;pole", "स्ट्रीट लाइट;बत्ती;अंधेरा;खंभा", "पथदिवा;दिवा बंद;अंधार;स्ट्रीट लाईट;खांब"),
    ("POWER_OUTAGE", "Power outage or electrical hazard", "बिजली कटौती / खतरा", "वीज खंडित / धोका", "ELEC", 24, 0, 0, 0.70, 1, "high",
     "Power cuts, transformer faults, hanging or sparking live wires.",
     "power cut;no electricity;outage;transformer;live wire;sparking;electric shock", "बिजली;बिजली नहीं;ट्रांसफार्मर;तार;करंट", "वीज;लाईट गेली;रोहित्र;तार;शॉक"),
    ("GARBAGE", "Garbage not collected", "कचरा नहीं उठाया गया", "कचरा उचलला नाही", "SWM", 48, 0, 0, 0.70, 1, "medium",
     "Missed door-to-door collection, overflowing bins, illegal dumping.",
     "garbage;waste;trash;dustbin;rubbish;dump;collection van;not collected", "कचरा;कूड़ा;गंदगी;डस्टबिन;कूड़ेदान", "कचरा;कचराकुंडी;घाण;घंटागाडी"),
    ("DRAINAGE", "Blocked drain or waterlogging", "नाली जाम / जलभराव", "गटार तुंबले / पाणी साचले", "DRAIN", 48, 0, 0, 0.70, 1, "medium",
     "Clogged storm drains, waterlogged lanes after rain.",
     "drain;blocked drain;waterlogging;gutter;flooding;nallah", "नाली;नाला;जलभराव;जाम", "गटार;नाला;पाणी साचले;तुंबले"),
    ("SEWAGE", "Sewage overflow", "सीवर ओवरफ्लो", "सांडपाणी वाहणे", "DRAIN", 24, 0, 0, 0.70, 1, "high",
     "Overflowing manholes or sewage entering homes and roads.",
     "sewage;sewer;manhole;overflow;septic;sewage water", "सीवर;मैनहोल;सीवर का पानी;ओवरफ्लो", "सांडपाणी;मॅनहोल;ड्रेनेज;मैलापाणी"),
    ("MOSQUITO", "Mosquito breeding / fogging request", "मच्छर / फॉगिंग", "डास / धूरफवारणी", "HEALTH", 72, 0, 0, 0.70, 1, "medium",
     "Mosquito menace, stagnant water, dengue or malaria cases, fogging requests.",
     "mosquito;mosquitoes;dengue;malaria;fogging;stagnant water", "मच्छर;डेंगू;मलेरिया;फॉगिंग", "डास;डेंग्यू;मलेरिया;धूर फवारणी;धुरळणी"),
    ("STRAY_ANIMALS", "Stray animal menace", "आवारा पशु", "भटकी जनावरे", "HEALTH", 96, 0, 0, 0.70, 1, "medium",
     "Stray dogs, dog bites, stray cattle on roads.",
     "stray dog;stray dogs;dog bite;cattle;stray animals;cow", "आवारा कुत्ते;कुत्ते;पशु;कुत्ते ने काटा", "भटकी कुत्री;कुत्रा चावला;जनावरे;मोकाट"),
    ("PROPERTY_TAX", "Property tax or billing issue", "संपत्ति कर समस्या", "मालमत्ता कर समस्या", "REVENUE", 168, 0, 0, 0.75, 1, "low",
     "Wrong property tax assessment, missing receipts, billing errors.",
     "property tax;tax bill;assessment;receipt;wrong bill;tax", "संपत्ति कर;टैक्स;बिल;रसीद", "मालमत्ता कर;कर;बिल;पावती"),
    ("ENCROACHMENT", "Illegal construction or encroachment", "अवैध निर्माण / अतिक्रमण", "अनधिकृत बांधकाम / अतिक्रमण", "TOWNPLAN", 168, 0, 0, 0.75, 1, "medium",
     "Unauthorised construction, footpath or road encroachment.",
     "illegal construction;encroachment;footpath blocked;unauthorised;hawkers", "अवैध निर्माण;अतिक्रमण;कब्जा;फुटपाथ", "अनधिकृत बांधकाम;अतिक्रमण;फुटपाथ;फेरीवाले"),
    ("PUBLIC_TRANSPORT", "Public transport issue", "सार्वजनिक परिवहन समस्या", "सार्वजनिक वाहतूक समस्या", "TRANSPORT", 96, 0, 0, 0.70, 1, "low",
     "Bus delays, skipped stops, damaged bus shelters, route issues.",
     "bus;bus stop;conductor;route;bus late;bus shelter", "बस;बस स्टॉप;कंडक्टर;बस देर", "बस;बस थांबा;वाहक;बस उशिरा"),
    ("BRIBERY", "Bribery or corruption by an official", "रिश्वत / भ्रष्टाचार", "लाच / भ्रष्टाचार", "VIGILANCE", 72, 1, 1, 0.85, 0, "high",
     "An official demanded money, gifts or favours to perform a public service.",
     "bribe;bribery;corruption;demanded money;kickback;asked for money", "रिश्वत;घूस;भ्रष्टाचार;पैसे मांगे", "लाच;भ्रष्टाचार;पैसे मागितले;चिरीमिरी"),
    ("HARASSMENT", "Harassment / women and child safety", "उत्पीड़न / महिला एवं बाल सुरक्षा", "छळ / महिला व बाल सुरक्षा", "SAFETY", 24, 1, 1, 0.85, 0, "critical",
     "Harassment, stalking, unsafe public spaces, child labour or abuse.",
     "harassment;harass;stalking;unsafe;eve teasing;molest;abuse;child labour", "उत्पीड़न;छेड़छाड़;परेशान;असुरक्षित;बाल श्रम", "छळ;छेडछाड;त्रास;असुरक्षित;बालमजुरी"),
    ("GENERAL", "Other civic issue", "अन्य नागरिक समस्या", "इतर नागरी समस्या", "GENERAL", 120, 0, 0, 0.90, 1, "low",
     "Issues that do not fit any other category; always reviewed by a human.",
     "", "", ""),
]

WARDS = [
    ("Ward 1", "Shivaji Nagar", 18.5308, 73.8475), ("Ward 2", "Kasba Peth", 18.5196, 73.8553),
    ("Ward 3", "Station Road", 18.5286, 73.8741), ("Ward 4", "Gandhi Chowk", 18.5120, 73.8420),
    ("Ward 5", "Nehru Colony", 18.4990, 73.8610), ("Ward 6", "Ambedkar Nagar", 18.5420, 73.8890),
    ("Ward 7", "Laxmi Road", 18.5160, 73.8510), ("Ward 8", "Market Yard", 18.4870, 73.8650),
    ("Ward 9", "Indira Nagar", 18.5560, 73.8290), ("Ward 10", "Sai Colony", 18.4760, 73.8380),
    ("Ward 11", "Ganesh Peth", 18.5140, 73.8600), ("Ward 12", "MIDC Area", 18.5650, 73.9100),
]

FIRST = ["Aarti", "Rahul", "Sneha", "Vikram", "Pooja", "Amit", "Kavita", "Suresh", "Neha", "Rajesh", "Priya",
         "Sanjay", "Meena", "Anil", "Swati", "Deepak", "Asha", "Manoj", "Rekha", "Nitin", "Shalini", "Ganesh",
         "Sunita", "Prakash", "Varsha", "Mahesh", "Anjali", "Sachin"]
LAST = ["Patil", "Sharma", "Deshmukh", "Kulkarni", "Joshi", "Verma", "Pawar", "Shinde", "Gupta", "Jadhav",
        "Kale", "Singh", "More", "Bhosale", "Mishra", "Gaikwad"]

TEMPLATES: dict[str, dict[str, list[str]]] = {
    "WATER_SUPPLY": {
        "en": ["No water supply in {loc} for the last {n} days. Taps are completely dry.",
               "Water pressure is very low in {loc}; we get water only for 15 minutes in the morning.",
               "Pipeline leakage near {loc} is wasting water and our lane gets no supply."],
        "hi": ["{loc} में पिछले {n} दिनों से पानी नहीं आ रहा है। नल पूरी तरह सूखे हैं।",
               "{loc} में पानी का प्रेशर बहुत कम है, सुबह सिर्फ 15 मिनट पानी आता है।"],
        "mr": ["{loc} मध्ये गेल्या {n} दिवसांपासून पाणी येत नाही. नळ पूर्ण कोरडे आहेत.",
               "{loc} येथे पाइपलाइन गळती आहे आणि आमच्या गल्लीत पाणीपुरवठा होत नाही."],
    },
    "WATER_CONTAMINATION": {
        "en": ["Muddy, foul-smelling water is coming from the taps in {loc}. Children are falling sick.",
               "Yellow contaminated drinking water supplied in {loc} since {n} days."],
        "hi": ["{loc} में नल से गंदा और बदबूदार पानी आ रहा है। बच्चे बीमार हो रहे हैं।"],
        "mr": ["{loc} मध्ये नळाला गढूळ आणि वास येणारे पाणी येत आहे. मुले आजारी पडत आहेत."],
    },
    "POTHOLE": {
        "en": ["Huge potholes on the main road at {loc}. Two-wheelers are slipping every day.",
               "The road near {loc} is completely broken after the rains and needs repair."],
        "hi": ["{loc} की मुख्य सड़क पर बड़े गड्ढे हैं, रोज़ दोपहिया वाहन फिसल रहे हैं।"],
        "mr": ["{loc} येथील मुख्य रस्त्यावर मोठे खड्डे पडले आहेत, रोज दुचाकी घसरत आहेत."],
    },
    "STREETLIGHT": {
        "en": ["Streetlights on the lane near {loc} have not been working for {n} days. It is very dark at night.",
               "Three street light poles near {loc} are off, women feel unsafe walking at night."],
        "hi": ["{loc} के पास की गली में {n} दिनों से स्ट्रीट लाइट बंद है, रात को बहुत अंधेरा रहता है।"],
        "mr": ["{loc} जवळील गल्लीतील पथदिवे {n} दिवसांपासून बंद आहेत, रात्री खूप अंधार असतो."],
    },
    "POWER_OUTAGE": {
        "en": ["Frequent power cuts in {loc}; the transformer keeps tripping.",
               "A live wire is hanging low near {loc} and sparking. This is dangerous."],
        "hi": ["{loc} में बार-बार बिजली जा रही है, ट्रांसफार्मर खराब है।"],
        "mr": ["{loc} मध्ये वारंवार वीज जात आहे, रोहित्र बिघडले आहे."],
    },
    "GARBAGE": {
        "en": ["Garbage has not been collected in {loc} for {n} days and it is overflowing onto the road.",
               "The collection van has skipped our society in {loc} all week."],
        "hi": ["{loc} में {n} दिनों से कचरा नहीं उठाया गया, कचरा सड़क पर फैल रहा है।"],
        "mr": ["{loc} मध्ये {n} दिवसांपासून कचरा उचलला नाही, कचरा रस्त्यावर पसरला आहे."],
    },
    "DRAINAGE": {
        "en": ["The drain near {loc} is blocked and the lane is waterlogged after rain.",
               "Water stagnates knee-deep in {loc} because the gutter is choked."],
        "hi": ["{loc} के पास नाली जाम है और बारिश के बाद गली में जलभराव हो गया है।"],
        "mr": ["{loc} जवळ गटार तुंबले आहे आणि पावसानंतर गल्लीत पाणी साचले आहे."],
    },
    "SEWAGE": {
        "en": ["Sewage is overflowing from the manhole at {loc} into houses.",
               "Sewer line choked in {loc}; dirty water is flowing on the road for {n} days."],
        "hi": ["{loc} में मैनहोल से सीवर का पानी घरों में घुस रहा है।"],
        "mr": ["{loc} येथे मॅनहोलमधून सांडपाणी घरात शिरत आहे."],
    },
    "MOSQUITO": {
        "en": ["Heavy mosquito breeding in {loc}; several dengue cases reported. Please arrange fogging.",
               "Stagnant water in the open plot at {loc} is breeding mosquitoes."],
        "hi": ["{loc} में मच्छरों का प्रकोप है, कई डेंगू के मामले हैं। कृपया फॉगिंग करवाएं।"],
        "mr": ["{loc} मध्ये डासांचा उपद्रव वाढला आहे, डेंग्यूचे रुग्ण आहेत. धूर फवारणी करावी."],
    },
    "STRAY_ANIMALS": {
        "en": ["A pack of stray dogs in {loc} chased children; one child was bitten.",
               "Stray cattle sit in the middle of the road at {loc}, causing accidents."],
        "hi": ["{loc} में आवारा कुत्तों ने बच्चों का पीछा किया, एक बच्चे को काट लिया।"],
        "mr": ["{loc} मध्ये भटक्या कुत्र्यांनी मुलांचा पाठलाग केला, एका मुलाला कुत्रा चावला."],
    },
    "PROPERTY_TAX": {
        "en": ["My property tax bill for the house in {loc} shows double the correct amount.",
               "I paid property tax online but no receipt was generated for my property in {loc}."],
        "hi": ["{loc} के मेरे घर का संपत्ति कर बिल गलत है, राशि दोगुनी दिखा रहा है।"],
        "mr": ["{loc} मधील माझ्या घराचे मालमत्ता कर बिल चुकीचे आहे, रक्कम दुप्पट दाखवली आहे."],
    },
    "ENCROACHMENT": {
        "en": ["Illegal construction on the footpath near {loc} is blocking pedestrians.",
               "Hawkers have encroached the entire footpath at {loc}."],
        "hi": ["{loc} के पास फुटपाथ पर अवैध निर्माण हो रहा है।"],
        "mr": ["{loc} जवळ फुटपाथवर अनधिकृत बांधकाम सुरू आहे."],
    },
    "PUBLIC_TRANSPORT": {
        "en": ["Buses on the route through {loc} are always late and skip the stop.",
               "The bus shelter at {loc} is broken and has no seating."],
        "hi": ["{loc} से जाने वाली बसें हमेशा देर से आती हैं और स्टॉप पर नहीं रुकतीं।"],
        "mr": ["{loc} मार्गे जाणाऱ्या बस नेहमी उशिरा येतात आणि थांब्यावर थांबत नाहीत."],
    },
    "BRIBERY": {
        "en": ["An official at the ward office for {loc} demanded money to process my water connection.",
               "The clerk asked for a bribe to issue my certificate at the {loc} office."],
        "hi": ["{loc} वार्ड कार्यालय के अधिकारी ने पानी कनेक्शन के लिए रिश्वत मांगी।"],
        "mr": ["{loc} प्रभाग कार्यालयातील अधिकाऱ्याने नळजोडणीसाठी लाच मागितली."],
    },
    "HARASSMENT": {
        "en": ["A group of men harass women near the bus stop at {loc} every evening.",
               "Children are being made to work in a shop at {loc}; this looks like child labour."],
        "hi": ["{loc} के बस स्टॉप के पास रोज़ शाम कुछ लोग महिलाओं से छेड़छाड़ करते हैं।"],
        "mr": ["{loc} येथील बस थांब्याजवळ रोज संध्याकाळी काही लोक महिलांची छेडछाड करतात."],
    },
    "GENERAL": {
        "en": ["The public toilet at {loc} is locked during the day.",
               "The community hall at {loc} has not been cleaned for weeks."],
        "hi": ["{loc} का सार्वजनिक शौचालय दिन में बंद रहता है।"],
        "mr": ["{loc} येथील सार्वजनिक शौचालय दिवसा बंद असते."],
    },
}

RESOLUTIONS = {
    "WATER_SUPPLY": ["Valve at the zonal reservoir was faulty and replaced; supply restored on normal timings.",
                     "Leaking pipeline section repaired; tanker supplied for two days in between."],
    "WATER_CONTAMINATION": ["Cross-connection with drainage line found and isolated; pipeline flushed and chlorinated; water sample tested safe."],
    "POTHOLE": ["Potholes filled with cold-mix asphalt; full resurfacing added to the next works plan."],
    "STREETLIGHT": ["Faulty LED fittings and a damaged cable replaced; lights verified working at night."],
    "POWER_OUTAGE": ["Overloaded transformer upgraded; hanging line re-strung and insulated."],
    "GARBAGE": ["Collection route reassigned and missed points cleared; daily pickup resumed."],
    "DRAINAGE": ["Drain desilted with a jetting machine; outlet cleared to stop waterlogging."],
    "SEWAGE": ["Choked sewer line cleared and manhole cover replaced; area disinfected."],
    "MOSQUITO": ["Fogging and larvicide spraying done; stagnant water drained from the open plot."],
    "STRAY_ANIMALS": ["Animal control team caught the dogs for sterilisation and vaccination; cattle owner fined."],
    "PROPERTY_TAX": ["Assessment re-verified and corrected bill issued; payment receipt regenerated."],
    "ENCROACHMENT": ["Site inspected; notice served and the encroachment removed by the anti-encroachment squad."],
    "PUBLIC_TRANSPORT": ["Route schedule revised and the crew counselled; shelter repair work order issued."],
    "BRIBERY": ["Complaint verified by the vigilance cell under confidentiality; departmental inquiry initiated by the competent authority."],
    "HARASSMENT": ["Safety cell coordinated patrolling and CCTV at the location; case referred to the competent authority."],
    "GENERAL": ["Matter forwarded to the responsible section and resolved after site visit."],
}

DEPT_SPEED = {"ROADS": 1.35, "TOWNPLAN": 1.25, "WATER": 0.95, "SWM": 0.8, "ELEC": 0.9, "DRAIN": 1.1,
              "HEALTH": 0.9, "REVENUE": 1.15, "TRANSPORT": 1.0, "VIGILANCE": 1.2, "SAFETY": 0.85, "GENERAL": 1.0}

CATEGORY_WEIGHTS = {"WATER_SUPPLY": 14, "WATER_CONTAMINATION": 5, "POTHOLE": 12, "STREETLIGHT": 9, "POWER_OUTAGE": 6,
                    "GARBAGE": 13, "DRAINAGE": 8, "SEWAGE": 5, "MOSQUITO": 6, "STRAY_ANIMALS": 5, "PROPERTY_TAX": 4,
                    "ENCROACHMENT": 4, "PUBLIC_TRANSPORT": 4, "BRIBERY": 2, "HARASSMENT": 2, "GENERAL": 3}


def officers(rng: random.Random) -> list[dict]:
    rows = []
    demo_emails = {"OFF-WATER-01": "officer.water@example.org", "OFF-ROADS-01": "officer.roads@example.org",
                   "OFF-SAFETY-01": "officer.safety@example.org", "OFF-SWM-01": "officer.swm@example.org"}
    for code, name, *_ in DEPARTMENTS:
        count = 3 if code in {"WATER", "ROADS", "SWM", "ELEC", "DRAIN"} else 2
        for i in range(1, count + 1):
            ocode = f"OFF-{code}-{i:02d}"
            wards = [] if i == 1 else sorted(rng.sample([w[0] for w in WARDS], 6), key=lambda w: int(w.split()[1]))
            rows.append({
                "officer_code": ocode,
                "name": f"{rng.choice(FIRST)} {rng.choice(LAST)}",
                "department_code": code,
                "designation": "Executive Engineer" if i == 1 else "Junior Engineer" if code in {"WATER", "ROADS", "DRAIN", "ELEC"} else "Ward Officer",
                "email": demo_emails.get(ocode, f"{ocode.lower()}@example.org"),
                "phone": f"+91-90000{rng.randint(10000, 99999)}",
                "wards": "|".join(wards),
                "max_active_cases": 30 if i == 1 else 20,
                "handles_sensitive": "true" if code in {"SAFETY", "VIGILANCE"} else "false",
            })
    return rows


def history(rng: random.Random, n: int = 720) -> list[dict]:
    cats = {c[0]: c for c in CATEGORIES}
    codes = list(CATEGORY_WEIGHTS)
    weights = [CATEGORY_WEIGHTS[c] for c in codes]
    rows = []
    for i in range(1, n + 1):
        code = rng.choices(codes, weights)[0]
        # Seeded hotspots so recurrence analysis has real signal.
        if rng.random() < 0.10:
            code, ward = "WATER_SUPPLY", WARDS[1]
            days_ago = rng.uniform(1, 60)
        elif rng.random() < 0.07:
            code, ward = "POTHOLE", WARDS[7]
            days_ago = rng.uniform(1, 75)
        else:
            ward = rng.choice(WARDS)
            days_ago = rng.uniform(3, 365)
        cat = cats[code]
        lang = rng.choices(["en", "hi", "mr"], [0.5, 0.25, 0.25])[0]
        tmpl = rng.choice(TEMPLATES[code].get(lang) or TEMPLATES[code]["en"])
        loc = f"{ward[1]}"
        desc = tmpl.format(loc=loc, n=rng.randint(2, 9))
        created = NOW - timedelta(days=days_ago, hours=rng.uniform(0, 23))
        sla = cat[5]
        speed = DEPT_SPEED[cat[4]]
        hours = max(2.0, rng.lognormvariate(math.log(sla * 0.72 * speed), 0.45))
        resolved = created + timedelta(hours=hours)
        if resolved > NOW:
            resolved = NOW - timedelta(hours=1)
        lat = ward[2] + rng.uniform(-0.006, 0.006)
        lon = ward[3] + rng.uniform(-0.006, 0.006)
        dept_offs = 3 if cat[4] in {"WATER", "ROADS", "SWM", "ELEC", "DRAIN"} else 2
        rows.append({
            "grievance_ref": f"SYN-H-{i:05d}",
            "title": cat[1],
            "description": desc,
            "language": lang,
            "category_code": code,
            "department_code": cat[4],
            "ward": ward[0],
            "location": f"{ward[1]}, {ward[0]}, Demo City",
            "latitude": f"{lat:.6f}",
            "longitude": f"{lon:.6f}",
            "urgency": cat[10],
            "status": "CLOSED" if rng.random() < 0.9 else "RESOLVED",
            "created_at": created.isoformat(timespec="seconds"),
            "resolved_at": resolved.isoformat(timespec="seconds"),
            "resolution_summary": rng.choice(RESOLUTIONS[code]),
            "officer_code": f"OFF-{cat[4]}-{rng.randint(1, dept_offs):02d}",
            "citizen_rating": rng.choices([5, 4, 3, 2, 1], [35, 30, 18, 10, 7])[0],
        })
    return rows


def write(name: str, rows: list[dict]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / name).open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {name}: {len(rows)} rows")


def main() -> None:
    rng = random.Random(SEED)
    write("departments.csv", [
        {"department_code": c, "name": n, "name_hi": hi, "name_mr": mr,
         "email": f"{c.lower()}@democity.example.org", "phone": f"+91-20-2550{i:04d}",
         "head_officer_code": head, "escalation_contact": f"commissioner.office@democity.example.org"}
        for i, (c, n, hi, mr, head) in enumerate(DEPARTMENTS, start=1)
    ])
    write("categories.csv", [
        {"category_code": c[0], "name_en": c[1], "name_hi": c[2], "name_mr": c[3], "department_code": c[4],
         "sla_hours": c[5], "is_sensitive": "true" if c[6] else "false", "hide_identity": "true" if c[7] else "false",
         "confidence_threshold": c[8], "auto_close_allowed": "true" if c[9] else "false", "default_urgency": c[10],
         "description": c[11], "keywords_en": c[12], "keywords_hi": c[13], "keywords_mr": c[14]}
        for c in CATEGORIES
    ])
    write("officers.csv", officers(rng))
    write("grievance_history.csv", history(rng))
    write("wards.csv", [{"ward": w[0], "locality": w[1], "latitude": w[2], "longitude": w[3]} for w in WARDS])
    (OUT / "README.md").write_text(
        "# SYNTHETIC demo datasets\n\n"
        "Generated by `backend/scripts/generate_synthetic_data.py` (seed "
        f"{SEED}). **These are not official HackFusion datasets.** All names, places, phone numbers and "
        "complaints are fictional. Every row is imported with `data_source = SYNTHETIC` and shown with a "
        "SYNTHETIC badge in the UI. Replace them through Admin → Datasets or `python -m app.cli import` "
        "once the official Category Master, Grievance History and Department Directory are available.\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
