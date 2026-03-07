## 🔥 Οδηγός Ρύθμισης Firebase & Firestore

Αυτό το αρχείο περιέχει βήμα-βήμα οδηγίες για να ρυθμίσεις το Firebase database για το quiz app.

---

## 📋 Βήμα 1: Δημιουργία Firebase Project

### 1.1 Σύνδεση στο Firebase Console
- Πήγαινε στο: https://console.firebase.google.com/
- Πάτα **"Add project"**
- Βάλε όνομα (π.χ. "alosiqu-iz-quiz")
- Πάτα **Continue**

### 1.2 Ενεργοποίηση Google Analytics (προαιρετικό)
- Μπορείς να το αφήσεις αποενεργοποιημένο για τώρα
- Πάτα **Create project**
- Περίμενε 1-2 λεπτά να δημιουργηθεί

---

## 🌐 Βήμα 2: Δημιουργία Web App & Λήψη API Keys

### 2.1 Προσθήκη Web App
- Στο Firebase console, πάτα το εικονίδιο **"<>" (Web)**
- Βάλε όνομα (π.χ. "quiz-app")
- Πάτα **Register app**

### 2.2 Αντιγραφή Firebaseonfig
Θα σου εμφανιστεί κώδικας σαν:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyACFE0zgKuew9wzloh1R9PenVSlMTtrenM",
  authDomain: "alwsiqu-iz.firebaseapp.com",
  projectId: "alwsiqu-iz",
  storageBucket: "alwsiqu-iz.firebasestorage.app",
  messagingSenderId: "67049645092",
  appId: "1:67049645092:web:dcb94bbdcdbc12f49964b1"
};
```

### 2.3 Ενημέρωση .env.local
Άνοιξε το αρχείο `/workspaces/alosiqu-iz/.env.local` (το έχεις ήδη):
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyACFE0zgKuew9wzloh1R9PenVSlMTtrenM
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=alwsiqu-iz.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=alwsiqu-iz
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=alwsiqu-iz.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=67049645092
NEXT_PUBLIC_FIREBASE_APP_ID=1:67049645092:web:dcb94bbdcdbc12f49964b1
```

---

## 🗄️ Βήμα 3: Δημιουργία Firestore Database

### 3.1 Ενεργοποίηση Firestore
- Στο Firebase console, πήγαινε σε **Firestore Database** (αριστερά)
- Πάτα **Create database**
- Επίλεξε:
  - **Location**: Europe (ή κοντινότερη περιοχή)
  - **Mode**: Start in **test mode** (προσ)
  - Πάτα **Create**

### 3.2 Ρύθμιση Security Rules
Μετά το create, πήγαινε στο tab **Rules** και αντικατάστησε το περιεχόμενο με:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow public read/write for rooms (for demo purposes)
    // In production, restrict these properly
    match /rooms/{roomId} {
      allow create: if true;
      allow read: if true;
      allow update: if true;
      allow delete: if false;
    }
    
    // Allow players to create and update their own entries
    match /players/{playerId} {
      allow create: if true;
      allow read: if true;
      allow update: if true;
      allow delete: if false;
    }
    
    // Allow results to be created
    match /results/{resultId} {
      allow create: if true;
      allow read: if false;
      allow update: if false;
      allow delete: if false;
    }
  }
}
```

Πάτα **Publish** στο κάτω δεξιά.

---

## 📁 Βήμα 4: Δημιουργία Collections (δεν χρειάζεται χειροκίνητα)

Το app δημιουργεί αυτόματα τις collections όταν πρώτη φορά γράψει δεδομένα:
- **Rooms**: Αποθηκεύει τα δωμάτια (κωδικός, ερωτήσεις, status)
- **Players**: Αποθηκεύει τους παίκτες ανά room (όνομα, σκορ, απαντήσεις)
- **Results**: Αποθηκεύει τελικά αποτελέσματα (προαιρετικό)

**ΔΕΝ χρειάζεται να τις δημιουργήσεις μη επι χειρισμού** – θα γίνει αυτόματα!

---

## 🧪 Βήμα 5: Δοκιμή Λειτουργίας

### 5.1 Έναρξη Dev Server
```bash
npm run dev
```

### 5.2 Δοκιμή Solo Quiz
- Πήγαινε σε http://localhost:3001
- Πάτα **"Μοναχικό Παιχνίδι"**
- Απάντησε λίγες ερωτήσεις
- Δες αν φορτώνεται σωστά

### 5.3 Δοκιμή Multiplayer
1. Πάτα **"Δημιουργία Δωματίου"**
2. Πάτα **"Δημιουργία Κωδικού"** (π.χ. ABC123)
3. Άνοιξε άλλο browser tab ή incognito window
4. Πάτα **"Είσοδος σε Δωμάτιο"**
5. Βάλε τον ίδιο κωδικό και όνομα παίκτη
6. Στην πρώτη tab, πάτα **"Ξεκίνα Παιχνίδι"**
7. Απάντησε ερωτήσεις και δες το leaderboard να ενημερώνεται

### 5.4 Έλεγχος Firestore
- Πήγαινε στο Firebase console
- Πήγαινε σε **Firestore Database > Data**
- Δές τα documents που δημιουργήθηκαν αυτόματα:
  - `rooms/{code}` – δωμάτιο
  - `players/{playerId}` – παίκτης

---

## ⚠️ Security Rules Προτάσεις

Τα παραπάνω rules είναι **πολύ ανοιχτά** (test mode). Για production:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      // Only allow creation and reading
      allow create: if request.auth != null;
      allow read: if true;
      allow update: if request.resource.data.hostId == request.auth.uid;
      allow delete: if false;
    }
    
    match /players/{playerId} {
      allow create: if true; // Anonymous join
      allow read: if true;
      allow update: if resource.data.id == request.auth.uid;
      allow delete: if false;
    }
  }
}
```

Αλλά για τώρα στο test mode είναι εντάξει – **ενεργοποιήστε αυθεντικοποίηση αργότερα**.

---

## 🚀 Βήμα 6: Deploy στο Vercel

### 6.1 Ορισμός Environment Variables
1. Πήγαινε στο Vercel dashboard του project σου
2. Πήγαινε σε **Settings > Environment Variables**
3. Πρόσθεσε τις ίδιες μεταβλητές (αντιγράφησε από `.env.local`):
   - NEXT_PUBLIC_FIREBASE_API_KEY
   - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
   - NEXT_PUBLIC_FIREBASE_PROJECT_ID
   - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
   - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
   - NEXT_PUBLIC_FIREBASE_APP_ID

### 6.2 Redeploy
- Πήγαινε στο **Deployments** tab
- Πάτα **Redeploy** ή κάνε `git push origin main`
- Περίμενε το build

---

## 📊 Firestore Data Structure

Ότι αποθηκεύεται στη βάση:

### `rooms/{code}` Document
```json
{
  "code": "ABC123",
  "hostId": "host-1704067200000",
  "questions": [...],
  "currentQuestionIndex": 0,
  "status": "waiting|active|finished",
  "timer": 30,
  "createdAt": 2024-01-01T12:00:00Z
}
```

### `players/{playerId}` Document
```json
{
  "id": "player-123",
  "name": "Γιάννης",
  "score": 5,
  "roomId": "room-id",
  "answers": [
    {
      "questionId": "q1",
      "answerId": "d",
      "time": 15
    }
  ]
}
```

### `results/{resultId}` Document
```json
{
  "score": 7,
  "total": 10,
  "timestamp": 2024-01-01T12:05:00Z
}
```

---

## ✅ Checklist Ολοκλήρωσης

- [ ] Firebase project δημιουργημένο
- [ ] Web app προστέθηκε
- [ ] API keys αντιγράφηκαν σε `.env.local`
- [ ] Firestore database ενεργοποιημένο
- [ ] Security rules δημοσιεύθηκαν
- [ ] Dev server δοκιμάστηκε τοπικά
- [ ] Multiplayer δοκιμάστηκε (2 browser tabs)
- [ ] Data εμφανίστηκε στο Firestore console
- [ ] Environment variables ορίστηκαν στο Vercel
- [ ] Production site deployed & live

---

## 🆘 Troubleshooting

**Q: "Module not found firebase"**
→ Εκτέλεσε `npm install firebase`

**Q: "Cannot read property of undefined in Firestore"**
→ Έλεγχος ότι `.env.local` έχει σωστές τιμές

**Q: "Permission denied" σφάλμα**
→ Έλεγχος security rules (πρέπει να είναι test mode)

**Q: "Leaderboard δεν ενημερώνεται"**
→ Έλεγχος browser console για σφάλματα, verify Firestore listeners

---

**Τώρα είσαι έτοιμος! Δημιούργησε το Firebase project και δοκίμασε το app!** 🎉
