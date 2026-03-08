## 🔥 Οδηγός Ρύθμισης Firebase Realtime Database

Αυτό το αρχείο περιέχει βήμα-βήμα οδηγίες για να ρυθμίσεις το Firebase Realtime Database για το quiz app.

---

## 📋 Βήμα 1: Εγκατάσταση Dependencies

### 1.1 Εγκατάσταση Node.js modules
Ανοίξτε terminal και τρέξτε:
```bash
npm install
```

---

## 🗄️ Βήμα 2: Δημιουργία Firebase Project

### 2.1 Σύνδεση στο Firebase Console
- Πήγαινε στο: https://console.firebase.google.com/
- Πάτα **"Add project"**
- Βάλε όνομα (π.χ. "alwsi-quiz-db")
- Πάτα **Continue**

### 2.2 Ενεργοποίηση Google Analytics (προαιρετικό)
- Μπορείς να το αφήσεις αποενεργοποιημένο για τώρα
- Πάτα **Create project**
- Περίμενε 1-2 λεπτά να δημιουργηθεί

---

## 🌐 Βήμα 3: Δημιουργία Web App & Λήψη API Keys

### 3.1 Προσθήκη Web App
- Στο Firebase console, πάτα το εικονίδιο **"<>" (Web)**
- Βάλε όνομα (π.χ. "quiz-app")
- Πάτα **Register app**

### 3.2 Αντιγραφή Firebase Config
Θα σου εμφανιστεί κώδικας σαν:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC8gHRpEppfgfkE-CJHiATUssbbuA9IYGE",
  authDomain: "alwsi-quiz-db.firebaseapp.com",
  projectId: "alwsi-quiz-db",
  storageBucket: "alwsi-quiz-db.firebasestorage.app",
  messagingSenderId: "783280722866",
  appId: "1:783280722866:web:8c5b9d83badc19fac64aab",
  databaseURL: "https://alwsi-quiz-db-default-rtdb.firebaseio.com"
};
```

### 3.3 Δημιουργία .env.local
Δημιούργησε ένα αρχείο `.env.local` στο root του project με:
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your_project_id-default-rtdb.firebaseio.com
```

⚠️ **ΣΗΜΑΝΤΙΚΟ**: Πρέπει να προσθέσεις το `databaseURL` για Realtime Database!

---

## 🗄️ Βήμα 4: Ενεργοποίηση Realtime Database

### 4.1 Μετάβαση στο Realtime Database
- Στο Firebase console, από το αριστερό μενού πάτα **"Realtime Database"**
- Πάτα **"Create Database"**

### 4.2 Ρύθμιση Ασφαλείας
- Επίλεξε **"Start in test mode"** (για τώρα, επιτρέπει ανάγνωση/εγγραφή χωρίς authentication)
- Πάτα **Done**

### 4.3 Ρυθμίσεις Security Rules
Μετά το create, πήγαινε στο tab **Rules** και αντικατέστησε με:

```json
{
  "rules": {
    ".read": true,
    ".write": true,
    "rooms": {
      ".read": true,
      ".write": true
    },
    "players": {
      ".read": true,
      ".write": true
    },
    "results": {
      ".read": true,
      ".write": true
    }
  }
}
```

Πάτα **Publish**.

---

## ⚠️ Security Rules Προτάσεις (για Production)

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": "auth != null"
      }
    },
    "players": {
      "$playerId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

---

## 🧪 Βήμα 5: Δοκιμή Λειτουργίας

### 5.1 Έναρξη Dev Server
```bash
npm run dev
```

### 5.2 Δοκιμή Multiplayer
1. Πάτα **"Δημιουργία Δωματίου"**
2. Πάτα **"Δημιουργία Κωδικού"** (π.χ. ABC123)
3. Άνοιξε άλλο browser tab ή incognito window
4. Πάτα **"Είσοδος σε Δωμάτιο"**
5. Βάλε τον ίδιο κωδικό και όνομα παίκτη
6. Στην πρώτη tab, πάτα **"Ξεκίνα Παιχνίδι"**
7. Απάντησε ερωτήσεις και δες το leaderboard να ενημερώνεται

---

## 📊 Realtime Database Data Structure

### `rooms/{roomId}`
```json
{
  "code": "ABC123",
  "hostId": "host-1704067200000",
  "questions": [...],
  "currentQuestionIndex": 0,
  "status": "waiting|active|finished",
  "timer": 30,
  "createdAt": "2024-01-01T12:00:00Z"
}
```

### `players/{playerId}`
```json
{
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

### `results/{resultId}`
```json
{
  "score": 7,
  "total": 10,
  "timestamp": "2024-01-01T12:05:00Z"
}
```

---

## ✅ Checklist Ολοκλήρωσης

- [ ] `npm install` ολοκληρώθηκε
- [ ] `.env.local` δημιουργήθηκε με σωστές τιμές
- [ ] Firebase project δημιουργημένο
- [ ] Web app προστέθηκε
- [ ] Realtime Database ενεργοποιημένη
- [ ] Security rules δημοσιεύθηκαν
- [ ] Dev server δοκιμάστηκε τοπικά
- [ ] Multiplayer δοκιμάστηκε (2 browser tabs)

---

## 🆘 Troubleshooting

**Q: "Module not found firebase"**
→ Εκτέλεσε `npm install`

**Q: "Cannot read property of undefined in Database"**
→ Έλεγχος ότι `.env.local` έχει σωστές τιμές και το `databaseURL` είναι σωστό

**Q: "Permission denied" σφάλμα**
→ Έλεγχος security rules (πρέπει να είναι test mode)

**Q: "Leaderboard δεν ενημερώνεται"**
→ Έλεγχος browser console για σφάλματα, verify Realtime Database listeners

**Q: "Λείπει το .env.local"**
→ Δημιούργησε το αρχείο `.env.local` στο root με τις μεταβλητές που φαίνονται παραπάνω

---

**Τώρα είσαι έτοιμος! Τρέξε `npm install`, δημιούργησε το `.env.local` και δοκίμασε το app!** 🎉
