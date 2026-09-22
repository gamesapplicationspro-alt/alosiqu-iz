export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-100 via-yellow-50 to-orange-100 font-sans dark:from-amber-900 dark:via-yellow-900 dark:to-orange-900 animate-fade-in">
      <main className="flex min-h-screen w-full max-w-6xl flex-col items-center justify-center py-8 px-4 sm:px-6 lg:px-8 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-lg shadow-2xl border border-amber-200 dark:border-amber-800 mx-4">
        <div className="flex flex-col items-center gap-6 sm:gap-8 text-center animate-slide-up w-full">
          <div className="text-4xl sm:text-5xl md:text-6xl mb-2 sm:mb-4 animate-pulse">🏰</div>
          <h1 className="max-w-4xl text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-tight tracking-tight text-amber-900 dark:text-amber-100 drop-shadow-lg px-4">
            Καλώς ήρθατε στο Quiz της Άλωσης της Κωνσταντινούπολης!
          </h1>
          <p className="max-w-2xl text-base sm:text-lg leading-6 sm:leading-8 text-amber-700 dark:text-amber-300 px-4">
            Επιλέξτε τρόπο παιχνιδιού για να εξερευνήσετε την ιστορία της Άλωσης με διαδραστικό τρόπο.
          </p>
          <div className="flex flex-col gap-4 sm:gap-6 mt-6 sm:mt-8 w-full max-w-sm sm:max-w-md">
            <a
              href="/quiz"
              className="inline-block rounded-lg bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-3 sm:px-8 sm:py-4 text-white font-semibold text-base sm:text-lg hover:from-blue-700 hover:to-blue-900 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Μοναχικό Παιχνίδι 🏆
            </a>
            <a
              href="/create-room"
              className="inline-block rounded-lg bg-gradient-to-r from-green-600 to-green-800 px-6 py-3 sm:px-8 sm:py-4 text-white font-semibold text-base sm:text-lg hover:from-green-700 hover:to-green-900 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Δημιουργία Δωματίου (Multiplayer) 👥
            </a>
            <a
              href="/join-room"
              className="inline-block rounded-lg bg-gradient-to-r from-purple-600 to-purple-800 px-6 py-3 sm:px-8 sm:py-4 text-white font-semibold text-base sm:text-lg hover:from-purple-700 hover:to-purple-900 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Είσοδος σε Δωμάτιο 🔑
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

