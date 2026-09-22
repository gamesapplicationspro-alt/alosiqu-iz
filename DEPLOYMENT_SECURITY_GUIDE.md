# Ασφαλές deployment: Firebase Realtime Database + Vercel

Τα keys με πρόθεμα NEXT_PUBLIC_ είναι web configuration και θα είναι ορατά από τον browser. Δεν είναι secrets. Τα FIREBASE_ADMIN_* και CRON_SECRET είναι secrets: δεν τα στέλνεις με email, δεν τα βάζεις σε Git και δεν τα κάνεις ποτέ NEXT_PUBLIC_.

## 1. Backup πριν από οποιαδήποτε αλλαγή

1. Άνοιξε **Firebase Console** και επίλεξε το project που αντιστοιχεί στο NEXT_PUBLIC_FIREBASE_PROJECT_ID του Vercel.
2. Πήγαινε **Build → Realtime Database → Data**.
3. Από το μενού των τριών τελειών διάλεξε **Export JSON** και αποθήκευσε το αρχείο σε ασφαλές, ιδιωτικό φάκελο. Μην το ανεβάσεις στο repository.
4. Επιβεβαίωσε ότι βλέπεις τα παλιά rooms, players ή quizHistory. Δεν τα διαγράφεις τώρα. Η νέα εφαρμογή γράφει αποκλειστικά κάτω από v3 και τα παλιά δεδομένα καθαρίζονται από το καθημερινό cron.

## 2. Firebase Console

### Realtime Database

1. Στο **Build → Realtime Database → Rules**, άνοιξε το τοπικό database.rules.json, αντέγραψε μόνο το περιεχόμενό του, επικόλλησέ το και πάτησε **Publish**.
2. Αυτοί οι κανόνες κόβουν κάθε direct write από browser. Είναι αναμενόμενο να σταματήσει προσωρινά η παλιά έκδοση της σελίδας μέχρι να γίνει deploy η νέα.
3. Μετά το deploy, στο **Data** θα εμφανίζεται η νέα δομή v3. Μην αλλάζεις κόμβους χειροκίνητα εκεί.

### Anonymous Authentication

1. Πήγαινε **Build → Authentication → Sign-in method**.
2. Πάτησε **Add new provider**, διάλεξε **Anonymous**, πάτησε **Enable** και **Save**.
3. Οι μαθητές δεν θα δουν φόρμα σύνδεσης. Κάθε browser παίρνει προσωρινό UID, ώστε οι Rules να ξεχωρίζουν host, παίκτη και ξένο χρήστη.

### App Check

1. Πήγαινε **Build → App Check**, βρες ή καταχώρισε το Web app σου.
2. Διάλεξε provider **reCAPTCHA Enterprise** και ακολούθησε το link για να δημιουργήσεις score-based web key στο ίδιο Google Cloud project. Δήλωσε τα production domains σου και το *.vercel.app για preview δοκιμές.
3. Αντέγραψε το site key στο NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY.
4. Κάνε πρώτα deploy και δοκίμασε create/join από δύο browsers. Στο App Check κράτησε αρχικά το Realtime Database σε **Monitor** και επιβεβαίωσε verified requests.
5. Μόνο τότε πάτησε **Enforce** για Realtime Database.

### Server service account

1. Πήγαινε **Project settings (γρανάζι) → Service accounts**.
2. Πάτησε **Generate new private key**, επιβεβαίωσε και κατέβασε το JSON μία φορά.
3. Από το JSON χρησιμοποίησε μόνο project_id, client_email, private_key για τα τρία FIREBASE_ADMIN_* variables.
4. Αποθήκευσε το JSON σε password manager ή ασφαλές offline vault και διέγραψέ το από Downloads. Δεν το ανεβάζεις ούτε το επικολλάς σε κώδικα.

## 3. Vercel Environment Variables

Στο **Vercel → Project → Settings → Environment Variables**, πρόσθεσε όλα τα ακόλουθα για **Production**. Για Preview χρησιμοποίησε ξεχωριστό Firebase staging project και άλλο service account.

| Variable | Τιμή |
|---|---|
| NEXT_PUBLIC_FIREBASE_API_KEY | apiKey από Firebase Web App settings |
| NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN | authDomain από Firebase Web App settings |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID | projectId από Firebase Web App settings |
| NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET | storageBucket από Firebase Web App settings |
| NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID | messagingSenderId από Firebase Web App settings |
| NEXT_PUBLIC_FIREBASE_APP_ID | appId από Firebase Web App settings |
| NEXT_PUBLIC_FIREBASE_DATABASE_URL | ακριβές Realtime Database URL |
| NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY | reCAPTCHA Enterprise site key |
| FIREBASE_ADMIN_PROJECT_ID | project_id από service-account JSON |
| FIREBASE_ADMIN_CLIENT_EMAIL | client_email από service-account JSON |
| FIREBASE_ADMIN_PRIVATE_KEY | ολόκληρο private_key από JSON, μαζί με BEGIN/END και line breaks |
| CRON_SECRET | νέο τυχαίο secret τουλάχιστον 32 bytes, από password manager |

Μην προσθέσεις εισαγωγικά στο FIREBASE_ADMIN_PRIVATE_KEY εκτός αν τα παρέχει το JSON. Αν το Vercel το εμφανίσει σε μία γραμμή με literal \\n, ο κώδικας το μετατρέπει με ασφάλεια. Πάτησε **Save**, έλεγξε ότι τα admin variables δεν έχουν NEXT_PUBLIC_, και κάνε νέο deploy.

## 4. Production sequence

1. Πάρε το backup του βήματος 1.
2. Βάλε τα Vercel variables και βεβαιώσου ότι το GitHub repository δεν έχει .env.local ή service-account JSON.
3. Δημοσίευσε τα database.rules.json. Η παλιά έκδοση θα είναι μη λειτουργική μέχρι το νέο deploy — αυτό είναι το ασφαλές maintenance window.
4. Κάνε push το νέο commit στο main ή Vercel **Deploy** από το νέο commit.
5. Στο **Deployments → τελευταίο deployment → Functions logs**, βεβαιώσου ότι δεν υπάρχει Missing required server environment variable.
6. Δοκίμασε host σε ένα κανονικό browser και player σε Incognito/δεύτερη συσκευή: δημιουργία, είσοδο, λειτουργία παρατήρησης, 20-second timer, μία απάντηση, αποκάλυψη, κατάταξη και τελικό history.
7. Ενεργοποίησε App Check enforcement μόνο μετά από αυτό το test.

## 5. Καθημερινός καθαρισμός και έλεγχος

- Το vercel.json προγραμματίζει /api/cron/purge κάθε ημέρα στις 03:00 UTC. Το Vercel στέλνει το CRON_SECRET ως Authorization header. Στο Vercel άνοιξε **Settings → Cron Jobs** και επιβεβαίωσε ότι εμφανίζεται το job.
- Στο δωρεάν Hobby plan το cron τρέχει μία φορά την ημέρα και η ακριβής ώρα μπορεί να αποκλίνει. Η πρόσβαση λήγει ακριβώς στις 24 ώρες από τους database rules· η φυσική διαγραφή γίνεται στο επόμενο cron run.
- Κάθε μήνα έλεγχε Firebase **Authentication users**, App Check metrics, Realtime Database usage και Vercel Functions logs. Αν δεις κακόβουλα requests, άλλαξε CRON_SECRET και κράτησε App Check enforced.
- Στο Google Cloud Console περιόρισε το Firebase web API key σε HTTP referrers των production domains σου. Αυτό συμπληρώνει — δεν αντικαθιστά — Auth, App Check και Rules.
